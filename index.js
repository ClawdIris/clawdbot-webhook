const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Your verify token - must match what you enter in Meta Developer Dashboard
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'clawdbot_verify_2024';

// Store recent events in memory (last 50)
const recentEvents = [];
const MAX_EVENTS = 50;

function logEvent(type, data) {
  const event = {
    type,
    data,
    timestamp: new Date().toISOString()
  };
  recentEvents.unshift(event);
  if (recentEvents.length > MAX_EVENTS) recentEvents.pop();
  console.log(`📩 [${type}]`, JSON.stringify(data, null, 2));
}

app.use(express.json());

// ============================================
// WEBHOOK VERIFICATION (GET request)
// Meta sends this to verify your endpoint
// ============================================
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

// ============================================
// WEBHOOK EVENTS (POST request)
// Meta sends real-time events here
// ============================================
app.post('/webhook', (req, res) => {
  const body = req.body;

  // Log the raw event
  logEvent('webhook_raw', body);

  // Instagram messaging events
  if (body.object === 'instagram') {
    body.entry?.forEach(entry => {
      if (entry.messaging) {
        entry.messaging.forEach(event => {
          if (event.message) {
            logEvent('instagram_dm', {
              sender: event.sender?.id,
              message: event.message.text || '[media]',
              mid: event.message.mid
            });
          }
        });
      }

      if (entry.changes) {
        entry.changes.forEach(change => {
          logEvent('instagram_change', {
            field: change.field,
            value: change.value
          });
        });
      }
    });
  }

  // Facebook Page messaging events
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

  // Always respond 200 quickly to acknowledge receipt
  res.sendStatus(200);
});

// ============================================
// VIEW RECENT EVENTS (for debugging)
// ============================================
app.get('/events', (req, res) => {
  res.json({
    total: recentEvents.length,
    server_uptime: process.uptime().toFixed(0) + 's',
    events: recentEvents
  });
});

// Health check endpoint
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
});
