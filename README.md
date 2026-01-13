# Automatic Lottery

自动抽奖/抽卡浏览器脚本。

## 功能

### auto-slot-machine.js（老虎机抽奖）

- Fork 自 [Lurito/kyx-auto-slot-machine](https://github.com/Lurito/kyx-auto-slot-machine)
- 在页面右上角添加一个悬浮按钮
- 每 6 秒自动点击一次抽奖按钮
- 支持手动开启和关闭自动抽奖功能
- 适用于以下网站：
  - [KYX 娱乐站](https://quota.kyx03.de/)（已关闭）
  - [莹のapi 加油站](https://quota.wpgzs.top/)

### auto-card-draw.js（抽卡）

- 参考 [黑与白自动抽卡助手](https://greasyfork.org/scripts/561215)
- iOS 风格悬浮面板，支持拖拽和最小化
- 单抽/十连抽模式切换
- 可配置间隔时间、付费上限、超时时间
- 配置自动保存
- 支持自动更新
- 适用于：[黑与白抽卡](https://cdk.hybgzs.com/entertainment/cards/draw)

## 使用方法

### auto-slot-machine.js

1. 点击右上角的蓝色悬浮按钮（▶️）开始自动抽奖
2. 再次点击按钮（⏹️）停止自动抽奖
3. 脚本启动后会立即执行一次抽奖，然后每 6 秒重复一次
4. 可通过输入框调整间隔秒数

### auto-card-draw.js

1. 页面右下角会出现悬浮面板
2. 选择单抽或十连抽模式
3. 根据需要配置间隔时间、付费上限、超时时间
4. 点击"开始"按钮启动自动抽卡
5. 点击"停止"按钮或达到上限后自动停止

## 安装

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 浏览器扩展
2. 点击下方链接安装脚本：
   - [auto-card-draw.user.js](https://raw.githubusercontent.com/shay-wong/automatic_lottery/master/auto-card-draw.user.js)
   - [auto-slot-machine.user.js](https://raw.githubusercontent.com/shay-wong/automatic_lottery/master/auto-slot-machine.user.js)

## 许可证

[Apache License 2.0](LICENSE)
