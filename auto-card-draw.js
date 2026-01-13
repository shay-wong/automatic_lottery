// ==UserScript==
// @name         自动抽卡
// @version      1.0.0
// @description  自动抽卡脚本
// @license      MIT; 参考 https://greasyfork.org/scripts/561215
// @match        https://cdk.hybgzs.com/entertainment/cards/draw
// @grant        none
// @updateURL    https://raw.githubusercontent.com/shay-wong/automatic_lottery/master/auto-card-draw.js
// @downloadURL  https://raw.githubusercontent.com/shay-wong/automatic_lottery/master/auto-card-draw.js
// ==/UserScript==

(function () {
  'use strict';

  const DEFAULT_CONFIG = {
    interval: 6000,
    mode: '单抽',
    paidLimit: 400,
    timeout: 10000
  };

  let CONFIG = { ...DEFAULT_CONFIG };
  try {
    const saved = localStorage.getItem('acd_config');
    if (saved) CONFIG = { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
  } catch (e) {}

  let isRunning = false;
  let intervalId = null;
  let drawCount = 0;

  function saveConfig() {
    localStorage.setItem('acd_config', JSON.stringify(CONFIG));
  }

  function getPaidUsed() {
    const allDivs = document.querySelectorAll('div');
    for (const div of allDivs) {
      if (div.textContent.trim() === '付费已用') {
        const valueDiv = div.previousElementSibling;
        if (valueDiv) {
          const parts = valueDiv.textContent.trim().split('/');
          return parts.length > 0 ? parseInt(parts[0], 10) : 0;
        }
      }
    }
    return 0;
  }

  // Toast 通知
  function showToast(msg, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `acd-toast ${type}`;
    toast.textContent = msg;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  // 注入样式
  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      #acd-panel, #acd-settings, .acd-toast {
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
        -webkit-font-smoothing: antialiased;
      }
      .acd-toast {
        position: fixed; top: 20px; left: 50%; transform: translateX(-50%) translateY(-20px);
        background: rgba(255,255,255,0.95); backdrop-filter: blur(20px);
        color: #1d1d1f; padding: 10px 20px; border-radius: 99px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.15);
        font-size: 14px; font-weight: 500; z-index: 1000001;
        opacity: 0; transition: all 0.3s ease; pointer-events: none;
      }
      .acd-toast.show { transform: translateX(-50%) translateY(0); opacity: 1; }
      .acd-toast.warn { color: #ff3b30; }

      #acd-panel {
        position: fixed; top: 50px; right: 50px; width: 280px;
        background: rgba(28,28,30,0.85); backdrop-filter: blur(30px);
        border: 1px solid rgba(255,255,255,0.1); border-radius: 18px;
        box-shadow: 0 16px 32px rgba(0,0,0,0.4); z-index: 999999; color: #fff;
        overflow: hidden;
      }
      .acd-header {
        padding: 14px 16px; display: flex; justify-content: space-between; align-items: center;
        cursor: move; border-bottom: 1px solid rgba(255,255,255,0.08);
        background: rgba(255,255,255,0.03); user-select: none;
      }
      .acd-title { font-weight: 600; font-size: 15px; color: rgba(255,255,255,0.95); }
      .acd-header-status { display: none; font-size: 11px; color: rgba(235,235,245,0.5); margin-left: 8px; }
      #acd-panel.minimized .acd-header-status { display: inline; }
      .acd-header-right { display: flex; gap: 6px; }
      .acd-header-stop { display: none; background: #ff453a; border: none; color: #fff; width: 26px; height: 26px; border-radius: 50%; cursor: pointer; font-size: 12px; line-height: 1; }
      .acd-header-start { display: none; background: #30d158; border: none; color: #fff; width: 26px; height: 26px; border-radius: 50%; cursor: pointer; font-size: 12px; line-height: 1; }
      #acd-panel.minimized.running .acd-header-stop { display: block; }
      #acd-panel.minimized:not(.running) .acd-header-start { display: block; }
      .acd-body { padding: 16px; }

      .acd-config { background: rgba(0,0,0,0.2); border-radius: 10px; padding: 10px 14px; margin-bottom: 14px; }
      .acd-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
      .acd-row:last-child { margin-bottom: 0; }
      .acd-label { font-size: 12px; color: rgba(235,235,245,0.6); }
      .acd-val { color: #fff; font-weight: 600; font-size: 13px; }

      .acd-btn {
        width: 100%; height: 40px; border: none; border-radius: 10px;
        cursor: pointer; font-weight: 600; font-size: 14px; margin-bottom: 10px;
        color: white; transition: all 0.2s;
      }
      .acd-btn:active { transform: scale(0.98); opacity: 0.9; }
      #acd-start { background: #30d158; }
      #acd-stop { background: #ff453a; display: none; }
      #acd-setting { background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.9); font-weight: 500; }

      .acd-status { font-size: 11px; color: rgba(235,235,245,0.5); text-align: center; display: flex; align-items: center; justify-content: center; gap: 6px; }
      .acd-dot { width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,0.2); }

      .acd-min-btn {
        background: rgba(255,255,255,0.1); border: none; color: rgba(255,255,255,0.8);
        width: 26px; height: 26px; border-radius: 50%; cursor: pointer;
        font-size: 16px; line-height: 1;
      }
      #acd-panel.minimized .acd-body { display: none; }
      #acd-panel.minimized { width: 180px; }

      #acd-settings {
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        z-index: 1000000; display: flex; justify-content: center; align-items: center;
      }
      .acd-backdrop {
        position: absolute; width: 100%; height: 100%;
        background: rgba(0,0,0,0.4); backdrop-filter: blur(10px);
      }
      .acd-modal {
        position: relative; width: 280px;
        background: rgba(30,30,30,0.9); backdrop-filter: blur(40px);
        border-radius: 16px; box-shadow: 0 20px 40px rgba(0,0,0,0.5);
      }
      .acd-modal-header { padding: 16px; text-align: center; }
      .acd-modal-title { font-weight: 600; font-size: 16px; color: #fff; }
      .acd-modal-body { padding: 0 16px 16px; }
      .acd-input-group { background: rgba(255,255,255,0.08); border-radius: 10px; overflow: hidden; }
      .acd-input-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; }
      .acd-input-row label { font-size: 14px; color: #fff; }
      .acd-input-row input, .acd-input-row select {
        width: 80px; background: transparent; border: none;
        color: #0a84ff; text-align: right; font-size: 15px; outline: none;
      }
      .acd-input-row select { width: 90px; }
      .acd-divider { height: 1px; background: rgba(84,84,88,0.5); margin-left: 14px; }
      .acd-modal-footer { display: flex; border-top: 1px solid rgba(84,84,88,0.5); }
      .acd-modal-btn {
        flex: 1; height: 44px; border: none; background: transparent;
        font-size: 16px; cursor: pointer; color: #0a84ff;
      }
      .acd-modal-btn:first-child { border-right: 1px solid rgba(84,84,88,0.5); border-bottom-left-radius: 16px; }
      .acd-modal-btn:last-child { font-weight: 600; border-bottom-right-radius: 16px; }
      .acd-modal-btn:active { background: rgba(255,255,255,0.1); }
    `;
    document.head.appendChild(style);
  }

  function draw() {
    if (!isRunning) return;

    // 检查付费上限
    const paidUsed = getPaidUsed();
    if (paidUsed >= CONFIG.paidLimit) {
      stop(`达到付费上限 (${paidUsed})`);
      showToast(`已达到付费上限 ${paidUsed} 次`, 'warn');
      return;
    }

    // 1. 关闭弹窗
    const closeBtn = document.querySelector('button[aria-label="Close"]') ||
      [...document.querySelectorAll('button')].find(b => /关闭|确定|知道了|收下/.test(b.textContent) && b.offsetParent);
    if (closeBtn?.offsetParent) { closeBtn.click(); return; }

    // 2. 确认弹窗
    const confirmBtn = [...document.querySelectorAll('button')].find(b => /确认|确定|继续/.test(b.textContent) && b.offsetParent && !b.disabled);
    if (confirmBtn) { confirmBtn.click(); return; }

    // 3. 抽奖按钮
    const btn = [...document.querySelectorAll('button')].find(b => b.textContent.includes(CONFIG.mode) && !b.disabled && b.offsetParent);
    if (btn) {
      btn.click();
      updateStatus('抽卡中...');
    } else {
      updateStatus('未找到按钮');
    }
  }

  function start() {
    const paidUsed = getPaidUsed();
    if (paidUsed >= CONFIG.paidLimit) {
      showToast(`已达到付费上限 ${paidUsed} 次`, 'warn');
      return;
    }
    isRunning = true;
    updateBtnState();
    document.querySelector('.acd-dot').style.background = '#30d158';
    showToast('开始自动抽卡');
    intervalId = setInterval(draw, CONFIG.interval);
    draw();
  }

  function stop(reason = '已停止') {
    isRunning = false;
    clearInterval(intervalId);
    intervalId = null;
    updateBtnState();
    document.querySelector('.acd-dot').style.background = 'rgba(255,255,255,0.2)';
    updateStatus(reason);
  }

  function updateBtnState() {
    document.getElementById('acd-start').style.display = isRunning ? 'none' : 'block';
    document.getElementById('acd-stop').style.display = isRunning ? 'block' : 'none';
    document.getElementById('acd-panel').classList.toggle('running', isRunning);
  }

  function updateStatus(msg) {
    document.getElementById('acd-status').textContent = msg;
    document.getElementById('acd-header-status').textContent = msg;
  }

  function updateConfigDisplay() {
    document.getElementById('acd-config').innerHTML = `
      <div class="acd-row"><span class="acd-label">抽卡模式</span><span class="acd-val">${CONFIG.mode}</span></div>
      <div class="acd-row"><span class="acd-label">间隔时间</span><span class="acd-val">${CONFIG.interval / 1000}秒</span></div>
      <div class="acd-row"><span class="acd-label">付费上限</span><span class="acd-val">${CONFIG.paidLimit}次</span></div>
      <div class="acd-row"><span class="acd-label">超时时间</span><span class="acd-val">${CONFIG.timeout / 1000}秒</span></div>
    `;
  }

  function showSettings() {
    const existing = document.getElementById('acd-settings');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'acd-settings';
    modal.innerHTML = `
      <div class="acd-backdrop"></div>
      <div class="acd-modal">
        <div class="acd-modal-header"><div class="acd-modal-title">设置</div></div>
        <div class="acd-modal-body">
          <div class="acd-input-group">
            <div class="acd-input-row">
              <label>抽卡模式</label>
              <select id="inp-mode">
                <option value="单抽" ${CONFIG.mode === '单抽' ? 'selected' : ''}>单抽</option>
                <option value="十连抽" ${CONFIG.mode === '十连抽' ? 'selected' : ''}>十连抽</option>
              </select>
            </div>
            <div class="acd-divider"></div>
            <div class="acd-input-row">
              <label>间隔 (秒)</label>
              <input type="number" id="inp-interval" value="${CONFIG.interval / 1000}" min="1">
            </div>
            <div class="acd-divider"></div>
            <div class="acd-input-row">
              <label>付费上限</label>
              <input type="number" id="inp-limit" value="${CONFIG.paidLimit}" min="0" step="10">
            </div>
            <div class="acd-divider"></div>
            <div class="acd-input-row">
              <label>超时 (秒)</label>
              <input type="number" id="inp-timeout" value="${CONFIG.timeout / 1000}" min="1">
            </div>
          </div>
        </div>
        <div class="acd-modal-footer">
          <button class="acd-modal-btn" id="btn-cancel">取消</button>
          <button class="acd-modal-btn" id="btn-save">保存</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('.acd-backdrop').onclick = () => modal.remove();
    document.getElementById('btn-cancel').onclick = () => modal.remove();
    document.getElementById('btn-save').onclick = () => {
      CONFIG.mode = document.getElementById('inp-mode').value;
      CONFIG.interval = Math.max(1, parseInt(document.getElementById('inp-interval').value) || 6) * 1000;
      CONFIG.paidLimit = Math.max(0, parseInt(document.getElementById('inp-limit').value) || 400);
      CONFIG.timeout = Math.max(1, parseInt(document.getElementById('inp-timeout').value) || 10) * 1000;
      saveConfig();
      updateConfigDisplay();
      if (isRunning) {
        clearInterval(intervalId);
        intervalId = setInterval(draw, CONFIG.interval);
      }
      modal.remove();
      showToast('设置已保存');
    };
  }

  function createPanel() {
    injectStyles();

    const panel = document.createElement('div');
    panel.id = 'acd-panel';
    panel.innerHTML = `
      <div class="acd-header">
        <span class="acd-title">自动抽卡</span><span class="acd-header-status" id="acd-header-status"></span>
        <div class="acd-header-right"><button class="acd-header-start" id="acd-header-start">▶</button><button class="acd-header-stop" id="acd-header-stop">⏹</button><button class="acd-min-btn">−</button></div>
      </div>
      <div class="acd-body">
        <div class="acd-config" id="acd-config"></div>
        <button id="acd-start" class="acd-btn">开始</button>
        <button id="acd-stop" class="acd-btn">停止</button>
        <button id="acd-setting" class="acd-btn">设置</button>
        <div class="acd-status"><span class="acd-dot"></span><span id="acd-status">准备就绪</span></div>
      </div>
    `;
    document.body.appendChild(panel);

    updateConfigDisplay();

    document.getElementById('acd-start').onclick = start;
    document.getElementById('acd-stop').onclick = () => stop('用户停止');
    document.getElementById('acd-setting').onclick = showSettings;
    document.getElementById('acd-header-stop').onclick = () => stop('用户停止');
    document.getElementById('acd-header-start').onclick = start;

    const header = panel.querySelector('.acd-header');
    const minBtn = panel.querySelector('.acd-min-btn');
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
      e.stopPropagation();
    });
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      e.preventDefault();
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
