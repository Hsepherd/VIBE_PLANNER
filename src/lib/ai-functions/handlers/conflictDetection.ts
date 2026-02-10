/**
 * 排程衝突偵測工具
 * 檢測排程任務與 Google Calendar 事件的時間衝突
 */

export interface CalendarEvent {
  start: string
  end: string
  title: string
}

export interface ScheduledTaskTime {
  taskId: string
  taskTitle: string
  startTime: string
  endTime: string
}

export interface ConflictInfo {
  taskId: string
  taskTitle: string
  taskStart: string
  taskEnd: string
  conflictingEvent: {
    title: string
    start: string
    end: string
  }
  overlapMinutes: number
  conflictType: 'full_overlap' | 'partial_start' | 'partial_end' | 'task_contains_event' | 'event_contains_task'
}

export interface ConflictCheckResult {
  hasConflicts: boolean
  conflicts: ConflictInfo[]
  conflictCount: number
  totalOverlapMinutes: number
}

/**
 * 檢測單一任務與行事曆事件的衝突
 */
export function checkTaskConflicts(
  task: ScheduledTaskTime,
  busyEvents: CalendarEvent[]
): ConflictInfo[] {
  const conflicts: ConflictInfo[] = []

  const taskStartDate = new Date(task.startTime)
  const taskEndDate = new Date(task.endTime)

  // 檢查日期是否有效，避免 Invalid time value
  if (isNaN(taskStartDate.getTime()) || isNaN(taskEndDate.getTime())) {
    console.warn('[ConflictDetection] 跳過無效時間的任務:', task.taskTitle, task.startTime, task.endTime)
    return conflicts
  }

  const taskStart = taskStartDate.getTime()
  const taskEnd = taskEndDate.getTime()

  for (const event of busyEvents) {
    const eventStart = new Date(event.start).getTime()
    const eventEnd = new Date(event.end).getTime()

    // 檢查是否有重疊
    if (taskStart < eventEnd && taskEnd > eventStart) {
      // 計算重疊時間
      const overlapStart = Math.max(taskStart, eventStart)
      const overlapEnd = Math.min(taskEnd, eventEnd)
      const overlapMinutes = Math.round((overlapEnd - overlapStart) / (1000 * 60))

      // 判斷衝突類型
      let conflictType: ConflictInfo['conflictType']

      if (taskStart >= eventStart && taskEnd <= eventEnd) {
        // 任務完全被事件包含
        conflictType = 'event_contains_task'
      } else if (taskStart <= eventStart && taskEnd >= eventEnd) {
        // 事件完全被任務包含
        conflictType = 'task_contains_event'
      } else if (taskStart < eventStart && taskEnd > eventStart && taskEnd < eventEnd) {
        // 任務尾端與事件開頭重疊
        conflictType = 'partial_end'
      } else if (taskStart > eventStart && taskStart < eventEnd && taskEnd > eventEnd) {
        // 任務開頭與事件尾端重疊
        conflictType = 'partial_start'
      } else {
        // 完全重疊
        conflictType = 'full_overlap'
      }

      conflicts.push({
        taskId: task.taskId,
        taskTitle: task.taskTitle,
        taskStart: task.startTime,
        taskEnd: task.endTime,
        conflictingEvent: {
          title: event.title,
          start: event.start,
          end: event.end,
        },
        overlapMinutes,
        conflictType,
      })
    }
  }

  return conflicts
}

/**
 * 檢測多個排程任務與行事曆事件的衝突
 */
export function checkScheduleConflicts(
  scheduledTasks: ScheduledTaskTime[],
  busyEventsByDate: Record<string, CalendarEvent[]>
): ConflictCheckResult {
  const allConflicts: ConflictInfo[] = []

  for (const task of scheduledTasks) {
    // 檢查 startTime 是否為有效日期，避免 Invalid time value
    const taskDateObj = new Date(task.startTime)
    if (isNaN(taskDateObj.getTime())) {
      console.warn('[ConflictDetection] 跳過無效 startTime 的任務:', task.taskTitle, task.startTime)
      continue
    }

    // 取得任務日期對應的忙碌事件
    const taskDate = taskDateObj.toISOString().split('T')[0]
    const busyEvents = busyEventsByDate[taskDate] || []

    const taskConflicts = checkTaskConflicts(task, busyEvents)
    allConflicts.push(...taskConflicts)
  }

  const totalOverlapMinutes = allConflicts.reduce((sum, c) => sum + c.overlapMinutes, 0)

  return {
    hasConflicts: allConflicts.length > 0,
    conflicts: allConflicts,
    conflictCount: allConflicts.length,
    totalOverlapMinutes,
  }
}

/**
 * 找出建議的替代時間（避開衝突）
 */
export function suggestAlternativeTime(
  task: ScheduledTaskTime,
  busyEvents: CalendarEvent[],
  workStartHour: number = 9,
  workEndHour: number = 18,
  taskDurationMinutes: number = 60
): { suggestedStart: string; suggestedEnd: string } | null {
  const taskDate = new Date(task.startTime)
  if (isNaN(taskDate.getTime())) {
    console.warn('[ConflictDetection] suggestAlternativeTime: 無效時間', task.startTime)
    return null
  }
  const dateStr = taskDate.toISOString().split('T')[0]

  // 建立當天的工作時段（每 30 分鐘一個時段）
  const slots: { start: Date; end: Date; available: boolean }[] = []

  for (let hour = workStartHour; hour < workEndHour; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const slotStart = new Date(`${dateStr}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`)
      const slotEnd = new Date(slotStart.getTime() + taskDurationMinutes * 60 * 1000)

      // 確保不超過工作結束時間
      const workEnd = new Date(`${dateStr}T${String(workEndHour).padStart(2, '0')}:00:00`)
      if (slotEnd > workEnd) continue

      // 檢查是否與任何事件衝突
      let isAvailable = true
      for (const event of busyEvents) {
        const eventStart = new Date(event.start).getTime()
        const eventEnd = new Date(event.end).getTime()

        if (slotStart.getTime() < eventEnd && slotEnd.getTime() > eventStart) {
          isAvailable = false
          break
        }
      }

      slots.push({ start: slotStart, end: slotEnd, available: isAvailable })
    }
  }

  // 找出最接近原始時間的可用時段
  const originalStart = new Date(task.startTime).getTime()
  let bestSlot: { start: Date; end: Date } | null = null
  let minTimeDiff = Infinity

  for (const slot of slots) {
    if (slot.available) {
      const timeDiff = Math.abs(slot.start.getTime() - originalStart)
      if (timeDiff < minTimeDiff) {
        minTimeDiff = timeDiff
        bestSlot = slot
      }
    }
  }

  if (bestSlot) {
    return {
      suggestedStart: bestSlot.start.toISOString(),
      suggestedEnd: bestSlot.end.toISOString(),
    }
  }

  return null
}

/**
 * 格式化衝突資訊為人類可讀的訊息
 */
export function formatConflictMessage(conflict: ConflictInfo): string {
  const taskTime = `${formatTime(conflict.taskStart)} - ${formatTime(conflict.taskEnd)}`
  const eventTime = `${formatTime(conflict.conflictingEvent.start)} - ${formatTime(conflict.conflictingEvent.end)}`

  return `「${conflict.taskTitle}」(${taskTime}) 與行事曆事件「${conflict.conflictingEvent.title}」(${eventTime}) 衝突，重疊 ${conflict.overlapMinutes} 分鐘`
}

/**
 * 格式化衝突摘要
 */
export function formatConflictSummary(result: ConflictCheckResult): string {
  if (!result.hasConflicts) {
    return '無排程衝突 ✓'
  }

  const lines = [
    `⚠️ 偵測到 ${result.conflictCount} 個排程衝突（共 ${result.totalOverlapMinutes} 分鐘重疊）：`,
    '',
    ...result.conflicts.map((c, i) => `${i + 1}. ${formatConflictMessage(c)}`),
  ]

  return lines.join('\n')
}

/**
 * 輔助函數：格式化時間
 */
function formatTime(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleTimeString('zh-TW', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}
