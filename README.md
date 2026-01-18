# Automatic Lottery

自动抽奖/抽卡浏览器脚本。

## 脚本列表

| 脚本 | 功能 | 适用网站 |
| --- | --- | --- |
| [auto-windhub.user.js](#auto-windhubjs) | WindHub 自动化助手 | [WindHub 福利站](https://wcdk.224442.xyz/) |
| [auto-slot-machine.user.js](#auto-slot-machinejs) | 老虎机抽奖 | [KYX](https://quota.kyx03.de/) / [莹のapi 加油站](https://quota.wpgzs.top/) |
| [auto-card-draw.user.js](#auto-card-drawjs) | 抽卡 | [黑与白抽卡网站](https://cdk.hybgzs.com/entertainment/cards/draw) |

## 功能

### auto-windhub.js 使用

WindHub 福利站自动化助手，根据页面自动加载对应功能模块：

#### 农场模块（farm.php）

- 自动收割成熟作物
- 自动在空地播种
- 可选择种子类型
- 可配置检查间隔（支持秒/毫秒）

#### 抽卡模块（cards.php）

- 自动单抽/十连抽
- 可配置抽卡间隔（支持秒/毫秒）
- 次数用完自动停止
- 显示抽卡统计

#### 打砖块模块（game.php）

- 自动追踪球位置控制挡板
- 预测球落点提前移动
- 自动开始新游戏
- 自动发球
- 支持砖块偏向权重，优先保证接球稳定

### auto-slot-machine.js（老虎机抽奖）

- Fork 自 [Lurito/kyx-auto-slot-machine](https://github.com/Lurito/kyx-auto-slot-machine)
- 在页面右上角添加一个悬浮按钮
- 每 6 秒自动点击一次抽奖按钮
- 支持手动开启和关闭自动抽奖功能
- 间隔时间支持秒/毫秒
- 适用于以下网站：

  - [KYX 娱乐站](https://quota.kyx03.de/)（已关闭）
  - [莹のapi 加油站](https://quota.wpgzs.top/)

### auto-card-draw.js（抽卡）

- 参考 [黑与白自动抽卡助手](https://greasyfork.org/scripts/561215)
- iOS 风格悬浮面板，支持拖拽和最小化
- 单抽/十连抽模式切换
- 可分别配置单抽/十连抽间隔、弹窗确认、结果关闭时间（秒/毫秒）
- 可配置付费上限、超时时间（秒/毫秒）
- 配置自动保存
- 支持自动更新
- 适用于：[黑与白抽卡](https://cdk.hybgzs.com/entertainment/cards/draw)

## 使用方法

### auto-windhub.js

1. 访问 WindHub 福利站的农场/抽卡/砖块页面
2. 页面右上角会出现对应功能的悬浮面板
3. 点击「设置」配置参数
4. 点击「开始」启动自动化
5. 点击「停止」或点击面板标题栏的 `−` 最小化

### auto-slot-machine.js

1. 点击右上角的蓝色悬浮按钮（▶️）开始自动抽奖
2. 再次点击按钮（⏹️）停止自动抽奖
3. 脚本启动后会立即执行一次抽奖，然后每 6 秒重复一次
4. 可设置间隔的秒/毫秒数

### auto-card-draw.js

1. 页面右下角会出现悬浮面板
2. 选择单抽或十连抽模式
3. 根据需要配置间隔时间、付费上限、超时时间（支持秒/毫秒）
4. 点击"开始"按钮启动自动抽卡
5. 点击"停止"按钮或达到上限后自动停止

## 安装

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 浏览器扩展
2. 点击下方链接安装脚本：

   - [auto-windhub.user.js](https://raw.githubusercontent.com/shay-wong/automatic_lottery/master/auto-windhub.user.js)
   - [auto-slot-machine.user.js](https://raw.githubusercontent.com/shay-wong/automatic_lottery/master/auto-slot-machine.user.js)
   - [auto-card-draw.user.js](https://raw.githubusercontent.com/shay-wong/automatic_lottery/master/auto-card-draw.user.js)

## 许可证

[Apache License 2.0](LICENSE)
