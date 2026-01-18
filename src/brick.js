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
      maxLevel: 0, // 最大关卡数，0 表示无限制
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
    prevBallY: null,
    prevBallX: null,
    prevBallAt: 0,
    lastBallAt: 0,
    lastPaddleSpan: null,
    lastBallSeenAt: 0,
    lastRescueAt: 0,
    lastBallMovedAt: 0,
    lastBrickDetectAt: 0,
    brickTargetX: null,
    totalBricks: 0, // 总砖块数（从配置读取）
    remainingBricks: 0, // 剩余砖块数（从 DOM 读取）
    lastBallStuckAt: 0, // 上次检测到小球卡住的时间

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

      // 减少日志输出频率：每 300 帧（约 5 秒）输出一次
      if (this.logCounter % 300 === 0) {
        console.log('[自动打砖块] 游戏状态: pause=', pauseVisible, 'start=', startVisible, 'startDisabled=', startDisabled, 'isPlaying=', isPlaying);
      }
      this.logCounter++;
      return isPlaying;
    },

    isGameFinished() {
      // 检测游戏是否结束：开始按钮可见且未禁用
      const startBtn = this.findStartButton();
      return startBtn && !startBtn.disabled && this.isElementVisible(startBtn);
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
        this.totalBricks = 0; // 重置总砖块数，等待新游戏配置
        this.remainingBricks = 0;
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
      const yLimit = Math.max(0, height - 30);
      const image = ctx.getImageData(0, 0, width, yLimit);
      const data = image.data;
      let sumX = 0;
      let sumY = 0;
      let count = 0;
      let minX = width;
      let maxX = 0;
      let minY = yLimit;
      let maxY = 0;

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
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      if (!count) return null;
      if ((maxX - minX) > 40 || (maxY - minY) > 40) return null;
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

    // 从暴露的游戏状态获取砖块数据
    getGameState() {
      return window._brickGameState || null;
    },

    // 获取存活的砖块列表
    getAliveBricks() {
      const state = this.getGameState();
      if (!state || !Array.isArray(state.bricks)) return [];
      return state.bricks.filter(b => b.alive);
    },

    // 获取小球状态
    getBallState() {
      const state = this.getGameState();
      if (!state || !state.ball) return null;
      return state.ball;
    },

    // 获取挡板状态
    getPaddleState() {
      const state = this.getGameState();
      if (!state || !state.paddle) return null;
      return state.paddle;
    },

    // 计算小球从挡板反弹后的轨迹，预测能击中哪个砖块
    predictBallPath(paddleX, ball, paddle, bricks) {
      if (!ball || !paddle || ball.stuck) return null;

      // 模拟小球从挡板反弹
      const hitX = paddleX + paddle.w / 2;
      const ballCenterX = ball.x;
      const offset = (ballCenterX - hitX) / (paddle.w / 2); // -1 到 1
      const maxAngle = Math.PI / 3; // 60度
      const angle = offset * maxAngle;

      // 计算反弹后的速度
      const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
      const vx = Math.sin(angle) * speed;
      const vy = -Math.abs(Math.cos(angle) * speed);

      // 模拟轨迹，找到第一个击中的砖块
      let simX = ball.x;
      let simY = ball.y;
      let simVx = vx;
      let simVy = vy;
      const canvasWidth = this.gameState.canvas?.width || 800;
      const maxSteps = 500;

      for (let step = 0; step < maxSteps; step++) {
        simX += simVx;
        simY += simVy;

        // 墙壁反弹
        if (simX <= ball.r || simX >= canvasWidth - ball.r) {
          simVx = -simVx;
          simX = Math.max(ball.r, Math.min(canvasWidth - ball.r, simX));
        }
        if (simY <= ball.r) {
          simVy = -simVy;
          simY = ball.r;
        }

        // 检测砖块碰撞
        for (const brick of bricks) {
          if (!brick.alive) continue;
          if (simX >= brick.x && simX <= brick.x + brick.w &&
              simY >= brick.y && simY <= brick.y + brick.h) {
            return brick;
          }
        }

        // 如果小球回到底部，停止模拟
        if (simY > paddle.y) break;
      }

      return null;
    },

    // 找到最佳的挡板位置来击中目标砖块
    findBestPaddlePosition(targetBrick) {
      const ball = this.getBallState();
      const paddle = this.getPaddleState();
      const bricks = this.getAliveBricks();

      if (!ball || !paddle || !targetBrick) return null;

      const canvasWidth = this.gameState.canvas?.width || 800;
      let bestX = null;
      let bestDistance = Infinity;

      // 尝试不同的挡板位置
      for (let x = paddle.w / 2; x < canvasWidth - paddle.w / 2; x += 10) {
        const hitBrick = this.predictBallPath(x - paddle.w / 2, ball, paddle, bricks);
        if (hitBrick && hitBrick.idx === targetBrick.idx) {
          const distance = Math.abs(x - ball.x);
          if (distance < bestDistance) {
            bestDistance = distance;
            bestX = x;
          }
        }
      }

      return bestX;
    },

    // 选择目标砖块（优先级：宝箱 > 钥匙 > 普通，且优先靠近小球的）
    selectTargetBrick() {
      const bricks = this.getAliveBricks();
      const ball = this.getBallState();
      const state = this.getGameState();

      if (!bricks.length || !ball) return null;

      const hasKeys = state && state.keys > 0;

      // 按优先级分组
      const chests = bricks.filter(b => b.t === 'chest' && hasKeys);
      const keys = bricks.filter(b => b.t === 'key');
      const normals = bricks.filter(b => b.t === 'normal');

      // 选择最靠近底部的砖块（更容易击中）
      const selectNearest = (arr) => {
        if (!arr.length) return null;
        return arr.reduce((best, b) => (!best || b.y > best.y) ? b : best, null);
      };

      // 优先级：有钥匙时优先开宝箱，否则优先拿钥匙
      if (chests.length) return selectNearest(chests);
      if (keys.length) return selectNearest(keys);
      return selectNearest(normals);
    },

    updateBrickCount() {
      // 从 DOM 读取剩余砖块数（普通砖块 + 钥匙砖块）
      const normalEl = document.getElementById('stat-normal');
      const keyEl = document.getElementById('stat-key');
      const normal = normalEl ? (parseInt(normalEl.textContent) || 0) : 0;
      const key = keyEl ? (parseInt(keyEl.textContent) || 0) : 0;

      // 如果是新游戏，从配置读取总砖块数
      if (this.totalBricks === 0 && window._brickGameConfig) {
        const config = window._brickGameConfig;
        this.totalBricks = (config.brick_rows || 6) * (config.brick_cols || 10);
      }

      // 计算剩余砖块数：总数 - 已击碎的普通砖块
      this.remainingBricks = Math.max(0, this.totalBricks - normal);
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

    releaseBall() {
      if (!this.gameState.canvas) return;
      const rect = this.gameState.canvas.getBoundingClientRect();
      const clientX = rect.left + rect.width * 0.5;
      const clientY = rect.top + rect.height * 0.9;
      const pointerEvent = new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        clientX,
        clientY,
        pointerType: 'mouse',
        pointerId: 1,
        isPrimary: true
      });
      this.gameState.canvas.dispatchEvent(pointerEvent);
      this.pressKey(' ');
    },

    getPaddleHalfWidth() {
      if (this.lastPaddleSpan) return Math.max(8, (this.lastPaddleSpan.width / 2) - 6);
      const config = window._brickGameConfig;
      if (config?.paddle_width_base) {
        return Math.max(8, (config.paddle_width_base / 2) - 6);
      }
      return null;
    },

    clampOffset(offset) {
      const safeHalf = this.getPaddleHalfWidth();
      if (!Number.isFinite(safeHalf)) return offset;
      if (!Number.isFinite(safeHalf) || safeHalf <= 0) return offset;
      return Math.min(safeHalf, Math.max(-safeHalf, offset));
    },

    async loop() {
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
        // 检测游戏是否刚结束，需要提交结算
        const gameFinished = this.isGameFinished();

        // 检查是否达到关卡限制，需要主动结束游戏
        if (this.config.maxLevel > 0) {
          const levelEl = document.getElementById('stat-level');
          const currentLevel = levelEl ? (parseInt(levelEl.textContent) || 0) : 0;
          if (currentLevel >= this.config.maxLevel) {
            const finishBtn = document.getElementById('btn-finish');
            if (finishBtn && !finishBtn.disabled) {
              console.log('[自动打砖块] 达到关卡限制，点击结束结算');
              finishBtn.click();
              // 等待结算完成
              await new Promise(resolve => setTimeout(resolve, 3000));
            }
          }
        }

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
          this.prevBallX = this.lastBallX;
          this.prevBallY = this.lastBallY;
          this.prevBallAt = this.lastBallAt;
          this.lastBallX = ball.x;
          this.lastBallY = ball.y;
          this.lastBallAt = now;
          this.lastBallSeenAt = now;
          if (!Number.isFinite(this.prevBallX) || !Number.isFinite(this.prevBallY)) {
            this.lastBallMovedAt = now;
          } else {
            const dx = Math.abs(this.lastBallX - this.prevBallX);
            const dy = Math.abs(this.lastBallY - this.prevBallY);
            if (dx > 0.6 || dy > 0.6) this.lastBallMovedAt = now;
          }
        } else if (now - this.lastBallSeenAt > 200) {
          this.lastBallX = null;
          this.lastBallY = null;
        }
        const paddleSpan = this.detectPaddleSpan();
        if (paddleSpan) this.lastPaddleSpan = paddleSpan;
      }

      // 检测小球是否卡在挡板上（进入下一关时）
      const gameState = this.getGameState();
      const ball = this.getBallState();
      if (gameState && ball && ball.stuck) {
        if (this.lastBallStuckAt === 0) {
          this.lastBallStuckAt = now;
        } else if (now - this.lastBallStuckAt > 2000) {
          // 小球卡住超过2秒，发射小球
          console.log('[自动打砖块] 检测到小球卡住，发射小球');
          this.pressKey(' ');
          this.lastBallStuckAt = 0;
        }
      } else {
        this.lastBallStuckAt = 0;
      }

      if (now - this.lastBrickDetectAt > 800) {
        this.lastBrickDetectAt = now;
        const targetX = this.detectBrickTargetX();
        if (Number.isFinite(targetX)) this.brickTargetX = targetX;
      }

      if (Number.isFinite(this.lastBallX) && Number.isFinite(this.lastBallY)) {
        const canvasHeight = this.gameState.canvas?.height || 0;
        const bottomZone = canvasHeight ? canvasHeight - 28 : 0;
        if (this.lastBallY >= bottomZone && now - this.lastBallMovedAt > 900 && now - this.lastRescueAt > 1200) {
          this.lastRescueAt = now;
          this.releaseBall();
        }
        const width = this.gameState.canvas?.width || 0;
        const movingDown = Number.isFinite(this.lastBallY)
          && Number.isFinite(this.prevBallY)
          ? this.lastBallY >= this.prevBallY
          : false;

        // 尝试使用精确追踪模式（如果游戏状态已暴露）
        const gameState = this.getGameState();
        const ball = this.getBallState();
        const paddle = this.getPaddleState();
        let targetX = this.lastBallX;
        let usedPreciseMode = false;

        if (gameState && ball && paddle && !ball.stuck && movingDown) {
          // 精确模式：使用游戏内部数据
          const targetBrick = this.selectTargetBrick();
          if (targetBrick) {
            const bestX = this.findBestPaddlePosition(targetBrick);
            if (bestX !== null) {
              targetX = bestX;
              usedPreciseMode = true;
              if (this.logCounter % 120 === 0) {
                console.log('[自动打砖块] 精确模式 - 目标砖块:', targetBrick.t, targetBrick.idx, '挡板位置:', Math.round(bestX));
              }
            }
          }
        }

        // 如果精确模式失败，使用原有的预测逻辑
        if (!usedPreciseMode) {
          let targetBaseX = this.lastBallX;
          if (movingDown && Number.isFinite(this.prevBallAt) && this.prevBallAt > 0) {
            const dt = Math.max(1, this.lastBallAt - this.prevBallAt);
            const vx = (this.lastBallX - (this.prevBallX ?? this.lastBallX)) / dt;
            const vy = (this.lastBallY - (this.prevBallY ?? this.lastBallY)) / dt;
            const paddleY = (this.gameState.canvas?.height || 0) - 18;
            if (vy > 0) {
              const timeToPaddle = (paddleY - this.lastBallY) / vy;
              if (timeToPaddle > 0 && Number.isFinite(timeToPaddle)) {
                let predicted = this.lastBallX + vx * timeToPaddle;
                const max = width;
                while (predicted < 0 || predicted > max) {
                  if (predicted < 0) predicted = -predicted;
                  if (predicted > max) predicted = 2 * max - predicted;
                }
                targetBaseX = predicted;
              }
            }
          }

          // 只在小球下落时偏向砖块，上升时完全专注接球
          targetX = targetBaseX;

          // 像素检测模式已废弃，精确模式会自动处理砖块瞄准
        }

        const clampedX = Math.min(width, Math.max(0, targetX));
        this.movePaddle(clampedX);
        if (this.logCounter % 60 === 0) {
          console.log('[自动打砖块] 追踪小球 X:', Math.round(clampedX));
        }
        WH.updateStatus(`追踪小球 X:${Math.round(clampedX)}`);
      } else {
        if (now - this.lastBallSeenAt > 1000 && now - this.lastRescueAt > 1500) {
          this.lastRescueAt = now;
          this.releaseBall();
        }
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
      this.prevBallY = null;
      this.prevBallX = null;
      this.prevBallAt = 0;
      this.lastPaddleSpan = null;
      this.lastBallSeenAt = 0;
      this.lastRescueAt = 0;
      this.lastBallMovedAt = 0;
      this.lastBrickDetectAt = 0;
      this.brickTargetX = null;
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
      const maxLevelText = this.config.maxLevel > 0 ? `${this.config.maxLevel}关` : '无限';
      return `
        <div class="${PREFIX}-row"><span class="${PREFIX}-label">自动开始</span><span class="${PREFIX}-val">${this.config.autoStart ? '开' : '关'}</span></div>
        <div class="${PREFIX}-row"><span class="${PREFIX}-label">扫描速度</span><span class="${PREFIX}-val">${this.config.speed}</span></div>
        <div class="${PREFIX}-row"><span class="${PREFIX}-label">局数限制</span><span class="${PREFIX}-val">${maxGamesText}</span></div>
        <div class="${PREFIX}-row"><span class="${PREFIX}-label">关卡限制</span><span class="${PREFIX}-val">${maxLevelText}</span></div>
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
            <label>扫描速度 (像素/帧)</label>
            <input type="number" id="inp-speed" value="${this.config.speed}" min="1" max="20">
          </div>
          <div class="${PREFIX}-hint">💡 扫描速度控制挡板寻找小球的移动速度。调高(10-20)扫描更快但可能错过小球，调低(1-5)更精确但速度较慢。推荐值：8</div>
          <div class="${PREFIX}-input-row">
            <label>局数限制 (0=无限)</label>
            <input type="number" id="inp-max-games" value="${this.config.maxGames}" min="0">
          </div>
          <div class="${PREFIX}-input-row">
            <label>关卡限制 (0=无限)</label>
            <input type="number" id="inp-max-level" value="${this.config.maxLevel}" min="0">
          </div>
          <div class="${PREFIX}-input-row">
            <label>最低余额 (0=不限)</label>
            <input type="number" id="inp-min-balance" value="${this.config.minBalance}" min="0">
          </div>
        </div>
        <div class="${PREFIX}-hint">💡 精确追踪模式已启用，会自动瞄准目标砖块</div>
      `, () => {
        this.config.autoStart = document.getElementById('tog-autostart').classList.contains('active');
        this.config.speed = Math.max(1, Math.min(20, parseInt(document.getElementById('inp-speed').value) || 8));
        this.config.maxGames = Math.max(0, parseInt(document.getElementById('inp-max-games').value) || 0);
        this.config.maxLevel = Math.max(0, parseInt(document.getElementById('inp-max-level').value) || 0);
        this.config.minBalance = Math.max(0, parseInt(document.getElementById('inp-min-balance').value) || 0);
        this.saveConfig();
      });

      document.getElementById('tog-autostart').onclick = (e) => e.target.classList.toggle('active');
    }
  };

  // 导出模块
  WH.BrickModule = BrickModule;
})();
