/**
 * 從自然語言萃取任務並自動排程
 * 接收 AI 萃取的任務陣列，用排程演算法排入可用時段
 * 此時不建立 DB 任務，等使用者確認後才建立
 */

import { getAvailableSlots } from './getAvailableSlots'
import type { ScheduledTask, ScheduleResult } from './scheduleAlgorithm'

// 傳入參數
interface ExtractAndScheduleArgs {
  tasks: Array<{
    title: string
    estimatedMinutes: number
    priority?: 'low' | 'medium' | 'high' | 'urgent'
    description?: string
  }>
  scheduleDate?: string   // YYYY-MM-DD，預設今天
  workStart?: string      // HH:mm，預設 09:00
  workEnd?: string        // HH:mm，預設 18:00
}

// 新任務資料（帶臨時 ID）
interface NewTaskData {
  tempId: string
  title: string
  description?: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  estimatedMinutes: number
}

// 擴展排程結果，額外帶上新任務建立資訊
export interface ExtractAndScheduleResult extends ScheduleResult {
  isNewTasks: true
  newTasksData: NewTaskData[]
}

// 可用時段介面
interface AvailableSlot {
  date: string
  start: string
  end: string
  durationMinutes: number
}

// 從時段中分配時間給任務
function allocateFromSlot(
  slot: AvailableSlot,
  taskMinutes: number,
): { startTime: string; endTime: string } {
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
  bufferMinutes: number,
): AvailableSlot | null {
  const totalUsed = usedMinutes + bufferMinutes
  const remaining = slot.durationMinutes - totalUsed

  if (remaining < 15) return null

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

// 找到最適合的時段
function findBestSlot(
  taskMinutes: number,
  availableSlots: AvailableSlot[],
  bufferMinutes: number,
): AvailableSlot | null {
  for (const slot of availableSlots) {
    if (slot.durationMinutes >= taskMinutes + bufferMinutes) {
      return slot
    }
  }
  return null
}

/**
 * 從自然語言萃取任務並自動排程
 */
export async function extractAndScheduleTasks(
  userId: string,
  args: ExtractAndScheduleArgs,
): Promise<ExtractAndScheduleResult> {
  const {
    tasks: inputTasks,
    scheduleDate = new Date().toISOString().split('T')[0],
    workStart = '09:00',
    workEnd = '18:00',
  } = args

  const bufferMinutes = 15 // 任務間緩衝時間

  console.log('[ExtractAndSchedule] 開始處理', {
    taskCount: inputTasks.length,
    scheduleDate,
    workStart,
    workEnd,
    userId,
  })

  // 為每個任務建立臨時 ID
  const newTasksData: NewTaskData[] = inputTasks.map((task, index) => ({
    tempId: `new-task-${Date.now()}-${index}`,
    title: task.title,
    description: task.description,
    priority: task.priority || 'medium',
    estimatedMinutes: task.estimatedMinutes,
  }))

  // 取得可用時段
  const slotsResult = await getAvailableSlots(userId, {
    startDate: scheduleDate,
    endDate: scheduleDate,
    workStart,
    workEnd,
  })

  // 轉換為扁平的時段陣列
  let availableSlots: AvailableSlot[] = []
  for (const [dateKey, dateSlots] of Object.entries(slotsResult.slots)) {
    for (const slot of dateSlots) {
      // 過濾午休時段（12:00-13:00）
      const slotStartHour = parseInt(slot.start.split(':')[0])
      const slotEndHour = parseInt(slot.end.split(':')[0])
      if (slotStartHour >= 12 && slotEndHour <= 13) {
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
      isNewTasks: true,
      newTasksData,
      scheduledTasks: [],
      unscheduledTasks: newTasksData.map(t => ({
        taskId: t.tempId,
        taskTitle: t.title,
        reason: '找不到可用時段',
      })),
      summary: {
        totalTasksProcessed: inputTasks.length,
        successfullyScheduled: 0,
        failedToSchedule: inputTasks.length,
        totalMinutesScheduled: 0,
        daysSpanned: 0,
      },
    }
  }

  console.log(`[ExtractAndSchedule] 找到 ${availableSlots.length} 個可用時段`)

  // 按優先級排序（urgent > high > medium > low）
  const priorityWeights: Record<string, number> = {
    urgent: 100,
    high: 75,
    medium: 50,
    low: 25,
  }

  const sortedTasks = [...newTasksData].sort((a, b) => {
    return (priorityWeights[b.priority] || 50) - (priorityWeights[a.priority] || 50)
  })

  // 排程
  const scheduledTasks: ScheduledTask[] = []
  const failedTasks: Array<{ taskId: string; taskTitle: string; reason: string }> = []
  const datesUsed = new Set<string>()

  for (const task of sortedTasks) {
    const slot = findBestSlot(task.estimatedMinutes, availableSlots, bufferMinutes)

    if (!slot) {
      failedTasks.push({
        taskId: task.tempId,
        taskTitle: task.title,
        reason: `找不到足夠長的時段（需要 ${task.estimatedMinutes} 分鐘）`,
      })
      continue
    }

    const { startTime, endTime } = allocateFromSlot(slot, task.estimatedMinutes)

    scheduledTasks.push({
      taskId: task.tempId,
      taskTitle: task.title,
      priority: task.priority,
      dueDate: null,
      startTime,
      endTime,
      estimatedMinutes: task.estimatedMinutes,
      taskType: 'focus',
      confidence: 'high',
      slotDate: slot.date,
      reasoning: 'AI 自動預估',
    })

    // 更新可用時段
    const slotIndex = availableSlots.indexOf(slot)
    const updatedSlot = updateSlot(slot, task.estimatedMinutes, bufferMinutes)
    if (updatedSlot) {
      availableSlots[slotIndex] = updatedSlot
    } else {
      availableSlots.splice(slotIndex, 1)
    }

    datesUsed.add(slot.date)
  }

  const totalMinutes = scheduledTasks.reduce((sum, t) => sum + t.estimatedMinutes, 0)

  console.log(`[ExtractAndSchedule] 排程完成: ${scheduledTasks.length} 成功, ${failedTasks.length} 失敗`)

  return {
    success: true,
    isNewTasks: true,
    newTasksData,
    scheduledTasks,
    unscheduledTasks: failedTasks,
    summary: {
      totalTasksProcessed: inputTasks.length,
      successfullyScheduled: scheduledTasks.length,
      failedToSchedule: failedTasks.length,
      totalMinutesScheduled: totalMinutes,
      daysSpanned: datesUsed.size,
    },
  }
}
