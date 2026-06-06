// server.js — TabGhost Email Digest Server
// Express + better-sqlite3 + Nodemailer
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { saveDigest } = require('./db');
const { sendDigestEmail } = require('./mailer');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(cors());
app.use(express.json());

// ─── Health check ─────────────────────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'TabGhost', timestamp: new Date().toISOString() });
});

// ─── POST /send-digest ────────────────────────────────────────────────────────

/**
 * Body: {
 *   email: string,
 *   tabs: [{ title: string, url: string, ageDays: number }]
 * }
 */
app.post('/send-digest', async (req, res) => {
  const { email, tabs } = req.body;

  // Validation
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'Invalid email address' });
  }
  if (!Array.isArray(tabs) || tabs.length === 0) {
    return res.status(400).json({ error: 'tabs must be a non-empty array' });
  }

  // Sort by ageDays descending, take top 10
  const topTabs = tabs
    .filter((t) => t.url && typeof t.url === 'string')
    .sort((a, b) => (b.ageDays || 0) - (a.ageDays || 0))
    .slice(0, 10);

  if (topTabs.length === 0) {
    return res.status(400).json({ error: 'No valid tabs provided' });
  }

  try {
    // Send email
    const info = await sendDigestEmail(email, topTabs);
    console.log(`[TabGhost] Digest sent to ${email}:`, info.messageId);

    // Save to SQLite
    const record = await saveDigest(email, topTabs);
    console.log(`[TabGhost] Saved digest record #${record.lastInsertRowid}`);

    return res.json({
      ok: true,
      messageId: info.messageId,
      digestId: record.lastInsertRowid,
      tabsSent: topTabs.length,
    });
  } catch (err) {
    console.error('[TabGhost] Error sending digest:', err);
    return res.status(500).json({
      error: 'Failed to send digest email',
      detail: err.message,
    });
  }
});

// ─── Start server ─────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n👻 TabGhost server running on http://localhost:${PORT}`);
  console.log(`   POST /send-digest — send weekly email digest`);
  console.log(`   GET  /health      — health check\n`);
});
