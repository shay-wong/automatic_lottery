// WindHub 抽卡模块
// @ts-check
'use strict';

window.WH = window.WH || {};

(function () {
  const PREFIX = WH.PREFIX || 'wh';

  const CardsModule = {
    name: '自动抽卡',
    color: '#fbbf24',
    configKey: 'wh_cards_config',
    defaultConfig: {
      interval: 3000,
      mode: 'single',
      autoStop: true,
      minBalance: 0, // 最低余额阈值，0 表示不限制
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
      // 尝试多种方式获取剩余次数
      const el = document.getElementById('draw-remaining')
        || document.querySelector('[id*="remaining"]')
        || document.querySelector('.draw-remaining')
        || document.querySelector('.remaining-count');
      if (el) {
        const text = el.textContent.trim();
        const num = parseInt(text);
        console.log(`[自动抽卡] 剩余次数元素: "${text}" -> ${num}`);
        return isNaN(num) ? 0 : num;
      }
      console.log('[自动抽卡] 未找到剩余次数元素');
      return 0;
    },

    draw() {
      if (!this.isRunning) {
        console.log('[自动抽卡] draw() 跳过: isRunning=false');
        return;
      }

      const remaining = this.getRemaining();
      console.log(`[自动抽卡] draw() remaining=${remaining}, autoStop=${this.config.autoStop}`);

      if (remaining <= 0 && this.config.autoStop) {
        console.log('[自动抽卡] 次数用完，停止');
        WH.stop('次数已用完');
        WH.showToast('抽卡次数已用完');
        return;
      }

      // 检查余额是否低于阈值
      if (this.config.minBalance > 0) {
        const currentBalance = WH.getWalletBalance();
        console.log(`[自动抽卡] 余额检查: ${currentBalance} vs ${this.config.minBalance}`);
        if (currentBalance < this.config.minBalance) {
          WH.stop('余额不足，已停止');
          WH.showToast(`余额不足，当前 ${currentBalance.toFixed(0)}，最低 ${this.config.minBalance}`);
          return;
        }
      }

      WH.updateStatus('抽卡中...');

      const btnId = this.config.mode === 'ten' ? 'btn-ten' : 'btn-single';
      const btn = document.getElementById(btnId);
      console.log(`[自动抽卡] 按钮 ${btnId}:`, btn, 'disabled=', btn?.disabled);

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
        WH.updateStatus(`已抽 ${this.stats.draws} 次`);
        WH.updateStatsDisplay();
      } else if (typeof window.doDraw === 'function') {
        const count = this.config.mode === 'ten' && remaining >= 10 ? 10 : 1;
        window.doDraw(count);
        this.stats.draws++;
        this.stats.cards += count;
        WH.updateStatus(`已抽 ${this.stats.draws} 次`);
        WH.updateStatsDisplay();
      } else {
        console.log('[自动抽卡] 无法找到可用的抽卡按钮');
      }
    },

    start() {
      console.log('[自动抽卡] 启动');
      this.isRunning = true;
      this.stats = { draws: 0, cards: 0 };
      // 先设置 intervalId，这样 draw() 中的 stop() 可以正确清理
      this.intervalId = setInterval(() => this.draw(), this.config.interval);
      // 然后执行第一次抽卡
      this.draw();
    },

    stop() {
      console.log('[自动抽卡] 停止, isRunning=', this.isRunning, 'intervalId=', this.intervalId);
      if (!this.isRunning) return; // 防止重复停止
      this.isRunning = false;
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }
    },

    getConfigDisplay() {
      const modeText = this.config.mode === 'ten' ? '十连' : '单抽';
      const minBalText = this.config.minBalance > 0 ? `${this.config.minBalance}` : '不限';
      return `
        <div class="${PREFIX}-row"><span class="${PREFIX}-label">抽卡间隔</span><span class="${PREFIX}-val">${this.config.interval / 1000}秒</span></div>
        <div class="${PREFIX}-row"><span class="${PREFIX}-label">抽卡模式</span><span class="${PREFIX}-val">${modeText}</span></div>
        <div class="${PREFIX}-row"><span class="${PREFIX}-label">自动停止</span><span class="${PREFIX}-val">${this.config.autoStop ? '开' : '关'}</span></div>
        <div class="${PREFIX}-row"><span class="${PREFIX}-label">最低余额</span><span class="${PREFIX}-val">${minBalText}</span></div>
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
      WH.createSettingsModal('抽卡设置', `
        <div class="${PREFIX}-input-group">
          <div class="${PREFIX}-input-row">
            <label>抽卡间隔 (秒)</label>
            <input type="number" id="inp-interval" value="${this.config.interval / 1000}" min="1">
          </div>
          <div class="${PREFIX}-input-row">
            <label>最低余额 (0=不限)</label>
            <input type="number" id="inp-min-balance" value="${this.config.minBalance}" min="0">
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
        this.config.minBalance = Math.max(0, parseInt(document.getElementById('inp-min-balance').value) || 0);
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

  // 导出模块
  WH.CardsModule = CardsModule;
})();
