import React, { useState, useEffect } from 'react';

const DEFAULT_SETTINGS = {
  thresholdDays: 7,
  email: '',
  digestEnabled: false,
  serverUrl: 'http://localhost:3000',
};

export default function SettingsPanel({ isOpen, onToggle }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);

  // Load settings from chrome.storage.sync on mount
  useEffect(() => {
    chrome.storage.sync.get(
      ['thresholdDays', 'email', 'digestEnabled', 'serverUrl'],
      (result) => {
        setSettings((prev) => ({ ...prev, ...result }));
      }
    );
  }, []);

  function handleChange(key, value) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    chrome.storage.sync.set(settings, () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  const fillPct = ((settings.thresholdDays - 1) / 29) * 100;

  return (
    <div className="settings-panel">
      <div
        className="settings-toggle"
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => e.key === 'Enter' && onToggle()}
        id="settings-toggle-btn"
        aria-expanded={isOpen}
        aria-controls="settings-body"
      >
        <span>⚙️ Settings</span>
        <span className={`settings-toggle-icon ${isOpen ? 'open' : ''}`}>▼</span>
      </div>

      {isOpen && (
        <div className="settings-body" id="settings-body">
          {/* Threshold slider */}
          <div className="settings-row">
            <div className="settings-label-row">
              <span className="settings-label">Age Threshold</span>
              <span className="settings-value">{settings.thresholdDays} days</span>
            </div>
            <input
              id="threshold-slider"
              type="range"
              min={1}
              max={30}
              value={settings.thresholdDays}
              className="settings-slider"
              style={{ '--fill': `${fillPct}%` }}
              onChange={(e) => handleChange('thresholdDays', Number(e.target.value))}
            />
          </div>

          {/* Email input */}
          <div className="settings-row">
            <span className="settings-label">Email for Digest</span>
            <input
              id="email-input"
              type="email"
              className="settings-input"
              placeholder="you@example.com"
              value={settings.email}
              onChange={(e) => handleChange('email', e.target.value)}
            />
          </div>

          {/* Weekly digest toggle */}
          <div className="settings-row">
            <div className="settings-toggle-row">
              <span className="settings-label">Weekly Digest Email</span>
              <label className="toggle-switch" htmlFor="digest-toggle" title="Enable weekly email digest">
                <input
                  id="digest-toggle"
                  type="checkbox"
                  checked={settings.digestEnabled}
                  onChange={(e) => handleChange('digestEnabled', e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>
          </div>

          {/* Server URL */}
          <div className="settings-row">
            <span className="settings-label">Server URL</span>
            <input
              id="server-url-input"
              type="url"
              className="settings-input"
              placeholder="http://localhost:3000"
              value={settings.serverUrl}
              onChange={(e) => handleChange('serverUrl', e.target.value)}
            />
          </div>

          {/* Save button */}
          <button
            id="save-settings-btn"
            className="settings-save-btn"
            onClick={handleSave}
          >
            Save Settings
          </button>

          {saved && <p className="settings-saved">✓ Settings saved!</p>}
        </div>
      )}
    </div>
  );
}
