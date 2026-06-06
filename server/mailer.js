// mailer.js — Nodemailer helper for TabGhost digest emails
const nodemailer = require('nodemailer');
require('dotenv').config();

// ─── Transporter ─────────────────────────────────────────────────────────────

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for others
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

// ─── Age color helper ─────────────────────────────────────────────────────────

function ageColor(ageDays, thresholdDays = 7) {
  const pct = ageDays / thresholdDays;
  if (pct < 0.33) return '#22c55e';
  if (pct < 0.66) return '#f59e0b';
  return '#ef4444';
}

// ─── Build HTML email body ────────────────────────────────────────────────────

function buildEmailHtml(tabs) {
  const rows = tabs
    .map(
      (tab, i) => `
      <tr style="border-bottom: 1px solid #1e2533;">
        <td style="padding: 12px 16px; color: #8892a4; font-size: 13px; text-align: center;">${i + 1}</td>
        <td style="padding: 12px 8px; text-align: center;">
          <img
            src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(tab.url)}&sz=32"
            width="16" height="16" alt=""
            style="border-radius: 3px;"
          />
        </td>
        <td style="padding: 12px 16px; max-width: 280px;">
          <a
            href="${tab.url}"
            style="color: #c4b5fd; text-decoration: none; font-size: 13px; font-weight: 500; display: block;
                   white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"
            title="${tab.title}"
          >
            ${tab.title || tab.url}
          </a>
          <span style="color: #4a5568; font-size: 11px; display: block; margin-top: 2px;">
            ${new URL(tab.url).hostname}
          </span>
        </td>
        <td style="padding: 12px 16px; text-align: right;">
          <span style="
            background: ${ageColor(tab.ageDays)}22;
            color: ${ageColor(tab.ageDays)};
            border: 1px solid ${ageColor(tab.ageDays)}44;
            border-radius: 20px;
            padding: 3px 10px;
            font-size: 12px;
            font-weight: 700;
            white-space: nowrap;
          ">${tab.ageDays}d old</span>
        </td>
      </tr>
    `
    )
    .join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>TabGhost Weekly Digest</title>
</head>
<body style="margin:0; padding:0; background:#0d0f14; font-family: system-ui, -apple-system, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0f14; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%;">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #111827, #1a1f2e); border-radius: 16px 16px 0 0;
                        padding: 32px 32px 24px; border: 1px solid rgba(255,255,255,0.08);">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="font-size: 32px; margin: 0 0 8px;">👻</p>
                    <h1 style="color: #c4b5fd; font-size: 22px; font-weight: 700; margin: 0 0 6px; letter-spacing: -0.5px;">
                      Your Tab Graveyard
                    </h1>
                    <p style="color: #8892a4; font-size: 14px; margin: 0;">
                      Weekly digest — ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                  </td>
                  <td align="right">
                    <div style="background: rgba(139,92,246,0.15); border: 1px solid rgba(139,92,246,0.3);
                                border-radius: 12px; padding: 12px 20px; text-align: center;">
                      <p style="color: #c4b5fd; font-size: 28px; font-weight: 700; margin: 0;">${tabs.length}</p>
                      <p style="color: #8892a4; font-size: 11px; margin: 4px 0 0;">tabs need attention</p>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Table -->
          <tr>
            <td style="background: #111827; border-left: 1px solid rgba(255,255,255,0.08);
                        border-right: 1px solid rgba(255,255,255,0.08);">
              <table width="100%" cellpadding="0" cellspacing="0">
                <thead>
                  <tr style="background: rgba(255,255,255,0.03);">
                    <th style="padding: 12px 16px; color: #4a5568; font-size: 11px; text-transform: uppercase;
                                letter-spacing: 0.5px; text-align: center; width: 40px;">#</th>
                    <th style="padding: 12px 8px; width: 32px;"></th>
                    <th style="padding: 12px 16px; color: #4a5568; font-size: 11px; text-transform: uppercase;
                                letter-spacing: 0.5px; text-align: left;">Tab</th>
                    <th style="padding: 12px 16px; color: #4a5568; font-size: 11px; text-transform: uppercase;
                                letter-spacing: 0.5px; text-align: right; white-space: nowrap;">Age</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows}
                </tbody>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background: #0d1017; border-radius: 0 0 16px 16px; padding: 20px 32px;
                        border: 1px solid rgba(255,255,255,0.08); border-top: none; text-align: center;">
              <p style="color: #4a5568; font-size: 12px; margin: 0 0 8px;">
                Sent by <strong style="color: #8892a4;">TabGhost</strong> Chrome Extension
              </p>
              <p style="color: #2d3748; font-size: 11px; margin: 0;">
                Open the extension popup to close or snooze these tabs.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

// ─── Send digest ──────────────────────────────────────────────────────────────

async function sendDigestEmail(toEmail, tabs) {
  const transporter = createTransporter();

  const subject = `Your tab graveyard this week — ${tabs.length} tabs need attention`;
  const html = buildEmailHtml(tabs);

  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: toEmail,
    subject,
    html,
  });

  return info;
}

module.exports = { sendDigestEmail };
