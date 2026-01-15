// WindHub 打砖块模块
// @ts-check
'use strict';

window.WH = window.WH || {};

(function () {
  const PREFIX = WH.PREFIX || 'wh';

  const BrickModule = {
    name: '自动打砖块',
    color: '#60a5fa',
    configKey: 'wh_brick_config',
    defaultConfig: {
      autoStart: true,
      speed: 8,
      maxGames: 0, // 0 表示无限制
      minBalance: 0, // 最低余额阈值，0 表示不限制
    },
    config: null,
    isRunning: false,
    animationId: null,
    stats: { games: 0, bricks: 0, chests: 0 },
    gameState: { canvas: null },
    lastStartTime: null,
    scanPosition: 0,
    scanDirection: 1,

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
      if (this.gameState.canvas) {
        this.scanPosition = this.gameState.canvas.width / 2;
      }
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

    isElementVisible(el) {
      if (!el) return false;
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
    },

    isGamePlaying() {
      const pauseBtn = document.getElementById('btn-pause');
      const startBtn = document.getElementById('btn-start');
      return this.isElementVisible(pauseBtn) && !this.isElementVisible(startBtn);
    },

    canStartGame() {
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
        WH.updateStatsDisplay();
        if (this.gameState.canvas) {
          this.scanPosition = this.gameState.canvas.width / 2;
        }
        setTimeout(() => this.pressKey(' '), 1500);
      }
    },

    updateScanPosition() {
      if (!this.gameState.canvas) return;
      const width = this.gameState.canvas.width;
      const padding = 60;

      this.scanPosition += this.config.speed * this.scanDirection;

      if (this.scanPosition >= width - padding) {
        this.scanPosition = width - padding;
        this.scanDirection = -1;
      } else if (this.scanPosition <= padding) {
        this.scanPosition = padding;
        this.scanDirection = 1;
      }
    },

    loop() {
      if (!this.isRunning) return;

      // 检查是否达到局数限制
      if (this.config.maxGames > 0 && this.stats.games >= this.config.maxGames) {
        WH.showToast(`已完成 ${this.config.maxGames} 局游戏`);
        WH.updateStatus(`已完成 ${this.config.maxGames} 局`);
        this.stop();
        return;
      }

      // 检查余额是否低于阈值
      if (this.config.minBalance > 0) {
        const currentBalance = WH.getWalletBalance();
        if (currentBalance < this.config.minBalance) {
          WH.showToast(`余额不足，当前 ${currentBalance.toFixed(0)}，最低 ${this.config.minBalance}`);
          WH.updateStatus('余额不足，已停止');
          this.stop();
          return;
        }
      }

      if (!this.isGamePlaying()) {
        if (this.config.autoStart && this.canStartGame()) {
          WH.updateStatus('启动新游戏...');
          this.startNewGame();
        } else {
          WH.updateStatus('等待游戏...');
        }
        this.animationId = requestAnimationFrame(() => this.loop());
        return;
      }

      this.updateScanPosition();
      this.movePaddle(this.scanPosition);

      const normalEl = document.getElementById('stat-normal');
      const chestEl = document.getElementById('stat-chest');
      if (normalEl) {
        const n = parseInt(normalEl.textContent) || 0;
        if (n > this.stats.bricks) this.stats.bricks = n;
      }
      if (chestEl) {
        const c = parseInt(chestEl.textContent) || 0;
        if (c > this.stats.chests) this.stats.chests = c;
      }
      WH.updateStatsDisplay();
      WH.updateStatus(`扫描中 X:${Math.round(this.scanPosition)}`);

      this.animationId = requestAnimationFrame(() => this.loop());
    },

    start() {
      this.isRunning = true;
      this.initCanvas();
      this.loop();
    },

    stop() {
      this.isRunning = false;
      if (this.animationId) {
        cancelAnimationFrame(this.animationId);
        this.animationId = null;
      }
    },

    getConfigDisplay() {
      const maxGamesText = this.config.maxGames > 0 ? `${this.config.maxGames}局` : '无限';
      const minBalText = this.config.minBalance > 0 ? `${this.config.minBalance}` : '不限';
      return `
        <div class="${PREFIX}-row"><span class="${PREFIX}-label">自动开始</span><span class="${PREFIX}-val">${this.config.autoStart ? '开' : '关'}</span></div>
        <div class="${PREFIX}-row"><span class="${PREFIX}-label">扫描速度</span><span class="${PREFIX}-val">${this.config.speed}</span></div>
        <div class="${PREFIX}-row"><span class="${PREFIX}-label">局数限制</span><span class="${PREFIX}-val">${maxGamesText}</span></div>
        <div class="${PREFIX}-row"><span class="${PREFIX}-label">最低余额</span><span class="${PREFIX}-val">${minBalText}</span></div>
      `;
    },

    getStatsDisplay() {
      const progress = this.config.maxGames > 0 ? `${this.stats.games}/${this.config.maxGames}` : `${this.stats.games}`;
      return `
        <div class="${PREFIX}-row"><span class="${PREFIX}-label">游戏进度</span><span class="${PREFIX}-val">${progress}</span></div>
        <div class="${PREFIX}-row"><span class="${PREFIX}-label">击碎砖块</span><span class="${PREFIX}-val">${this.stats.bricks}</span></div>
        <div class="${PREFIX}-row"><span class="${PREFIX}-label">开启宝箱</span><span class="${PREFIX}-val">${this.stats.chests}</span></div>
      `;
    },

    showSettings() {
      WH.createSettingsModal('砖块设置', `
        <div class="${PREFIX}-input-group">
          <div class="${PREFIX}-input-row">
            <label>自动开始新游戏</label>
            <div class="${PREFIX}-toggle ${this.config.autoStart ? 'active' : ''}" id="tog-autostart"></div>
          </div>
        </div>
        <div class="${PREFIX}-input-group">
          <div class="${PREFIX}-input-row">
            <label>扫描速度</label>
            <input type="number" id="inp-speed" value="${this.config.speed}" min="1" max="20">
          </div>
          <div class="${PREFIX}-input-row">
            <label>局数限制 (0=无限)</label>
            <input type="number" id="inp-max-games" value="${this.config.maxGames}" min="0">
          </div>
          <div class="${PREFIX}-input-row">
            <label>最低余额 (0=不限)</label>
            <input type="number" id="inp-min-balance" value="${this.config.minBalance}" min="0">
          </div>
        </div>
      `, () => {
        this.config.autoStart = document.getElementById('tog-autostart').classList.contains('active');
        this.config.speed = Math.max(1, Math.min(20, parseInt(document.getElementById('inp-speed').value) || 8));
        this.config.maxGames = Math.max(0, parseInt(document.getElementById('inp-max-games').value) || 0);
        this.config.minBalance = Math.max(0, parseInt(document.getElementById('inp-min-balance').value) || 0);
        this.saveConfig();
      });

      document.getElementById('tog-autostart').onclick = (e) => e.target.classList.toggle('active');
    }
  };

  // 导出模块
  WH.BrickModule = BrickModule;
})();
