<div align="center">

# 👻 TabGhost

**See how long every browser tab has been open. Close your tab graveyard.**

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-blueviolet)
![Node.js](https://img.shields.io/badge/Node.js-Backend-339933?logo=nodedotjs&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

</div>

---

## What is TabGhost?

TabGhost is a Chrome extension that tracks how long every browser tab has been open and helps you close your **tab graveyard** — those forgotten tabs from 3 weeks ago.

### Features

- 🕐 **Age Badge** — A colored badge on every webpage shows how long that tab has been open (`5m`, `3h`, `2d`)
- 🎨 **Color Coded** — Green (fresh) → Amber (aging) → Red (ancient)
- 💀 **Bulk Close** — Close all tabs over your threshold in one click
- 💤 **Snooze** — Close a tab now, reopen it Tomorrow 9am / In 3 days / Next Monday
- ⚙️ **Settings** — Set your own age threshold (1–30 days)
- 📧 **Weekly Email Digest** — Get a weekly email listing your oldest tabs *(requires the Node.js server)*

---

## Screenshots

> *Coming soon — load the extension and take your own!*

---

## Project Structure

```
tabghost/
├── extension/        ← Chrome Extension (Vite + React)
│   ├── public/
│   │   ├── manifest.json     ← Chrome MV3 manifest
│   │   ├── background.js     ← Service worker (tab tracking, snooze, alarms)
│   │   └── content.js        ← Age badge injected on every page
│   ├── src/popup/
│   │   ├── App.jsx           ← Main popup UI
│   │   ├── TabRow.jsx        ← Individual tab row component
│   │   └── SettingsPanel.jsx ← Settings (threshold, email, server URL)
│   └── vite.config.js
│
└── server/           ← Node.js Backend (optional — for email digest)
    ├── server.js     ← Express API
    ├── db.js         ← SQLite database
    ├── mailer.js     ← Email sender (Nodemailer)
    └── .env.example  ← SMTP config template
```

---

## Installation

### Requirements

- [Node.js](https://nodejs.org/) v18 or higher
- Google Chrome browser

---

### Step 1 — Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/tabghost.git
cd tabghost
```

---

### Step 2 — Build the Extension

```bash
cd extension
npm install
npm run build
```

This creates a `dist/` folder — that's what you load into Chrome.

---

### Step 3 — Load into Chrome

1. Open Chrome and go to: `chrome://extensions`
2. Turn on **Developer Mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select the `extension/dist/` folder
5. Pin the 👻 TabGhost icon from the extensions menu

That's it! Visit any webpage and you'll see the age badge in the bottom-right corner.

---

## Using the Extension

### The Age Badge
Every tab shows a small badge in the **bottom-right corner** of the page:

| Badge | Meaning |
|-------|---------|
| 🟢 `5m` | Tab opened 5 minutes ago |
| 🟡 `3h` | Tab opened 3 hours ago |
| 🔴 `2d` | Tab opened 2 days ago (past threshold) |

### The Popup
Click the TabGhost icon in your Chrome toolbar to:
- See all open tabs sorted **oldest first**
- **Close** individual tabs with the ✕ button
- **Snooze** tabs with the 💤 button (picks a time to reopen it)
- **Close All Ancient Tabs** with the bulk close button
- Change your **age threshold** in Settings

### Snooze Options
| Option | When it reopens |
|--------|----------------|
| Tomorrow 9am | Next day at 9:00 AM |
| In 3 days | 72 hours from now |
| Next Monday | Monday at 9:00 AM |

---

## Email Digest (Optional)

The Node.js server sends you a weekly email listing your oldest tabs.

### Step 1 — Configure SMTP

```bash
cd server
cp .env.example .env
```

Open `.env` and fill in your email credentials. See `.env.example` for instructions — it supports **Gmail**, **Mailgun**, and **SendGrid**.

### Step 2 — Start the server

```bash
npm install
npm start
```

Server runs at `http://localhost:3000`

### Step 3 — Enable in the Extension

1. Click the TabGhost icon → open **Settings**
2. Enter your email address
3. Toggle **Weekly Digest Email** ON
4. Make sure **Server URL** is set to `http://localhost:3000`
5. Click **Save Settings**

Every week, TabGhost will automatically email you a summary of your oldest tabs.

> **Deploying for public use?**
> Deploy the `server/` folder to [Railway](https://railway.app), [Render](https://render.com), or [Fly.io](https://fly.io) (all have free tiers). Then update the Server URL in Settings to your deployed URL.

---

## How Tab Tracking Works

- When you **open** a tab → TabGhost records the exact timestamp
- When you **close** a tab → TabGhost removes it from tracking
- When you **install** the extension → all currently open tabs are seeded with the current time
- All data is stored locally in your browser via `chrome.storage.local` — **nothing is sent anywhere** unless you enable the email digest

> **Privacy:** Your tab data never leaves your browser. The email digest only sends tab titles and URLs to *your own server* that you control.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Extension UI | React + Vite |
| Service Worker | Vanilla JS (Chrome MV3) |
| Content Script | Vanilla JS + Shadow DOM |
| Backend | Node.js + Express |
| Database | sql.js (SQLite via WebAssembly) |
| Email | Nodemailer |

---

## Development

### Extension (hot reload not supported for extensions — rebuild after changes)

```bash
cd extension
npm run build    # Rebuild after every change, then reload in chrome://extensions
```

### Server

```bash
cd server
npm run dev      # Uses node --watch for auto-restart
```

---

## Permissions Explained

TabGhost requests these Chrome permissions:

| Permission | Why it's needed |
|-----------|----------------|
| `tabs` | Read tab titles and URLs to display in popup |
| `storage` | Remember when each tab was opened |
| `alarms` | Snooze tabs (reopen at a scheduled time) |
| `scripting` | Inject the age badge onto web pages |
| `<all_urls>` | Show the age badge on every webpage |

---

## Contributing

Pull requests are welcome! If you find a bug or have a feature idea, [open an issue](https://github.com/YOUR_USERNAME/tabghost/issues).

---

## License

MIT — do whatever you want with it.

---

<div align="center">
Made with 👻 by <a href="https://github.com/YOUR_USERNAME">YOUR_USERNAME</a>
</div>
