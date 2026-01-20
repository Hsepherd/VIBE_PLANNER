/**
 * 排程偏好學習系統
 * Story: S-009 - 學習排程偏好
 */

import { supabase } from './supabase'

// ============ 類型定義 ============

export interface WeeklyScheduleDay {
  enabled: boolean
  start?: string  // HH:mm 格式
  end?: string    // HH:mm 格式
}

export interface WeeklySchedule {
  monday: WeeklyScheduleDay
  tuesday: WeeklyScheduleDay
  wednesday: WeeklyScheduleDay
  thursday: WeeklyScheduleDay
  friday: WeeklyScheduleDay
  saturday: WeeklyScheduleDay
  sunday: WeeklyScheduleDay
}

export type TimePeriod = 'morning' | 'afternoon' | 'evening' | 'anytime'

export interface PriorityTimePreferences {
  urgent: TimePeriod
  high: TimePeriod
  medium: TimePeriod
  low: TimePeriod
}

export interface SchedulingPreferences {
  id: string
  userId: string

  // 工作時間偏好
  workStartTime: string      // HH:mm 格式
  workEndTime: string        // HH:mm 格式
  lunchStartTime: string     // HH:mm 格式
  lunchEndTime: string       // HH:mm 格式

  // 專注時段偏好
  focusPeriodStart: string   // HH:mm 格式
  focusPeriodEnd: string     // HH:mm 格式

  // 排程限制
  maxDailyHours: number      // 每日最大工作時數
  minTaskGapMinutes: number  // 任務間隔分鐘數
  maxTasksPerDay: number     // 每日最大任務數

  // 週間偏好
  weeklySchedule: WeeklySchedule

  // 優先級時段偏好
  priorityTimePreferences: PriorityTimePreferences

  // 學習統計
  learnedFromModifications: number
  learnedFromInstructions: number
  lastUpdatedAt: string

  createdAt: string
}

export interface SchedulingPreferenceLog {
  id: string
  userId: string
  sourceType: 'modification' | 'instruction' | 'rejection'
  sourceContext: string | null
  preferenceKey: string
  oldValue: string | null
  newValue: string | null
  confidence: number
  createdAt: string
}

// 資料庫格式轉換
interface DbSchedulingPreferences {
  id: string
  user_id: string
  work_start_time: string
  work_end_time: string
  lunch_start_time: string
  lunch_end_time: string
  focus_period_start: string
  focus_period_end: string
  max_daily_hours: number
  min_task_gap_minutes: number
  max_tasks_per_day: number
  weekly_schedule: WeeklySchedule
  priority_time_preferences: PriorityTimePreferences
  learned_from_modifications: number
  learned_from_instructions: number
  last_updated_at: string
  created_at: string
}

// ============ 轉換函數 ============

function dbToPreferences(db: DbSchedulingPreferences): SchedulingPreferences {
  return {
    id: db.id,
    userId: db.user_id,
    workStartTime: db.work_start_time,
    workEndTime: db.work_end_time,
    lunchStartTime: db.lunch_start_time,
    lunchEndTime: db.lunch_end_time,
    focusPeriodStart: db.focus_period_start,
    focusPeriodEnd: db.focus_period_end,
    maxDailyHours: db.max_daily_hours,
    minTaskGapMinutes: db.min_task_gap_minutes,
    maxTasksPerDay: db.max_tasks_per_day,
    weeklySchedule: db.weekly_schedule,
    priorityTimePreferences: db.priority_time_preferences,
    learnedFromModifications: db.learned_from_modifications,
    learnedFromInstructions: db.learned_from_instructions,
    lastUpdatedAt: db.last_updated_at,
    createdAt: db.created_at,
  }
}

// ============ API 函數 ============

/**
 * 取得用戶的排程偏好
 * 如果不存在，會建立預設偏好
 */
export async function getSchedulingPreferences(userId: string): Promise<SchedulingPreferences | null> {
  try {
    const { data, error } = await supabase
      .from('scheduling_preferences')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // 不存在，建立預設偏好
        return await createDefaultPreferences(userId)
      }
      console.error('[SchedulingPreferences] 取得偏好失敗:', error)
      return null
    }

    return dbToPreferences(data)
  } catch (error) {
    console.error('[SchedulingPreferences] 取得偏好錯誤:', error)
    return null
  }
}

/**
 * 建立預設排程偏好
 */
export async function createDefaultPreferences(userId: string): Promise<SchedulingPreferences | null> {
  try {
    const { data, error } = await supabase
      .from('scheduling_preferences')
      .insert({ user_id: userId })
      .select()
      .single()

    if (error) {
      console.error('[SchedulingPreferences] 建立預設偏好失敗:', error)
      return null
    }

    console.log('[SchedulingPreferences] 已建立預設偏好')
    return dbToPreferences(data)
  } catch (error) {
    console.error('[SchedulingPreferences] 建立預設偏好錯誤:', error)
    return null
  }
}

/**
 * 更新排程偏好
 */
export async function updateSchedulingPreferences(
  userId: string,
  updates: Partial<Omit<SchedulingPreferences, 'id' | 'userId' | 'createdAt' | 'lastUpdatedAt'>>
): Promise<SchedulingPreferences | null> {
  try {
    // 轉換為資料庫格式
    const dbUpdates: Record<string, unknown> = {}

    if (updates.workStartTime !== undefined) dbUpdates.work_start_time = updates.workStartTime
    if (updates.workEndTime !== undefined) dbUpdates.work_end_time = updates.workEndTime
    if (updates.lunchStartTime !== undefined) dbUpdates.lunch_start_time = updates.lunchStartTime
    if (updates.lunchEndTime !== undefined) dbUpdates.lunch_end_time = updates.lunchEndTime
    if (updates.focusPeriodStart !== undefined) dbUpdates.focus_period_start = updates.focusPeriodStart
    if (updates.focusPeriodEnd !== undefined) dbUpdates.focus_period_end = updates.focusPeriodEnd
    if (updates.maxDailyHours !== undefined) dbUpdates.max_daily_hours = updates.maxDailyHours
    if (updates.minTaskGapMinutes !== undefined) dbUpdates.min_task_gap_minutes = updates.minTaskGapMinutes
    if (updates.maxTasksPerDay !== undefined) dbUpdates.max_tasks_per_day = updates.maxTasksPerDay
    if (updates.weeklySchedule !== undefined) dbUpdates.weekly_schedule = updates.weeklySchedule
    if (updates.priorityTimePreferences !== undefined) dbUpdates.priority_time_preferences = updates.priorityTimePreferences

    const { data, error } = await supabase
      .from('scheduling_preferences')
      .update(dbUpdates)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      console.error('[SchedulingPreferences] 更新偏好失敗:', error)
      return null
    }

    console.log('[SchedulingPreferences] 偏好已更新:', Object.keys(dbUpdates))
    return dbToPreferences(data)
  } catch (error) {
    console.error('[SchedulingPreferences] 更新偏好錯誤:', error)
    return null
  }
}

/**
 * 記錄學習事件
 */
export async function logPreferenceLearning(
  userId: string,
  sourceType: 'modification' | 'instruction' | 'rejection',
  preferenceKey: string,
  newValue: string,
  oldValue?: string,
  sourceContext?: string,
  confidence: number = 0.5
): Promise<void> {
  try {
    // 記錄學習事件
    await supabase
      .from('scheduling_preference_logs')
      .insert({
        user_id: userId,
        source_type: sourceType,
        preference_key: preferenceKey,
        old_value: oldValue || null,
        new_value: newValue,
        source_context: sourceContext || null,
        confidence,
      })

    // 更新學習統計計數器
    // 使用簡單的 select + update 方式，避免 RPC 依賴
    const countField = sourceType === 'modification'
      ? 'learned_from_modifications'
      : 'learned_from_instructions'

    const { data: currentPref } = await supabase
      .from('scheduling_preferences')
      .select(countField)
      .eq('user_id', userId)
      .single()

    if (currentPref) {
      const currentCount = (currentPref as Record<string, number>)[countField] || 0
      await supabase
        .from('scheduling_preferences')
        .update({ [countField]: currentCount + 1 })
        .eq('user_id', userId)
    }

    console.log(`[SchedulingPreferences] 已記錄學習: ${sourceType} - ${preferenceKey}`)
  } catch (error) {
    console.error('[SchedulingPreferences] 記錄學習失敗:', error)
  }
}

// ============ 偏好解析函數 ============

/**
 * 從用戶指令中解析排程偏好
 */
export function parsePreferenceFromInstruction(instruction: string): {
  key: string
  value: string
  confidence: number
} | null {
  const patterns: Array<{
    pattern: RegExp
    key: string
    extractValue: (match: RegExpMatchArray) => string
    confidence: number
  }> = [
    // 工作時間
    {
      pattern: /(?:我|每天)?(?:從|早上)?(\d{1,2})[點:時](?:開始)?(?:工作|上班)/i,
      key: 'workStartTime',
      extractValue: (m) => `${m[1].padStart(2, '0')}:00`,
      confidence: 0.8,
    },
    {
      pattern: /(?:我|每天)?(?:到|下午|晚上)?(\d{1,2})[點:時](?:下班|結束)/i,
      key: 'workEndTime',
      extractValue: (m) => `${m[1].padStart(2, '0')}:00`,
      confidence: 0.8,
    },

    // 午休時間
    {
      pattern: /午休(?:時間)?(?:是|從)?(\d{1,2})[點:時](?:到|至)(\d{1,2})[點:時]/i,
      key: 'lunchTime',
      extractValue: (m) => `${m[1].padStart(2, '0')}:00-${m[2].padStart(2, '0')}:00`,
      confidence: 0.9,
    },
    {
      pattern: /(?:中午|午餐)(?:不要|別)(?:排|安排)(?:任務|工作)/i,
      key: 'lunchTime',
      extractValue: () => '12:00-13:00',
      confidence: 0.7,
    },

    // 專注時段
    {
      pattern: /(?:上午|早上)(?:比較)?(?:有精神|專注|效率高)/i,
      key: 'focusPeriod',
      extractValue: () => 'morning',
      confidence: 0.8,
    },
    {
      pattern: /(?:下午|午後)(?:比較)?(?:有精神|專注|效率高)/i,
      key: 'focusPeriod',
      extractValue: () => 'afternoon',
      confidence: 0.8,
    },
    {
      pattern: /重要(?:的)?(?:任務|事情)(?:放|排)?(?:在)?(?:上午|早上)/i,
      key: 'priorityTimePreferences.high',
      extractValue: () => 'morning',
      confidence: 0.9,
    },
    {
      pattern: /重要(?:的)?(?:任務|事情)(?:放|排)?(?:在)?(?:下午|午後)/i,
      key: 'priorityTimePreferences.high',
      extractValue: () => 'afternoon',
      confidence: 0.9,
    },

    // 每日上限
    {
      pattern: /每天(?:最多)?(?:工作|排)?(\d+)(?:個)?小時/i,
      key: 'maxDailyHours',
      extractValue: (m) => m[1],
      confidence: 0.9,
    },
    {
      pattern: /一天(?:不要)?超過(\d+)(?:個)?小時/i,
      key: 'maxDailyHours',
      extractValue: (m) => m[1],
      confidence: 0.9,
    },

    // 任務數量
    {
      pattern: /每天(?:最多)?(?:排)?(\d+)(?:個|項)?任務/i,
      key: 'maxTasksPerDay',
      extractValue: (m) => m[1],
      confidence: 0.9,
    },

    // 任務間隔
    {
      pattern: /任務(?:之間|間)?(?:要|留)?(\d+)分鐘(?:休息|緩衝|間隔)/i,
      key: 'minTaskGapMinutes',
      extractValue: (m) => m[1],
      confidence: 0.9,
    },

    // 週末
    {
      pattern: /(?:週末|假日)(?:不要|別|不)(?:排|安排)(?:任務|工作)/i,
      key: 'weeklySchedule.weekend',
      extractValue: () => 'disabled',
      confidence: 0.9,
    },
    {
      pattern: /(?:週六|週日|星期[六日])(?:也)?(?:要|可以)(?:排|安排|工作)/i,
      key: 'weeklySchedule.weekend',
      extractValue: () => 'enabled',
      confidence: 0.8,
    },
  ]

  for (const { pattern, key, extractValue, confidence } of patterns) {
    const match = instruction.match(pattern)
    if (match) {
      return {
        key,
        value: extractValue(match),
        confidence,
      }
    }
  }

  return null
}

/**
 * 根據偏好判斷時段是否適合排程
 */
export function isTimeSlotPreferred(
  preferences: SchedulingPreferences,
  startTime: Date,
  priority: 'urgent' | 'high' | 'medium' | 'low'
): { preferred: boolean; reason?: string } {
  const hour = startTime.getHours()

  // 檢查是否在工作時間內
  const workStart = parseInt(preferences.workStartTime.split(':')[0])
  const workEnd = parseInt(preferences.workEndTime.split(':')[0])

  if (hour < workStart || hour >= workEnd) {
    return { preferred: false, reason: '超出工作時間' }
  }

  // 檢查是否在午休時間
  const lunchStart = parseInt(preferences.lunchStartTime.split(':')[0])
  const lunchEnd = parseInt(preferences.lunchEndTime.split(':')[0])

  if (hour >= lunchStart && hour < lunchEnd) {
    return { preferred: false, reason: '午休時間' }
  }

  // 檢查優先級時段偏好
  const preferredPeriod = preferences.priorityTimePreferences[priority]

  if (preferredPeriod === 'anytime') {
    return { preferred: true }
  }

  const isMorning = hour >= workStart && hour < 12
  const isAfternoon = hour >= 13 && hour < 17
  const isEvening = hour >= 17 && hour < workEnd

  if (preferredPeriod === 'morning' && !isMorning) {
    return { preferred: false, reason: '建議在上午處理此優先級任務' }
  }

  if (preferredPeriod === 'afternoon' && !isAfternoon) {
    return { preferred: false, reason: '建議在下午處理此優先級任務' }
  }

  if (preferredPeriod === 'evening' && !isEvening) {
    return { preferred: false, reason: '建議在傍晚處理此優先級任務' }
  }

  return { preferred: true }
}

/**
 * 取得指定日期是否啟用排程
 */
export function isDayEnabled(preferences: SchedulingPreferences, date: Date): boolean {
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const
  const dayName = dayNames[date.getDay()]
  return preferences.weeklySchedule[dayName]?.enabled ?? true
}

/**
 * 根據偏好計算時段分數（用於排序）
 */
export function calculateSlotScore(
  preferences: SchedulingPreferences,
  startTime: Date,
  priority: 'urgent' | 'high' | 'medium' | 'low'
): number {
  let score = 50 // 基礎分數

  const hour = startTime.getHours()
  const preferredPeriod = preferences.priorityTimePreferences[priority]

  // 專注時段加分
  const focusStart = parseInt(preferences.focusPeriodStart.split(':')[0])
  const focusEnd = parseInt(preferences.focusPeriodEnd.split(':')[0])

  if (hour >= focusStart && hour < focusEnd) {
    if (priority === 'urgent' || priority === 'high') {
      score += 30 // 重要任務在專注時段大加分
    } else {
      score += 10
    }
  }

  // 優先級時段匹配加分
  const isMorning = hour < 12
  const isAfternoon = hour >= 13 && hour < 17

  if (
    (preferredPeriod === 'morning' && isMorning) ||
    (preferredPeriod === 'afternoon' && isAfternoon)
  ) {
    score += 20
  }

  // 午休時段扣分
  const lunchStart = parseInt(preferences.lunchStartTime.split(':')[0])
  const lunchEnd = parseInt(preferences.lunchEndTime.split(':')[0])

  if (hour >= lunchStart && hour < lunchEnd) {
    score -= 50
  }

  return score
}
