// ==UserScript==
// @name         自动老虎机
// @version      1.4.1
// @description  在页面右上角添加一个悬浮按钮，每 6 秒自动点击一次按钮来进行抽奖
// @license      MIT; Fork from https://github.com/Lurito/kyx-auto-slot-machine
// @homepage     https://github.com/shay-wong/automatic_lottery
// @updateURL    https://raw.githubusercontent.com/shay-wong/automatic_lottery/master/auto-slot-machine.user.js
// @downloadURL  https://raw.githubusercontent.com/shay-wong/automatic_lottery/master/auto-slot-machine.user.js
// @supportURL   https://github.com/shay-wong/automatic_lottery/issues
// @match        https://quota.kyx03.de/
// @match        https://quota.wpgzs.top/
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const DEFAULT_CONFIG = { interval: 6000, intervalUnit: 's' };
  let CONFIG = { ...DEFAULT_CONFIG };
  try {
    const saved = localStorage.getItem('asm_config');
    if (saved) {
      const parsed = JSON.parse(saved);
      CONFIG = { ...DEFAULT_CONFIG, ...parsed };
      if (!CONFIG.intervalUnit) {
        CONFIG.intervalUnit = CONFIG.interval % 1000 === 0 ? 's' : 'ms';
      }
    }
  } catch (e) {}

  let isRunning = false;
  let intervalId = null;

  function saveConfig() {
    localStorage.setItem('asm_config', JSON.stringify(CONFIG));
  }

  function formatDuration(ms, unit) {
    if (unit === 's') {
      const seconds = ms / 1000;
      const secondsText = Number.isInteger(seconds) ? seconds : seconds.toFixed(2);
      return `${secondsText}秒`;
    }
    if (unit === 'ms') {
      return `${ms}毫秒`;
    }
    if (ms % 1000 === 0) return `${ms / 1000}秒`;
    return `${ms}毫秒`;
  }

  function normalizeDurationValue(value) {
    return Number.isInteger(value) ? value : parseFloat(value.toFixed(3));
  }

  function getDurationParts(ms, unit) {
    if (unit === 's') {
      return { value: normalizeDurationValue(ms / 1000), unit: 's' };
    }
    if (unit === 'ms') {
      return { value: normalizeDurationValue(ms), unit: 'ms' };
    }
    if (ms % 1000 === 0) {
      return { value: ms / 1000, unit: 's' };
    }
    return { value: ms, unit: 'ms' };
  }

  function toMilliseconds(value, unit, fallback) {
    const num = parseFloat(value);
    if (!Number.isFinite(num)) return fallback;
    const ms = unit === 's' ? num * 1000 : num;
    return Math.max(1, Math.round(ms));
  }

  function autoSizeSelect(select) {
    if (!select) return;
    const style = window.getComputedStyle(select);
    const probe = document.createElement('span');
    probe.style.position = 'absolute';
    probe.style.visibility = 'hidden';
    probe.style.whiteSpace = 'nowrap';
    probe.style.font = style.font;
    probe.textContent = select.options[select.selectedIndex]?.textContent || '';
    document.body.appendChild(probe);
    const textWidth = Math.ceil(probe.getBoundingClientRect().width);
    const paddingLeft = parseFloat(style.paddingLeft) || 0;
    const paddingRight = parseFloat(style.paddingRight) || 0;
    const arrowWidth = 30;
    probe.remove();
    const width = Math.max(90, textWidth + paddingLeft + paddingRight + arrowWidth);
    select.style.width = `${width}px`;
  }

  function showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'asm-toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      #asm-panel, #asm-settings, .asm-toast {
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
        -webkit-font-smoothing: antialiased;
      }
      .asm-toast {
        position: fixed; top: 20px; left: 50%; transform: translateX(-50%) translateY(-20px);
        background: rgba(255,255,255,0.95); backdrop-filter: blur(20px);
        color: #1d1d1f; padding: 10px 20px; border-radius: 99px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.15);
        font-size: 14px; font-weight: 500; z-index: 1000001;
        opacity: 0; transition: all 0.3s ease; pointer-events: none;
      }
      .asm-toast.show { transform: translateX(-50%) translateY(0); opacity: 1; }

      #asm-panel {
        position: fixed; top: 50px; right: 50px; width: 200px;
        background: rgba(28,28,30,0.85); backdrop-filter: blur(30px);
        border: 1px solid rgba(255,255,255,0.1); border-radius: 18px;
        box-shadow: 0 16px 32px rgba(0,0,0,0.4); z-index: 999999; color: #fff;
        overflow: hidden;
      }
      .asm-header {
        padding: 14px 16px; display: flex; justify-content: space-between; align-items: center;
        cursor: move; border-bottom: 1px solid rgba(255,255,255,0.08);
        background: rgba(255,255,255,0.03); user-select: none;
      }
      .asm-header-left { display: flex; flex-direction: column; }
      .asm-title { font-weight: 600; font-size: 15px; color: rgba(255,255,255,0.95); }
      .asm-header-status { display: none; font-size: 11px; color: rgba(235,235,245,0.5); margin-top: 6px; align-items: center; gap: 6px; }
      .asm-header-status .asm-dot { width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,0.2); }
      #asm-panel.minimized .asm-header-status { display: flex; }
      #asm-panel.minimized.running .asm-header-status .asm-dot { background: #30d158; }
      .asm-header-right { display: flex; gap: 6px; margin-left: 16px; }
      .asm-header-stop { display: none; background: #ff453a; border: none; color: #fff; width: 26px; height: 26px; border-radius: 50%; cursor: pointer; font-size: 12px; line-height: 1; }
      .asm-header-start { display: none; background: #30d158; border: none; color: #fff; width: 26px; height: 26px; border-radius: 50%; cursor: pointer; font-size: 12px; line-height: 1; }
      #asm-panel.minimized.running .asm-header-stop { display: block; }
      #asm-panel.minimized:not(.running) .asm-header-start { display: block; }
      .asm-body { padding: 16px; }

      .asm-config { background: rgba(0,0,0,0.2); border-radius: 10px; padding: 10px 14px; margin-bottom: 14px; }
      .asm-row { display: flex; justify-content: space-between; align-items: center; }
      .asm-label { font-size: 12px; color: rgba(235,235,245,0.6); }
      .asm-val { color: #fff; font-weight: 600; font-size: 13px; }

      .asm-btn {
        width: 100%; height: 40px; border: none; border-radius: 10px;
        cursor: pointer; font-weight: 600; font-size: 14px; margin-bottom: 10px;
        color: white; transition: all 0.2s;
      }
      .asm-btn:active { transform: scale(0.98); opacity: 0.9; }
      #asm-start { background: #30d158; }
      #asm-stop { background: #ff453a; display: none; }
      #asm-setting { background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.9); font-weight: 500; }

      .asm-status { font-size: 11px; color: rgba(235,235,245,0.5); text-align: center; display: flex; align-items: center; justify-content: center; gap: 6px; }
      .asm-dot { width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,0.2); }

      .asm-min-btn {
        background: rgba(255,255,255,0.1); border: none; color: rgba(255,255,255,0.8);
        width: 26px; height: 26px; border-radius: 50%; cursor: pointer;
        font-size: 16px; line-height: 1;
      }
      #asm-panel.minimized .asm-body { display: none; }
      #asm-panel.minimized { width: auto; min-width: fit-content; }
      #asm-panel.minimized .asm-header { white-space: nowrap; }

      #asm-settings {
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        z-index: 1000000; display: flex; justify-content: center; align-items: center;
      }
      .asm-backdrop {
        position: absolute; width: 100%; height: 100%;
        background: rgba(0,0,0,0.4); backdrop-filter: blur(10px);
      }
      .asm-modal {
        position: relative; width: 360px; min-width: 320px; min-height: 220px;
        max-width: calc(100vw - 24px); max-height: calc(100vh - 24px);
        background: rgba(30,30,30,0.9); backdrop-filter: blur(40px);
        border-radius: 16px; box-shadow: 0 20px 40px rgba(0,0,0,0.5);
        resize: both; overflow: hidden; display: flex; flex-direction: column;
      }
      .asm-modal-header { padding: 16px; text-align: center; flex: 0 0 auto; }
      .asm-modal-title { font-weight: 600; font-size: 16px; color: #fff; }
      .asm-modal-body { padding: 0 16px 16px; flex: 1 1 auto; overflow: auto; }
      .asm-input-group { background: rgba(255,255,255,0.08); border-radius: 10px; overflow: hidden; }
      .asm-input-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 10px 14px; }
      .asm-input-row label {
        font-size: 14px; color: #fff; flex: 0 0 100px;
        text-align: left; white-space: nowrap;
      }
      .asm-input-row input {
        width: 120px; background: transparent; border: none;
        color: #0a84ff; text-align: right; font-size: 15px; outline: none;
      }
      .asm-input-row select {
        background: transparent; border: none;
        color: #0a84ff; font-size: 14px; outline: none;
        text-align: right; text-align-last: right;
        width: auto; min-width: 0;
      }
      .asm-input-inline { display: flex; align-items: center; gap: 6px; flex: 1 1 auto; min-width: 0; justify-content: flex-end; }
      .asm-input-inline select { flex: 0 0 auto; }
      .asm-input-inline input { width: 120px; min-width: 100px; }
      .asm-hint { font-size: 12px; color: rgba(255,255,255,0.6); margin: 6px 14px 0; }
      .asm-modal-footer { display: flex; border-top: 1px solid rgba(84,84,88,0.5); flex: 0 0 auto; }
      .asm-modal-btn {
        flex: 1; height: 44px; border: none; background: transparent;
        font-size: 16px; cursor: pointer; color: #0a84ff;
      }
      .asm-modal-btn:first-child { border-right: 1px solid rgba(84,84,88,0.5); border-bottom-left-radius: 16px; }
      .asm-modal-btn:last-child { font-weight: 600; border-bottom-right-radius: 16px; }
      .asm-modal-btn:active { background: rgba(255,255,255,0.1); }
    `;
    document.head.appendChild(style);
  }

  function spin() {
    if (!isRunning) return;
    const btns = ['#freeSpinButton', '#spinButton', '#advancedSpinButton', '#supremeSpinButton'];
    for (const sel of btns) {
      const btn = document.querySelector(sel);
      if (btn && !btn.disabled && btn.offsetParent !== null) {
        btn.click();
        updateStatus('抽奖中...');
        return;
      }
    }
    updateStatus('未找到按钮');
  }

  function start() {
    isRunning = true;
    updateBtnState();
    document.querySelector('.asm-dot').style.background = '#30d158';
    showToast('开始自动抽奖');
    spin();
    intervalId = setInterval(spin, CONFIG.interval);
  }

  function stop(reason = '已停止') {
    isRunning = false;
    clearInterval(intervalId);
    intervalId = null;
    updateBtnState();
    document.querySelector('.asm-dot').style.background = 'rgba(255,255,255,0.2)';
    updateStatus(reason);
  }

  function updateBtnState() {
    document.getElementById('asm-start').style.display = isRunning ? 'none' : 'block';
    document.getElementById('asm-stop').style.display = isRunning ? 'block' : 'none';
    document.getElementById('asm-panel').classList.toggle('running', isRunning);
  }

  function updateStatus(msg) {
    document.getElementById('asm-status').textContent = msg;
    document.getElementById('asm-header-status-text').textContent = msg;
  }

  function updateConfigDisplay() {
    document.getElementById('asm-config').innerHTML = `
      <div class="asm-row"><span class="asm-label">间隔时间</span><span class="asm-val">${formatDuration(CONFIG.interval, CONFIG.intervalUnit)}</span></div>
    `;
  }

  function showSettings() {
    const existing = document.getElementById('asm-settings');
    if (existing) existing.remove();

    const intervalParts = getDurationParts(CONFIG.interval, CONFIG.intervalUnit);
    const modal = document.createElement('div');
    modal.id = 'asm-settings';
    modal.innerHTML = `
      <div class="asm-backdrop"></div>
      <div class="asm-modal">
        <div class="asm-modal-header"><div class="asm-modal-title">设置</div></div>
        <div class="asm-modal-body">
          <div class="asm-input-group">
            <div class="asm-input-row">
              <label>间隔</label>
              <div class="asm-input-inline">
                <input type="number" id="inp-interval" value="${intervalParts.value}" min="1" step="any">
                <select id="sel-interval-unit">
                  <option value="s" ${intervalParts.unit === 's' ? 'selected' : ''}>秒</option>
                  <option value="ms" ${intervalParts.unit === 'ms' ? 'selected' : ''}>毫秒</option>
                </select>
              </div>
            </div>
            <div class="asm-hint">单位可选秒/毫秒，切换会自动换算</div>
          </div>
        </div>
        <div class="asm-modal-footer">
          <button class="asm-modal-btn" id="btn-cancel">取消</button>
          <button class="asm-modal-btn" id="btn-save">保存</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('.asm-backdrop').onclick = () => modal.remove();
    const intervalInput = document.getElementById('inp-interval');
    const intervalUnitSelect = document.getElementById('sel-interval-unit');
    intervalUnitSelect.dataset.prevUnit = intervalUnitSelect.value;
    autoSizeSelect(intervalUnitSelect);
    intervalUnitSelect.addEventListener('change', () => {
      const prevUnit = intervalUnitSelect.dataset.prevUnit;
      const nextUnit = intervalUnitSelect.value;
      if (prevUnit === nextUnit) return;
      const currentValue = parseFloat(intervalInput.value);
      if (Number.isFinite(currentValue)) {
        const converted = prevUnit === 's' && nextUnit === 'ms'
          ? currentValue * 1000
          : currentValue / 1000;
        intervalInput.value = normalizeDurationValue(converted);
      }
      intervalUnitSelect.dataset.prevUnit = nextUnit;
      autoSizeSelect(intervalUnitSelect);
    });
    document.getElementById('btn-cancel').onclick = () => modal.remove();
    document.getElementById('btn-save').onclick = () => {
      const intervalValue = document.getElementById('inp-interval').value;
      const intervalUnit = document.getElementById('sel-interval-unit').value;
      CONFIG.interval = toMilliseconds(intervalValue, intervalUnit, CONFIG.interval);
      CONFIG.intervalUnit = intervalUnit;
      saveConfig();
      updateConfigDisplay();
      if (isRunning) {
        clearInterval(intervalId);
        intervalId = setInterval(spin, CONFIG.interval);
      }
      modal.remove();
      showToast('设置已保存');
    };
  }

  function createPanel() {
    injectStyles();

    const panel = document.createElement('div');
    panel.id = 'asm-panel';
    panel.innerHTML = `
      <div class="asm-header">
        <div class="asm-header-left">
          <span class="asm-title">自动抽奖</span>
          <div class="asm-header-status" id="asm-header-status"><span class="asm-dot"></span><span id="asm-header-status-text">准备就绪</span></div>
        </div>
        <div class="asm-header-right"><button class="asm-header-start" id="asm-header-start">▶</button><button class="asm-header-stop" id="asm-header-stop">⏹</button><button class="asm-min-btn">−</button></div>
      </div>
      <div class="asm-body">
        <div class="asm-config" id="asm-config"></div>
        <button id="asm-start" class="asm-btn">开始</button>
        <button id="asm-stop" class="asm-btn">停止</button>
        <button id="asm-setting" class="asm-btn">设置</button>
        <div class="asm-status"><span class="asm-dot"></span><span id="asm-status">准备就绪</span></div>
      </div>
    `;
    document.body.appendChild(panel);

    updateConfigDisplay();

    document.getElementById('asm-start').onclick = start;
    document.getElementById('asm-stop').onclick = () => stop('用户停止');
    document.getElementById('asm-setting').onclick = showSettings;
    document.getElementById('asm-header-stop').onclick = () => stop('用户停止');
    document.getElementById('asm-header-start').onclick = start;

    const header = panel.querySelector('.asm-header');
    const minBtn = panel.querySelector('.asm-min-btn');
    minBtn.onclick = () => {
      panel.classList.toggle('minimized');
      minBtn.textContent = panel.classList.contains('minimized') ? '+' : '−';
    };

    // 拖拽
    let dragging = false, offsetX, offsetY;
    header.addEventListener('mousedown', (e) => {
      if (e.target === minBtn) return;
      dragging = true;
      offsetX = e.clientX - panel.getBoundingClientRect().left;
      offsetY = e.clientY - panel.getBoundingClientRect().top;
      panel.style.transition = 'none';
      e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      panel.style.left = (e.clientX - offsetX) + 'px';
      panel.style.top = (e.clientY - offsetY) + 'px';
      panel.style.right = 'auto';
    });
    window.addEventListener('mouseup', () => {
      if (dragging) {
        dragging = false;
        panel.style.transition = '';
      }
    });
  }

  createPanel();
})();
