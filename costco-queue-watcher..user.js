
// ==UserScript==
// @name         Costco Queue Watcher Dashboard
// @namespace    local.costco.queue
// @version      3.0
// @description  Monitor Costco product and queue status
// @match        https://www.costco.com/*
// @grant        GM_notification
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const CONFIG = {
    productUrl: 'https://www.costco.com/.product.2007497.html',
    minRefresh: 60000,
    maxRefresh: 150000,
    loadTimeout: 15000,
    maxAttempts: 200,
    autoJoinQueue: true
  };

  const target = new URL(CONFIG.productUrl);
  if (location.pathname !== target.pathname) return;

  const KEY = 'costco_watcher_v3_' + target.pathname;
  const $ = id => document.getElementById(id);

  let state;
  try {
    state = JSON.parse(sessionStorage.getItem(KEY) || '{}');
  } catch {
    state = {};
  }

  state = {
    active: true,
    attempts: 0,
    status: 'Initializing',
    productStatus: 'Checking',
    queueStatus: 'Checking',
    nextRefresh: null,
    lastChecked: null,
    logs: [],
    ...state
  };

  let refreshTimer = null;
  let scanning = false;
  let joined = false;
  let observer = null;
  let panel;

  function save() {
    sessionStorage.setItem(KEY, JSON.stringify(state));
  }

  function time() {
    return new Date().toLocaleTimeString();
  }

  function log(message) {
    console.log('[Costco Watcher]', message);
    state.logs.unshift(`[${time()}] ${message}`);
    state.logs = state.logs.slice(0, 25);
    save();
    renderLogs();
  }

  function setStatus(status) {
    state.status = status;
    save();
    render();
  }

  function randomDelay() {
    return Math.floor(
      CONFIG.minRefresh +
      Math.random() *
      (CONFIG.maxRefresh - CONFIG.minRefresh + 1)
    );
  }

  function notify(message) {
    log(message);
    try {
      GM_notification({
        title: 'Costco Queue Watcher',
        text: message,
        timeout: 0
      });
    } catch (e) {
      console.warn(e);
    }
  }

  // ---------- DASHBOARD ----------

  function createDashboard() {
    const style = document.createElement('style');

    style.textContent = `
      #cw-panel {
        position: fixed;
        top: 20px;
        right: 20px;
        width: 330px;
        z-index: 2147483647;
        background: #101827;
        color: #f8fafc;
        border: 1px solid #334155;
        border-radius: 14px;
        box-shadow: 0 12px 35px #0006;
        font: 13px Arial, sans-serif;
        overflow: hidden;
      }
      #cw-panel * { box-sizing: border-box; }
      #cw-header {
        padding: 14px;
        background: #182439;
        font-weight: bold;
        cursor: move;
        display: flex;
        justify-content: space-between;
        align-items: center;
        user-select: none;
      }
      #cw-body { padding: 14px; }
      #cw-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        margin-bottom: 12px;
      }
      .cw-card {
        background: #1e293b;
        border-radius: 8px;
        padding: 10px;
      }
      .cw-label {
        color: #94a3b8;
        font-size: 10px;
        margin-bottom: 6px;
        text-transform: uppercase;
      }
      .cw-value {
        color: white;
        font-size: 16px;
        font-weight: bold;
        overflow-wrap: anywhere;
      }
      #cw-status {
        padding: 5px 9px;
        border-radius: 20px;
        background: #334155;
        font-size: 11px;
      }
      #cw-log {
        height: 140px;
        overflow-y: auto;
        background: #0b1220;
        padding: 9px;
        border-radius: 8px;
        font: 11px/1.7 monospace;
        color: #cbd5e1;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }
      .cw-actions {
        display: flex;
        gap: 7px;
        margin-top: 12px;
      }
      .cw-btn {
        flex: 1;
        padding: 9px 5px;
        border: 0;
        border-radius: 7px;
        cursor: pointer;
        font-weight: bold;
        font-size: 12px;
      }
      #cw-toggle { background: #38bdf8; color: #071525; }
      #cw-check { background: #334155; color: white; }
      #cw-reset { background: #334155; color: white; }
      #cw-details {
        margin: 12px 0;
        color: #94a3b8;
        font-size: 11px;
      }
      #cw-minimize {
        background: none;
        color: #e2e8f0;
        border: 0;
        cursor: pointer;
        font-size: 18px;
      }
      #cw-panel.cw-collapsed #cw-body {
        display: none;
      }
    `;

    document.head.appendChild(style);

    panel = document.createElement('div');
    panel.id = 'cw-panel';

    panel.innerHTML = `
      <div id="cw-header">
        <span>⚡ Costco Queue Watcher</span>
        <div>
          <span id="cw-status">Starting</span>
          <button id="cw-minimize">−</button>
        </div>
      </div>
      <div id="cw-body">
        <div id="cw-grid">
          <div class="cw-card">
            <div class="cw-label">Next Refresh</div>
            <div id="cw-countdown" class="cw-value">--:--</div>
          </div>
          <div class="cw-card">
            <div class="cw-label">Refresh Count</div>
            <div id="cw-attempts" class="cw-value">0</div>
          </div>
          <div class="cw-card">
            <div class="cw-label">Product Status</div>
            <div id="cw-product" class="cw-value">Checking</div>
          </div>
          <div class="cw-card">
            <div class="cw-label">Queue Status</div>
            <div id="cw-queue" class="cw-value">Checking</div>
          </div>
        </div>

        <div id="cw-details">
          Last checked: <span id="cw-last">Never</span>
        </div>

        <div style="margin-bottom:7px;font-weight:bold">
          Activity Log
        </div>
        <div id="cw-log"></div>

        <div class="cw-actions">
          <button class="cw-btn" id="cw-toggle">Pause</button>
          <button class="cw-btn" id="cw-check">Check Now</button>
          <button class="cw-btn" id="cw-reset">Reset</button>
        </div>
      </div>
    `;

    document.body.appendChild(panel);

    $('cw-toggle').onclick = toggle;
    $('cw-check').onclick = () => checkStatus(true);
    $('cw-reset').onclick = reset;

    $('cw-minimize').onclick = () => {
      panel.classList.toggle('cw-collapsed');
      $('cw-minimize').textContent =
        panel.classList.contains('cw-collapsed') ? '+' : '−';
    };

    // Dragging
    const header = $('cw-header');
    let drag = null;

    header.addEventListener('pointerdown', e => {
      if (e.target.closest('button')) return;

      const rect = panel.getBoundingClientRect();
      drag = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };

      header.setPointerCapture(e.pointerId);
    });

    header.addEventListener('pointermove', e => {
      if (!drag) return;

      panel.style.left =
        Math.max(0, e.clientX - drag.x) + 'px';
      panel.style.top =
        Math.max(0, e.clientY - drag.y) + 'px';
      panel.style.right = 'auto';
    });

    header.addEventListener('pointerup', () => {
      drag = null;
    });

    render();
    renderLogs();
  }

  function renderLogs() {
    const element = $('cw-log');
    if (element) {
      element.textContent = state.logs.join('\n');
    }
  }

  function render() {
    if (!panel) return;

    $('cw-status').textContent = state.status;
    $('cw-attempts').textContent = state.attempts;
    $('cw-product').textContent = state.productStatus;
    $('cw-queue').textContent = state.queueStatus;
    $('cw-last').textContent =
      state.lastChecked || 'Never';

    $('cw-toggle').textContent =
      state.active ? 'Pause' : 'Start';

    const status = $('cw-status');
    status.style.background =
      state.status === 'In Queue' ? '#166534' :
      state.status === 'Available' ? '#166534' :
      state.active ? '#075985' : '#475569';
  }

  function updateCountdown() {
    if (!panel) return;

    const display = $('cw-countdown');

    if (!state.active) {
      display.textContent = 'Paused';
      return;
    }

    if (!state.nextRefresh) {
      display.textContent = 'Checking';
      return;
    }

    const remaining = Math.max(
      0,
      Math.ceil((state.nextRefresh - Date.now()) / 1000)
    );

    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;

    display.textContent =
      String(minutes).padStart(2, '0') + ':' +
      String(seconds).padStart(2, '0');
  }

  // ---------- DETECTION ----------

  function visible(el) {
    return Boolean(
      el.getClientRects().length &&
      getComputedStyle(el).visibility !== 'hidden'
    );
  }

  function findControl(pattern) {
    return [...document.querySelectorAll(
      'button, a, [role="button"]'
    )].find(el => {
      if (panel?.contains(el)) return false;
      if (!visible(el)) return false;
      if (el.disabled ||
          el.getAttribute('aria-disabled') === 'true') {
        return false;
      }

      const label = (
        el.innerText ||
        el.getAttribute('aria-label') ||
        ''
      ).trim();

      return pattern.test(label);
    });
  }

  function verificationRequired() {
    const text = document.title + ' ' +
      (document.body?.innerText || '').slice(0, 3000);

    return /captcha|verify you are human|access denied|unusual traffic/i
      .test(text);
  }

  function isInQueue() {
    const text = document.body?.innerText || '';

    return (
      /you are (now )?in (the |a )?(queue|waiting room)/i
        .test(text) ||
      /your (place|position) in (the )?(queue|line)/i
        .test(text) ||
      /estimated wait time/i.test(text)
    );
  }

  function stop(message, status) {
    state.active = false;
    state.nextRefresh = null;

    clearTimeout(refreshTimer);
    observer?.disconnect();

    setStatus(status);
    notify(message);
    save();
    render();
  }

  function checkStatus(manual = false) {
    if (!state.active && !manual) return true;

    if (scanning) return false;
    scanning = true;

    try {
      state.lastChecked = time();

      if (verificationRequired()) {
        stop('Verification required', 'Paused');
        return true;
      }

      if (isInQueue()) {
        state.queueStatus = 'Entered';
        stop('Waiting room detected!', 'In Queue');
        return true;
      }

      const queueButton = findControl(
        /^(join (the )?(queue|waiting room)|enter (the )?(queue|waiting room))$/i
      );

      if (queueButton && !joined) {
        state.queueStatus = 'Available';
        joined = true;

        stop('Queue entry detected!', 'Available');

        if (CONFIG.autoJoinQueue) {
          queueButton.click();
        }

        return true;
      }

      const addToCart = findControl(/^add to cart$/i);

      if (addToCart) {
        state.productStatus = 'Available';
        stop('Product can be added to cart!', 'Available');
        return true;
      }

      state.productStatus = 'Not available';
      state.queueStatus = 'Not detected';

      if (manual) {
        log('Manual check: no availability detected');
      }

      save();
      render();
      return false;

    } finally {
      scanning = false;
    }
  }

  // ---------- REFRESH ----------

  function scheduleRefresh() {
    if (!state.active) return;

    if (state.attempts >= CONFIG.maxAttempts) {
      stop('Maximum attempts reached', 'Paused');
      return;
    }

    const delay = randomDelay();

    state.nextRefresh = Date.now() + delay;
    save();

    log(
      'Next refresh in ' +
      Math.round(delay / 1000) + ' seconds'
    );

    clearTimeout(refreshTimer);

    refreshTimer = setTimeout(() => {
      if (!state.active) return;
      if (checkStatus()) return;

      state.attempts++;
      state.nextRefresh = null;
      save();

      log('Refreshing product page');
      location.reload();
    }, delay);
  }

  function toggle() {
    state.active = !state.active;

    if (state.active) {
      log('Monitoring started');
      setStatus('Monitoring');
      checkStatus();
      if (state.active) scheduleRefresh();
    } else {
      clearTimeout(refreshTimer);
      state.nextRefresh = null;
      log('Monitoring paused');
      setStatus('Paused');
    }

    save();
    render();
  }

  function reset() {
    clearTimeout(refreshTimer);
    observer?.disconnect();
    sessionStorage.removeItem(KEY);
    location.reload();
  }

  // ---------- STARTUP ----------

  async function start() {
    createDashboard();

    setInterval(updateCountdown, 250);

    if (!state.active) {
      setStatus('Paused');
      return;
    }

    setStatus('Monitoring');
    log('Product monitor initialized');

    const startTime = Date.now();

    while (
      state.active &&
      Date.now() - startTime < CONFIG.loadTimeout
    ) {
      if (checkStatus()) return;

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    if (!state.active) return;

    // Watch changes in dynamically loaded content
    observer = new MutationObserver(() => {
      if (state.active) checkStatus();
    });

    // Observe the product page, not the dashboard
    const root =
      document.querySelector('main') ||
      document.querySelector('#main') ||
      document.body;

    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true
    });

    scheduleRefresh();
  }

  start();
})();
