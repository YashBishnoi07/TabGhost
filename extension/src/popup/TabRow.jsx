import React, { useState, useRef } from 'react';

// ─── Snooze time calculations ────────────────────────────────────────────────

function getTomorrowNineAM() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d.getTime();
}

function getInThreeDays() {
  return Date.now() + 3 * 86400000;
}

function getNextMonday() {
  const d = new Date();
  const day = d.getDay(); // 0=Sun, 1=Mon...
  const daysUntilMonday = day === 1 ? 7 : (8 - day) % 7 || 7;
  d.setDate(d.getDate() + daysUntilMonday);
  d.setHours(9, 0, 0, 0);
  return d.getTime();
}

const SNOOZE_OPTIONS = [
  { label: 'Tomorrow 9am', sub: new Date(getTomorrowNineAM()).toLocaleDateString(), getTime: getTomorrowNineAM },
  { label: 'In 3 days', sub: new Date(getInThreeDays()).toLocaleDateString(), getTime: getInThreeDays },
  { label: 'Next Monday', sub: new Date(getNextMonday()).toLocaleDateString(), getTime: getNextMonday },
];

// ─── TabRow Component ─────────────────────────────────────────────────────────

export default function TabRow({ tab, thresholdMs, onClose, onSnooze }) {
  const [showSnooze, setShowSnooze] = useState(false);
  const [faviconError, setFaviconError] = useState(false);
  const dropdownRef = useRef(null);

  const ageMs = Date.now() - tab.openedAt;
  const agePct = ageMs / thresholdMs;

  function formatAge(ms) {
    const minutes = Math.floor(ms / 60000);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(ms / 3600000);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(ms / 86400000);
    return `${days}d`;
  }

  function getPillClass() {
    if (agePct < 0.33) return 'green';
    if (agePct < 0.66) return 'amber';
    return 'red';
  }

  function getFaviconUrl() {
    if (!tab.url) return null;
    try {
      const origin = new URL(tab.url).origin;
      return `https://www.google.com/s2/favicons?domain=${origin}&sz=32`;
    } catch {
      return null;
    }
  }

  function getDomain() {
    try {
      return new URL(tab.url).hostname.replace('www.', '');
    } catch {
      return tab.url;
    }
  }

  function handleSnoozeOption(getTimeFn) {
    const wakeTime = getTimeFn();
    onSnooze(tab.id, tab.url, wakeTime);
    setShowSnooze(false);
  }

  const faviconUrl = getFaviconUrl();

  return (
    <div className="tab-row" title={tab.title || tab.url}>
      {/* Favicon */}
      {faviconUrl && !faviconError ? (
        <img
          className="tab-favicon"
          src={faviconUrl}
          alt=""
          onError={() => setFaviconError(true)}
        />
      ) : (
        <div className="tab-favicon-fallback">🌐</div>
      )}

      {/* Info */}
      <div className="tab-info">
        <div className="tab-title">{tab.title || 'Untitled'}</div>
        <div className="tab-url">{getDomain()}</div>
      </div>

      {/* Age pill */}
      <div className={`tab-age-pill ${getPillClass()}`}>
        {formatAge(ageMs)}
      </div>

      {/* Actions */}
      <div className="tab-actions">
        {/* Snooze */}
        <div style={{ position: 'relative' }}>
          <button
            id={`snooze-btn-${tab.id}`}
            className="btn-tab-action snooze"
            title="Snooze tab"
            onClick={(e) => { e.stopPropagation(); setShowSnooze((v) => !v); }}
          >
            💤
          </button>
          {showSnooze && (
            <div className="snooze-dropdown" ref={dropdownRef}>
              {SNOOZE_OPTIONS.map((opt) => (
                <button
                  key={opt.label}
                  className="snooze-option"
                  onClick={(e) => { e.stopPropagation(); handleSnoozeOption(opt.getTime); }}
                >
                  {opt.label}
                  <span>{opt.sub}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Close */}
        <button
          id={`close-btn-${tab.id}`}
          className="btn-tab-action close"
          title="Close tab"
          onClick={(e) => { e.stopPropagation(); onClose(tab.id); }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
