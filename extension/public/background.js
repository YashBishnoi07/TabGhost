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

// ─── Tab Lifecycle ───────────────────────────────────────────────────────────

chrome.tabs.onCreated.addListener(async (tab) => {
  const { tabData = {} } = await storageGet('tabData');
  tabData[tab.id] = {
    openedAt: Date.now(),
    url: tab.url || tab.pendingUrl || '',
    title: tab.title || '',
  };
  await storageSet({ tabData });
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!changeInfo.url && !changeInfo.title) return;
  const { tabData = {} } = await storageGet('tabData');
  if (!tabData[tabId]) {
    // Tab existed before extension was installed — seed it
    tabData[tabId] = { openedAt: Date.now(), url: tab.url || '', title: tab.title || '' };
  } else {
    if (changeInfo.url) tabData[tabId].url = changeInfo.url;
    if (changeInfo.title) tabData[tabId].title = changeInfo.title;
  }
  await storageSet({ tabData });
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const { tabData = {} } = await storageGet('tabData');
  delete tabData[tabId];
  await storageSet({ tabData });
});

// ─── On Installed — Seed All Open Tabs ──────────────────────────────────────

chrome.runtime.onInstalled.addListener(async () => {
  const tabs = await chrome.tabs.query({});
  const { tabData = {} } = await storageGet('tabData');
  const now = Date.now();
  for (const tab of tabs) {
    if (!tabData[tab.id]) {
      tabData[tab.id] = {
        openedAt: now,
        url: tab.url || tab.pendingUrl || '',
        title: tab.title || '',
      };
    }
  }
  await storageSet({ tabData });

  // Create the weekly digest alarm
  chrome.alarms.create('weekly-digest', { periodInMinutes: 10080 });

  console.log('[TabGhost] Installed — seeded', tabs.length, 'tabs');
});

// ─── Message Handler ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_TAB_AGE') {
    handleGetTabAge(sender.tab?.id, sendResponse);
    return true; // async response
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
