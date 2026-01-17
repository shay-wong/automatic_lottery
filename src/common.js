// WindHub 通用工具模块
// @ts-check
'use strict';

window.WH = window.WH || {};

(function () {
  const PREFIX = 'wh';

  // ============== 存储函数 ==============
  function saveConfig(key, value) {
    const json = JSON.stringify(value);
    if (typeof GM_setValue === 'function') {
      GM_setValue(key, json);
    } else {
      localStorage.setItem(key, json);
    }
  }

  function loadConfig(key, defaultValue) {
    try {
      let json;
      if (typeof GM_getValue === 'function') {
        json = GM_getValue(key, null);
      } else {
        json = localStorage.getItem(key);
      }
      return json ? { ...defaultValue, ...JSON.parse(json) } : { ...defaultValue };
    } catch (e) {
      return { ...defaultValue };
    }
  }

  // ============== 工具函数 ==============
  function showToast(msg) {
    const toast = document.createElement('div');
    toast.className = `${PREFIX}-toast`;
    toast.textContent = msg;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  // 获取钱包余额
  function getWalletBalance() {
    const walletEl = document.querySelector('#nav-wallet, .wallet-balance, [data-wallet]');
    if (walletEl) {
      const text = walletEl.textContent.replace(/[^\d.-]/g, '');
      return parseFloat(text) || 0;
    }
    return 0;
  }

  function injectBaseStyles() {
    if (document.getElementById(`${PREFIX}-base-styles`)) return;

    const style = document.createElement('style');
    style.id = `${PREFIX}-base-styles`;
    style.textContent = `
      #${PREFIX}-panel, #${PREFIX}-settings, .${PREFIX}-toast {
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
        -webkit-font-smoothing: antialiased;
      }
      .${PREFIX}-toast {
        position: fixed; top: 20px; left: 50%; transform: translateX(-50%) translateY(-20px);
        background: rgba(255,255,255,0.95); backdrop-filter: blur(20px);
        color: #1d1d1f; padding: 10px 20px; border-radius: 99px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.15);
        font-size: 14px; font-weight: 500; z-index: 1000001;
        opacity: 0; transition: all 0.3s ease; pointer-events: none;
      }
      .${PREFIX}-toast.show { transform: translateX(-50%) translateY(0); opacity: 1; }

      #${PREFIX}-panel {
        position: fixed; top: 50px; right: 50px; width: 220px;
        background: rgba(28,28,30,0.85); backdrop-filter: blur(30px);
        border: 1px solid rgba(255,255,255,0.1); border-radius: 18px;
        box-shadow: 0 16px 32px rgba(0,0,0,0.4); z-index: 999999; color: #fff;
        overflow: hidden;
      }
      .${PREFIX}-header {
        padding: 14px 16px; display: flex; justify-content: space-between; align-items: center;
        cursor: move; border-bottom: 1px solid rgba(255,255,255,0.08);
        background: rgba(255,255,255,0.03); user-select: none;
      }
      .${PREFIX}-header-left { display: flex; flex-direction: column; }
      .${PREFIX}-title { font-weight: 600; font-size: 15px; color: rgba(255,255,255,0.95); display: flex; align-items: baseline; gap: 6px; }
      .${PREFIX}-version { font-size: 11px; font-weight: 400; color: rgba(235,235,245,0.4); }
      .${PREFIX}-header-status { display: none; font-size: 11px; color: rgba(235,235,245,0.5); margin-top: 6px; align-items: center; gap: 6px; }
      .${PREFIX}-header-status .${PREFIX}-dot { width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,0.2); }
      #${PREFIX}-panel.minimized .${PREFIX}-header-status { display: flex; }
      #${PREFIX}-panel.minimized.running .${PREFIX}-header-status .${PREFIX}-dot { background: #30d158; }
      .${PREFIX}-header-right { display: flex; gap: 6px; margin-left: 16px; }
      .${PREFIX}-header-stop { display: none; background: #ff453a; border: none; color: #fff; width: 26px; height: 26px; border-radius: 50%; cursor: pointer; font-size: 12px; line-height: 1; }
      .${PREFIX}-header-start { display: none; background: #30d158; border: none; color: #fff; width: 26px; height: 26px; border-radius: 50%; cursor: pointer; font-size: 12px; line-height: 1; }
      #${PREFIX}-panel.minimized.running .${PREFIX}-header-stop { display: block; }
      #${PREFIX}-panel.minimized:not(.running) .${PREFIX}-header-start { display: block; }
      .${PREFIX}-body { padding: 16px; }

      .${PREFIX}-config { background: rgba(0,0,0,0.2); border-radius: 10px; padding: 10px 14px; margin-bottom: 14px; }
      .${PREFIX}-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
      .${PREFIX}-row:last-child { margin-bottom: 0; }
      .${PREFIX}-label { font-size: 12px; color: rgba(235,235,245,0.6); }
      .${PREFIX}-val { color: #fff; font-weight: 600; font-size: 13px; }

      .${PREFIX}-stats { border-radius: 10px; padding: 10px 14px; margin-bottom: 14px; }

      .${PREFIX}-btn {
        width: 100%; height: 40px; border: none; border-radius: 10px;
        cursor: pointer; font-weight: 600; font-size: 14px; margin-bottom: 10px;
        color: white; transition: all 0.2s;
      }
      .${PREFIX}-btn:active { transform: scale(0.98); opacity: 0.9; }
      #${PREFIX}-start { background: #30d158; }
      #${PREFIX}-stop { background: #ff453a; display: none; }
      #${PREFIX}-setting { background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.9); font-weight: 500; }

      .${PREFIX}-status { font-size: 11px; color: rgba(235,235,245,0.5); text-align: center; display: flex; align-items: center; justify-content: center; gap: 6px; }
      .${PREFIX}-dot { width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,0.2); }

      .${PREFIX}-min-btn {
        background: rgba(255,255,255,0.1); border: none; color: rgba(255,255,255,0.8);
        width: 26px; height: 26px; border-radius: 50%; cursor: pointer;
        font-size: 16px; line-height: 1;
      }
      #${PREFIX}-panel.minimized .${PREFIX}-body { display: none; }
      #${PREFIX}-panel.minimized { width: auto; min-width: fit-content; }
      #${PREFIX}-panel.minimized .${PREFIX}-header { white-space: nowrap; }

      /* Resize handles */
      .${PREFIX}-resize-handle {
        position: absolute; z-index: 10;
      }
      .${PREFIX}-resize-e {
        right: 0; top: 18px; bottom: 0; width: 6px; cursor: ew-resize;
      }
      .${PREFIX}-resize-s {
        bottom: 0; left: 18px; right: 0; height: 6px; cursor: ns-resize;
      }
      .${PREFIX}-resize-se {
        right: 0; bottom: 0; width: 18px; height: 18px; cursor: nwse-resize;
      }
      .${PREFIX}-resize-w {
        left: 0; top: 18px; bottom: 0; width: 6px; cursor: ew-resize;
      }
      .${PREFIX}-resize-n {
        top: 0; left: 18px; right: 0; height: 6px; cursor: ns-resize;
      }
      .${PREFIX}-resize-nw {
        left: 0; top: 0; width: 18px; height: 18px; cursor: nwse-resize;
      }
      .${PREFIX}-resize-ne {
        right: 0; top: 0; width: 18px; height: 18px; cursor: nesw-resize;
      }
      .${PREFIX}-resize-sw {
        left: 0; bottom: 0; width: 18px; height: 18px; cursor: nesw-resize;
      }
      #${PREFIX}-panel.minimized .${PREFIX}-resize-handle { display: none; }

      #${PREFIX}-settings {
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        z-index: 1000000; display: flex; justify-content: center; align-items: center;
      }
      .${PREFIX}-backdrop {
        position: absolute; width: 100%; height: 100%;
        background: rgba(0,0,0,0.4); backdrop-filter: blur(10px);
      }
      .${PREFIX}-modal {
        position: relative; width: 280px;
        background: rgba(30,30,30,0.9); backdrop-filter: blur(40px);
        border-radius: 16px; box-shadow: 0 20px 40px rgba(0,0,0,0.5);
      }
      .${PREFIX}-modal-header { padding: 16px; text-align: center; }
      .${PREFIX}-modal-title { font-weight: 600; font-size: 16px; color: #fff; }
      .${PREFIX}-modal-body { padding: 0 16px 16px; }
      .${PREFIX}-input-group { background: rgba(255,255,255,0.08); border-radius: 10px; overflow: hidden; margin-bottom: 12px; }
      .${PREFIX}-input-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; border-bottom: 1px solid rgba(255,255,255,0.05); }
      .${PREFIX}-input-row:last-child { border-bottom: none; }
      .${PREFIX}-input-row label { font-size: 14px; color: #fff; }
      .${PREFIX}-input-row input[type="number"] {
        width: 80px; background: transparent; border: none;
        color: #0a84ff; text-align: right; font-size: 15px; outline: none;
      }
      .${PREFIX}-input-row select {
        background: transparent; border: none;
        color: #0a84ff; font-size: 14px; outline: none;
      }
      .${PREFIX}-input-row select option { background: #2c2c2e; color: #fff; }
      .${PREFIX}-toggle {
        position: relative; width: 51px; height: 31px;
        background: rgba(120,120,128,0.32); border-radius: 16px;
        cursor: pointer; transition: background 0.3s;
      }
      .${PREFIX}-toggle.active { background: #30d158; }
      .${PREFIX}-toggle::after {
        content: ''; position: absolute; top: 2px; left: 2px;
        width: 27px; height: 27px; background: #fff;
        border-radius: 50%; transition: transform 0.3s;
        box-shadow: 0 3px 8px rgba(0,0,0,0.15);
      }
      .${PREFIX}-toggle.active::after { transform: translateX(20px); }
      .${PREFIX}-modal-footer { display: flex; border-top: 1px solid rgba(84,84,88,0.5); }
      .${PREFIX}-modal-btn {
        flex: 1; height: 44px; border: none; background: transparent;
        font-size: 16px; cursor: pointer; color: #0a84ff;
      }
      .${PREFIX}-modal-btn:first-child { border-right: 1px solid rgba(84,84,88,0.5); border-bottom-left-radius: 16px; }
      .${PREFIX}-modal-btn:last-child { font-weight: 600; border-bottom-right-radius: 16px; }
      .${PREFIX}-modal-btn:active { background: rgba(255,255,255,0.1); }
    `;
    document.head.appendChild(style);
  }

  function createSettingsModal(title, content, onSave) {
    const existing = document.getElementById(`${PREFIX}-settings`);
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = `${PREFIX}-settings`;
    modal.innerHTML = `
      <div class="${PREFIX}-backdrop"></div>
      <div class="${PREFIX}-modal">
        <div class="${PREFIX}-modal-header"><div class="${PREFIX}-modal-title">${title}</div></div>
        <div class="${PREFIX}-modal-body">${content}</div>
        <div class="${PREFIX}-modal-footer">
          <button class="${PREFIX}-modal-btn" id="btn-cancel">取消</button>
          <button class="${PREFIX}-modal-btn" id="btn-save">保存</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector(`.${PREFIX}-backdrop`).onclick = () => modal.remove();
    document.getElementById('btn-cancel').onclick = () => modal.remove();
    document.getElementById('btn-save').onclick = () => {
      onSave();
      WH.updateConfigDisplay();
      modal.remove();
      showToast('设置已保存');
    };

    return modal;
  }

  // ============== 面板控制 ==============
  let currentModule = null;
  let isRunning = false;

  function updateStatus(msg) {
    const el1 = document.getElementById(`${PREFIX}-status`);
    const el2 = document.getElementById(`${PREFIX}-header-status-text`);
    if (el1) el1.textContent = msg;
    if (el2) el2.textContent = msg;
  }

  function updateStatsDisplay() {
    const el = document.getElementById(`${PREFIX}-stats`);
    if (el && currentModule) {
      el.innerHTML = currentModule.getStatsDisplay();
      // 绑定折叠按钮事件（农场模块）
      const toggleBtn = document.getElementById(`${PREFIX}-toggle-seeds`);
      if (toggleBtn && currentModule._seedListExpanded !== undefined) {
        toggleBtn.onclick = () => {
          currentModule._seedListExpanded = !currentModule._seedListExpanded;
          if (currentModule.config) {
            currentModule.config.seedListExpanded = currentModule._seedListExpanded;
            if (typeof currentModule.saveConfig === 'function') {
              currentModule.saveConfig();
            } else if (currentModule.configKey) {
              saveConfig(currentModule.configKey, currentModule.config);
            }
          }
          updateStatsDisplay();
        };
      }
    }
  }

  function updateConfigDisplay() {
    const el = document.getElementById(`${PREFIX}-config`);
    if (el && currentModule) el.innerHTML = currentModule.getConfigDisplay();
  }

  function updateBtnState() {
    const startBtn = document.getElementById(`${PREFIX}-start`);
    const stopBtn = document.getElementById(`${PREFIX}-stop`);
    const panel = document.getElementById(`${PREFIX}-panel`);
    const dot = document.querySelector(`#${PREFIX}-panel .${PREFIX}-dot`);

    if (startBtn) startBtn.style.display = isRunning ? 'none' : 'block';
    if (stopBtn) stopBtn.style.display = isRunning ? 'block' : 'none';
    if (panel) panel.classList.toggle('running', isRunning);
    if (dot) dot.style.background = isRunning ? '#30d158' : 'rgba(255,255,255,0.2)';
  }

  function start() {
    if (!currentModule) return;
    isRunning = true;
    currentModule.start();
    updateBtnState();
    showToast(`开始${currentModule.name}`);
  }

  function stop(reason = '已停止') {
    if (!currentModule) return;
    isRunning = false;
    currentModule.stop();
    updateBtnState();
    updateStatus(reason);
  }

  function createPanel() {
    // 防止重复创建面板
    if (document.getElementById(`${PREFIX}-panel`)) {
      console.log('[WindHub] 面板已存在，跳过创建');
      return;
    }

    injectBaseStyles();

    const panelStateKey = `${PREFIX}_panel_state_${currentModule?.configKey || 'default'}`;
    const panelState = loadConfig(panelStateKey, {
      left: null,
      top: null,
      width: null,
      height: null,
      minimized: false
    });

    // 添加模块特定样式
    const moduleStyle = document.createElement('style');
    moduleStyle.textContent = `
      .${PREFIX}-stats { background: rgba(${currentModule.color === '#30d158' ? '48,209,88' : currentModule.color === '#fbbf24' ? '251,191,36' : '96,165,250'},0.15); }
      .${PREFIX}-stats .${PREFIX}-val { color: ${currentModule.color}; }
    `;
    document.head.appendChild(moduleStyle);

    const version = WH.version || '';
    const versionDisplay = version ? `<span class="${PREFIX}-version">v${version}</span>` : '';

    const panel = document.createElement('div');
    panel.id = `${PREFIX}-panel`;
    panel.innerHTML = `
      <div class="${PREFIX}-header">
        <div class="${PREFIX}-header-left">
          <span class="${PREFIX}-title">${currentModule.name}${versionDisplay}</span>
          <div class="${PREFIX}-header-status" id="${PREFIX}-header-status"><span class="${PREFIX}-dot"></span><span id="${PREFIX}-header-status-text">准备就绪</span></div>
        </div>
        <div class="${PREFIX}-header-right">
          <button class="${PREFIX}-header-start" id="${PREFIX}-header-start">▶</button>
          <button class="${PREFIX}-header-stop" id="${PREFIX}-header-stop">⏹</button>
          <button class="${PREFIX}-min-btn">−</button>
        </div>
      </div>
      <div class="${PREFIX}-body">
        <div class="${PREFIX}-config" id="${PREFIX}-config"></div>
        <div class="${PREFIX}-stats" id="${PREFIX}-stats"></div>
        <button id="${PREFIX}-start" class="${PREFIX}-btn">开始</button>
        <button id="${PREFIX}-stop" class="${PREFIX}-btn">停止</button>
        <button id="${PREFIX}-setting" class="${PREFIX}-btn">设置</button>
        <div class="${PREFIX}-status"><span class="${PREFIX}-dot"></span><span id="${PREFIX}-status">准备就绪</span></div>
      </div>
      <div class="${PREFIX}-resize-handle ${PREFIX}-resize-e" data-resize="e"></div>
      <div class="${PREFIX}-resize-handle ${PREFIX}-resize-s" data-resize="s"></div>
      <div class="${PREFIX}-resize-handle ${PREFIX}-resize-se" data-resize="se"></div>
      <div class="${PREFIX}-resize-handle ${PREFIX}-resize-w" data-resize="w"></div>
      <div class="${PREFIX}-resize-handle ${PREFIX}-resize-n" data-resize="n"></div>
      <div class="${PREFIX}-resize-handle ${PREFIX}-resize-nw" data-resize="nw"></div>
      <div class="${PREFIX}-resize-handle ${PREFIX}-resize-ne" data-resize="ne"></div>
      <div class="${PREFIX}-resize-handle ${PREFIX}-resize-sw" data-resize="sw"></div>
    `;
    document.body.appendChild(panel);

    updateConfigDisplay();
    updateStatsDisplay();

    document.getElementById(`${PREFIX}-start`).onclick = start;
    document.getElementById(`${PREFIX}-stop`).onclick = () => stop('用户停止');
    document.getElementById(`${PREFIX}-setting`).onclick = () => currentModule.showSettings();
    document.getElementById(`${PREFIX}-header-stop`).onclick = () => stop('用户停止');
    document.getElementById(`${PREFIX}-header-start`).onclick = start;

    const header = panel.querySelector(`.${PREFIX}-header`);
    const minBtn = panel.querySelector(`.${PREFIX}-min-btn`);

    const applyPanelState = () => {
      if (typeof panelState.left === 'number') {
        panel.style.left = panelState.left + 'px';
        panel.style.right = 'auto';
      }
      if (typeof panelState.top === 'number') {
        panel.style.top = panelState.top + 'px';
      }
      if (typeof panelState.width === 'number') {
        panel.dataset.expandedWidth = String(panelState.width);
      }
      if (typeof panelState.height === 'number') {
        panel.dataset.expandedHeight = String(panelState.height);
      }
      if (panelState.minimized) {
        panel.classList.add('minimized');
        minBtn.textContent = '+';
        panel.style.width = '';
        panel.style.height = '';
      } else {
        if (typeof panelState.width === 'number') panel.style.width = panelState.width + 'px';
        if (typeof panelState.height === 'number') panel.style.height = panelState.height + 'px';
      }
    };

    const savePanelState = (forceMinimized) => {
      const rect = panel.getBoundingClientRect();
      const isMinimized = typeof forceMinimized === 'boolean'
        ? forceMinimized
        : panel.classList.contains('minimized');
      let width = rect.width;
      let height = rect.height;

      if (!isMinimized) {
        panel.dataset.expandedWidth = String(Math.round(rect.width));
        panel.dataset.expandedHeight = String(Math.round(rect.height));
      } else {
        const cachedWidth = Number(panel.dataset.expandedWidth);
        const cachedHeight = Number(panel.dataset.expandedHeight);
        if (Number.isFinite(cachedWidth)) width = cachedWidth;
        if (Number.isFinite(cachedHeight)) height = cachedHeight;
      }

      saveConfig(panelStateKey, {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        width: Math.round(width),
        height: Math.round(height),
        minimized: isMinimized
      });
    };

    minBtn.onclick = () => {
      if (!panel.classList.contains('minimized')) {
        const rect = panel.getBoundingClientRect();
        panel.dataset.expandedWidth = String(Math.round(rect.width));
        panel.dataset.expandedHeight = String(Math.round(rect.height));
      }
      panel.classList.toggle('minimized');
      const isMinimized = panel.classList.contains('minimized');
      if (isMinimized) {
        panel.style.width = '';
        panel.style.height = '';
      } else {
        const cachedWidth = Number(panel.dataset.expandedWidth);
        const cachedHeight = Number(panel.dataset.expandedHeight);
        if (Number.isFinite(cachedWidth)) panel.style.width = cachedWidth + 'px';
        if (Number.isFinite(cachedHeight)) panel.style.height = cachedHeight + 'px';
      }
      minBtn.textContent = isMinimized ? '+' : '−';
      savePanelState(isMinimized);
    };

    applyPanelState();

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
        savePanelState();
      }
    });

    // 边缘拖拽调整大小
    let resizing = false, resizeDir = '', startX, startY, startW, startH, startLeft, startTop;
    const MIN_WIDTH = 180, MIN_HEIGHT = 200;

    panel.querySelectorAll(`.${PREFIX}-resize-handle`).forEach(handle => {
      handle.addEventListener('mousedown', (e) => {
        resizing = true;
        resizeDir = handle.dataset.resize;
        startX = e.clientX;
        startY = e.clientY;
        const rect = panel.getBoundingClientRect();
        startW = rect.width;
        startH = rect.height;
        startLeft = rect.left;
        startTop = rect.top;
        panel.style.transition = 'none';
        e.preventDefault();
        e.stopPropagation();
      });
    });

    window.addEventListener('mousemove', (e) => {
      if (!resizing) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      let newW = startW, newH = startH, newLeft = startLeft, newTop = startTop;

      // 水平方向
      if (resizeDir.includes('e')) {
        newW = Math.max(MIN_WIDTH, startW + dx);
      }
      if (resizeDir.includes('w')) {
        const w = Math.max(MIN_WIDTH, startW - dx);
        newLeft = startLeft + (startW - w);
        newW = w;
      }

      // 垂直方向
      if (resizeDir.includes('s')) {
        newH = Math.max(MIN_HEIGHT, startH + dy);
      }
      if (resizeDir.includes('n')) {
        const h = Math.max(MIN_HEIGHT, startH - dy);
        newTop = startTop + (startH - h);
        newH = h;
      }

      panel.style.width = newW + 'px';
      panel.style.height = newH + 'px';
      panel.style.left = newLeft + 'px';
      panel.style.top = newTop + 'px';
      panel.style.right = 'auto';
    });

    window.addEventListener('mouseup', () => {
      if (resizing) {
        resizing = false;
        panel.style.transition = '';
        savePanelState(false);
      }
    });
  }

  function init(module) {
    currentModule = module;
    currentModule.init();
    createPanel();
  }

  // 导出到全局
  WH.PREFIX = PREFIX;
  WH.showToast = showToast;
  WH.getWalletBalance = getWalletBalance;
  WH.saveConfig = saveConfig;
  WH.loadConfig = loadConfig;
  WH.createSettingsModal = createSettingsModal;
  WH.updateStatus = updateStatus;
  WH.updateStatsDisplay = updateStatsDisplay;
  WH.updateConfigDisplay = updateConfigDisplay;
  WH.init = init;
  WH.isRunning = () => isRunning;
  WH.stop = stop;
})();
