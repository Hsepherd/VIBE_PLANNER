/**
 * 排程預覽相關功能
 */

interface ScheduleItem {
  taskId: string
  taskTitle: string
  startTime: string
  endTime: string
  estimatedMinutes?: number
}

interface CreateSchedulePreviewArgs {
  schedules: ScheduleItem[]
}

interface SchedulePreviewResult {
  preview: Array<{
    taskId: string
    taskTitle: string
    startTime: string
    endTime: string
    durationMinutes: number
    date: string
  }>
  summary: {
    totalTasks: number
    totalMinutes: number
    dateRange: { start: string; end: string }
  }
}

/**
 * 產生排程預覽
 * 這個 function 將 AI 產生的排程轉換為前端可用的格式
 */
export async function createSchedulePreview(
  userId: string,
  args: CreateSchedulePreviewArgs
): Promise<SchedulePreviewResult> {
  const { schedules } = args

  if (!schedules || schedules.length === 0) {
    return {
      preview: [],
      summary: {
        totalTasks: 0,
        totalMinutes: 0,
        dateRange: { start: '', end: '' },
      },
    }
  }

  // 轉換為預覽格式
  const preview = schedules.map((item) => {
    const startTime = new Date(item.startTime)
    const endTime = new Date(item.endTime)
    const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000)

    return {
      taskId: item.taskId,
      taskTitle: item.taskTitle,
      startTime: item.startTime,
      endTime: item.endTime,
      durationMinutes: item.estimatedMinutes || durationMinutes,
      date: startTime.toISOString().split('T')[0],
    }
  })

  // 計算總結
  const totalMinutes = preview.reduce((sum, p) => sum + p.durationMinutes, 0)
  const dates = preview.map((p) => p.date).sort()

  return {
    preview,
    summary: {
      totalTasks: preview.length,
      totalMinutes,
      dateRange: {
        start: dates[0] || '',
        end: dates[dates.length - 1] || '',
      },
    },
  }
}
