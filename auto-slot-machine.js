// ==UserScript==
// @name         Auto Slot Machine
// @version      1.0.1
// @description  在页面右上角添加一个悬浮按钮，每 6 秒自动点击一次 button#spinButton 来进行抽奖
// @homepage     https://github.com/Lurito/kyx-auto-slot-machine
// @updateURL    https://cdn.jsdelivr.net/gh/Lurito/kyx-auto-slot-machine/auto-slot-machine.js
// @downloadURL  https://cdn.jsdelivr.net/gh/Lurito/kyx-auto-slot-machine/auto-slot-machine.js
// @supportURL   https://github.com/Lurito/kyx-auto-slot-machine/issues
// @match        https://quota.kyx03.de/
// @match        https://quota.wpgzs.top/
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  let intervalId = null;
  let running = false;
  let interval = 6000;

  // 创建悬浮按钮容器
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '0.5rem';
  container.style.right = '1.5rem';
  container.style.zIndex = '9999';
  container.style.width = '3rem';
  container.style.height = '3rem';
  container.style.borderRadius = '50%';
  container.style.backgroundColor = '#007bff';
  container.style.display = 'flex';
  container.style.alignItems = 'center';
  container.style.justifyContent = 'center';
  container.style.cursor = 'pointer';
  container.style.color = 'white';
  container.style.fontSize = '20px';
  container.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
  container.title = '开始自动点击';

  // 使用 emoji 图标
  container.textContent = '▶️';

  // 创建间隔设置输入框
  const input = document.createElement('input');
  input.type = 'number';
  input.value = interval / 1000;
  input.min = '1';
  input.style.cssText = 'position:fixed;top:3.8rem;right:1.5rem;width:3rem;height:1.5rem;z-index:9999;text-align:center;border-radius:4px;border:1px solid #ccc;';
  input.title = '间隔秒数';
  input.addEventListener('change', () => {
    interval = Math.max(1, parseInt(input.value) || 6) * 1000;
    if (running) {
      clearInterval(intervalId);
      intervalId = setInterval(spin, interval);
    }
  });
  document.body.appendChild(input);

  // 定义 spin 函数
  function spin() {
    // 按优先级尝试点击可用的抽奖按钮
    const btns = ['#freeSpinButton', '#spinButton', '#advancedSpinButton', '#supremeSpinButton'];
    for (const sel of btns) {
      const btn = document.querySelector(sel);
      if (btn && !btn.disabled && btn.offsetParent !== null) {
        btn.click();
        return;
      }
    }
    console.warn('[AutoClick] 没有可用的抽奖按钮');
  }

  // 点击切换状态
  container.addEventListener('click', () => {
    running = !running;

    if (running) {
      container.textContent = '⏹️';
      container.title = '停止自动点击';
      spin(); // 先立即抽取一次
      intervalId = setInterval(spin, interval);
    } else {
      container.textContent = '▶️';
      container.title = '开始自动点击';
      clearInterval(intervalId);
      intervalId = null;
    }
  });

  document.body.appendChild(container);
})();
