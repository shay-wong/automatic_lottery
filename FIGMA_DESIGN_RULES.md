# Figma 设计系统规则

本文档为 Figma MCP 集成提供设计系统指南，用于将 Figma 设计转换为此项目的代码。

## 1. 设计令牌（Design Tokens）

### 颜色系统
```javascript
// 主色调 - iOS 风格
const colors = {
  // 背景色
  panelBg: 'rgba(28,28,30,0.85)',           // 深色面板背景
  modalBg: 'rgba(30,30,30,0.9)',            // 模态框背景
  cardBg: 'rgba(0,0,0,0.2)',                // 卡片背景
  toastBg: 'rgba(255,255,255,0.95)',        // Toast 背景

  // 文字颜色
  textPrimary: 'rgba(255,255,255,0.95)',    // 主要文字
  textSecondary: 'rgba(235,235,245,0.6)',   // 次要文字
  textTertiary: 'rgba(235,235,245,0.5)',    // 三级文字
  textDark: '#1d1d1f',                      // 深色文字（用于浅色背景）

  // 功能色
  success: '#30d158',                        // 成功/运行状态
  danger: '#ff453a',                         // 危险/停止
  warning: '#ff3b30',                        // 警告
  link: '#0a84ff',                          // 链接/强调

  // 边框和分隔线
  border: 'rgba(255,255,255,0.1)',
  borderLight: 'rgba(255,255,255,0.08)',
  divider: 'rgba(84,84,88,0.5)',

  // 叠加层
  overlay: 'rgba(255,255,255,0.03)',
  overlayHover: 'rgba(255,255,255,0.1)',
  backdropBg: 'rgba(0,0,0,0.4)',

  // 状态指示器
  dotInactive: 'rgba(255,255,255,0.2)',
  dotActive: '#30d158'
};
```

### 排版系统
```javascript
const typography = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
  fontSmoothing: 'antialiased',

  sizes: {
    title: '15px',        // 面板标题
    modalTitle: '16px',   // 模态框标题
    button: '14px',       // 按钮文字
    label: '14px',        // 表单标签
    value: '13px',        // 配置值
    caption: '12px',      // 说明文字
    status: '11px'        // 状态文字
  },

  weights: {
    regular: 400,
    medium: 500,
    semibold: 600
  }
};
```

### 间距系统
```javascript
const spacing = {
  xs: '6px',    // 小间距（图标间距、状态点）
  sm: '10px',   // 小间距（内边距）
  md: '14px',   // 中等间距（卡片内边距）
  lg: '16px',   // 大间距（主要内边距）
  xl: '20px'    // 超大间距（Toast 边距）
};
```

### 圆角系统
```javascript
const borderRadius = {
  full: '99px',   // 完全圆角（Toast、圆形按钮）
  lg: '18px',     // 大圆角（面板）
  md: '16px',     // 中等圆角（模态框）
  sm: '10px',     // 小圆角（按钮、输入框）
  circle: '50%'   // 圆形（状态点、小按钮）
};
```

### 阴影系统
```javascript
const shadows = {
  panel: '0 16px 32px rgba(0,0,0,0.4)',
  modal: '0 20px 40px rgba(0,0,0,0.5)',
  toast: '0 4px 16px rgba(0,0,0,0.15)'
};
```

### 毛玻璃效果
```javascript
const blur = {
  light: 'blur(10px)',   // 轻度模糊（背景遮罩）
  medium: 'blur(20px)',  // 中度模糊（Toast）
  heavy: 'blur(30px)',   // 重度模糊（面板）
  ultra: 'blur(40px)'    // 超重模糊（模态框）
};
```

## 2. 组件库

### 组件位置
所有 UI 组件都内联在各自的用户脚本文件中：
- `auto-card-draw.user.js` - 抽卡脚本组件
- `auto-slot-machine.user.js` - 老虎机脚本组件

### 组件架构
采用原生 JavaScript + 动态 DOM 创建模式：

```javascript
// 组件创建模式
function createComponent() {
  injectStyles();  // 1. 注入样式

  const element = document.createElement('div');
  element.id = 'component-id';
  element.innerHTML = `...`;  // 2. 设置 HTML 结构

  document.body.appendChild(element);  // 3. 添加到 DOM

  // 4. 绑定事件
  element.querySelector('.btn').onclick = handler;
}
```

### 核心组件

#### 悬浮面板（Panel）
```javascript
// 特性：可拖拽、可最小化、固定定位
#acd-panel / #asm-panel {
  position: fixed;
  top: 50px;
  right: 50px;
  width: 280px / 200px;
  background: rgba(28,28,30,0.85);
  backdrop-filter: blur(30px);
  border-radius: 18px;
  z-index: 999999;
}
```

#### Toast 通知
```javascript
// 特性：自动消失、居中显示、动画过渡
.acd-toast / .asm-toast {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(255,255,255,0.95);
  backdrop-filter: blur(20px);
  border-radius: 99px;
  padding: 10px 20px;
}
```

#### 模态框（Modal）
```javascript
// 特性：全屏遮罩、居中显示、iOS 风格
#acd-settings / #asm-settings {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
}
```

#### 按钮
```javascript
// 主要按钮
.acd-btn / .asm-btn {
  width: 100%;
  height: 40px;
  border-radius: 10px;
  font-weight: 600;
  transition: all 0.2s;
}

// 圆形小按钮（最小化、开始、停止）
.acd-min-btn {
  width: 26px;
  height: 26px;
  border-radius: 50%;
}
```

## 3. 框架和库

### UI 框架
- **原生 JavaScript（Vanilla JS）** - 无框架依赖
- **ES6+ 语法** - 箭头函数、模板字符串、解构

### 样式方法
- **内联样式注入** - 通过 `<style>` 标签动态注入
- **无 CSS 预处理器** - 纯 CSS
- **无 CSS-in-JS 库** - 原生字符串模板

### 构建系统
- **无构建步骤** - 直接运行的用户脚本
- **无打包工具** - 单文件部署
- **自动更新** - 通过 `@updateURL` 和 `@downloadURL`

## 4. 资源管理

### 资源存储
- **无外部资源** - 所有样式和逻辑都内联在脚本中
- **无图片/图标文件** - 使用 Unicode 符号（▶、⏹、−、+）
- **无 CDN** - 完全自包含

### 配置持久化
```javascript
// 使用 localStorage 存储用户配置
localStorage.setItem('acd_config', JSON.stringify(CONFIG));
localStorage.getItem('acd_config');
```

## 5. 图标系统

### 图标来源
使用 Unicode 字符作为图标：
- `▶` - 播放/开始
- `⏹` - 停止
- `−` - 最小化
- `+` - 展开

### 图标使用
```javascript
// 直接在 HTML 中使用
<button>▶</button>
<button>⏹</button>
```

## 6. 样式方法

### CSS 方法论
- **BEM 命名约定的变体** - 使用前缀隔离样式
- **类名前缀**：
  - `acd-*` - 自动抽卡脚本
  - `asm-*` - 自动老虎机脚本

### 样式注入模式
```javascript
function injectStyles() {
  const style = document.createElement('style');
  style.textContent = `
    /* 所有样式规则 */
  `;
  document.head.appendChild(style);
}
```

### 响应式设计
- **固定宽度** - 面板使用固定像素宽度
- **最小化状态** - 通过 `.minimized` 类切换布局
- **移动端适配** - 目标网站为移动端（375px 宽度）

### 全局样式
```javascript
// 字体平滑
-webkit-font-smoothing: antialiased;

// 用户选择
user-select: none;  // 用于可拖拽元素

// 过渡动画
transition: all 0.3s ease;
transition: all 0.2s;
```

## 7. 项目结构

```
automatic_lottery/
├── auto-card-draw.user.js      # 自动抽卡脚本（完整独立）
├── auto-slot-machine.user.js   # 自动老虎机脚本（完整独立）
├── CLAUDE.md                    # 项目指南
├── FIGMA_DESIGN_RULES.md       # 本文档
└── README.md                    # 项目说明
```

### 代码组织模式
每个脚本文件遵循相同的结构：

```javascript
// 1. UserScript 元数据块
// ==UserScript==
// @name, @version, @match, @grant 等
// ==/UserScript==

// 2. IIFE 包装器
(function () {
  'use strict';

  // 3. 配置管理
  const DEFAULT_CONFIG = {...};
  let CONFIG = {...};

  // 4. 工具函数
  function saveConfig() {...}
  function showToast() {...}

  // 5. 样式注入
  function injectStyles() {...}

  // 6. 核心逻辑
  function draw() {...}  // 或 spin()
  function start() {...}
  function stop() {...}

  // 7. UI 创建
  function createPanel() {...}
  function showSettings() {...}

  // 8. 初始化
  createPanel();
})();
```

## 8. Figma 到代码转换指南

### 从 Figma 设计生成代码时的规则

#### 布局转换
- **Frame → `<div>`** - 使用 flexbox 布局
- **Auto Layout → Flexbox** - 保持间距和对齐
- **Fixed Position → `position: fixed`** - 悬浮元素

#### 样式转换
```javascript
// Figma 毛玻璃效果 → CSS backdrop-filter
background: rgba(28,28,30,0.85);
backdrop-filter: blur(30px);

// Figma 阴影 → CSS box-shadow
box-shadow: 0 16px 32px rgba(0,0,0,0.4);

// Figma 圆角 → CSS border-radius
border-radius: 18px;
```

#### 交互转换
- **Hover → `:hover` 伪类**
- **Active → `:active` 伪类**
- **Disabled → `:disabled` 或 `[disabled]`**

#### 动画转换
```javascript
// Figma 过渡 → CSS transition
transition: all 0.3s ease;

// Figma 变换 → CSS transform
transform: translateX(-50%) translateY(0);
```

### 命名约定
- **组件 ID**：`{prefix}-{component}` (如 `acd-panel`)
- **类名**：`{prefix}-{element}` (如 `acd-btn`)
- **状态类**：`.minimized`, `.running`, `.show`

### 颜色使用优先级
1. 使用 `rgba()` 实现透明度
2. 使用十六进制颜色表示不透明色
3. 保持 iOS 风格的颜色语义

### 间距规范
- 使用 `padding` 而非 `margin` 控制内部间距
- 使用 `gap` 属性处理 flexbox 子元素间距
- 按钮之间使用 `margin-bottom` 分隔

## 9. 最佳实践

### 性能优化
- 使用 `requestAnimationFrame` 触发动画
- 使用 `setTimeout` 延迟移除 DOM 元素
- 避免频繁的 DOM 查询，缓存选择器结果

### 可访问性
- 使用语义化的按钮元素 `<button>`
- 提供清晰的视觉反馈（`:active` 状态）
- 使用足够的颜色对比度

### 浏览器兼容性
- 使用 `-webkit-` 前缀支持 Safari
- 使用 `backdrop-filter` 需要现代浏览器
- 测试目标：Chrome、Firefox、Safari（桌面和移动端）

### 代码风格
- 使用单引号包裹字符串
- 使用模板字符串构建 HTML
- 使用箭头函数简化回调
- 保持函数简短且单一职责

## 10. 从 Figma 导入检查清单

将 Figma 设计转换为代码时，请确保：

- [ ] 使用正确的类名前缀（`acd-` 或 `asm-`）
- [ ] 应用毛玻璃效果（`backdrop-filter: blur()`）
- [ ] 使用 iOS 风格的颜色和圆角
- [ ] 实现平滑的过渡动画
- [ ] 支持拖拽功能（如果是面板）
- [ ] 支持最小化状态（如果是面板）
- [ ] 添加 Toast 通知反馈
- [ ] 使用 localStorage 持久化配置
- [ ] 遵循现有的代码结构模式
- [ ] 测试在目标网站上的显示效果
