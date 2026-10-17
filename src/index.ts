import { Context, Schema } from 'koishi'

export const name = 'monetary-transfer'
export const inject = ['monetary', 'database']

declare module 'koishi' {
  interface Tables {
    monetary: {
      uid: number
      currency: string
      value: number
    }
  }
}

export interface Config {
  currency: string
  enableFee: boolean
  feeRules: Record<string, number>
  maxTransferAmount: number
  forceInteger: boolean
  transferCooldown: number
}

// 【核心修改】：放弃 Schema.intersect 和 Schema.union，采用最简单直接的 Schema.object
export const Config: Schema<Config> = Schema.object({
  currency: Schema.string().default('default').description('使用的积分类型名称（对应 monetary 插件的货币名）。'),
  maxTransferAmount: Schema.number().default(0).min(0).description('单次转账最大金额限制（填 0 表示不限制）。'),
  forceInteger: Schema.boolean().default(true).description('是否强制要求转账金额必须为整数。'),
  transferCooldown: Schema.number().default(10).min(0).description('连续转账的最短间隔时间（单位：秒）。填 0 表示不限制。'),
  enableFee: Schema.boolean().default(false).description('是否开启转账手续费。'),
  feeRules: Schema.dict(Schema.number())
    .default({
      '1000': 1,
      '5000': 2,
      '10000': 5,
    })
    .description('阶梯手续费。左侧填转账金额上限，右侧直接填数字代表百分比（填 1 即代表 1%）。**仅在开启手续费时生效**。'),
})

export function apply(ctx: Context, config: Config) {
  const cooldownMap = new Map<number, number>()

  async function getBalance(uid: number): Promise<number> {
    const [userData] = await ctx.database.get('monetary', { uid, currency: config.currency })
    return userData?.value ?? 0
  }

  async function changeBalance(uid: number, delta: number) {
    const [userData] = await ctx.database.get('monetary', { uid, currency: config.currency })
    if (userData) {
      const newValue = Math.max(0, userData.value + delta)
      await ctx.database.set('monetary', { uid, currency: config.currency }, { value: newValue })
    } else if (delta > 0) {
      await ctx.database.create('monetary', { uid, currency: config.currency, value: delta })
    }
  }

  ctx.command('转账 <target:user> <amount:number>', '给其他玩家转账')
    .usage('例如：转账 @某人 100')
    .action(async ({ session }, target, amount) => {
      if (!session) return '无法获取会话信息。'
      if (!target) return '请指定你要转账的对象，例如：转账 @某人 100'
      if (!amount || amount <= 0) return '请输入大于 0 的有效转账金额。'

      if (config.forceInteger && !Number.isInteger(amount)) {
        return '转账金额必须为整数！'
      }

      const user = await session.observeUser(['id'])
      const senderUid = user.id

      // 冷却检查
      if (config.transferCooldown > 0) {
        const now = Date.now()
        const lastTime = cooldownMap.get(senderUid) || 0
        const cooldownMs = config.transferCooldown * 1000
        if (now - lastTime < cooldownMs) {
          const remainSec = Math.ceil((cooldownMs - (now - lastTime)) / 1000)
          return `转账冷却中，请等待 ${remainSec} 秒后再试。`
        }
      }
      
      // 提取平台 ID
      let targetStr = String(target).replace(/^@/, '').trim()
      const colonIndex = targetStr.indexOf(':')
      if (colonIndex >= 0) targetStr = targetStr.slice(colonIndex + 1)

      const [binding] = await ctx.database.get('binding', { platform: session.platform, pid: targetStr })
      if (!binding) return `找不到接收方，请确认对方已在当前平台发过言。`
      const receiverUid = binding.aid

      if (senderUid === receiverUid) return '你不能给自己转账哦。'

      // 获取对方昵称
      let targetName = targetStr
      const atElement = session.elements?.find(el => el.type === 'at' && (el.attrs?.id === targetStr || el.attrs?.qq === targetStr))
      if (atElement?.attrs?.name) {
        targetName = atElement.attrs.name
      } else {
        try {
          const botUser = await session.bot.getUser(targetStr)
          const name = botUser?.name || botUser?.nick || botUser?.nickname
          if (name) targetName = name
        } catch (e) {
          const [dbUser] = await ctx.database.get('user', { id: receiverUid })
          if (dbUser?.name) targetName = dbUser.name
        }
      }

      if (config.maxTransferAmount > 0 && amount > config.maxTransferAmount) {
        return `单次转账金额不能超过 ${config.maxTransferAmount}。`
      }

      // 手续费计算
      let fee = 0
      if (config.enableFee && config.feeRules) {
        const thresholds = Object.keys(config.feeRules)
          .map(Number)
          .sort((a, b) => a - b)

        let matchedRate = 0
        for (const threshold of thresholds) {
          if (amount <= threshold) {
            matchedRate = config.feeRules[threshold.toString()]
            break
          }
        }

        if (matchedRate > 0) {
          fee = Math.ceil(amount * (matchedRate / 100))
        }
      }

      const totalCost = amount + fee

      const senderBalance = await getBalance(senderUid)
      if (senderBalance < totalCost) {
        return `余额不足！转账金额 ${amount}${fee > 0 ? ` + 手续费 ${fee}` : ''} = ${totalCost} 积分。\n你当前只有 ${senderBalance} 积分。`
      }

      await changeBalance(senderUid, -totalCost)
      await changeBalance(receiverUid, amount)

      if (config.transferCooldown > 0) {
        cooldownMap.set(senderUid, Date.now())
      }

      let reply = `✅ 成功向 【${targetName}】 转账 ${amount} 积分。`
      if (fee > 0) {
        reply += `\n（扣除手续费 ${fee} 积分，实际消耗 ${totalCost} 积分）`
      }
      return reply
    })
}