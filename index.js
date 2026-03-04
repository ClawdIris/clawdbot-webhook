const express = require('express');
const https = require('https');
const app = express();
const PORT = process.env.PORT || 3000;

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'clawdbot_verify_2024';
const PAGE_TOKEN = process.env.PAGE_TOKEN;
const PAGE_ID = process.env.PAGE_ID || '1014276075103060';
const OWN_IG_ID = process.env.OWN_IG_ID || '17841449856710671';

const recentEvents = [];
const MAX_EVENTS = 50;
const repliedMids = new Set();

function logEvent(type, data) {
  const event = { type, data, timestamp: new Date().toISOString() };
  recentEvents.unshift(event);
  if (recentEvents.length > MAX_EVENTS) recentEvents.pop();
  console.log(`📩 [${type}]`, JSON.stringify(data, null, 2));
}

function sendReply(recipientId, message) {
  if (!PAGE_TOKEN) {
    console.log('⚠️ PAGE_TOKEN not set — cannot send reply');
    return;
  }

  const body = JSON.stringify({
    recipient: { id: recipientId },
    message: { text: message }
  });

  const options = {
    hostname: 'graph.facebook.com',
    path: `/v19.0/me/messages?access_token=${PAGE_TOKEN}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    }
  };

  const req = https.request(options, res => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      const parsed = JSON.parse(data);
      if (parsed.error) {
        console.log('❌ Reply failed:', JSON.stringify(parsed.error));
        logEvent('reply_error', { recipientId, error: parsed.error });
      } else {
        console.log('✅ Reply sent to', recipientId);
        logEvent('reply_sent', { recipientId, message });
      }
    });
  });

  req.on('error', err => {
    console.log('❌ Reply request error:', err.message);
    logEvent('reply_error', { recipientId, error: err.message });
  });

  req.write(body);
  req.end();
}

function buildReply() {
  return `Hey! Thanks so much for reaching out to Reel House. We love hearing from couples planning their big day.\n\nWe'd love to learn more about your vision. Could you share a little about your event — when is it, where, and what's most important to you when it comes to your wedding film?\n\nWe're here to make sure every moment is captured the way it deserves to be. 🎬`;
}

app.use(express.json());

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Webhook verified successfully!');
    logEvent('verification', { status: 'success' });
    return res.status(200).send(challenge);
  }
  console.log('❌ Webhook verification failed');
  logEvent('verification', { status: 'failed', mode, token });
  return res.sendStatus(403);
});

app.post('/webhook', (req, res) => {
  const body = req.body;
  logEvent('webhook_raw', body);

  if (body.object === 'instagram') {
    body.entry?.forEach(entry => {
      if (entry.messaging) {
        entry.messaging.forEach(event => {
          const senderId = event.sender?.id;
          const mid = event.message?.mid;

          if (senderId === OWN_IG_ID) return;
          if (event.message?.is_echo) return;
          if (!event.message) return;
          if (repliedMids.has(mid)) return;

          const msgText = event.message.text || '[media]';
          logEvent('instagram_dm', { sender: senderId, message: msgText, mid });

          repliedMids.add(mid);
          sendReply(senderId, buildReply());
        });
      }

      if (entry.changes) {
        entry.changes.forEach(change => {
          logEvent('instagram_change', { field: change.field, value: change.value });
        });
      }
    });
  }

  if (body.object === 'page') {
    body.entry?.forEach(entry => {
      if (entry.messaging) {
        entry.messaging.forEach(event => {
          if (event.message) {
            logEvent('page_message', {
              sender: event.sender?.id,
              message: event.message.text || '[media]',
              mid: event.message.mid
            });
          }
        });
      }
    });
  }

  res.sendStatus(200);
});

app.get('/events', (req, res) => {
  res.json({
    total: recentEvents.length,
    server_uptime: process.uptime().toFixed(0) + 's',
    events: recentEvents
  });
});

app.get('/', (req, res) => {
  res.json({
    status: 'ClawdBot Social Manager webhook is running 🤖',
    timestamp: new Date().toISOString(),
    events_received: recentEvents.length,
    uptime: process.uptime().toFixed(0) + 's'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 ClawdBot webhook server running on port ${PORT}`);
  console.log(`   Verify Token: ${VERIFY_TOKEN}`);
  console.log(`   Page Token: ${PAGE_TOKEN ? '✅ set' : '⚠️ NOT SET'}`);
});
