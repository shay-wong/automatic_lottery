// WindHub 农场模块
// @ts-check
'use strict';

window.WH = window.WH || {};

(function () {
  const PREFIX = WH.PREFIX || 'wh';

  const FarmModule = {
    name: '自动农场',
    color: '#30d158',
    configKey: 'wh_farm_config',
    defaultConfig: {
      interval: 30000,
      autoHarvest: true,
      autoPlant: true,
      selectedSeed: null,
      autoSelectBest: true,
      minBalance: 0, // 最低余额阈值，0 表示不限制
    },
    config: null,
    isRunning: false,
    intervalId: null,
    stats: { harvested: 0, planted: 0, totalProfit: 0 },
    profitData: {},
    pendingHarvest: null,

    init() {
      this.config = { ...this.defaultConfig };
      try {
        const saved = localStorage.getItem(this.configKey);
        if (saved) this.config = { ...this.defaultConfig, ...JSON.parse(saved) };
      } catch (e) {}
      try {
        const profitSaved = localStorage.getItem('wh_farm_profit');
        if (profitSaved) this.profitData = JSON.parse(profitSaved);
      } catch (e) {}
    },

    saveConfig() {
      localStorage.setItem(this.configKey, JSON.stringify(this.config));
    },

    saveProfitData() {
      localStorage.setItem('wh_farm_profit', JSON.stringify(this.profitData));
    },

    parseSeedCost(seed) {
      if (!seed.element) return 0;
      const costEl = seed.element.querySelector('.seed-cost');
      if (costEl) {
        const text = costEl.textContent.replace(/[^\d.-]/g, '');
        return Math.abs(parseFloat(text)) || 0;
      }
      return 0;
    },

    getAvailableSeeds() {
      const seedItems = document.querySelectorAll('.seed-item:not(.locked)');
      const seeds = [];
      seedItems.forEach(item => {
        const nameEl = item.querySelector('.seed-name');
        const costEl = item.querySelector('.seed-cost');
        const name = nameEl ? nameEl.textContent.trim() : item.getAttribute('title') || '未知';
        const id = item.getAttribute('data-crop-key');
        const costText = costEl ? costEl.textContent : '';
        const cost = Math.abs(parseFloat(costText.replace(/[^\d.-]/g, ''))) || 0;
        if (id) seeds.push({ id, name, cost, element: item });
      });
      return seeds;
    },

    getBestSeed(seeds) {
      if (seeds.length === 0) return null;

      // 如果没有开启智能选种，使用手动选择的种子
      if (!this.config.autoSelectBest) {
        if (this.config.selectedSeed) {
          const found = seeds.find(s => s.id === this.config.selectedSeed);
          if (found) return found;
        }
        return seeds[0];
      }

      // 检查是否有作物缺少收益数据（数据收集阶段）
      const needData = seeds.filter(seed => {
        const data = this.profitData[seed.id];
        return !data || data.count === 0;
      });

      if (needData.length > 0) {
        // 数据收集阶段：返回第一个缺少数据的作物
        const seed = needData[0];
        console.log(`[自动农场] 数据收集: ${seed.name} (还有 ${needData.length} 种作物需要收集数据)`);
        return { seed, isDataCollection: true };
      }

      // 所有作物都有数据，计算最优 ROI
      let bestSeed = null;
      let bestROI = -Infinity;

      seeds.forEach(seed => {
        const data = this.profitData[seed.id];
        if (data && data.count > 0) {
          const avgProfit = data.totalProfit / data.count;
          const roi = seed.cost > 0 ? (avgProfit - seed.cost) / seed.cost : avgProfit;
          if (roi > bestROI) {
            bestROI = roi;
            bestSeed = seed;
          }
        }
      });

      if (bestSeed) {
        console.log(`[自动农场] 智能选种: ${bestSeed.name} (ROI: ${(bestROI * 100).toFixed(1)}%)`);
      }

      return bestSeed || seeds[0];
    },

    getFarmStatus() {
      const tiles = document.querySelectorAll('.tile');
      let empty = 0, growing = 0, ready = 0;
      const readyCrops = {};
      tiles.forEach(tile => {
        if (tile.classList.contains('empty')) empty++;
        else if (tile.classList.contains('ready')) {
          ready++;
          const info = tile.querySelector('.tile-info');
          if (info) {
            const cropName = info.textContent.split(':')[0].trim();
            readyCrops[cropName] = (readyCrops[cropName] || 0) + 1;
          }
        }
        else if (tile.classList.contains('growing')) growing++;
      });
      return { empty, growing, ready, total: tiles.length, readyCrops };
    },

    async harvest() {
      if (!this.config.autoHarvest) return 0;
      const status = this.getFarmStatus();
      if (status.ready === 0) return 0;

      const balanceBefore = WH.getWalletBalance();

      const harvestAllBtn = document.querySelector('#btn-harvest-all');
      if (harvestAllBtn && !harvestAllBtn.disabled) {
        harvestAllBtn.click();
        this.stats.harvested += status.ready;

        await new Promise(r => setTimeout(r, 1000));
        this.recordHarvestProfit(balanceBefore, status);

        WH.showToast(`收割了 ${status.ready} 块作物`);
        return status.ready;
      }

      if (typeof window.doAction === 'function') {
        try {
          await window.doAction('harvest_all', {});
          this.stats.harvested += status.ready;

          await new Promise(r => setTimeout(r, 1000));
          this.recordHarvestProfit(balanceBefore, status);

          WH.showToast(`收割了 ${status.ready} 块作物`);
          return status.ready;
        } catch (e) {
          console.error('[自动农场] harvest_all 失败:', e);
        }
      }

      const readyTiles = document.querySelectorAll('.tile.ready');
      let count = 0;
      for (const tile of readyTiles) {
        tile.click();
        count++;
        await new Promise(r => setTimeout(r, 100));
      }
      this.stats.harvested += count;

      await new Promise(r => setTimeout(r, 500));
      this.recordHarvestProfit(balanceBefore, status);

      if (count > 0) WH.showToast(`收割了 ${count} 块作物`);
      return count;
    },

    recordHarvestProfit(balanceBefore, status) {
      const balanceAfter = WH.getWalletBalance();
      const profit = balanceAfter - balanceBefore;

      if (profit > 0 && status.ready > 0) {
        this.stats.totalProfit += profit;

        const cropNames = Object.keys(status.readyCrops);

        // 只有单一作物时才记录收益数据（保证数据准确）
        if (cropNames.length === 1) {
          const cropName = cropNames[0];
          const count = status.readyCrops[cropName];
          const profitPerCrop = profit / count;

          const seeds = this.getAvailableSeeds();
          const seed = seeds.find(s => s.name === cropName);
          if (seed) {
            if (!this.profitData[seed.id]) {
              this.profitData[seed.id] = { totalProfit: 0, totalCost: 0, count: 0 };
            }
            this.profitData[seed.id].totalProfit += profit;
            this.profitData[seed.id].count += count;
            this.saveProfitData();
            console.log(`[自动农场] 记录 ${cropName} 收益: ${profitPerCrop.toFixed(2)}/块, 共 ${count} 块`);
          }
        } else if (cropNames.length > 1) {
          console.log(`[自动农场] 多种作物混收 (${cropNames.join(', ')})，不记录单品收益数据`);
        }

        console.log(`[自动农场] 本次收益: +${profit.toFixed(2)}, 总收益: ${this.stats.totalProfit.toFixed(2)}`);
      }
    },

    async plant() {
      if (!this.config.autoPlant) return 0;
      const status = this.getFarmStatus();
      if (status.empty === 0) return 0;

      // 如果还有作物在生长，等待收割后再种植（避免混种）
      if (status.growing > 0) {
        console.log(`[自动农场] 等待 ${status.growing} 块作物成熟后再种植`);
        return 0;
      }

      const seeds = this.getAvailableSeeds();
      if (seeds.length === 0) return 0;

      const result = this.getBestSeed(seeds);
      if (!result) return 0;

      // 判断是否是数据收集模式
      const isDataCollection = result.isDataCollection === true;
      const selectedSeed = isDataCollection ? result.seed : result;

      // 数据收集模式只种1块，正常模式种满
      const plantCount = isDataCollection ? 1 : status.empty;
      const totalCost = selectedSeed.cost * plantCount;

      // 检查余额是否足够
      const currentBalance = WH.getWalletBalance();
      const minRequired = this.config.minBalance + totalCost;
      if (currentBalance < minRequired) {
        WH.showToast(`余额不足，需要 ${minRequired.toFixed(0)}，当前 ${currentBalance.toFixed(0)}`);
        WH.updateStatus(`余额不足，已停止`);
        this.stop();
        return 0;
      }

      if (this.profitData[selectedSeed.id]) {
        this.profitData[selectedSeed.id].totalCost += totalCost;
      } else {
        this.profitData[selectedSeed.id] = { totalProfit: 0, totalCost: totalCost, count: 0 };
      }
      this.saveProfitData();

      const emptyTiles = document.querySelectorAll('.tile.empty');
      const plotIndices = [];
      let i = 0;
      for (const tile of emptyTiles) {
        if (i >= plantCount) break;
        const index = tile.dataset.plotIndex;
        if (index !== undefined) {
          plotIndices.push(parseInt(index));
          i++;
        }
      }

      if (plotIndices.length === 0) return 0;

      if (typeof window.doAction === 'function') {
        try {
          await window.doAction('plant_many', {
            crop_key: selectedSeed.id,
            plot_indices: JSON.stringify(plotIndices)
          });
          this.stats.planted += plotIndices.length;
          const modeText = isDataCollection ? '(数据收集)' : '';
          WH.showToast(`种植了 ${plotIndices.length} 块 ${selectedSeed.name} ${modeText}`);
          return plotIndices.length;
        } catch (e) {
          console.error('[自动农场] plant_many 失败:', e);
        }
      }

      let count = 0;
      if (selectedSeed.element) {
        selectedSeed.element.click();
        await new Promise(r => setTimeout(r, 200));
      }
      for (const tile of emptyTiles) {
        if (count >= plantCount) break;
        tile.click();
        count++;
        await new Promise(r => setTimeout(r, 100));
      }
      this.stats.planted += count;
      if (count > 0) {
        const modeText = isDataCollection ? '(数据收集)' : '';
        WH.showToast(`种植了 ${count} 块 ${selectedSeed.name} ${modeText}`);
      }
      return count;
    },

    parseCountdown(text) {
      if (!text) return null;
      const match = text.match(/(\d+)m\s*(\d+)s|(\d+)s/);
      if (match) {
        if (match[1] && match[2]) {
          return parseInt(match[1]) * 60 + parseInt(match[2]);
        } else if (match[3]) {
          return parseInt(match[3]);
        }
      }
      return null;
    },

    getNextHarvestTime() {
      const tiles = document.querySelectorAll('.tile.growing');
      let minTime = Infinity;
      tiles.forEach(tile => {
        const info = tile.querySelector('.tile-info');
        if (info) {
          const seconds = this.parseCountdown(info.textContent);
          if (seconds !== null && seconds < minTime) {
            minTime = seconds;
          }
        }
      });
      return minTime === Infinity ? null : minTime;
    },

    async loop() {
      if (!this.isRunning) return;
      const status = this.getFarmStatus();
      WH.updateStatus(`检查中... (空:${status.empty} 长:${status.growing} 熟:${status.ready})`);

      if (status.ready > 0) {
        await this.harvest();
        await new Promise(r => setTimeout(r, 500));
      }
      const newStatus = this.getFarmStatus();
      if (newStatus.empty > 0) await this.plant();

      const finalStatus = this.getFarmStatus();

      const nextHarvest = this.getNextHarvestTime();
      if (nextHarvest !== null && nextHarvest < this.config.interval / 1000) {
        const waitTime = (nextHarvest + 2) * 1000;
        WH.updateStatus(`空:${finalStatus.empty} 长:${finalStatus.growing} 熟:${finalStatus.ready} | ${nextHarvest}秒后收割`);
        clearInterval(this.intervalId);
        this.intervalId = setTimeout(() => {
          this.loop();
          this.intervalId = setInterval(() => this.loop(), this.config.interval);
        }, waitTime);
      } else {
        WH.updateStatus(`空:${finalStatus.empty} 长:${finalStatus.growing} 熟:${finalStatus.ready}`);
      }
      WH.updateStatsDisplay();
    },

    start() {
      this.isRunning = true;
      // 先设置 intervalId，这样 loop() 中的 stop() 可以正确清理
      this.intervalId = setInterval(() => this.loop(), this.config.interval);
      this.loop();
    },

    stop() {
      if (!this.isRunning) return; // 防止重复停止
      this.isRunning = false;
      if (this.intervalId) {
        clearInterval(this.intervalId);
        clearTimeout(this.intervalId);
        this.intervalId = null;
      }
    },

    getConfigDisplay() {
      const seeds = this.getAvailableSeeds();
      let seedName = '自动最优';
      if (!this.config.autoSelectBest && this.config.selectedSeed) {
        const found = seeds.find(s => s.id === this.config.selectedSeed);
        seedName = found?.name || '自动最优';
      }
      const minBalText = this.config.minBalance > 0 ? `${this.config.minBalance}` : '不限';
      return `
        <div class="${PREFIX}-row"><span class="${PREFIX}-label">检查间隔</span><span class="${PREFIX}-val">${this.config.interval / 1000}秒</span></div>
        <div class="${PREFIX}-row"><span class="${PREFIX}-label">自动收割</span><span class="${PREFIX}-val">${this.config.autoHarvest ? '开' : '关'}</span></div>
        <div class="${PREFIX}-row"><span class="${PREFIX}-label">自动种植</span><span class="${PREFIX}-val">${this.config.autoPlant ? '开' : '关'}</span></div>
        <div class="${PREFIX}-row"><span class="${PREFIX}-label">智能选种</span><span class="${PREFIX}-val">${this.config.autoSelectBest ? '开' : '关'}</span></div>
        <div class="${PREFIX}-row"><span class="${PREFIX}-label">种子</span><span class="${PREFIX}-val">${seedName}</span></div>
        <div class="${PREFIX}-row"><span class="${PREFIX}-label">最低余额</span><span class="${PREFIX}-val">${minBalText}</span></div>
      `;
    },

    getStatsDisplay() {
      const seeds = this.getAvailableSeeds();

      // 统计数据收集进度
      let hasData = 0;
      let totalSeeds = seeds.length;
      seeds.forEach(seed => {
        const data = this.profitData[seed.id];
        if (data && data.count > 0) hasData++;
      });

      // 找出最优作物
      let bestCrop = null;
      let bestROI = -Infinity;
      Object.keys(this.profitData).forEach(cropKey => {
        const data = this.profitData[cropKey];
        if (data.count > 0) {
          const seed = seeds.find(s => s.id === cropKey);
          if (seed) {
            const avgProfit = data.totalProfit / data.count;
            const roi = seed.cost > 0 ? (avgProfit - seed.cost) / seed.cost : 0;
            if (roi > bestROI) {
              bestROI = roi;
              bestCrop = seed.name;
            }
          }
        }
      });

      const dataProgress = `${hasData}/${totalSeeds}`;
      const bestInfo = bestCrop ? `${bestCrop} (${(bestROI * 100).toFixed(0)}%)` : '收集中';
      return `
        <div class="${PREFIX}-row"><span class="${PREFIX}-label">数据收集</span><span class="${PREFIX}-val">${dataProgress}</span></div>
        <div class="${PREFIX}-row"><span class="${PREFIX}-label">已收割</span><span class="${PREFIX}-val">${this.stats.harvested}</span></div>
        <div class="${PREFIX}-row"><span class="${PREFIX}-label">已种植</span><span class="${PREFIX}-val">${this.stats.planted}</span></div>
        <div class="${PREFIX}-row"><span class="${PREFIX}-label">总收益</span><span class="${PREFIX}-val">${this.stats.totalProfit.toFixed(1)}</span></div>
        <div class="${PREFIX}-row"><span class="${PREFIX}-label">最优作物</span><span class="${PREFIX}-val" style="font-size:11px">${bestInfo}</span></div>
      `;
    },

    showSettings() {
      const seeds = this.getAvailableSeeds();
      const seedOptions = seeds.map(s =>
        `<option value="${s.id}" ${this.config.selectedSeed === s.id ? 'selected' : ''}>${s.name}</option>`
      ).join('');

      WH.createSettingsModal('农场设置', `
        <div class="${PREFIX}-input-group">
          <div class="${PREFIX}-input-row">
            <label>检查间隔 (秒)</label>
            <input type="number" id="inp-interval" value="${this.config.interval / 1000}" min="10">
          </div>
          <div class="${PREFIX}-input-row">
            <label>最低余额 (0=不限)</label>
            <input type="number" id="inp-min-balance" value="${this.config.minBalance}" min="0">
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
          <div class="${PREFIX}-input-row">
            <label>智能选种</label>
            <div class="${PREFIX}-toggle ${this.config.autoSelectBest ? 'active' : ''}" id="tog-smart"></div>
          </div>
        </div>
        <div class="${PREFIX}-input-group">
          <div class="${PREFIX}-input-row">
            <label>默认/备选种子</label>
            <select id="sel-seed"><option value="">自动</option>${seedOptions}</select>
          </div>
        </div>
        <div class="${PREFIX}-input-group">
          <div class="${PREFIX}-input-row">
            <label>清空收益数据</label>
            <button id="btn-clear-profit" style="background:#ff453a;color:#fff;border:none;padding:6px 12px;border-radius:6px;cursor:pointer;">清空</button>
          </div>
        </div>
      `, () => {
        this.config.interval = Math.max(10, parseInt(document.getElementById('inp-interval').value) || 30) * 1000;
        this.config.minBalance = Math.max(0, parseInt(document.getElementById('inp-min-balance').value) || 0);
        this.config.autoHarvest = document.getElementById('tog-harvest').classList.contains('active');
        this.config.autoPlant = document.getElementById('tog-plant').classList.contains('active');
        this.config.autoSelectBest = document.getElementById('tog-smart').classList.contains('active');
        this.config.selectedSeed = document.getElementById('sel-seed').value || null;
        this.saveConfig();
        if (this.isRunning) {
          clearInterval(this.intervalId);
          this.intervalId = setInterval(() => this.loop(), this.config.interval);
        }
      });

      document.getElementById('tog-harvest').onclick = (e) => e.target.classList.toggle('active');
      document.getElementById('tog-plant').onclick = (e) => e.target.classList.toggle('active');
      document.getElementById('tog-smart').onclick = (e) => e.target.classList.toggle('active');
      document.getElementById('btn-clear-profit').onclick = () => {
        this.profitData = {};
        this.stats.totalProfit = 0;
        this.saveProfitData();
        WH.showToast('收益数据已清空');
      };
    }
  };

  // 导出模块
  WH.FarmModule = FarmModule;
})();
