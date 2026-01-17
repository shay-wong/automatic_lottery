# AGENTS.md

This file provides guidance to Codex CLI and Claude Code when working with
code in this repository.

## 项目概述

这是一个浏览器用户脚本（Tampermonkey/Greasemonkey）项目，包含以下自动化脚本：

| 脚本文件 | 功能 | 适用网站 |
|---------|------|---------|
| `auto-windhub.user.js` | WindHub 自动化助手（农场、抽卡、打砖块） | wcdk.224442.xyz |
| `auto-slot-machine.user.js` | 自动老虎机抽奖 | KYX、莹のapi 加油站 |
| `auto-card-draw.user.js` | 自动抽卡 | 黑与白抽卡网站 |

## 代码架构

### 脚本结构模式

两个脚本都遵循相同的架构模式：

```text
UserScript 元数据块 (@name, @version, @match, @grant 等)
  ↓
IIFE 包装器 (function() { 'use strict'; })
  ↓
配置管理 (DEFAULT_CONFIG + localStorage)
  ↓
核心功能函数
  ↓
UI 创建和事件绑定
```

### 关键组件

#### 配置系统

- 使用 `localStorage` 持久化用户配置
- 配置键：
  - `acd_config` - 黑与白抽卡
  - `asm_config` - 老虎机
  - `wh_farm_config` - WindHub 农场
  - `wh_cards_config` - WindHub 抽卡
  - `wh_brick_config` - WindHub 打砖块
- 通过 `saveConfig()` 保存，启动时自动加载

#### UI 系统

- iOS 风格悬浮面板，支持拖拽和最小化
- 使用 `backdrop-filter: blur()` 实现毛玻璃效果
- 所有样式通过 `injectStyles()` 动态注入
- Toast 通知系统用于用户反馈

#### 核心逻辑

- `draw()`/`spin()` - 执行抽奖/抽卡操作
- `start()` - 启动自动化循环（使用 `setInterval`）
- `stop()` - 停止自动化并清理
- `updateBtnState()` - 同步 UI 状态

#### DOM 操作

- 通过 `querySelector` 查找目标按钮
- auto-card-draw 使用文本匹配查找按钮（"单抽"/"十连抽"）
- auto-slot-machine 使用 ID 选择器（`#spin-button`）

## 开发指南

### 修改脚本时的注意事项

1. **版本号管理**：修改代码后必须更新 `@version` 字段，遵循语义化版本
2. **匹配规则**：`@match` 字段定义脚本运行的网站，修改时需谨慎
3. **配置兼容性**：添加新配置项时，确保 `DEFAULT_CONFIG` 包含默认值
4. **样式隔离**：所有 CSS 类名使用前缀（`acd-` 或 `asm-`）避免冲突
5. **错误处理**：localStorage 操作需要 try-catch 包裹

### 测试方法

1. 在浏览器中安装 Tampermonkey 扩展
2. 创建新脚本并粘贴代码
3. 访问对应的 `@match` 网站进行测试
4. 检查控制台是否有错误信息

### 本地调试脚本（WindHub）

- `auto-windhub.local.user.js` 由脚本自动生成，避免手动同步
- 修改 `auto-windhub.user.js` 后运行：
  ```bash
  node scripts/gen-windhub-userscripts.js
  ```
- 本地脚本使用 `file:///.../src/*.js`，路径变更时重新生成即可

### 发布流程

本项目使用 GitHub Actions 自动管理版本号和发布，**每个脚本独立版本**：

1. **开发阶段**：正常提交代码，**不需要手动修改** `@version` 字段

2. **发布新版本**：根据脚本创建对应格式的 Git tag

   | 脚本 | Tag 格式 | 示例 |
   |------|----------|------|
   | WindHub 自动化助手 | `windhub-v{版本}` | `windhub-v1.9.0` |
   | 自动抽卡 | `card-draw-v{版本}` | `card-draw-v1.2.0` |
   | 自动老虎机 | `slot-machine-v{版本}` | `slot-machine-v1.1.0` |

   ```bash
   # 示例：发布 WindHub v1.9.0
   git tag windhub-v1.9.0
   git push origin windhub-v1.9.0
   ```

3. **自动化处理**：GitHub Actions 会自动：
   - 更新**对应脚本**的 `@version` 字段
   - 生成该脚本的 changelog
   - 创建 GitHub Release
   - 提交版本更新到 main 分支

4. **版本号规范**：遵循语义化版本（SemVer）
   - `MAJOR.MINOR.PATCH`（如 `1.2.3`）
   - MAJOR：不兼容的 API 变更
   - MINOR：向后兼容的功能新增
   - PATCH：向后兼容的 Bug 修复

### 文档同步

**重要**：每次新增脚本或功能时，必须同步更新以下文档：

1. **CLAUDE.md**（本文件）：
   - 更新「项目概述」表格，添加新脚本信息
   - 更新「配置系统」配置键列表
   - 如有新的代码模式，更新「代码架构」部分

2. **README.md**（如存在）：
   - 更新脚本列表和功能说明
   - 更新安装和使用说明

3. **脚本元数据**：
   - 确保 `@name`、`@description`、`@version` 准确
   - 确保 `@match` 规则正确
   - 确保 `@updateURL` 和 `@downloadURL` 指向正确的 raw 文件地址

## 代码约定

- 使用 ES6+ 语法（箭头函数、模板字符串、解构等）
- 严格模式：`'use strict'`
- 变量命名：驼峰命名法
- 常量：大写下划线分隔（如 `DEFAULT_CONFIG`）
- 状态变量：`isRunning`、`intervalId`、`drawCount` 等
- 配置对象：全局 `CONFIG` 对象

## 许可证

Apache License 2.0
