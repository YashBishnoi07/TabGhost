import React, { useState, useEffect, useCallback } from 'react';
import TabRow from './TabRow.jsx';
import SettingsPanel from './SettingsPanel.jsx';

const DEFAULT_THRESHOLD_DAYS = 7;
const MS_PER_DAY = 86400000;

// ─── Chrome API helpers (with fallback for dev outside extension) ─────────────

function chromeStorageGet(keys) {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(keys, resolve);
    } else {
      resolve({});
    }
  });
}

function chromeSyncGet(keys) {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.sync.get(keys, resolve);
    } else {
      resolve({});
    }
  });
}

function chromeTabsQuery(queryInfo) {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query(queryInfo, resolve);
    } else {
      resolve([]);
    }
  });
}

function chromeTabsRemove(tabId) {
  if (typeof chrome !== 'undefined' && chrome.tabs) {
    chrome.tabs.remove(tabId);
  }
}

function chromeSendMessage(msg) {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage(msg, resolve);
    } else {
      resolve(null);
    }
  });
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [tabs, setTabs] = useState([]);
  const [thresholdDays, setThresholdDays] = useState(DEFAULT_THRESHOLD_DAYS);
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const thresholdMs = thresholdDays * MS_PER_DAY;

  // ─── Load tabs ─────────────────────────────────────────────────────────────

  const loadTabs = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Get stored tab age data
      const { tabData = {} } = await chromeStorageGet('tabData');

      // 2. Get live tabs
      const liveTabs = await chromeTabsQuery({});

      // 3. Merge: keep only live tabs, enrich with stored openedAt
      const merged = liveTabs
        .filter((t) => !t.url.startsWith('chrome://') || tabData[t.id])
        .map((liveTab) => {
          const stored = tabData[liveTab.id];
          return {
            id: liveTab.id,
            title: liveTab.title || stored?.title || 'Untitled',
            url: liveTab.url || stored?.url || '',
            openedAt: stored?.openedAt ?? Date.now(),
            favIconUrl: liveTab.favIconUrl || null,
          };
        });

      // 4. Sort oldest first
      merged.sort((a, b) => a.openedAt - b.openedAt);

      setTabs(merged);

      // 5. Load threshold from sync
      const { thresholdDays: td = DEFAULT_THRESHOLD_DAYS } = await chromeSyncGet('thresholdDays');
      setThresholdDays(td);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTabs();
  }, [loadTabs]);

  // Reload when settings close (threshold may have changed)
  function handleSettingsToggle() {
    setSettingsOpen((v) => {
      if (v) loadTabs(); // refresh on close
      return !v;
    });
  }

  // ─── Actions ───────────────────────────────────────────────────────────────

  function handleClose(tabId) {
    chromeTabsRemove(tabId);
    setTabs((prev) => prev.filter((t) => t.id !== tabId));
  }

  function handleSnooze(tabId, tabUrl, wakeTime) {
    chromeSendMessage({ type: 'SNOOZE_TAB', tabId, tabUrl, wakeTime });
    setTabs((prev) => prev.filter((t) => t.id !== tabId));
  }

  function handleBulkClose() {
    const ancient = tabs.filter((t) => Date.now() - t.openedAt > thresholdMs);
    ancient.forEach((t) => chromeTabsRemove(t.id));
    setTabs((prev) => prev.filter((t) => Date.now() - t.openedAt <= thresholdMs));
  }

  // ─── Derived state ─────────────────────────────────────────────────────────

  const ancientCount = tabs.filter((t) => Date.now() - t.openedAt > thresholdMs).length;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Header */}
      <header className="header">
        <div className="header-brand">
          <span className="header-ghost" aria-hidden="true">👻</span>
          <h1 className="header-title">TabGhost</h1>
        </div>
        <div className="header-actions">
          <span className="header-count">{tabs.length} tab{tabs.length !== 1 ? 's' : ''}</span>
          <button
            id="refresh-btn"
            className="btn-icon"
            title="Refresh"
            onClick={loadTabs}
            aria-label="Refresh tab list"
          >
            ↻
          </button>
          <button
            id="settings-btn"
            className={`btn-icon ${settingsOpen ? 'active' : ''}`}
            title="Settings"
            onClick={handleSettingsToggle}
            aria-label="Open settings"
          >
            ⚙
          </button>
        </div>
      </header>

      {/* Bulk action bar — shown only if there are ancient tabs */}
      {ancientCount > 0 && (
        <div className="bulk-bar">
          <span className="bulk-bar-info">
            <strong>{ancientCount}</strong> tab{ancientCount !== 1 ? 's' : ''} over {thresholdDays}d threshold
          </span>
          <button
            id="bulk-close-btn"
            className="btn-bulk-close"
            onClick={handleBulkClose}
            title={`Close ${ancientCount} ancient tabs`}
          >
            💀 Close All
          </button>
        </div>
      )}

      {/* Tab list */}
      <main className="tab-list" role="list" aria-label="Open tabs">
        {loading ? (
          <div className="loading">
            <div className="spinner" aria-hidden="true" />
            Loading tabs…
          </div>
        ) : tabs.length === 0 ? (
          <div className="tab-list-empty">
            <span className="empty-icon">👻</span>
            <p>No tabs to haunt.</p>
            <p>You're all caught up!</p>
          </div>
        ) : (
          tabs.map((tab) => (
            <TabRow
              key={tab.id}
              tab={tab}
              thresholdMs={thresholdMs}
              onClose={handleClose}
              onSnooze={handleSnooze}
            />
          ))
        )}
      </main>

      {/* Settings panel */}
      <SettingsPanel isOpen={settingsOpen} onToggle={handleSettingsToggle} />
    </>
  );
}
