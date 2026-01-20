/**
 * 智慧排程演算法
 * 將未排程任務最佳化地安排到可用時段
 * 支援用戶偏好設定（S-009）
 */

import { getUnscheduledTasks } from './getUnscheduledTasks'
import { getAvailableSlots } from './getAvailableSlots'
import { estimateMultipleTasksTimeOptimized, TaskTimeEstimate } from './estimateTaskTime'
import {
  getSchedulingPreferences,
  calculateSlotScore,
  isDayEnabled,
  type SchedulingPreferences,
} from '@/lib/scheduling-preferences'
import {
  checkScheduleConflicts,
  formatConflictSummary,
  type ConflictCheckResult,
  type CalendarEvent,
} from './conflictDetection'

// 排程任務介面
export interface ScheduledTask {
  taskId: string
  taskTitle: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  dueDate: string | null
  startTime: string
  endTime: string
  estimatedMinutes: number
  taskType: 'focus' | 'background'
  confidence: 'high' | 'medium' | 'low'
  slotDate: string // 排在哪一天
  reasoning: string
}

// 排程結果
export interface ScheduleResult {
  success: boolean
  scheduledTasks: ScheduledTask[]
  unscheduledTasks: Array<{
    taskId: string
    taskTitle: string
    reason: string
  }>
  summary: {
    totalTasksProcessed: number
    successfullyScheduled: number
    failedToSchedule: number
    totalMinutesScheduled: number
    daysSpanned: number
  }
  // S-010: 衝突偵測資訊
  conflictCheck?: ConflictCheckResult
  busyEvents?: Record<string, CalendarEvent[]>
  conflictSummary?: string
}

// 排程參數
export interface ScheduleOptions {
  startDate?: string // 排程起始日（預設今天）
  endDate?: string // 排程結束日（預設 7 天後）
  workStart?: string // 工作開始時間（預設 09:00）
  workEnd?: string // 工作結束時間（預設 18:00）
  priorityOrder?: ('urgent' | 'high' | 'medium' | 'low')[] // 優先級排序
  respectDeadlines?: boolean // 是否優先處理快到期的任務
  maxTasksPerDay?: number // 每天最多排幾個任務
  bufferMinutes?: number // 任務間緩衝時間
}

// 可用時段介面（從 getAvailableSlots 取得）
interface AvailableSlot {
  date: string
  start: string
  end: string
  durationMinutes: number
}

// 優先級權重
const PRIORITY_WEIGHTS: Record<string, number> = {
  urgent: 100,
  high: 75,
  medium: 50,
  low: 25,
}

// 截止日緊迫度加成
function getDeadlineUrgency(dueDate: string | null, scheduleDate: string): number {
  if (!dueDate) return 0

  const due = new Date(dueDate)
  const schedule = new Date(scheduleDate)
  const daysUntilDue = Math.ceil((due.getTime() - schedule.getTime()) / (1000 * 60 * 60 * 24))

  if (daysUntilDue <= 0) return 50 // 已過期，最高緊迫度
  if (daysUntilDue <= 1) return 40 // 明天到期
  if (daysUntilDue <= 3) return 30 // 三天內
  if (daysUntilDue <= 7) return 20 // 一週內
  return 0
}

// 計算任務排程分數（分數越高越優先）
function calculateTaskScore(
  task: { priority: string; dueDate: string | null },
  scheduleDate: string,
  respectDeadlines: boolean
): number {
  const priorityScore = PRIORITY_WEIGHTS[task.priority] || 50
  const deadlineScore = respectDeadlines ? getDeadlineUrgency(task.dueDate, scheduleDate) : 0
  return priorityScore + deadlineScore
}

// 找到最適合的時段
function findBestSlot(
  taskMinutes: number,
  availableSlots: AvailableSlot[],
  bufferMinutes: number
): AvailableSlot | null {
  // 找到第一個足夠長的時段
  for (const slot of availableSlots) {
    if (slot.durationMinutes >= taskMinutes + bufferMinutes) {
      return slot
    }
  }
  return null
}

// 從時段中分配時間給任務
function allocateFromSlot(
  slot: AvailableSlot,
  taskMinutes: number,
  bufferMinutes: number
): { startTime: string; endTime: string } {
  const [startHour, startMin] = slot.start.split(':').map(Number)
  const startDate = new Date(`${slot.date}T${slot.start}:00`)
  const endDate = new Date(startDate.getTime() + taskMinutes * 60 * 1000)

  const formatTime = (date: Date) => {
    const h = date.getHours().toString().padStart(2, '0')
    const m = date.getMinutes().toString().padStart(2, '0')
    return `${h}:${m}`
  }

  return {
    startTime: `${slot.date}T${formatTime(startDate)}:00`,
    endTime: `${slot.date}T${formatTime(endDate)}:00`,
  }
}

// 更新時段（扣除已使用的時間）
function updateSlot(
  slot: AvailableSlot,
  usedMinutes: number,
  bufferMinutes: number
): AvailableSlot | null {
  const totalUsed = usedMinutes + bufferMinutes
  const remaining = slot.durationMinutes - totalUsed

  if (remaining < 15) return null // 剩餘時間太短，捨棄

  // 計算新的開始時間
  const [startHour, startMin] = slot.start.split(':').map(Number)
  const newStartMinutes = startHour * 60 + startMin + totalUsed
  const newStartHour = Math.floor(newStartMinutes / 60)
  const newStartMin = newStartMinutes % 60

  return {
    date: slot.date,
    start: `${newStartHour.toString().padStart(2, '0')}:${newStartMin.toString().padStart(2, '0')}`,
    end: slot.end,
    durationMinutes: remaining,
  }
}

/**
 * 執行智慧排程
 */
export async function generateSmartSchedule(
  userId: string,
  options: ScheduleOptions = {}
): Promise<ScheduleResult> {
  // 1. 載入用戶排程偏好
  const preferences = await getSchedulingPreferences(userId)
  const hasPreferences = preferences !== null

  if (hasPreferences) {
    console.log('[Schedule Algorithm] 已載入用戶排程偏好')
  } else {
    console.log('[Schedule Algorithm] 使用預設排程設定')
  }

  // 優先使用偏好設定，否則使用 options 或預設值
  const {
    startDate = new Date().toISOString().split('T')[0],
    endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    workStart = preferences?.workStartTime || '09:00',
    workEnd = preferences?.workEndTime || '18:00',
    priorityOrder = ['urgent', 'high', 'medium', 'low'],
    respectDeadlines = true,
    maxTasksPerDay = preferences?.maxTasksPerDay || 8,
    bufferMinutes = preferences?.minTaskGapMinutes || 15,
  } = options

  // 從偏好中取得額外設定
  const maxDailyHours = preferences?.maxDailyHours || 6
  const lunchStart = preferences?.lunchStartTime || '12:00'
  const lunchEnd = preferences?.lunchEndTime || '13:00'

  console.log('[Schedule Algorithm] 開始排程', {
    startDate,
    endDate,
    userId,
    workStart,
    workEnd,
    maxTasksPerDay,
    bufferMinutes,
    maxDailyHours,
    hasPreferences,
  })

  // 1. 取得未排程任務
  const unscheduledResult = await getUnscheduledTasks(userId, {})

  if (!unscheduledResult.tasks || unscheduledResult.tasks.length === 0) {
    return {
      success: true,
      scheduledTasks: [],
      unscheduledTasks: [],
      summary: {
        totalTasksProcessed: 0,
        successfullyScheduled: 0,
        failedToSchedule: 0,
        totalMinutesScheduled: 0,
        daysSpanned: 0,
      },
      conflictCheck: { hasConflicts: false, conflicts: [], conflictCount: 0, totalOverlapMinutes: 0 },
      busyEvents: {},
      conflictSummary: '無排程衝突 ✓',
    }
  }

  const tasks = unscheduledResult.tasks as Array<{
    id: string
    title: string
    description?: string | null
    priority: 'low' | 'medium' | 'high' | 'urgent'
    dueDate: string | null
    estimatedMinutes?: number
    taskType?: 'focus' | 'background' | string
  }>

  console.log(`[Schedule Algorithm] 找到 ${tasks.length} 個未排程任務`)

  // 2. 取得可用時段
  const slotsResult = await getAvailableSlots(userId, {
    startDate,
    endDate,
    workStart,
    workEnd,
  })

  // 將按日期分組的 slots 轉換為扁平的 AvailableSlot 陣列
  let availableSlots: AvailableSlot[] = []
  for (const [dateKey, dateSlots] of Object.entries(slotsResult.slots)) {
    // 檢查該日是否在用戶偏好中啟用
    const dateObj = new Date(dateKey)
    if (preferences && !isDayEnabled(preferences, dateObj)) {
      console.log(`[Schedule Algorithm] 跳過停用的日期: ${dateKey}`)
      continue
    }

    for (const slot of dateSlots) {
      // 過濾午休時段
      const slotStartHour = parseInt(slot.start.split(':')[0])
      const slotEndHour = parseInt(slot.end.split(':')[0])
      const lunchStartHour = parseInt(lunchStart.split(':')[0])
      const lunchEndHour = parseInt(lunchEnd.split(':')[0])

      // 如果時段完全在午休時間內，跳過
      if (slotStartHour >= lunchStartHour && slotEndHour <= lunchEndHour) {
        continue
      }

      availableSlots.push({
        date: dateKey,
        start: slot.start,
        end: slot.end,
        durationMinutes: slot.minutes,
      })
    }
  }

  if (availableSlots.length === 0) {
    return {
      success: false,
      scheduledTasks: [],
      unscheduledTasks: tasks.map(t => ({
        taskId: t.id,
        taskTitle: t.title,
        reason: '找不到可用時段',
      })),
      summary: {
        totalTasksProcessed: tasks.length,
        successfullyScheduled: 0,
        failedToSchedule: tasks.length,
        totalMinutesScheduled: 0,
        daysSpanned: 0,
      },
      conflictCheck: { hasConflicts: false, conflicts: [], conflictCount: 0, totalOverlapMinutes: 0 },
      busyEvents: slotsResult.busyEvents,
      conflictSummary: '無法排程（時段不足）',
    }
  }

  console.log(`[Schedule Algorithm] 找到 ${availableSlots.length} 個可用時段`)

  // 3. 預估任務時間（如果沒有 estimatedMinutes）
  const tasksNeedEstimate = tasks.filter(t => !t.estimatedMinutes)
  let estimates: TaskTimeEstimate[] = []

  if (tasksNeedEstimate.length > 0) {
    console.log(`[Schedule Algorithm] 預估 ${tasksNeedEstimate.length} 個任務的時間`)
    const estimateResult = await estimateMultipleTasksTimeOptimized({
      tasks: tasksNeedEstimate.map(t => ({
        taskId: t.id,
        taskTitle: t.title,
        taskDescription: t.description || undefined,
      })),
    })
    estimates = estimateResult.estimates
  }

  // 建立任務時間對照表
  const estimateMap = new Map<string, TaskTimeEstimate>()
  for (const est of estimates) {
    estimateMap.set(est.taskId, est)
  }

  // 4. 對任務排序（按優先級和截止日）
  const sortedTasks = [...tasks].sort((a, b) => {
    const scoreA = calculateTaskScore(
      { priority: a.priority, dueDate: a.dueDate },
      startDate,
      respectDeadlines
    )
    const scoreB = calculateTaskScore(
      { priority: b.priority, dueDate: b.dueDate },
      startDate,
      respectDeadlines
    )
    return scoreB - scoreA // 分數高的排前面
  })

  console.log('[Schedule Algorithm] 任務排序完成', sortedTasks.map(t => `${t.title}(${t.priority})`))

  // 5. 開始排程
  const scheduledTasks: ScheduledTask[] = []
  const failedTasks: Array<{ taskId: string; taskTitle: string; reason: string }> = []
  const tasksPerDay: Record<string, number> = {}
  const minutesPerDay: Record<string, number> = {} // 追蹤每日已排程分鐘數
  const maxDailyMinutes = maxDailyHours * 60 // 轉換為分鐘
  const datesUsed = new Set<string>()

  for (const task of sortedTasks) {
    // 取得任務預估時間
    const estimate = estimateMap.get(task.id)
    const estimatedMinutes = task.estimatedMinutes || estimate?.estimatedMinutes || 60
    const taskType = (task.taskType === 'focus' || task.taskType === 'background' ? task.taskType : estimate?.taskType) || 'focus'
    const confidence = estimate?.confidence || 'medium'
    const reasoning = estimate?.reasoning || '使用預設預估'

    // 找到適合的時段
    const slot = findBestSlot(estimatedMinutes, availableSlots, bufferMinutes)

    if (!slot) {
      failedTasks.push({
        taskId: task.id,
        taskTitle: task.title,
        reason: `找不到足夠長的時段（需要 ${estimatedMinutes} 分鐘）`,
      })
      continue
    }

    // 檢查當天是否已達任務數上限或時數上限
    const dayMinutes = minutesPerDay[slot.date] || 0
    const wouldExceedHours = (dayMinutes + estimatedMinutes) > maxDailyMinutes

    if ((tasksPerDay[slot.date] || 0) >= maxTasksPerDay || wouldExceedHours) {
      // 嘗試找其他天的時段（考慮任務數和時數上限）
      const otherSlots = availableSlots.filter(s =>
        s.date !== slot.date &&
        (tasksPerDay[s.date] || 0) < maxTasksPerDay &&
        ((minutesPerDay[s.date] || 0) + estimatedMinutes) <= maxDailyMinutes
      )
      const alternativeSlot = findBestSlot(estimatedMinutes, otherSlots, bufferMinutes)

      if (!alternativeSlot) {
        failedTasks.push({
          taskId: task.id,
          taskTitle: task.title,
          reason: `每天任務數已達上限 (${maxTasksPerDay})`,
        })
        continue
      }
      // 使用替代時段
      const { startTime, endTime } = allocateFromSlot(alternativeSlot, estimatedMinutes, bufferMinutes)

      scheduledTasks.push({
        taskId: task.id,
        taskTitle: task.title,
        priority: task.priority,
        dueDate: task.dueDate,
        startTime,
        endTime,
        estimatedMinutes,
        taskType,
        confidence,
        slotDate: alternativeSlot.date,
        reasoning,
      })

      // 更新可用時段
      const slotIndex = availableSlots.indexOf(alternativeSlot)
      const updatedSlot = updateSlot(alternativeSlot, estimatedMinutes, bufferMinutes)
      if (updatedSlot) {
        availableSlots[slotIndex] = updatedSlot
      } else {
        availableSlots.splice(slotIndex, 1)
      }

      tasksPerDay[alternativeSlot.date] = (tasksPerDay[alternativeSlot.date] || 0) + 1
      minutesPerDay[alternativeSlot.date] = (minutesPerDay[alternativeSlot.date] || 0) + estimatedMinutes
      datesUsed.add(alternativeSlot.date)
      continue
    }

    // 分配時間
    const { startTime, endTime } = allocateFromSlot(slot, estimatedMinutes, bufferMinutes)

    scheduledTasks.push({
      taskId: task.id,
      taskTitle: task.title,
      priority: task.priority,
      dueDate: task.dueDate,
      startTime,
      endTime,
      estimatedMinutes,
      taskType,
      confidence,
      slotDate: slot.date,
      reasoning,
    })

    // 更新可用時段
    const slotIndex = availableSlots.indexOf(slot)
    const updatedSlot = updateSlot(slot, estimatedMinutes, bufferMinutes)
    if (updatedSlot) {
      availableSlots[slotIndex] = updatedSlot
    } else {
      availableSlots.splice(slotIndex, 1)
    }

    tasksPerDay[slot.date] = (tasksPerDay[slot.date] || 0) + 1
    minutesPerDay[slot.date] = (minutesPerDay[slot.date] || 0) + estimatedMinutes
    datesUsed.add(slot.date)
  }

  const totalMinutes = scheduledTasks.reduce((sum, t) => sum + t.estimatedMinutes, 0)

  console.log(`[Schedule Algorithm] 排程完成: ${scheduledTasks.length} 成功, ${failedTasks.length} 失敗`)

  // S-010: 執行衝突檢查（驗證排程結果與行事曆事件）
  const scheduledTasksForCheck = scheduledTasks.map(t => ({
    taskId: t.taskId,
    taskTitle: t.taskTitle,
    startTime: t.startTime,
    endTime: t.endTime,
  }))

  const conflictCheck = checkScheduleConflicts(
    scheduledTasksForCheck,
    slotsResult.busyEvents
  )

  if (conflictCheck.hasConflicts) {
    console.log(`[Schedule Algorithm] 偵測到 ${conflictCheck.conflictCount} 個衝突`)
  }

  const conflictSummary = formatConflictSummary(conflictCheck)

  return {
    success: true,
    scheduledTasks,
    unscheduledTasks: failedTasks,
    summary: {
      totalTasksProcessed: tasks.length,
      successfullyScheduled: scheduledTasks.length,
      failedToSchedule: failedTasks.length,
      totalMinutesScheduled: totalMinutes,
      daysSpanned: datesUsed.size,
    },
    // S-010: 衝突資訊
    conflictCheck,
    busyEvents: slotsResult.busyEvents,
    conflictSummary,
  }
}

/**
 * 驗證排程是否有衝突
 */
export function validateSchedule(
  scheduledTasks: ScheduledTask[]
): { valid: boolean; conflicts: string[] } {
  const conflicts: string[] = []

  // 按開始時間排序
  const sorted = [...scheduledTasks].sort((a, b) =>
    new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  )

  // 檢查是否有重疊
  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i]
    const next = sorted[i + 1]

    const currentEnd = new Date(current.endTime).getTime()
    const nextStart = new Date(next.startTime).getTime()

    if (currentEnd > nextStart) {
      conflicts.push(
        `「${current.taskTitle}」與「${next.taskTitle}」時間重疊`
      )
    }
  }

  return {
    valid: conflicts.length === 0,
    conflicts,
  }
}
