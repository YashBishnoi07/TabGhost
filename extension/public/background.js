// background.js — TabGhost Service Worker (MV3)
// CRITICAL: No in-memory state. All state lives in chrome.storage.local.
// Service workers are ephemeral — they are killed when idle and revived on events.

// ─── Helpers ────────────────────────────────────────────────────────────────

function storageGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}

function storageSet(data) {
  return new Promise((resolve) => chrome.storage.local.set(data, resolve));
}

function syncGet(keys) {
  return new Promise((resolve) => chrome.storage.sync.get(keys, resolve));
}

const DEFAULT_THRESHOLD_DAYS = 7;

// ─── URL History Helpers ─────────────────────────────────────────────────────
// urlHistory maps URL → { openedAt, dayStamp }
// dayStamp = "YYYY-MM-DD" — the calendar day openedAt was recorded.
// If dayStamp !== today, the entry is stale (past midnight) and gets reset.

function todayStamp() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getNextMidnight() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Given a URL, return the openedAt timestamp to use.
 * - If urlHistory has a valid entry for today → restore it (persistent across closes)
 * - Otherwise → Date.now() (fresh start for today)
 * Also saves the resolved openedAt back into urlHistory.
 */
async function resolveOpenedAt(url) {
  if (!url || url.startsWith('chrome://') || url.startsWith('about:')) {
    return Date.now();
  }

  const today = todayStamp();
  const { urlHistory = {} } = await storageGet('urlHistory');
  const entry = urlHistory[url];

  let openedAt;
  if (entry && entry.dayStamp === today) {
    // Restore previous session's time for this URL (same calendar day)
    openedAt = entry.openedAt;
  } else {
    // New day or never seen — start fresh
    openedAt = Date.now();
  }

  // Persist back so the URL is tracked
  urlHistory[url] = { openedAt, dayStamp: today };
  await storageSet({ urlHistory });

  return openedAt;
}

/**
 * Update urlHistory when a tab's URL changes (navigation).
 * Keeps the OLD url entry intact; resolves openedAt for the NEW url.
 */
async function updateUrlHistory(newUrl) {
  if (!newUrl || newUrl.startsWith('chrome://') || newUrl.startsWith('about:')) {
    return Date.now();
  }
  return resolveOpenedAt(newUrl);
}

// ─── Tab Lifecycle ───────────────────────────────────────────────────────────

chrome.tabs.onCreated.addListener(async (tab) => {
  const url = tab.url || tab.pendingUrl || '';
  const openedAt = await resolveOpenedAt(url);

  const { tabData = {} } = await storageGet('tabData');
  tabData[tab.id] = { openedAt, url, title: tab.title || '' };
  await storageSet({ tabData });
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!changeInfo.url && !changeInfo.title) return;

  const { tabData = {} } = await storageGet('tabData');

  if (!tabData[tabId]) {
    // Tab existed before extension was installed — seed it
    const url = tab.url || '';
    const openedAt = await resolveOpenedAt(url);
    tabData[tabId] = { openedAt, url, title: tab.title || '' };
  } else {
    if (changeInfo.url) {
      // Tab navigated to a new URL — resolve its history independently
      const openedAt = await updateUrlHistory(changeInfo.url);
      tabData[tabId].url = changeInfo.url;
      tabData[tabId].openedAt = openedAt;
    }
    if (changeInfo.title) {
      tabData[tabId].title = changeInfo.title;
      // Also update title in urlHistory
      const url = tabData[tabId].url;
      if (url) {
        const today = todayStamp();
        const { urlHistory = {} } = await storageGet('urlHistory');
        if (urlHistory[url]) {
          urlHistory[url].title = changeInfo.title;
          await storageSet({ urlHistory });
        }
      }
    }
  }

  await storageSet({ tabData });
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const { tabData = {} } = await storageGet('tabData');

  // IMPORTANT: Do NOT delete from urlHistory — we want the openedAt to persist
  // so the next time this URL is opened today, time continues from where it left off.
  // urlHistory is only cleared by the midnight alarm.

  delete tabData[tabId];
  await storageSet({ tabData });
});

// ─── On Installed — Seed All Open Tabs ──────────────────────────────────────

chrome.runtime.onInstalled.addListener(async () => {
  const tabs = await chrome.tabs.query({});
  const { tabData = {} } = await storageGet('tabData');

  for (const tab of tabs) {
    if (!tabData[tab.id]) {
      const url = tab.url || tab.pendingUrl || '';
      const openedAt = await resolveOpenedAt(url);
      tabData[tab.id] = { openedAt, url, title: tab.title || '' };
    }
  }
  await storageSet({ tabData });

  // Weekly digest alarm
  chrome.alarms.create('weekly-digest', { periodInMinutes: 10080 });

  // Midnight reset alarm — fires at next 12:00 AM, then every 24h
  chrome.alarms.create('midnight-reset', {
    when: getNextMidnight(),
    periodInMinutes: 1440,
  });

  console.log('[TabGhost] Installed — seeded', tabs.length, 'tabs');
  console.log('[TabGhost] Next midnight reset at:', new Date(getNextMidnight()).toLocaleString());
});

// ─── Message Handler ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_TAB_AGE') {
    handleGetTabAge(sender.tab?.id, sendResponse);
    return true;
  }

  if (message.type === 'SNOOZE_TAB') {
    handleSnoozeTab(message).then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message.type === 'GET_ALL_TABS') {
    handleGetAllTabs(sendResponse);
    return true;
  }
});

async function handleGetTabAge(tabId, sendResponse) {
  if (!tabId) { sendResponse(null); return; }
  const { tabData = {} } = await storageGet('tabData');
  const { thresholdDays = DEFAULT_THRESHOLD_DAYS } = await syncGet('thresholdDays');
  const entry = tabData[tabId];
  if (entry) {
    sendResponse({ openedAt: entry.openedAt, threshold: thresholdDays * 86400000 });
  } else {
    sendResponse(null);
  }
}

async function handleGetAllTabs(sendResponse) {
  const { tabData = {} } = await storageGet('tabData');
  sendResponse(tabData);
}

// ─── Snooze ──────────────────────────────────────────────────────────────────

async function handleSnoozeTab({ tabId, tabUrl, wakeTime }) {
  const { snoozed = [] } = await storageGet('snoozed');
  snoozed.push({ url: tabUrl, wakeAt: wakeTime });
  await storageSet({ snoozed });

  const alarmName = `snooze-${wakeTime}`;
  chrome.alarms.create(alarmName, { when: wakeTime });

  if (tabId) {
    chrome.tabs.remove(tabId);
  }
}

// ─── Alarm Handler ───────────────────────────────────────────────────────────

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name.startsWith('snooze-')) {
    await handleSnoozeAlarm();
  } else if (alarm.name === 'midnight-reset') {
    await handleMidnightReset();
  } else if (alarm.name === 'weekly-digest') {
    await handleWeeklyDigest();
  }
});

async function handleSnoozeAlarm() {
  const now = Date.now();
  const { snoozed = [] } = await storageGet('snoozed');
  const toWake = snoozed.filter((s) => s.wakeAt <= now);
  const remaining = snoozed.filter((s) => s.wakeAt > now);

  for (const item of toWake) {
    if (item.url) {
      chrome.tabs.create({ url: item.url, active: false });
    }
  }

  await storageSet({ snoozed: remaining });
}

// ─── Midnight Reset ───────────────────────────────────────────────────────────
// Fires at 12:00 AM every day.
// Clears urlHistory so all tab ages reset to 0 for the new day.
// Also resets openedAt for any currently open tabs.

async function handleMidnightReset() {
  const now = Date.now();
  console.log('[TabGhost] Midnight reset —', new Date(now).toLocaleString());

  // Clear URL history — new day, all timers start fresh
  await storageSet({ urlHistory: {} });

  // Reset all currently open tabs' openedAt to now
  const { tabData = {} } = await storageGet('tabData');
  const today = todayStamp();
  for (const tabId of Object.keys(tabData)) {
    tabData[tabId].openedAt = now;
  }
  await storageSet({ tabData });

  console.log('[TabGhost] Reset', Object.keys(tabData).length, 'open tabs for new day');
}

// ─── Weekly Digest ───────────────────────────────────────────────────────────

async function handleWeeklyDigest() {
  const { email, digestEnabled, serverUrl = 'http://localhost:3000' } = await syncGet([
    'email',
    'digestEnabled',
    'serverUrl',
  ]);

  if (!email || !digestEnabled) return;

  const { tabData = {} } = await storageGet('tabData');
  const now = Date.now();
  const tabs = Object.values(tabData).map((t) => ({
    title: t.title || t.url,
    url: t.url,
    ageDays: Math.floor((now - t.openedAt) / 86400000),
  }));

  try {
    await fetch(`${serverUrl}/send-digest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, tabs }),
    });
    console.log('[TabGhost] Weekly digest sent');
  } catch (err) {
    console.error('[TabGhost] Failed to send digest:', err);
  }
}
