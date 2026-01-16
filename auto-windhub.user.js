// ==UserScript==
// @name         WindHub 自动化助手
// @version      1.9.13
// @description  WindHub 福利站自动化脚本，支持农场、抽卡、打砖块
// @license      Apache-2.0
// @homepage     https://github.com/shay-wong/automatic_lottery
// @updateURL    https://raw.githubusercontent.com/shay-wong/automatic_lottery/master/auto-windhub.user.js
// @downloadURL  https://raw.githubusercontent.com/shay-wong/automatic_lottery/master/auto-windhub.user.js
// @supportURL   https://github.com/shay-wong/automatic_lottery/issues
// @match        https://wcdk.224442.xyz/*
// @require      https://raw.githubusercontent.com/shay-wong/automatic_lottery/master/src/common.js?v=1.9.13
// @require      https://raw.githubusercontent.com/shay-wong/automatic_lottery/master/src/farm.js?v=1.9.13
// @require      https://raw.githubusercontent.com/shay-wong/automatic_lottery/master/src/cards.js?v=1.9.13
// @require      https://raw.githubusercontent.com/shay-wong/automatic_lottery/master/src/brick.js?v=1.9.13
// @run-at       document-start
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function () {
  'use strict';

  // 自动从 GM_info 读取版本号
  WH.version = (typeof GM_info !== 'undefined' && GM_info.script && GM_info.script.version)
    ? GM_info.script.version
    : '';

  function init() {
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
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 1000));
  } else {
    setTimeout(init, 1000);
  }
})();
