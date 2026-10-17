# koishi-plugin-monetary-qingchan-transfer

基于 [koishi-plugin-monetary](https://www.npmjs.com/package/koishi-plugin-monetary) 的玩家间积分转账插件。

支持**阶梯式手续费**和**转账限额**。

## 📦 依赖

请确保在 Koishi 控制台中启用并配置了以下插件：

- [koishi](https://koishi.chat) `^4.18.0`
- [koishi-plugin-monetary](https://www.npmjs.com/package/koishi-plugin-monetary)（核心积分系统）
- 数据库插件（推荐 `@koishijs/plugin-database-sqlite`）

## 🚀 安装

在 Koishi 插件市场中搜索 `monetary-qingchan-transfer` 并安装，或者在控制台终端中运行：

```bash
npm install koishi-plugin-monetary-qingchan-transfer
```

## 📜 指令列表

| 指令 | 说明 | 示例 |
|---|---|---|
| `转账 <@某人> <金额>` | 给群内的其他玩家转账。 | `/转账 @小明 100` |

> **注意**：被转账的玩家必须在当前平台发过言（即拥有绑定信息），否则无法找到接收方。

## ⚙️ 配置项说明

在 Koishi 控制台插件配置页，你可以进行以下设置：

### 基础设置

- **使用的积分类型名称 (`currency`)**：对应 `monetary` 插件里的货币名，默认为 `default`。
- **单次转账最大金额限制 (`maxTransferAmount`)**：超过此数值将无法转账。填 `0` 表示不限制。
- **是否强制要求转账金额必须为整数 (`forceInteger`)**：开启后，输入 `100.5` 将会被拒绝。默认为开启。
- **连续转账的最短间隔时间 (`transferCooldown`)**：两次转账之间的冷却时间（秒），防止刷屏或恶意频繁转账。默认为 `10` 秒。填 `0` 表示不限制。

### 手续费设置

- **是否开启转账手续费 (`enableFee`)**：开启后，转账将扣除一定比例的手续费（手续费会被系统销毁，不会流入接收方）。
- **阶梯手续费 (`feeRules`)**：
  这是一个左侧填金额、右侧填百分比的表格字典。系统会**从小到大自动排序**并匹配。
  - **左侧（金额上限）**：比如填 `1000`。
  - **右侧（手续费率）**：直接填数字代表百分比。比如填 `1`，就代表 `1%`（**不需要敲 % 号**）。
  - 如果转账金额超出了表格里设定的最高额度，则**不再收取**手续费。

## 📄 开源协议

[MIT License](https://opensource.org/licenses/MIT)

