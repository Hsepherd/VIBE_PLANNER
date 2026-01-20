/**
 * 排程偏好學習 Handler
 * 從用戶對話中偵測並學習排程偏好
 */

import {
  parsePreferenceFromInstruction,
  getSchedulingPreferences,
  updateSchedulingPreferences,
  logPreferenceLearning,
  type SchedulingPreferences,
} from '@/lib/scheduling-preferences'

export interface LearnPreferenceResult {
  success: boolean
  learned: boolean
  preferenceKey?: string
  oldValue?: string
  newValue?: string
  message?: string
}

/**
 * 從用戶訊息中學習排程偏好
 */
export async function learnPreferenceFromMessage(
  userId: string,
  message: string
): Promise<LearnPreferenceResult> {
  try {
    // 解析訊息中的偏好指令
    const parsed = parsePreferenceFromInstruction(message)

    if (!parsed) {
      return {
        success: true,
        learned: false,
        message: '未偵測到排程偏好指令',
      }
    }

    console.log('[LearnPreference] 偵測到偏好指令:', parsed)

    // 取得現有偏好
    const preferences = await getSchedulingPreferences(userId)
    if (!preferences) {
      return {
        success: false,
        learned: false,
        message: '無法取得用戶偏好',
      }
    }

    // 根據偏好類型更新
    const { key, value, confidence } = parsed
    let updates: Partial<SchedulingPreferences> = {}
    let oldValue: string | undefined

    switch (key) {
      case 'workStartTime':
        oldValue = preferences.workStartTime
        updates.workStartTime = value
        break

      case 'workEndTime':
        oldValue = preferences.workEndTime
        updates.workEndTime = value
        break

      case 'lunchTime':
        // 格式: "12:00-13:00"
        const [lunchStart, lunchEnd] = value.split('-')
        oldValue = `${preferences.lunchStartTime}-${preferences.lunchEndTime}`
        updates.lunchStartTime = lunchStart
        updates.lunchEndTime = lunchEnd
        break

      case 'focusPeriod':
        oldValue = `${preferences.focusPeriodStart}-${preferences.focusPeriodEnd}`
        if (value === 'morning') {
          updates.focusPeriodStart = '09:00'
          updates.focusPeriodEnd = '12:00'
        } else if (value === 'afternoon') {
          updates.focusPeriodStart = '13:00'
          updates.focusPeriodEnd = '17:00'
        }
        break

      case 'priorityTimePreferences.high':
        oldValue = preferences.priorityTimePreferences.high
        updates.priorityTimePreferences = {
          ...preferences.priorityTimePreferences,
          high: value as 'morning' | 'afternoon' | 'evening' | 'anytime',
          urgent: value as 'morning' | 'afternoon' | 'evening' | 'anytime', // urgent 跟隨 high
        }
        break

      case 'maxDailyHours':
        oldValue = preferences.maxDailyHours.toString()
        updates.maxDailyHours = parseFloat(value)
        break

      case 'maxTasksPerDay':
        oldValue = preferences.maxTasksPerDay.toString()
        updates.maxTasksPerDay = parseInt(value)
        break

      case 'minTaskGapMinutes':
        oldValue = preferences.minTaskGapMinutes.toString()
        updates.minTaskGapMinutes = parseInt(value)
        break

      case 'weeklySchedule.weekend':
        oldValue = JSON.stringify({
          saturday: preferences.weeklySchedule.saturday,
          sunday: preferences.weeklySchedule.sunday,
        })
        if (value === 'disabled') {
          updates.weeklySchedule = {
            ...preferences.weeklySchedule,
            saturday: { enabled: false },
            sunday: { enabled: false },
          }
        } else {
          updates.weeklySchedule = {
            ...preferences.weeklySchedule,
            saturday: { enabled: true },
            sunday: { enabled: true },
          }
        }
        break

      default:
        return {
          success: true,
          learned: false,
          message: `未知的偏好類型: ${key}`,
        }
    }

    // 更新偏好
    const updated = await updateSchedulingPreferences(userId, updates)
    if (!updated) {
      return {
        success: false,
        learned: false,
        message: '更新偏好失敗',
      }
    }

    // 記錄學習事件
    await logPreferenceLearning(
      userId,
      'instruction',
      key,
      value,
      oldValue,
      message,
      confidence
    )

    console.log(`[LearnPreference] 已學習偏好: ${key} = ${value}`)

    return {
      success: true,
      learned: true,
      preferenceKey: key,
      oldValue,
      newValue: value,
      message: `已記住您的偏好：${getPreferenceDescription(key, value)}`,
    }
  } catch (error) {
    console.error('[LearnPreference] 學習偏好錯誤:', error)
    return {
      success: false,
      learned: false,
      message: '學習偏好時發生錯誤',
    }
  }
}

/**
 * 取得偏好描述（用於回應用戶）
 */
function getPreferenceDescription(key: string, value: string): string {
  const descriptions: Record<string, (v: string) => string> = {
    workStartTime: (v) => `工作開始時間為 ${v}`,
    workEndTime: (v) => `工作結束時間為 ${v}`,
    lunchTime: (v) => `午休時間為 ${v}`,
    focusPeriod: (v) => v === 'morning' ? '上午是您的專注時段' : '下午是您的專注時段',
    'priorityTimePreferences.high': (v) => v === 'morning' ? '重要任務優先安排在上午' : '重要任務優先安排在下午',
    maxDailyHours: (v) => `每天最多排程 ${v} 小時`,
    maxTasksPerDay: (v) => `每天最多 ${v} 個任務`,
    minTaskGapMinutes: (v) => `任務間隔 ${v} 分鐘`,
    'weeklySchedule.weekend': (v) => v === 'disabled' ? '週末不安排任務' : '週末也可以安排任務',
  }

  return descriptions[key]?.(value) || `${key} = ${value}`
}

/**
 * 檢查訊息是否包含排程偏好相關內容
 */
export function containsPreferenceIntent(message: string): boolean {
  const patterns = [
    /(?:我|每天)?(?:從|早上)?(\d{1,2})[點:時](?:開始)?(?:工作|上班)/i,
    /(?:我|每天)?(?:到|下午|晚上)?(\d{1,2})[點:時](?:下班|結束)/i,
    /午休/i,
    /(?:上午|早上|下午|午後)(?:比較)?(?:有精神|專注|效率高)/i,
    /重要(?:的)?(?:任務|事情)(?:放|排)?(?:在)?(?:上午|早上|下午|午後)/i,
    /每天(?:最多)?(?:工作|排)?(\d+)(?:個)?小時/i,
    /每天(?:最多)?(?:排)?(\d+)(?:個|項)?任務/i,
    /任務(?:之間|間)?(?:要|留)?(\d+)分鐘/i,
    /(?:週末|假日)(?:不要|別|不|也)?(?:排|安排|要|可以)(?:任務|工作)/i,
  ]

  return patterns.some(pattern => pattern.test(message))
}
