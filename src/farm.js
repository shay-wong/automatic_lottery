// WindHub 农场模块
// @ts-check
'use strict';

window.WH = window.WH || {};

// 拦截 fetch 请求，捕获 CSRF token 和 farm_state API 响应
(function () {
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
    const options = args[1] || {};

    // 打印所有请求信息用于调试
    console.log('[自动农场] 拦截到请求:', url, {
      method: options.method || 'GET',
      headers: options.headers,
      headersType: options.headers ? options.headers.constructor.name : 'undefined'
    });

    // 捕获请求中的 CSRF token
    const headers = options.headers;
    if (headers) {
      let token = null;
      // headers 可能是 Headers 对象、普通对象或数组
      if (headers instanceof Headers) {
        token = headers.get('x-csrf-token');
      } else if (Array.isArray(headers)) {
        const found = headers.find(h => h[0]?.toLowerCase() === 'x-csrf-token');
        token = found ? found[1] : null;
      } else if (typeof headers === 'object') {
        token = headers['x-csrf-token'] || headers['X-Csrf-Token'] || headers['X-CSRF-TOKEN'];
      }

      if (token) {
        window._farmCsrfToken = token;
        console.log('[自动农场] 捕获到 CSRF token:', token.substring(0, 10) + '...');
      }
    }

    const response = await originalFetch.apply(this, args);

    // 捕获 farm_state API 响应
    if (url.includes('farm_state')) {
      try {
        const cloned = response.clone();
        const json = await cloned.json();
        const data = json.data || json;

        // 保存完整的 API 数据
        window._farmApiData = {
          crops: {},
          plots: data.plots || [],
          profile: data.profile || {},
          walletBalance: data.wallet_balance || 0
        };

        // 解析作物数据（包含解锁状态）
        const crops = data.crops;
        if (crops && Array.isArray(crops)) {
          crops.forEach(crop => {
            window._farmApiData.crops[crop.key] = {
              name: crop.name,
              reward: crop.reward,
              seedCost: crop.seed_cost,
              growSeconds: crop.grow_seconds,
              exp: crop.exp,
              unlocked: crop.unlocked
            };
          });
        }
        console.log('[自动农场] 拦截到 API 数据:', window._farmApiData);
      } catch (e) {
        console.warn('[自动农场] 解析 farm_state 响应失败:', e);
      }
    }
    return response;
  };

  // 主动获取 CSRF token 的函数
  window._getCsrfToken = function() {
    if (window._farmCsrfToken) return window._farmCsrfToken;

    // 打印调试信息
    console.log('[自动农场] 尝试获取 CSRF token, window.state:', window.state);

    // 从 meta 标签获取
    const meta = document.querySelector('meta[name="csrf-token"]');
    if (meta) {
      window._farmCsrfToken = meta.getAttribute('content');
      console.log('[自动农场] 从 meta 标签获取 CSRF token');
      return window._farmCsrfToken;
    }

    // 从各种全局变量获取
    const globalVars = ['csrfToken', 'csrf_token', 'CSRF_TOKEN', '_csrf', 'token'];
    for (const v of globalVars) {
      if (window[v]) {
        window._farmCsrfToken = window[v];
        console.log(`[自动农场] 从 window.${v} 获取 CSRF token`);
        return window._farmCsrfToken;
      }
    }

    // 从 window.state 获取（多种可能的属性名）
    if (window.state) {
      const stateKeys = ['csrf_token', 'csrfToken', 'csrf', 'token'];
      for (const k of stateKeys) {
        if (window.state[k]) {
          window._farmCsrfToken = window.state[k];
          console.log(`[自动农场] 从 window.state.${k} 获取 CSRF token`);
          return window._farmCsrfToken;
        }
      }
    }

    // 从隐藏 input 获取
    const input = document.querySelector('input[name="csrf_token"], input[name="_token"], input[name="csrf"]');
    if (input) {
      window._farmCsrfToken = input.value;
      console.log('[自动农场] 从 input 获取 CSRF token');
      return window._farmCsrfToken;
    }

    // 从页面 script 中解析（更宽松的正则）
    const scripts = document.querySelectorAll('script:not([src])');
    for (const script of scripts) {
      // 匹配各种格式: csrf_token: "xxx", csrfToken = "xxx", "csrf_token": "xxx" 等
      const patterns = [
        /csrf[_-]?token['":\s=]+['"]([a-f0-9]{32,})['"]/i,
        /['"]csrf[_-]?token['"]\s*:\s*['"]([a-f0-9]{32,})['"]/i,
        /token['":\s=]+['"]([a-f0-9]{64})['"]/i
      ];
      for (const pattern of patterns) {
        const match = script.textContent.match(pattern);
        if (match) {
          window._farmCsrfToken = match[1];
          console.log('[自动农场] 从 script 解析 CSRF token');
          return window._farmCsrfToken;
        }
      }
    }

    console.log('[自动农场] 未能获取 CSRF token');
    return null;
  };

  // 页面加载后尝试获取
  setTimeout(() => window._getCsrfToken(), 500);
})();

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
      seedStrategy: 'profit', // profit/exp/fast/efficiency/exp_efficiency
      minBalance: 0,
    },
    config: null,
    isRunning: false,
    intervalId: null,
    stats: { harvested: 0, planted: 0, totalProfit: 0 },
    // API 返回的作物数据缓存
    cropsData: null,
    // 种子排名列表是否展开
    _seedListExpanded: false,

    init() {
      this.config = { ...this.defaultConfig };
      try {
        const saved = localStorage.getItem(this.configKey);
        if (saved) this.config = { ...this.defaultConfig, ...JSON.parse(saved) };
      } catch (e) {}

      // 尝试从页面获取作物数据
      this.refreshCropsData();
    },

    // 从 API 获取作物数据
    async refreshCropsData() {
      // 优先使用拦截到的 API 数据
      if (window._farmApiData?.crops && Object.keys(window._farmApiData.crops).length > 0) {
        this.cropsData = window._farmApiData.crops;
        console.log('[自动农场] 使用拦截到的 API 数据:', this.cropsData);
        return;
      }

      // 尝试从 window.state 获取
      if (window.state && window.state.crops) {
        this.cropsData = {};
        window.state.crops.forEach(crop => {
          this.cropsData[crop.key] = {
            name: crop.name,
            reward: crop.reward,
            seedCost: crop.seed_cost,
            growSeconds: crop.grow_seconds,
            exp: crop.exp,
            unlocked: crop.unlocked
          };
        });
        console.log('[自动农场] 从 window.state 获取作物数据:', this.cropsData);
        return;
      }

      console.log('[自动农场] 等待 API 数据...');
    },

    // 从 API 数据获取可用种子（已解锁的）
    getAvailableSeeds() {
      if (!this.cropsData) return [];
      const seeds = [];
      for (const [id, data] of Object.entries(this.cropsData)) {
        if (data.unlocked) {
          seeds.push({
            id,
            name: data.name,
            cost: data.seedCost
          });
        }
      }
      return seeds;
    },

    // 从 API 数据获取农场状态
    getFarmStatus() {
      const apiData = window._farmApiData;
      if (apiData?.plots) {
        let empty = 0, growing = 0, ready = 0;
        const readyCrops = {};
        apiData.plots.forEach(plot => {
          if (plot.state === 'empty') empty++;
          else if (plot.state === 'ready') {
            ready++;
            const cropName = plot.crop?.name || plot.crop_key;
            if (cropName) readyCrops[cropName] = (readyCrops[cropName] || 0) + 1;
          }
          else if (plot.state === 'growing') growing++;
        });
        return { empty, growing, ready, total: apiData.plots.length, readyCrops, plots: apiData.plots };
      }

      // 降级到 DOM 读取
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

    // 从 API 数据获取体力
    getStamina() {
      const apiData = window._farmApiData;
      if (apiData?.profile) {
        return {
          current: apiData.profile.daily_actions_cap - apiData.profile.daily_actions_used,
          max: apiData.profile.daily_actions_cap,
          used: apiData.profile.daily_actions_used
        };
      }

      // 降级到 DOM 读取
      const el = document.getElementById('p-actions');
      if (el) {
        const text = el.textContent.trim();
        const match = text.match(/^(\d+)\s*\/\s*(\d+)$/);
        if (match) {
          return {
            current: parseInt(match[1]),
            max: parseInt(match[2])
          };
        }
      }
      return null;
    },

    // 从 API 数据获取余额
    getWalletBalance() {
      const apiData = window._farmApiData;
      if (apiData?.walletBalance !== undefined) {
        return apiData.walletBalance;
      }
      // 降级到全局方法
      return WH.getWalletBalance?.() || 0;
    },

    // 获取作物的基础收益（不含加成）
    getCropBaseProfit(cropId) {
      if (this.cropsData && this.cropsData[cropId]) {
        const data = this.cropsData[cropId];
        return data.reward - data.seedCost;
      }
      return 0;
    },

    // 获取作物每点体力的收益（种植+收割各消耗1点体力）
    getCropProfitPerStamina(cropId) {
      if (this.cropsData && this.cropsData[cropId]) {
        const data = this.cropsData[cropId];
        const profit = data.reward - data.seedCost;
        // 每块地消耗2点体力：种植1点 + 收割1点
        return profit / 2;
      }
      return 0;
    },

    saveConfig() {
      localStorage.setItem(this.configKey, JSON.stringify(this.config));
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

      // 使用 API 数据根据策略选择最优种子
      let bestSeed = null;
      let bestValue = -Infinity;
      const strategy = this.config.seedStrategy || 'profit';

      seeds.forEach(seed => {
        const data = this.cropsData?.[seed.id];
        if (!data) return;

        let value = 0;
        const growMinutes = (data.growSeconds || 1) / 60;
        const profit = data.reward - data.seedCost;

        switch (strategy) {
          case 'profit': // 每点体力净收益最高
            value = profit / 2;
            break;
          case 'exp': // 每点体力经验最多
            value = (data.exp || 0) / 2;
            break;
          case 'fast': // 生长时间最短（用负数，这样最小的排最前）
            value = -(data.growSeconds || Infinity);
            break;
          case 'efficiency': // 每分钟收益（时间效率）
            value = profit / growMinutes;
            break;
          case 'exp_efficiency': // 每分钟经验（时间效率）
            value = (data.exp || 0) / growMinutes;
            break;
        }

        if (value > bestValue) {
          bestValue = value;
          bestSeed = seed;
        }
      });

      if (bestSeed) {
        const strategyNames = {
          profit: '体力收益',
          exp: '体力经验',
          fast: '速度',
          efficiency: '时间收益',
          exp_efficiency: '时间经验'
        };
        console.log(`[自动农场] 智能选种(${strategyNames[strategy]}): ${bestSeed.name}`);
      }

      return bestSeed || seeds[0];
    },

    async harvest() {
      if (!this.config.autoHarvest) return 0;

      // 从 API 数据获取可收割的地块数量
      const apiData = window._farmApiData;
      let readyCount = 0;
      if (apiData?.plots) {
        apiData.plots.forEach(plot => {
          if (plot.state === 'ready') readyCount++;
        });
      }

      if (readyCount === 0) {
        // 降级到 DOM 检测
        const status = this.getFarmStatus();
        if (status.ready === 0) return 0;
        readyCount = status.ready;
      }

      console.log(`[自动农场] 准备收割 ${readyCount} 块作物`);

      // 优先使用 harvest_all API 一次性收割
      const csrfToken = window._getCsrfToken?.() || window._farmCsrfToken;
      console.log(`[自动农场] 收割 CSRF Token: ${csrfToken ? '已获取' : '未获取'}`, csrfToken ? csrfToken.substring(0, 10) + '...' : null);

      if (csrfToken) {
        try {
          const result = await this.callHarvestAllApi(csrfToken);
          if (result.success) {
            const harvested = result.harvestedCount || readyCount;
            const reward = result.totalReward || 0;
            this.stats.harvested += harvested;
            this.stats.totalProfit += reward;
            WH.showToast(`收割了 ${harvested} 块，收益 ${reward}`);
            console.log(`[自动农场] 批量收割成功: ${harvested} 块，收益 ${reward}`);
            return harvested;
          }
          console.error('[自动农场] harvest_all 失败:', result.error);
        } catch (e) {
          console.error('[自动农场] harvest_all 异常:', e);
        }
      }

      // 降级到旧方法
      return await this.harvestByDom();
    },

    // 批量收割 API
    async callHarvestAllApi(csrfToken) {
      const formData = new FormData();
      formData.append('action', 'harvest_all');

      const response = await fetch('/api/farm_action.php', {
        method: 'POST',
        headers: {
          'x-csrf-token': csrfToken
        },
        body: formData
      });

      const data = await response.json();
      if (data.success || data.status === 'success') {
        // 刷新本地缓存
        if (data.data?.state) {
          this.updateLocalCache(data.data.state);
        }
        const result = data.data?.result || {};
        return {
          success: true,
          harvestedCount: result.harvested_count || 0,
          totalReward: result.total_reward || 0,
          data
        };
      }
      return { success: false, error: data.message || data.error || 'Unknown error' };
    },

    // 单个收割 API（备用）
    async callHarvestApi(plotIndex, csrfToken) {
      const formData = new FormData();
      formData.append('action', 'harvest');
      formData.append('plot_index', plotIndex.toString());

      const response = await fetch('/api/farm_action.php', {
        method: 'POST',
        headers: {
          'x-csrf-token': csrfToken
        },
        body: formData
      });

      const data = await response.json();
      if (data.success || data.status === 'success') {
        // 刷新本地缓存
        if (data.data?.state) {
          this.updateLocalCache(data.data.state);
        }
        const reward = data.data?.result?.reward || 0;
        return { success: true, reward, data };
      }
      return { success: false, error: data.message || data.error || 'Unknown error' };
    },

    // 降级的 DOM 收割方法
    async harvestByDom() {
      const status = this.getFarmStatus();
      if (status.ready === 0) return 0;

      const cropNames = Object.keys(status.readyCrops);

      // 如果是单一作物，可以一键收割
      if (cropNames.length === 1) {
        const balanceBefore = this.getWalletBalance();

        const harvestAllBtn = document.querySelector('#btn-harvest-all');
        if (harvestAllBtn && !harvestAllBtn.disabled) {
          harvestAllBtn.click();
          this.stats.harvested += status.ready;
          await new Promise(r => setTimeout(r, 1000));
          this.recordSingleCropProfit(balanceBefore, cropNames[0], status.ready);
          WH.showToast(`收割了 ${status.ready} 块 ${cropNames[0]}`);
          return status.ready;
        }

        if (typeof window.doAction === 'function') {
          try {
            await window.doAction('harvest_all', {});
            this.stats.harvested += status.ready;
            await new Promise(r => setTimeout(r, 1000));
            this.recordSingleCropProfit(balanceBefore, cropNames[0], status.ready);
            WH.showToast(`收割了 ${status.ready} 块 ${cropNames[0]}`);
            return status.ready;
          } catch (e) {
            console.error('[自动农场] harvest_all 失败:', e);
          }
        }
      }

      // 多种作物：按作物类型分组，快速收割
      let totalCount = 0;
      for (const cropName of cropNames) {
        const tiles = Array.from(document.querySelectorAll('.tile.ready')).filter(tile => {
          const info = tile.querySelector('.tile-info');
          if (info) {
            const name = info.textContent.split(':')[0].trim();
            return name === cropName;
          }
          return false;
        });

        if (tiles.length === 0) continue;

        for (const tile of tiles) {
          tile.click();
          totalCount++;
        }

        await new Promise(r => setTimeout(r, 800));

        const seeds = this.getAvailableSeeds();
        const seed = seeds.find(s => s.name === cropName);
        if (seed) {
          const baseProfit = this.getCropBaseProfit(seed.id);
          if (baseProfit > 0) {
            const profit = baseProfit * tiles.length;
            this.stats.totalProfit += profit;
          }
        }

        await new Promise(r => setTimeout(r, 200));
      }

      this.stats.harvested += totalCount;
      if (totalCount > 0) WH.showToast(`收割了 ${totalCount} 块作物`);
      return totalCount;
    },

    recordSingleCropProfit(balanceBefore, cropName, count) {
      const balanceAfter = this.getWalletBalance();
      const profit = balanceAfter - balanceBefore;

      console.log(`[自动农场] 收益计算: ${cropName}, 收益: ${profit}, 数量: ${count}`);

      if (profit > 0 && count > 0) {
        this.stats.totalProfit += profit;
      }
    },

    async plant() {
      if (!this.config.autoPlant) return 0;
      const status = this.getFarmStatus();
      if (status.empty === 0) return 0;

      const seeds = this.getAvailableSeeds();
      if (seeds.length === 0) return 0;

      const seed = this.getBestSeed(seeds);
      if (!seed) return 0;

      return await this.plantSingleSeed(seed, status.empty);
    },

    async plantSingleSeed(seed, emptyCount) {
      const totalCost = seed.cost * emptyCount;

      // 检查余额是否足够
      const currentBalance = this.getWalletBalance();
      const minRequired = this.config.minBalance + totalCost;
      if (currentBalance < minRequired) {
        WH.showToast(`余额不足，需要 ${minRequired.toFixed(0)}，当前 ${currentBalance.toFixed(0)}`);
        WH.stop('余额不足，已停止');
        return 0;
      }

      // 从 API 数据获取空地索引
      const apiData = window._farmApiData;
      let plotIndices = [];
      if (apiData?.plots) {
        apiData.plots.forEach((plot, index) => {
          if (plot.state === 'empty') {
            plotIndices.push(index);
          }
        });
      }

      // 降级到 DOM 获取
      if (plotIndices.length === 0) {
        const emptyTiles = document.querySelectorAll('.tile.empty');
        emptyTiles.forEach(tile => {
          const index = tile.dataset.plotIndex;
          if (index !== undefined) plotIndices.push(parseInt(index));
        });
      }

      if (plotIndices.length === 0) {
        console.log('[自动农场] 没有找到空地');
        return 0;
      }

      console.log(`[自动农场] 准备种植 ${seed.name}，空地索引:`, plotIndices);

      // 优先使用 fetch API 直接调用
      const csrfToken = window._getCsrfToken?.() || window._farmCsrfToken;
      console.log(`[自动农场] CSRF Token: ${csrfToken ? '已获取' : '未获取'}`, csrfToken ? csrfToken.substring(0, 10) + '...' : null);

      if (csrfToken) {
        try {
          const result = await this.callPlantApi(seed.id, plotIndices, csrfToken);
          if (result.success) {
            this.stats.planted += plotIndices.length;
            WH.showToast(`种植了 ${plotIndices.length} 块 ${seed.name}`);
            return plotIndices.length;
          }
          console.error('[自动农场] API 种植失败:', result.error);
        } catch (e) {
          console.error('[自动农场] fetch 种植失败:', e);
        }
      }

      // 降级到 window.doAction
      if (typeof window.doAction === 'function') {
        try {
          await window.doAction('plant_many', {
            crop_key: seed.id,
            plot_indices: JSON.stringify(plotIndices)
          });
          this.stats.planted += plotIndices.length;
          WH.showToast(`种植了 ${plotIndices.length} 块 ${seed.name}`);
          return plotIndices.length;
        } catch (e) {
          console.error('[自动农场] doAction 种植失败:', e);
        }
      }

      console.error('[自动农场] 所有种植方式都失败了');
      return 0;
    },

    // 直接调用种植 API
    async callPlantApi(cropKey, plotIndices, csrfToken) {
      const formData = new FormData();
      formData.append('action', 'plant_many');
      formData.append('crop_key', cropKey);
      formData.append('plot_indices', JSON.stringify(plotIndices));

      const response = await fetch('/api/farm_action.php', {
        method: 'POST',
        headers: {
          'x-csrf-token': csrfToken
        },
        body: formData
      });

      const data = await response.json();
      if (data.success || data.status === 'success') {
        // 刷新本地缓存
        if (data.data?.state) {
          this.updateLocalCache(data.data.state);
        }
        return { success: true, data };
      }
      return { success: false, error: data.message || data.error || 'Unknown error' };
    },

    // 更新本地缓存
    updateLocalCache(state) {
      if (!state) return;

      // 更新 window._farmApiData
      window._farmApiData = {
        crops: window._farmApiData?.crops || {},
        plots: state.plots || [],
        profile: state.profile || {},
        walletBalance: state.wallet_balance || 0
      };

      // 更新作物数据
      if (state.crops && Array.isArray(state.crops)) {
        state.crops.forEach(crop => {
          window._farmApiData.crops[crop.key] = {
            name: crop.name,
            reward: crop.reward,
            seedCost: crop.seed_cost,
            growSeconds: crop.grow_seconds,
            exp: crop.exp,
            unlocked: crop.unlocked
          };
        });
        this.cropsData = window._farmApiData.crops;
      }

      console.log('[自动农场] 本地缓存已刷新');

      // 刷新网页 UI
      if (typeof window.renderState === 'function') {
        window.renderState(state);
      }
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

      // 检查体力是否用完
      const stamina = this.getStamina();
      if (stamina && stamina.current <= 0) {
        WH.showToast('体力已用完，自动停止');
        WH.stop('体力已用完');
        return;
      }

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
      const strategyNames = {
        profit: '体力收益优先',
        exp: '体力经验优先',
        fast: '速度优先',
        efficiency: '时间收益优先',
        exp_efficiency: '时间经验优先'
      };
      const strategyText = strategyNames[this.config.seedStrategy] || '体力收益优先';
      return `
        <div class="${PREFIX}-row"><span class="${PREFIX}-label">检查间隔</span><span class="${PREFIX}-val">${this.config.interval / 1000}秒</span></div>
        <div class="${PREFIX}-row"><span class="${PREFIX}-label">自动收割</span><span class="${PREFIX}-val">${this.config.autoHarvest ? '开' : '关'}</span></div>
        <div class="${PREFIX}-row"><span class="${PREFIX}-label">自动种植</span><span class="${PREFIX}-val">${this.config.autoPlant ? '开' : '关'}</span></div>
        <div class="${PREFIX}-row"><span class="${PREFIX}-label">智能选种</span><span class="${PREFIX}-val">${this.config.autoSelectBest ? '开' : '关'}</span></div>
        <div class="${PREFIX}-row"><span class="${PREFIX}-label">选种策略</span><span class="${PREFIX}-val">${strategyText}</span></div>
        <div class="${PREFIX}-row"><span class="${PREFIX}-label">种子</span><span class="${PREFIX}-val">${seedName}</span></div>
        <div class="${PREFIX}-row"><span class="${PREFIX}-label">最低余额</span><span class="${PREFIX}-val">${minBalText}</span></div>
      `;
    },

    getStatsDisplay() {
      const seeds = this.getAvailableSeeds();
      const stamina = this.getStamina();
      const staminaText = stamina ? `${stamina.current}/${stamina.max}` : '-';
      const strategy = this.config.seedStrategy || 'profit';

      // 基于 API 数据构建种子信息表
      let seedTableHtml = '';
      if (this.cropsData && Object.keys(this.cropsData).length > 0) {
        const seedList = [];
        seeds.forEach(seed => {
          const data = this.cropsData[seed.id];
          if (data && data.seedCost > 0) {
            const profit = data.reward - data.seedCost;
            const growMinutes = (data.growSeconds || 0) / 60;
            const profitPerStamina = profit / 2;
            const expPerStamina = (data.exp || 0) / 2;
            const profitPerMin = growMinutes > 0 ? profit / growMinutes : 0;
            const expPerMin = growMinutes > 0 ? (data.exp || 0) / growMinutes : 0;

            seedList.push({
              name: seed.name,
              reward: data.reward,
              cost: data.seedCost,
              profit,
              growMinutes: Math.round(growMinutes),
              exp: data.exp || 0,
              profitPerStamina,
              expPerStamina,
              profitPerMin,
              expPerMin
            });
          }
        });

        // 根据策略排序
        switch (strategy) {
          case 'profit':
            seedList.sort((a, b) => b.profitPerStamina - a.profitPerStamina);
            break;
          case 'exp':
            seedList.sort((a, b) => b.expPerStamina - a.expPerStamina);
            break;
          case 'fast':
            seedList.sort((a, b) => a.growMinutes - b.growMinutes);
            break;
          case 'efficiency':
            seedList.sort((a, b) => b.profitPerMin - a.profitPerMin);
            break;
          case 'exp_efficiency':
            seedList.sort((a, b) => b.expPerMin - a.expPerMin);
            break;
        }

        if (seedList.length > 0) {
          const best = seedList[0];
          const isExpanded = this._seedListExpanded || false;

          seedTableHtml = `<div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.1);">`;

          // 最优种子显示
          seedTableHtml += `<div class="${PREFIX}-row"><span class="${PREFIX}-label" style="color:#30d158;">最优种子</span><span class="${PREFIX}-val" style="color:#30d158;font-weight:bold;">${best.name}</span></div>`;
          seedTableHtml += `<div class="${PREFIX}-row"><span class="${PREFIX}-label">收益/时间/经验</span><span class="${PREFIX}-val">${best.profit} / ${best.growMinutes}分 / ${best.exp}</span></div>`;

          // 展开/收起按钮
          seedTableHtml += `<div style="text-align:center;margin-top:6px;">
            <button id="${PREFIX}-toggle-seeds" style="background:rgba(255,255,255,0.1);border:none;color:#fff;padding:4px 12px;border-radius:4px;font-size:11px;cursor:pointer;">
              ${isExpanded ? '收起排名 ▲' : '查看排名 ▼'}
            </button>
          </div>`;

          // 完整排名列表（可折叠）
          if (isExpanded) {
            seedTableHtml += `<div id="${PREFIX}-seed-list" style="margin-top:8px;">`;
            seedTableHtml += `<div style="display:flex;font-size:10px;opacity:0.6;padding:2px 0;border-bottom:1px solid rgba(255,255,255,0.1);">
              <span style="flex:2;">名称</span>
              <span style="flex:1;text-align:right;">收益</span>
              <span style="flex:1;text-align:right;">时间</span>
              <span style="flex:1;text-align:right;">经验</span>
            </div>`;
            seedList.forEach((crop, index) => {
              const style = index === 0 ? 'color:#30d158;font-weight:bold;' : '';
              seedTableHtml += `<div style="display:flex;font-size:11px;${style}padding:2px 0;">
                <span style="flex:2;">${crop.name}</span>
                <span style="flex:1;text-align:right;">${crop.profit}</span>
                <span style="flex:1;text-align:right;">${crop.growMinutes}分</span>
                <span style="flex:1;text-align:right;">${crop.exp}</span>
              </div>`;
            });
            seedTableHtml += `</div>`;
          }
          seedTableHtml += `</div>`;
        }
      }

      return `
        <div class="${PREFIX}-row"><span class="${PREFIX}-label">体力</span><span class="${PREFIX}-val">${staminaText}</span></div>
        <div class="${PREFIX}-row"><span class="${PREFIX}-label">已收割</span><span class="${PREFIX}-val">${this.stats.harvested}</span></div>
        <div class="${PREFIX}-row"><span class="${PREFIX}-label">已种植</span><span class="${PREFIX}-val">${this.stats.planted}</span></div>
        <div class="${PREFIX}-row"><span class="${PREFIX}-label">总收益</span><span class="${PREFIX}-val">${this.stats.totalProfit.toFixed(1)}</span></div>
        ${seedTableHtml}
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
          <div class="${PREFIX}-input-row">
            <label>选种策略</label>
            <select id="sel-strategy">
              <option value="profit" ${this.config.seedStrategy === 'profit' ? 'selected' : ''}>体力收益优先</option>
              <option value="exp" ${this.config.seedStrategy === 'exp' ? 'selected' : ''}>体力经验优先</option>
              <option value="fast" ${this.config.seedStrategy === 'fast' ? 'selected' : ''}>速度优先</option>
              <option value="efficiency" ${this.config.seedStrategy === 'efficiency' ? 'selected' : ''}>时间收益优先</option>
              <option value="exp_efficiency" ${this.config.seedStrategy === 'exp_efficiency' ? 'selected' : ''}>时间经验优先</option>
            </select>
          </div>
        </div>
        <div class="${PREFIX}-input-group">
          <div class="${PREFIX}-input-row">
            <label>默认/备选种子</label>
            <select id="sel-seed"><option value="">自动</option>${seedOptions}</select>
          </div>
        </div>
      `, () => {
        this.config.interval = Math.max(10, parseInt(document.getElementById('inp-interval').value) || 30) * 1000;
        this.config.minBalance = Math.max(0, parseInt(document.getElementById('inp-min-balance').value) || 0);
        this.config.autoHarvest = document.getElementById('tog-harvest').classList.contains('active');
        this.config.autoPlant = document.getElementById('tog-plant').classList.contains('active');
        this.config.autoSelectBest = document.getElementById('tog-smart').classList.contains('active');
        this.config.seedStrategy = document.getElementById('sel-strategy').value || 'profit';
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
    }
  };

  // 导出模块
  WH.FarmModule = FarmModule;
})();
