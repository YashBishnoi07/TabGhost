// content.js — TabGhost Content Script
// Runs on every page. Creates an age badge using Shadow DOM (style-isolated).
// Also attempts to overlay a colored dot on the favicon (with CSP fallback).

(function () {
  'use strict';

  // Don't double-inject
  if (window.__tabGhostInjected) return;
  window.__tabGhostInjected = true;

  // ─── Constants ─────────────────────────────────────────────────────────────

  const BADGE_ID = 'tabghost-host';
  const POLL_INTERVAL_MS = 60000; // refresh badge every minute

  // ─── Format age as human-readable string ───────────────────────────────────

  function formatAge(ms) {
    const minutes = Math.floor(ms / 60000);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(ms / 3600000);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(ms / 86400000);
    return `${days}d`;
  }

  // ─── Determine badge color based on threshold percentage ───────────────────

  function getColor(ageMs, thresholdMs) {
    const pct = ageMs / thresholdMs;
    if (pct < 0.33) return { bg: '#22c55e', text: '#fff' }; // green
    if (pct < 0.66) return { bg: '#f59e0b', text: '#000' }; // amber
    return { bg: '#ef4444', text: '#fff' };                  // red
  }

  // ─── Create or update the Shadow DOM badge ─────────────────────────────────

  let shadowRoot = null;
  let badgeEl = null;

  function ensureBadge() {
    let host = document.getElementById(BADGE_ID);
    if (!host) {
      host = document.createElement('div');
      host.id = BADGE_ID;
      host.style.cssText = `
        position: fixed;
        bottom: 12px;
        right: 12px;
        z-index: 999999;
        pointer-events: none;
        font-family: system-ui, -apple-system, sans-serif;
      `;
      document.body.appendChild(host);
      shadowRoot = host.attachShadow({ mode: 'open' });

      const style = document.createElement('style');
      style.textContent = `
        .badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 9px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.3px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.35);
          backdrop-filter: blur(4px);
          transition: background 0.4s ease, color 0.4s ease;
          user-select: none;
          cursor: default;
        }
        .ghost-icon {
          font-size: 11px;
          filter: drop-shadow(0 1px 2px rgba(0,0,0,0.5));
        }
      `;
      shadowRoot.appendChild(style);

      badgeEl = document.createElement('div');
      badgeEl.className = 'badge';
      shadowRoot.appendChild(badgeEl);
    }
    return badgeEl;
  }

  function updateBadge(ageMs, thresholdMs) {
    const badge = ensureBadge();
    const label = formatAge(ageMs);
    const { bg, text } = getColor(ageMs, thresholdMs);
    badge.style.background = bg;
    badge.style.color = text;
    badge.innerHTML = `<span class="ghost-icon">👻</span>${label}`;
  }

  function removeBadge() {
    const host = document.getElementById(BADGE_ID);
    if (host) host.remove();
    shadowRoot = null;
    badgeEl = null;
  }

  // ─── Favicon dot overlay (with graceful CSP fallback) ─────────────────────

  function applyFaviconDot(color) {
    try {
      // Find or create favicon link element
      let link = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }

      const canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 32;
      const ctx = canvas.getContext('2d');

      // Draw original favicon if we have a src
      const src = link.href;
      if (src && !src.startsWith('data:')) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          ctx.drawImage(img, 0, 0, 32, 32);
          drawDot(ctx, canvas, color, link);
        };
        img.onerror = () => {
          // Just draw a ghost emoji on blank canvas
          ctx.font = '24px serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('👻', 16, 16);
          drawDot(ctx, canvas, color, link);
        };
        img.src = src;
      } else {
        ctx.font = '24px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('👻', 16, 16);
        drawDot(ctx, canvas, color, link);
      }
    } catch (e) {
      // Silently fail — CSP or cross-origin restriction
      console.debug('[TabGhost] Favicon overlay skipped:', e.message);
    }
  }

  function drawDot(ctx, canvas, color, link) {
    try {
      ctx.beginPath();
      ctx.arc(26, 6, 6, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      link.href = canvas.toDataURL('image/png');
    } catch (e) {
      console.debug('[TabGhost] Canvas export blocked:', e.message);
    }
  }

  // ─── Main logic: request age from background, render badge ─────────────────

  function requestAndRender() {
    try {
      chrome.runtime.sendMessage({ type: 'GET_TAB_AGE' }, (response) => {
        if (chrome.runtime.lastError || !response) {
          // Extension context not ready or tab not tracked yet
          return;
        }
        const { openedAt, threshold } = response;
        const ageMs = Date.now() - openedAt;
        updateBadge(ageMs, threshold);

        const { bg } = getColor(ageMs, threshold);
        applyFaviconDot(bg);
      });
    } catch (e) {
      // Context invalidated — ignore
    }
  }

  // ─── Init ──────────────────────────────────────────────────────────────────

  // Wait for body to be available
  if (document.body) {
    requestAndRender();
  } else {
    document.addEventListener('DOMContentLoaded', requestAndRender);
  }

  // Refresh badge every minute so age stays current
  setInterval(requestAndRender, POLL_INTERVAL_MS);
})();
