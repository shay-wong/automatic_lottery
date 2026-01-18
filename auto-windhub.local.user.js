// ==UserScript==
// @name         WindHub 自动化助手 (local)
// @version      2.0.9-local
// @description  WindHub 福利站自动化脚本（本地调试版）
// @license      Apache-2.0
// @homepage     https://github.com/shay-wong/automatic_lottery
// @match        https://wcdk.224442.xyz/*
// @require      file:///home/runner/work/automatic_lottery/automatic_lottery/src/common.js
// @require      file:///home/runner/work/automatic_lottery/automatic_lottery/src/farm.js
// @require      file:///home/runner/work/automatic_lottery/automatic_lottery/src/cards.js
// @require      file:///home/runner/work/automatic_lottery/automatic_lottery/src/brick.js
// @run-at       document-start
// @grant        none
// ==/UserScript==
// Generated from auto-windhub.user.js by scripts/gen-windhub-userscripts.js

// 立即拦截 fetch，必须在 @require 脚本加载前执行
(function () {
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    // 捕获请求中的 CSRF token
    const options = args[1] || {};
    const headers = options.headers || {};
    if (headers['x-csrf-token']) {
      window._farmCsrfToken = headers['x-csrf-token'];
      console.log('[自动农场] 捕获到 CSRF token');
    }

    const response = await originalFetch.apply(this, args);
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';

    // 捕获 farm_state API 响应
    if (url.includes('farm_state')) {
      try {
        const cloned = response.clone();
        const json = await cloned.json();
        const data = json.data || json;
        window._farmApiData = {
          crops: {},
          plots: data.plots || [],
          profile: data.profile || {},
          walletBalance: data.wallet_balance || 0
        };
        if (data.crops && Array.isArray(data.crops)) {
          data.crops.forEach(crop => {
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

    // 捕获砖块游戏启动配置
    if (url.includes('brick_game_start')) {
      try {
        const cloned = response.clone();
        const json = await cloned.json();
        const data = json.data || {};
        if (data.config) {
          window._brickGameConfig = data.config;
          window._brickGameSession = {
            sessionId: data.session_id,
            runId: data.run_id,
            finishToken: data.finish_token,
            finishTokenExpiresAt: data.finish_token_expires_at
          };
          console.log('[自动打砖块] 捕获到游戏配置:', window._brickGameConfig);
        }
      } catch (e) {
        console.warn('[自动打砖块] 解析 brick_game_start 响应失败:', e);
      }
    }
    return response;
  };
})();

(function () {
  'use strict';

  // 自动从 GM_info 读取版本号
  WH.version = (typeof GM_info !== 'undefined' && GM_info.script && GM_info.script.version)
    ? GM_info.script.version
    : '';

  function init() {
    if (window.__whInitDone) return;
    window.__whInitDone = true;
    const path = window.location.pathname;
    let module = null;

    if (path.includes('farm.php')) {
      module = WH.FarmModule;
    } else if (path.includes('cards.php')) {
      module = WH.CardsModule;
    } else if (path.includes('game.php')) {
      module = WH.BrickModule;
    }

    if (module) {
      WH.init(module);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 1000), { once: true });
  } else {
    setTimeout(init, 1000);
  }
})();
