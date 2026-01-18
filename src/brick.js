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
      brickBias: 30, // 0-100，偏向砖块的权重
      jitterScale: 35, // 0-100，随机幅度（相对挡板宽度的百分比）
    },
    config: null,
    isRunning: false,
    animationId: null,
    stats: { games: 0, bricks: 0, chests: 0 },
    gameState: { canvas: null, ctx: null },
    lastStartTime: null,
    scanPosition: 0,
    scanDirection: 1,
    logCounter: 0,
    lastDetectAt: 0,
    lastBallX: null,
    lastBallY: null,
    lastPaddleSpan: null,
    lastBrickDetectAt: 0,
    brickTargetX: null,
    jitterOffset: 0,
    lastJitterAt: 0,

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
      // 尝试多种方式获取 canvas
      this.gameState.canvas = document.getElementById('game-canvas')
        || document.querySelector('canvas#game-canvas')
        || document.querySelector('canvas[id*="game"]')
        || document.querySelector('canvas');

      if (this.gameState.canvas) {
        this.gameState.ctx = this.gameState.canvas.getContext('2d');
        this.scanPosition = this.gameState.canvas.width / 2;
        console.log('[自动打砖块] Canvas 找到:', this.gameState.canvas.width, 'x', this.gameState.canvas.height);
      } else {
        console.warn('[自动打砖块] 未找到 Canvas');
      }
    },

    movePaddle(x) {
      if (!this.gameState.canvas) {
        this.initCanvas();
        if (!this.gameState.canvas) return;
      }
      const rect = this.gameState.canvas.getBoundingClientRect();
      const scaleX = this.gameState.canvas.width ? (rect.width / this.gameState.canvas.width) : 1;
      const clientX = rect.left + (x * scaleX);
      const clientY = rect.top + rect.height - 50;

      // 尝试 PointerEvent
      const pointerEvent = new PointerEvent('pointermove', {
        bubbles: true, cancelable: true,
        clientX, clientY,
        pointerType: 'mouse',
        pointerId: 1,
        isPrimary: true
      });
      this.gameState.canvas.dispatchEvent(pointerEvent);

      // 同时尝试 MouseEvent 作为备选
      const mouseEvent = new MouseEvent('mousemove', {
        bubbles: true, cancelable: true,
        clientX, clientY
      });
      this.gameState.canvas.dispatchEvent(mouseEvent);
    },

    pressKey(key) {
      const keyCode = key === ' ' ? 32 : (key === 'ArrowLeft' ? 37 : (key === 'ArrowRight' ? 39 : 0));
      const eventInit = {
        key,
        code: key === ' ' ? 'Space' : key,
        keyCode,
        which: keyCode,
        bubbles: true,
        cancelable: true
      };
      // 发送到 document
      document.dispatchEvent(new KeyboardEvent('keydown', eventInit));
      // 也发送到 canvas (有些游戏监听 canvas)
      if (this.gameState.canvas) {
        this.gameState.canvas.dispatchEvent(new KeyboardEvent('keydown', eventInit));
      }
      // 发送到 window
      window.dispatchEvent(new KeyboardEvent('keydown', eventInit));
    },

    isElementVisible(el) {
      if (!el) return false;
      const style = window.getComputedStyle(el);
      // 检查 display 和 visibility
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      // 检查尺寸
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false;
      // 检查 opacity
      if (parseFloat(style.opacity) === 0) return false;
      // 检查是否在视口内（防止元素被移到屏幕外）
      const inViewport = rect.right > 0 && rect.bottom > 0 &&
        rect.left < window.innerWidth && rect.top < window.innerHeight;
      if (!inViewport) return false;
      // 检查 pointer-events
      if (style.pointerEvents === 'none') return false;
      return true;
    },

    findStartButton() {
      // 尝试多种方式查找开始按钮
      return document.getElementById('btn-start')
        || document.querySelector('button#btn-start')
        || document.querySelector('button[id*="start"]:not([id*="auto"])')
        || document.querySelector('.btn-start')
        || document.querySelector('[class*="start-btn"]')
        || document.querySelector('button.start');
    },

    findPauseButton() {
      return document.getElementById('btn-pause')
        || document.querySelector('button#btn-pause')
        || document.querySelector('button[id*="pause"]')
        || document.querySelector('.btn-pause')
        || document.querySelector('[class*="pause"]');
    },

    isGamePlaying() {
      const pauseBtn = this.findPauseButton();
      const startBtn = this.findStartButton();
      const pauseVisible = this.isElementVisible(pauseBtn);
      const startVisible = this.isElementVisible(startBtn);
      const startDisabled = startBtn ? startBtn.disabled : false;

      // 游戏进行中的条件：
      // 1. 暂停按钮可见 且 开始按钮不可见
      // 2. 或者 暂停按钮可见 且 开始按钮被禁用
      const isPlaying = pauseVisible && (!startVisible || startDisabled);

      // 每 60 帧输出一次日志
      if (this.logCounter % 60 === 0) {
        console.log('[自动打砖块] 游戏状态: pause=', pauseVisible, 'start=', startVisible, 'startDisabled=', startDisabled, 'isPlaying=', isPlaying);
      }
      this.logCounter++;
      return isPlaying;
    },

    canStartGame() {
      if (this.lastStartTime && Date.now() - this.lastStartTime < 3000) return false;
      const startBtn = this.findStartButton();
      const canStart = startBtn && !startBtn.disabled && this.isElementVisible(startBtn);
      if (this.logCounter % 60 === 0) {
        console.log('[自动打砖块] 可以开始:', canStart, 'disabled=', startBtn?.disabled);
      }
      return canStart;
    },

    startNewGame() {
      const startBtn = this.findStartButton();
      if (startBtn && !startBtn.disabled && this.isElementVisible(startBtn)) {
        console.log('[自动打砖块] 点击开始按钮');
        this.lastStartTime = Date.now();
        startBtn.click();
        this.stats.games++;
        WH.updateStatsDisplay();
        if (this.gameState.canvas) {
          this.scanPosition = this.gameState.canvas.width / 2;
        }
        setTimeout(() => {
          console.log('[自动打砖块] 发送空格键');
          this.pressKey(' ');
        }, 1500);
      } else {
        console.warn('[自动打砖块] 无法启动游戏, btn=', startBtn);
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

    detectBall() {
      if (!this.gameState.canvas || !this.gameState.ctx) return null;
      const canvas = this.gameState.canvas;
      const ctx = this.gameState.ctx;
      const width = canvas.width;
      const height = canvas.height;
      if (!width || !height) return null;

      const threshold = 240;
      const step = 2;
      const yLimit = Math.max(0, height - 25);
      const image = ctx.getImageData(0, 0, width, yLimit);
      const data = image.data;
      let sumX = 0;
      let sumY = 0;
      let count = 0;
      let minX = width;
      let maxX = 0;

      for (let y = 0; y < yLimit; y += step) {
        for (let x = 0; x < width; x += step) {
          const idx = (y * width + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const a = data[idx + 3];
          if (a > 200 && r >= threshold && g >= threshold && b >= threshold) {
            sumX += x;
            sumY += y;
            count += 1;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
          }
        }
      }

      if (!count) return null;
      if ((maxX - minX) > width * 0.5) return null;
      return { x: sumX / count, y: sumY / count };
    },

    detectPaddleSpan() {
      if (!this.gameState.canvas || !this.gameState.ctx) return null;
      const canvas = this.gameState.canvas;
      const ctx = this.gameState.ctx;
      const width = canvas.width;
      const height = canvas.height;
      if (!width || !height) return null;

      const threshold = 220;
      const yStart = Math.max(0, height - 30);
      const image = ctx.getImageData(0, yStart, width, height - yStart);
      const data = image.data;
      let minX = width;
      let maxX = 0;
      let count = 0;

      for (let y = 0; y < (height - yStart); y += 1) {
        for (let x = 0; x < width; x += 1) {
          const idx = (y * width + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const a = data[idx + 3];
          if (a > 200 && r > threshold && g > threshold && b > threshold) {
            count += 1;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
          }
        }
      }

      if (!count || minX >= maxX) return null;
      return { minX, maxX, width: maxX - minX };
    },

    detectBrickTargetX() {
      if (!this.gameState.canvas || !this.gameState.ctx) return null;
      const canvas = this.gameState.canvas;
      const ctx = this.gameState.ctx;
      const width = canvas.width;
      const height = canvas.height;
      if (!width || !height) return null;

      const yLimit = Math.max(1, Math.floor(height * 0.45));
      const step = 4;
      const image = ctx.getImageData(0, 0, width, yLimit);
      const data = image.data;
      let sumX = 0;
      let count = 0;

      for (let y = 0; y < yLimit; y += step) {
        for (let x = 0; x < width; x += step) {
          const idx = (y * width + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const a = data[idx + 3];
          if (a < 80) continue;
          const brightness = (r + g + b) / 3;
          if (brightness > 60 && brightness < 240) {
            sumX += x;
            count += 1;
          }
        }
      }

      if (count < 20) return null;
      return sumX / count;
    },

    getJitterOffset(now, ballY) {
      if (!Number.isFinite(ballY) || !this.gameState.canvas) return 0;
      const height = this.gameState.canvas.height || 0;
      if (!height) return 0;
      const movingDown = this.lastBallY !== null && ballY > this.lastBallY;
      if (!movingDown) {
        this.jitterOffset = 0;
        this.lastJitterAt = 0;
        return 0;
      }

      if (ballY < height * 0.55) return this.jitterOffset || 0;
      if (now - this.lastJitterAt < 250 && Number.isFinite(this.jitterOffset)) return this.jitterOffset;

      const paddleWidth = this.lastPaddleSpan?.width || 100;
      const jitterRatio = Math.max(0, Math.min(100, this.config.jitterScale || 0)) / 100;
      const range = Math.max(10, paddleWidth * jitterRatio);
      this.jitterOffset = (Math.random() * 2 - 1) * range;
      this.lastJitterAt = now;
      return this.jitterOffset;
    },

    loop() {
      if (!this.isRunning) return;

      // 检查是否达到局数限制
      if (this.config.maxGames > 0 && this.stats.games >= this.config.maxGames) {
        WH.showToast(`已完成 ${this.config.maxGames} 局游戏`);
        WH.stop(`已完成 ${this.config.maxGames} 局`);
        return;
      }

      // 检查余额是否低于阈值
      if (this.config.minBalance > 0) {
        const currentBalance = WH.getWalletBalance();
        if (currentBalance < this.config.minBalance) {
          WH.showToast(`余额不足，当前 ${currentBalance.toFixed(0)}，最低 ${this.config.minBalance}`);
          WH.stop('余额不足，已停止');
          return;
        }
      }

      // 确保 canvas 存在
      if (!this.gameState.canvas) {
        this.initCanvas();
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

      const now = performance.now();
      if (now - this.lastDetectAt > 80) {
        this.lastDetectAt = now;
        const ball = this.detectBall();
        if (ball) {
          this.lastBallX = ball.x;
          this.lastBallY = ball.y;
        }
        const paddleSpan = this.detectPaddleSpan();
        if (paddleSpan) this.lastPaddleSpan = paddleSpan;
      }
      if (now - this.lastBrickDetectAt > 800) {
        this.lastBrickDetectAt = now;
        const targetX = this.detectBrickTargetX();
        if (Number.isFinite(targetX)) this.brickTargetX = targetX;
      }

      if (Number.isFinite(this.lastBallX)) {
        const width = this.gameState.canvas?.width || 0;
        const jitter = this.getJitterOffset(now, this.lastBallY);
        const biasWeight = Math.max(0, Math.min(100, this.config.brickBias || 0)) / 100;
        const brickBias = Number.isFinite(this.brickTargetX)
          ? (this.brickTargetX - this.lastBallX) * biasWeight
          : 0;
        const targetX = this.lastBallX + jitter + brickBias;
        const clampedX = Math.min(width, Math.max(0, targetX));
        this.movePaddle(clampedX);
        if (this.logCounter % 60 === 0) {
          console.log('[自动打砖块] 追踪小球 X:', Math.round(clampedX));
        }
        WH.updateStatus(`追踪小球 X:${Math.round(clampedX)}`);
      } else {
        this.updateScanPosition();
        this.movePaddle(this.scanPosition);
        if (this.logCounter % 60 === 0) {
          console.log('[自动打砖块] 扫描中 X:', Math.round(this.scanPosition));
        }
        WH.updateStatus(`扫描中 X:${Math.round(this.scanPosition)}`);
      }

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

      this.animationId = requestAnimationFrame(() => this.loop());
    },

    start() {
      console.log('[自动打砖块] 启动');
      this.isRunning = true;
      if (WH.setRunning) WH.setRunning(true);
      this.lastDetectAt = 0;
      this.lastBallX = null;
      this.lastBallY = null;
      this.lastPaddleSpan = null;
      this.lastBrickDetectAt = 0;
      this.brickTargetX = null;
      this.jitterOffset = 0;
      this.lastJitterAt = 0;
      this.initCanvas();
      this.loop();
    },

    stop() {
      if (!this.isRunning) return; // 防止重复停止
      this.isRunning = false;
      if (WH.setRunning) WH.setRunning(false);
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
        <div class="${PREFIX}-row"><span class="${PREFIX}-label">砖块偏向</span><span class="${PREFIX}-val">${this.config.brickBias}%</span></div>
        <div class="${PREFIX}-row"><span class="${PREFIX}-label">随机幅度</span><span class="${PREFIX}-val">${this.config.jitterScale}%</span></div>
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
            <label>砖块偏向 (0-100)</label>
            <input type="number" id="inp-brick-bias" value="${this.config.brickBias}" min="0" max="100">
          </div>
          <div class="${PREFIX}-input-row">
            <label>随机幅度 (0-100)</label>
            <input type="number" id="inp-jitter-scale" value="${this.config.jitterScale}" min="0" max="100">
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
        this.config.brickBias = Math.max(0, Math.min(100, parseInt(document.getElementById('inp-brick-bias').value) || 0));
        this.config.jitterScale = Math.max(0, Math.min(100, parseInt(document.getElementById('inp-jitter-scale').value) || 0));
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
