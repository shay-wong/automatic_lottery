// ==UserScript==
// @name         WindHub 自动化助手
// @version      1.0.0
// @description  WindHub 福利站自动化脚本，支持农场、抽卡、打砖块
// @license      Apache-2.0
// @homepage     https://github.com/shay-wong/automatic_lottery
// @updateURL    https://raw.githubusercontent.com/shay-wong/automatic_lottery/master/auto-windhub.user.js
// @downloadURL  https://raw.githubusercontent.com/shay-wong/automatic_lottery/master/auto-windhub.user.js
// @supportURL   https://github.com/shay-wong/automatic_lottery/issues
// @match        https://wcdk.224442.xyz/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // ============== 通用工具 ==============
  const PREFIX = 'wh';

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
      .${PREFIX}-title { font-weight: 600; font-size: 15px; color: rgba(255,255,255,0.95); }
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

  // ============== 农场模块 ==============
  const FarmModule = {
    name: '自动农场',
    color: '#30d158',
    configKey: 'wh_farm_config',
    defaultConfig: {
      interval: 30000,
      autoHarvest: true,
      autoPlant: true,
      selectedSeed: null,
    },
    config: null,
    isRunning: false,
    intervalId: null,
    stats: { harvested: 0, planted: 0 },

    init() {
      this.config = { ...this.defaultConfig };
      try {
        const saved = localStorage.getItem(this.configKey);
        if (saved) this.config = { ...this.defaultConfig, ...JSON.parse(saved) };
      } catch (e) {}
    },

    saveConfig() {
      localStorage.setItem(this.configKey, JSON.stringify(this.config));
    },

    getAvailableSeeds() {
      const seedItems = document.querySelectorAll('.seed-item:not(.locked)');
      const seeds = [];
      seedItems.forEach(item => {
        const nameEl = item.querySelector('.seed-name');
        const name = nameEl ? nameEl.textContent.trim() : item.getAttribute('title') || '未知';
        const id = item.getAttribute('data-crop-key');
        if (id) seeds.push({ id, name, element: item });
      });
      return seeds;
    },

    getFarmStatus() {
      const tiles = document.querySelectorAll('.tile');
      let empty = 0, growing = 0, ready = 0;
      tiles.forEach(tile => {
        if (tile.classList.contains('empty')) empty++;
        else if (tile.classList.contains('ready')) ready++;
        else if (tile.classList.contains('growing')) growing++;
      });
      return { empty, growing, ready, total: tiles.length };
    },

    async harvest() {
      if (!this.config.autoHarvest) return 0;
      const status = this.getFarmStatus();
      if (status.ready === 0) return 0;

      const harvestAllBtn = document.querySelector('#btn-harvest-all');
      if (harvestAllBtn && !harvestAllBtn.disabled) {
        harvestAllBtn.click();
        this.stats.harvested += status.ready;
        showToast(`收割了 ${status.ready} 块作物`);
        return status.ready;
      }

      if (typeof window.doAction === 'function') {
        try {
          await window.doAction('harvest_all', {});
          this.stats.harvested += status.ready;
          showToast(`收割了 ${status.ready} 块作物`);
          return status.ready;
        } catch (e) {}
      }

      const readyTiles = document.querySelectorAll('.tile.ready');
      let count = 0;
      for (const tile of readyTiles) {
        tile.click();
        count++;
        await new Promise(r => setTimeout(r, 100));
      }
      this.stats.harvested += count;
      if (count > 0) showToast(`收割了 ${count} 块作物`);
      return count;
    },

    async plant() {
      if (!this.config.autoPlant) return 0;
      const status = this.getFarmStatus();
      if (status.empty === 0) return 0;

      const seeds = this.getAvailableSeeds();
      if (seeds.length === 0) return 0;

      let selectedSeed = seeds[0];
      if (this.config.selectedSeed) {
        const found = seeds.find(s => s.id === this.config.selectedSeed);
        if (found) selectedSeed = found;
      }

      const emptyTiles = document.querySelectorAll('.tile.empty');
      const plotIndices = [];
      emptyTiles.forEach(tile => {
        const index = tile.dataset.plotIndex;
        if (index !== undefined) plotIndices.push(parseInt(index));
      });

      if (plotIndices.length === 0) return 0;

      if (typeof window.doAction === 'function') {
        try {
          await window.doAction('plant_many', {
            crop_key: selectedSeed.id,
            plot_indices: JSON.stringify(plotIndices)
          });
          this.stats.planted += plotIndices.length;
          showToast(`种植了 ${plotIndices.length} 块 ${selectedSeed.name}`);
          return plotIndices.length;
        } catch (e) {}
      }

      let count = 0;
      if (selectedSeed.element) {
        selectedSeed.element.click();
        await new Promise(r => setTimeout(r, 200));
      }
      for (const tile of emptyTiles) {
        tile.click();
        count++;
        await new Promise(r => setTimeout(r, 150));
        if (count >= 10) break;
      }
      this.stats.planted += count;
      if (count > 0) showToast(`种植了 ${count} 块`);
      return count;
    },

    async loop() {
      if (!this.isRunning) return;
      const status = this.getFarmStatus();
      updateStatus(`检查中... (空:${status.empty} 长:${status.growing} 熟:${status.ready})`);

      if (status.ready > 0) {
        await this.harvest();
        await new Promise(r => setTimeout(r, 500));
      }
      const newStatus = this.getFarmStatus();
      if (newStatus.empty > 0) await this.plant();

      const finalStatus = this.getFarmStatus();
      updateStatus(`空:${finalStatus.empty} 长:${finalStatus.growing} 熟:${finalStatus.ready}`);
      updateStatsDisplay();
    },

    start() {
      this.isRunning = true;
      this.loop();
      this.intervalId = setInterval(() => this.loop(), this.config.interval);
    },

    stop() {
      this.isRunning = false;
      clearInterval(this.intervalId);
      this.intervalId = null;
    },

    getConfigDisplay() {
      const seeds = this.getAvailableSeeds();
      const seedName = this.config.selectedSeed
        ? (seeds.find(s => s.id === this.config.selectedSeed)?.name || '自动')
        : '自动';
      return `
        <div class="${PREFIX}-row"><span class="${PREFIX}-label">检查间隔</span><span class="${PREFIX}-val">${this.config.interval / 1000}秒</span></div>
        <div class="${PREFIX}-row"><span class="${PREFIX}-label">自动收割</span><span class="${PREFIX}-val">${this.config.autoHarvest ? '开' : '关'}</span></div>
        <div class="${PREFIX}-row"><span class="${PREFIX}-label">自动种植</span><span class="${PREFIX}-val">${this.config.autoPlant ? '开' : '关'}</span></div>
        <div class="${PREFIX}-row"><span class="${PREFIX}-label">种子</span><span class="${PREFIX}-val">${seedName}</span></div>
      `;
    },

    getStatsDisplay() {
      return `
        <div class="${PREFIX}-row"><span class="${PREFIX}-label">已收割</span><span class="${PREFIX}-val">${this.stats.harvested}</span></div>
        <div class="${PREFIX}-row"><span class="${PREFIX}-label">已种植</span><span class="${PREFIX}-val">${this.stats.planted}</span></div>
      `;
    },

    showSettings() {
      const seeds = this.getAvailableSeeds();
      const seedOptions = seeds.map(s =>
        `<option value="${s.id}" ${this.config.selectedSeed === s.id ? 'selected' : ''}>${s.name}</option>`
      ).join('');

      const modal = createSettingsModal('农场设置', `
        <div class="${PREFIX}-input-group">
          <div class="${PREFIX}-input-row">
            <label>检查间隔 (秒)</label>
            <input type="number" id="inp-interval" value="${this.config.interval / 1000}" min="10">
          </div>
        </div>
        <div class="${PREFIX}-input-group">
          <div class="${PREFIX}-input-row">
            <label>自动收割</label>
            <div class="${PREFIX}-toggle ${this.config.autoHarvest ? 'active' : ''}" id="tog-harvest"></div>
          </div>
          <div class="${PREFIX}-input-row">
            <label>自动种植</label>
            <div class="${PREFIX}-toggle ${this.config.autoPlant ? 'active' : ''}" id="tog-plant"></div>
          </div>
        </div>
        <div class="${PREFIX}-input-group">
          <div class="${PREFIX}-input-row">
            <label>种子选择</label>
            <select id="sel-seed"><option value="">自动选择</option>${seedOptions}</select>
          </div>
        </div>
      `, () => {
        this.config.interval = Math.max(10, parseInt(document.getElementById('inp-interval').value) || 30) * 1000;
        this.config.autoHarvest = document.getElementById('tog-harvest').classList.contains('active');
        this.config.autoPlant = document.getElementById('tog-plant').classList.contains('active');
        this.config.selectedSeed = document.getElementById('sel-seed').value || null;
        this.saveConfig();
        if (this.isRunning) {
          clearInterval(this.intervalId);
          this.intervalId = setInterval(() => this.loop(), this.config.interval);
        }
      });

      document.getElementById('tog-harvest').onclick = (e) => e.target.classList.toggle('active');
      document.getElementById('tog-plant').onclick = (e) => e.target.classList.toggle('active');
    }
  };

  // ============== 抽卡模块 ==============
  const CardsModule = {
    name: '自动抽卡',
    color: '#fbbf24',
    configKey: 'wh_cards_config',
    defaultConfig: {
      interval: 3000,
      mode: 'single',
      autoStop: true,
    },
    config: null,
    isRunning: false,
    intervalId: null,
    stats: { draws: 0, cards: 0 },

    init() {
      this.config = { ...this.defaultConfig };
      try {
        const saved = localStorage.getItem(this.configKey);
        if (saved) this.config = { ...this.defaultConfig, ...JSON.parse(saved) };
      } catch (e) {}
    },

    saveConfig() {
      localStorage.setItem(this.configKey, JSON.stringify(this.config));
    },

    getRemaining() {
      const el = document.getElementById('draw-remaining');
      if (el) {
        const num = parseInt(el.textContent.trim());
        return isNaN(num) ? 0 : num;
      }
      return 0;
    },

    draw() {
      if (!this.isRunning) return;

      const remaining = this.getRemaining();
      if (remaining <= 0 && this.config.autoStop) {
        this.stop();
        showToast('抽卡次数已用完');
        updateStatus('次数已用完');
        return;
      }

      updateStatus('抽卡中...');

      const btnId = this.config.mode === 'ten' ? 'btn-ten' : 'btn-single';
      const btn = document.getElementById(btnId);

      if (btn && !btn.disabled) {
        if (this.config.mode === 'ten' && remaining < 10) {
          const singleBtn = document.getElementById('btn-single');
          if (singleBtn && !singleBtn.disabled) {
            singleBtn.click();
            this.stats.draws++;
            this.stats.cards++;
          }
        } else {
          btn.click();
          this.stats.draws++;
          this.stats.cards += this.config.mode === 'ten' ? 10 : 1;
        }
        updateStatus(`已抽 ${this.stats.draws} 次`);
        updateStatsDisplay();
      } else if (typeof window.doDraw === 'function') {
        const count = this.config.mode === 'ten' && remaining >= 10 ? 10 : 1;
        window.doDraw(count);
        this.stats.draws++;
        this.stats.cards += count;
        updateStatus(`已抽 ${this.stats.draws} 次`);
        updateStatsDisplay();
      }
    },

    start() {
      this.isRunning = true;
      this.stats = { draws: 0, cards: 0 };
      this.draw();
      this.intervalId = setInterval(() => this.draw(), this.config.interval);
    },

    stop() {
      this.isRunning = false;
      clearInterval(this.intervalId);
      this.intervalId = null;
    },

    getConfigDisplay() {
      const modeText = this.config.mode === 'ten' ? '十连' : '单抽';
      return `
        <div class="${PREFIX}-row"><span class="${PREFIX}-label">抽卡间隔</span><span class="${PREFIX}-val">${this.config.interval / 1000}秒</span></div>
        <div class="${PREFIX}-row"><span class="${PREFIX}-label">抽卡模式</span><span class="${PREFIX}-val">${modeText}</span></div>
        <div class="${PREFIX}-row"><span class="${PREFIX}-label">自动停止</span><span class="${PREFIX}-val">${this.config.autoStop ? '开' : '关'}</span></div>
      `;
    },

    getStatsDisplay() {
      const remaining = this.getRemaining();
      return `
        <div class="${PREFIX}-row"><span class="${PREFIX}-label">剩余次数</span><span class="${PREFIX}-val">${remaining}</span></div>
        <div class="${PREFIX}-row"><span class="${PREFIX}-label">已抽次数</span><span class="${PREFIX}-val">${this.stats.draws}</span></div>
        <div class="${PREFIX}-row"><span class="${PREFIX}-label">获得卡片</span><span class="${PREFIX}-val">${this.stats.cards}</span></div>
      `;
    },

    showSettings() {
      const modal = createSettingsModal('抽卡设置', `
        <div class="${PREFIX}-input-group">
          <div class="${PREFIX}-input-row">
            <label>抽卡间隔 (秒)</label>
            <input type="number" id="inp-interval" value="${this.config.interval / 1000}" min="1">
          </div>
        </div>
        <div class="${PREFIX}-input-group">
          <div class="${PREFIX}-input-row">
            <label>抽卡模式</label>
            <select id="sel-mode">
              <option value="single" ${this.config.mode === 'single' ? 'selected' : ''}>单抽</option>
              <option value="ten" ${this.config.mode === 'ten' ? 'selected' : ''}>十连</option>
            </select>
          </div>
        </div>
        <div class="${PREFIX}-input-group">
          <div class="${PREFIX}-input-row">
            <label>次数用完自动停止</label>
            <div class="${PREFIX}-toggle ${this.config.autoStop ? 'active' : ''}" id="tog-autostop"></div>
          </div>
        </div>
      `, () => {
        this.config.interval = Math.max(1, parseInt(document.getElementById('inp-interval').value) || 3) * 1000;
        this.config.mode = document.getElementById('sel-mode').value;
        this.config.autoStop = document.getElementById('tog-autostop').classList.contains('active');
        this.saveConfig();
        if (this.isRunning) {
          clearInterval(this.intervalId);
          this.intervalId = setInterval(() => this.draw(), this.config.interval);
        }
      });

      document.getElementById('tog-autostop').onclick = (e) => e.target.classList.toggle('active');
    }
  };

  // ============== 打砖块模块 ==============
  const BrickModule = {
    name: '自动打砖块',
    color: '#60a5fa',
    configKey: 'wh_brick_config',
    defaultConfig: {
      autoStart: true,
      smoothing: 0.3,
    },
    config: null,
    isRunning: false,
    animationId: null,
    stats: { games: 0, bricks: 0, chests: 0 },
    gameState: { ball: null, paddle: null, canvas: null },
    lastStartTime: null,

    init() {
      this.config = { ...this.defaultConfig };
      try {
        const saved = localStorage.getItem(this.configKey);
        if (saved) this.config = { ...this.defaultConfig, ...JSON.parse(saved) };
      } catch (e) {}
    },

    saveConfig() {
      localStorage.setItem(this.configKey, JSON.stringify(this.config));
    },

    initCanvas() {
      this.gameState.canvas = document.getElementById('game-canvas');
    },

    movePaddle(x) {
      if (!this.gameState.canvas) return;
      const rect = this.gameState.canvas.getBoundingClientRect();
      const event = new PointerEvent('pointermove', {
        bubbles: true, cancelable: true,
        clientX: rect.left + x,
        clientY: rect.top + rect.height - 50,
        pointerType: 'mouse'
      });
      this.gameState.canvas.dispatchEvent(event);
    },

    pressKey(key) {
      const keyCode = key === ' ' ? 32 : (key === 'ArrowLeft' ? 37 : (key === 'ArrowRight' ? 39 : 0));
      document.dispatchEvent(new KeyboardEvent('keydown', {
        key, code: key === ' ' ? 'Space' : key, keyCode, which: keyCode, bubbles: true
      }));
    },

    getBallPosition() {
      if (window.ball) return { x: window.ball.x, y: window.ball.y, vx: window.ball.vx || 0, vy: window.ball.vy || 0 };
      if (window.gameState?.ball) return window.gameState.ball;
      if (window.state?.ball) return window.state.ball;
      return null;
    },

    getPaddleInfo() {
      if (window.paddle) return { x: window.paddle.x, width: window.paddle.width || 100 };
      if (window.gameState?.paddle) return window.gameState.paddle;
      if (window.state?.paddle) return window.state.paddle;
      return null;
    },

    predictBallX(ball, canvasHeight, paddleY) {
      if (!ball || ball.vy <= 0) return ball ? ball.x : (this.gameState.canvas?.width || 400) / 2;
      let x = ball.x, y = ball.y, vx = ball.vx, vy = ball.vy;
      const canvasWidth = this.gameState.canvas?.width || 400;
      while (y < paddleY && vy > 0) {
        x += vx; y += vy;
        if (x <= 0 || x >= canvasWidth) { vx = -vx; x = Math.max(0, Math.min(canvasWidth, x)); }
      }
      return x;
    },

    isElementVisible(el) {
      if (!el) return false;
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
    },

    isGamePlaying() {
      const pauseBtn = document.getElementById('btn-pause');
      const startBtn = document.getElementById('btn-start');
      // 游戏进行中：暂停按钮可见，开始按钮不可见
      return this.isElementVisible(pauseBtn) && !this.isElementVisible(startBtn);
    },

    canStartGame() {
      // 防止频繁点击开始按钮
      if (this.lastStartTime && Date.now() - this.lastStartTime < 3000) return false;
      const startBtn = document.getElementById('btn-start');
      return startBtn && !startBtn.disabled && this.isElementVisible(startBtn);
    },

    startNewGame() {
      const startBtn = document.getElementById('btn-start');
      if (startBtn && !startBtn.disabled && this.isElementVisible(startBtn)) {
        this.lastStartTime = Date.now();
        startBtn.click();
        this.stats.games++;
        updateStatsDisplay();
        setTimeout(() => this.pressKey(' '), 1500);
      }
    },

    loop() {
      if (!this.isRunning) return;

      if (!this.isGamePlaying()) {
        if (this.config.autoStart && this.canStartGame()) {
          updateStatus('启动新游戏...');
          this.startNewGame();
        } else {
          updateStatus('等待游戏...');
        }
        this.animationId = requestAnimationFrame(() => this.loop());
        return;
      }

      const ball = this.getBallPosition();
      const paddle = this.getPaddleInfo();

      if (ball && this.gameState.canvas) {
        const canvasHeight = this.gameState.canvas.height;
        const paddleY = canvasHeight - 30;
        let targetX = ball.vy > 0 ? this.predictBallX(ball, canvasHeight, paddleY) : ball.x;
        const currentX = paddle ? paddle.x : this.gameState.canvas.width / 2;
        const smoothedX = currentX + (targetX - currentX) * this.config.smoothing;
        this.movePaddle(smoothedX);

        const normalEl = document.getElementById('stat-normal');
        const chestEl = document.getElementById('stat-chest');
        if (normalEl) { const n = parseInt(normalEl.textContent) || 0; if (n > this.stats.bricks) this.stats.bricks = n; }
        if (chestEl) { const c = parseInt(chestEl.textContent) || 0; if (c > this.stats.chests) this.stats.chests = c; }
        updateStatsDisplay();
        updateStatus(`追踪中 X:${Math.round(targetX)}`);
      } else {
        if (this.gameState.canvas) this.movePaddle(this.gameState.canvas.width / 2);
        updateStatus('追踪模式');
      }

      this.animationId = requestAnimationFrame(() => this.loop());
    },

    start() {
      this.isRunning = true;
      this.initCanvas();
      this.loop();
    },

    stop() {
      this.isRunning = false;
      if (this.animationId) { cancelAnimationFrame(this.animationId); this.animationId = null; }
    },

    getConfigDisplay() {
      return `
        <div class="${PREFIX}-row"><span class="${PREFIX}-label">自动开始</span><span class="${PREFIX}-val">${this.config.autoStart ? '开' : '关'}</span></div>
        <div class="${PREFIX}-row"><span class="${PREFIX}-label">平滑度</span><span class="${PREFIX}-val">${this.config.smoothing}</span></div>
      `;
    },

    getStatsDisplay() {
      return `
        <div class="${PREFIX}-row"><span class="${PREFIX}-label">游戏次数</span><span class="${PREFIX}-val">${this.stats.games}</span></div>
        <div class="${PREFIX}-row"><span class="${PREFIX}-label">击碎砖块</span><span class="${PREFIX}-val">${this.stats.bricks}</span></div>
        <div class="${PREFIX}-row"><span class="${PREFIX}-label">开启宝箱</span><span class="${PREFIX}-val">${this.stats.chests}</span></div>
      `;
    },

    showSettings() {
      const modal = createSettingsModal('砖块设置', `
        <div class="${PREFIX}-input-group">
          <div class="${PREFIX}-input-row">
            <label>自动开始新游戏</label>
            <div class="${PREFIX}-toggle ${this.config.autoStart ? 'active' : ''}" id="tog-autostart"></div>
          </div>
        </div>
        <div class="${PREFIX}-input-group">
          <div class="${PREFIX}-input-row">
            <label>移动平滑度</label>
            <input type="number" id="inp-smoothing" value="${this.config.smoothing}" min="0.1" max="1" step="0.1">
          </div>
        </div>
      `, () => {
        this.config.autoStart = document.getElementById('tog-autostart').classList.contains('active');
        this.config.smoothing = Math.max(0.1, Math.min(1, parseFloat(document.getElementById('inp-smoothing').value) || 0.3));
        this.saveConfig();
      });

      document.getElementById('tog-autostart').onclick = (e) => e.target.classList.toggle('active');
    }
  };

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
    if (el && currentModule) el.innerHTML = currentModule.getStatsDisplay();
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
      updateConfigDisplay();
      modal.remove();
      showToast('设置已保存');
    };

    return modal;
  }

  function createPanel() {
    injectBaseStyles();

    // 添加模块特定样式
    const moduleStyle = document.createElement('style');
    moduleStyle.textContent = `
      .${PREFIX}-stats { background: rgba(${currentModule.color === '#30d158' ? '48,209,88' : currentModule.color === '#fbbf24' ? '251,191,36' : '96,165,250'},0.15); }
      .${PREFIX}-stats .${PREFIX}-val { color: ${currentModule.color}; }
    `;
    document.head.appendChild(moduleStyle);

    const panel = document.createElement('div');
    panel.id = `${PREFIX}-panel`;
    panel.innerHTML = `
      <div class="${PREFIX}-header">
        <div class="${PREFIX}-header-left">
          <span class="${PREFIX}-title">${currentModule.name}</span>
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
      if (dragging) { dragging = false; panel.style.transition = ''; }
    });
  }

  // ============== 初始化 ==============
  function init() {
    const path = window.location.pathname;

    if (path.includes('farm.php')) {
      currentModule = FarmModule;
    } else if (path.includes('cards.php')) {
      currentModule = CardsModule;
    } else if (path.includes('game.php')) {
      currentModule = BrickModule;
    } else {
      return; // 不支持的页面
    }

    currentModule.init();
    createPanel();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 1000));
  } else {
    setTimeout(init, 1000);
  }
})();
