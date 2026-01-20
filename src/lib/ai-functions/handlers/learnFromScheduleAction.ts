/**
 * 從用戶排程操作中學習 Handler
 * 記錄用戶對排程建議的接受/拒絕行為
 */

import { logPreferenceLearning } from '@/lib/scheduling-preferences'

export interface ScheduledTaskInfo {
  taskId: string
  taskTitle: string
  startTime: string
  endTime: string
  estimatedMinutes: number
  taskType?: string
  priority?: string
}

export interface ScheduleActionLog {
  action: 'apply' | 'cancel' | 'modify'
  tasksCount: number
  totalMinutes: number
  daysCovered: Set<string>
  timeRangeStart?: string
  timeRangeEnd?: string
}

/**
 * 記錄用戶套用排程的行為（正向回饋）
 */
export async function logScheduleApplied(
  userId: string,
  scheduledTasks: ScheduledTaskInfo[]
): Promise<void> {
  try {
    if (scheduledTasks.length === 0) return

    // 分析套用的排程模式
    const analysis = analyzeSchedulePattern(scheduledTasks)

    console.log('[LearnFromScheduleAction] 用戶套用排程:', {
      tasksCount: scheduledTasks.length,
      ...analysis,
    })

    // 記錄到學習日誌
    await logPreferenceLearning(
      userId,
      'modification', // 視為用戶認可的修改
      'schedule_pattern',
      JSON.stringify({
        action: 'apply',
        tasksCount: scheduledTasks.length,
        avgStartHour: analysis.avgStartHour,
        avgTaskMinutes: analysis.avgTaskMinutes,
        preferredDays: analysis.preferredDays,
      }),
      undefined,
      `用戶套用了 ${scheduledTasks.length} 個任務的排程`,
      0.7 // 套用排程是較高信心度的正向回饋
    )
  } catch (error) {
    console.error('[LearnFromScheduleAction] 記錄套用排程失敗:', error)
  }
}

/**
 * 記錄用戶取消排程的行為（可能的負向回饋）
 */
export async function logScheduleCancelled(
  userId: string,
  scheduledTasks: ScheduledTaskInfo[],
  reason?: string
): Promise<void> {
  try {
    if (scheduledTasks.length === 0) return

    const analysis = analyzeSchedulePattern(scheduledTasks)

    console.log('[LearnFromScheduleAction] 用戶取消排程:', {
      tasksCount: scheduledTasks.length,
      reason,
      ...analysis,
    })

    // 記錄到學習日誌（作為拒絕類型）
    await logPreferenceLearning(
      userId,
      'rejection',
      'schedule_pattern',
      JSON.stringify({
        action: 'cancel',
        tasksCount: scheduledTasks.length,
        avgStartHour: analysis.avgStartHour,
        avgTaskMinutes: analysis.avgTaskMinutes,
        preferredDays: analysis.preferredDays,
      }),
      undefined,
      reason || `用戶取消了 ${scheduledTasks.length} 個任務的排程建議`,
      0.5 // 取消排程的信心度較低（可能只是暫時不需要）
    )
  } catch (error) {
    console.error('[LearnFromScheduleAction] 記錄取消排程失敗:', error)
  }
}

/**
 * 分析排程模式
 */
function analyzeSchedulePattern(scheduledTasks: ScheduledTaskInfo[]) {
  const startHours: number[] = []
  const taskMinutes: number[] = []
  const dayOfWeekCounts: Record<number, number> = {}

  for (const task of scheduledTasks) {
    const startTime = new Date(task.startTime)
    startHours.push(startTime.getHours())
    taskMinutes.push(task.estimatedMinutes)

    const dayOfWeek = startTime.getDay()
    dayOfWeekCounts[dayOfWeek] = (dayOfWeekCounts[dayOfWeek] || 0) + 1
  }

  // 計算平均開始時間
  const avgStartHour = startHours.length > 0
    ? Math.round(startHours.reduce((a, b) => a + b, 0) / startHours.length)
    : undefined

  // 計算平均任務時長
  const avgTaskMinutes = taskMinutes.length > 0
    ? Math.round(taskMinutes.reduce((a, b) => a + b, 0) / taskMinutes.length)
    : undefined

  // 找出最常排程的日子
  const preferredDays = Object.entries(dayOfWeekCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([day]) => parseInt(day))

  // 找出時間範圍
  const sortedTimes = scheduledTasks
    .map(t => new Date(t.startTime).getTime())
    .sort((a, b) => a - b)

  const timeRangeStart = sortedTimes.length > 0
    ? new Date(sortedTimes[0]).toISOString()
    : undefined

  const timeRangeEnd = sortedTimes.length > 0
    ? new Date(sortedTimes[sortedTimes.length - 1]).toISOString()
    : undefined

  return {
    avgStartHour,
    avgTaskMinutes,
    preferredDays,
    timeRangeStart,
    timeRangeEnd,
  }
}
