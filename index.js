const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Your verify token - must match what you enter in Meta Developer Dashboard
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'clawdbot_verify_2024';

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
    return res.status(200).send(challenge);
  }
  console.log('❌ Webhook verification failed');
  return res.sendStatus(403);
});

// ============================================
// WEBHOOK EVENTS (POST request)
// Meta sends real-time events here
// ============================================
app.post('/webhook', (req, res) => {
  const body = req.body;

  console.log('📩 Incoming webhook event:', JSON.stringify(body, null, 2));

  // Instagram messaging events
  if (body.object === 'instagram') {
    body.entry?.forEach(entry => {
      // Handle DMs
      if (entry.messaging) {
        entry.messaging.forEach(event => {
          if (event.message) {
            console.log('💬 New DM from:', event.sender?.id);
            console.log('   Message:', event.message.text || '[media]');
            // TODO: Add your ClawdBot AI response logic here
          }
        });
      }

      // Handle comments
      if (entry.changes) {
        entry.changes.forEach(change => {
          if (change.field === 'comments') {
            console.log('💬 New comment:', change.value);
            // TODO: Add your comment response logic here
          }
          if (change.field === 'mentions') {
            console.log('📢 New mention:', change.value);
          }
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
            console.log('💬 New FB Message from:', event.sender?.id);
            console.log('   Message:', event.message.text || '[media]');
            // TODO: Add your ClawdBot AI response logic here
          }
        });
      }
    });
  }

  // Always respond 200 quickly to acknowledge receipt
  res.sendStatus(200);
});

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'ClawdBot Social Manager webhook is running 🤖',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`🚀 ClawdBot webhook server running on port ${PORT}`);
  console.log(`   Webhook URL: https://your-domain.com/webhook`);
  console.log(`   Verify Token: ${VERIFY_TOKEN}`);
});
