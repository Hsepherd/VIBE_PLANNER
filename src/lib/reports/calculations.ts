/**
 * 報表計算工具函數
 * S-013: 排程報表統計計算
 */

import type {
  DailyStats,
  WeeklyReport,
  MonthlyReport,
  ReportSummaryCard,
  BarChartData,
} from './types'

// 任務資料介面（從資料庫）
interface TaskData {
  id: string
  title: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  estimatedMinutes: number | null
  scheduledStart: string | null
  scheduledEnd: string | null
  completedAt: string | null
  projectId: string | null
  projectName?: string
}

/**
 * 取得日期的週一
 */
function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * 格式化日期為 YYYY-MM-DD（使用本地時區）
 */
function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * 取得年度週數
 */
function getWeekNumber(date: Date): number {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 4 - (d.getDay() || 7))
  const yearStart = new Date(d.getFullYear(), 0, 1)
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

/**
 * 計算單日統計
 */
export function calculateDailyStats(
  date: string,
  tasks: TaskData[]
): DailyStats {
  const dateObj = new Date(date)
  const dayTasks = tasks.filter(task => {
    if (!task.scheduledStart) return false
    const taskDate = task.scheduledStart.split('T')[0]
    return taskDate === date
  })

  const completedTasks = dayTasks.filter(t => t.status === 'completed')
  const totalScheduledMinutes = dayTasks.reduce(
    (sum, t) => sum + (t.estimatedMinutes || 0),
    0
  )
  const totalCompletedMinutes = completedTasks.reduce(
    (sum, t) => sum + (t.estimatedMinutes || 0),
    0
  )

  // 假設工作時間為 8 小時 (480 分鐘)
  const workingMinutes = 480
  const utilizationRate = workingMinutes > 0
    ? Math.min(totalScheduledMinutes / workingMinutes, 1)
    : 0

  const completionRate = dayTasks.length > 0
    ? completedTasks.length / dayTasks.length
    : 0

  return {
    date,
    dayOfWeek: dateObj.getDay(),
    scheduledTaskCount: dayTasks.length,
    completedTaskCount: completedTasks.length,
    totalScheduledMinutes,
    totalCompletedMinutes,
    utilizationRate,
    completionRate,
  }
}

/**
 * 計算週報表
 */
export function calculateWeeklyReport(
  weekStart: Date,
  tasks: TaskData[]
): WeeklyReport {
  const monday = getMonday(weekStart)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  const weekStartStr = formatDate(monday)
  const weekEndStr = formatDate(sunday)

  // 取得該週所有日期
  const dailyStats: DailyStats[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    const dateStr = formatDate(d)
    dailyStats.push(calculateDailyStats(dateStr, tasks))
  }

  // 篩選該週的任務
  const weekTasks = tasks.filter(task => {
    if (!task.scheduledStart) return false
    const taskDate = task.scheduledStart.split('T')[0]
    return taskDate >= weekStartStr && taskDate <= weekEndStr
  })

  const completedTasks = weekTasks.filter(t => t.status === 'completed')

  // 總計
  const totalScheduledMinutes = weekTasks.reduce(
    (sum, t) => sum + (t.estimatedMinutes || 0),
    0
  )
  const totalCompletedMinutes = completedTasks.reduce(
    (sum, t) => sum + (t.estimatedMinutes || 0),
    0
  )

  // 任務分類統計
  const tasksByPriority = {
    urgent: weekTasks.filter(t => t.priority === 'urgent').length,
    high: weekTasks.filter(t => t.priority === 'high').length,
    medium: weekTasks.filter(t => t.priority === 'medium').length,
    low: weekTasks.filter(t => t.priority === 'low').length,
  }

  // 按專案分類
  const projectMap = new Map<string | null, { name: string; count: number; completed: number }>()
  weekTasks.forEach(task => {
    const key = task.projectId
    const existing = projectMap.get(key) || {
      name: task.projectName || '無專案',
      count: 0,
      completed: 0,
    }
    existing.count++
    if (task.status === 'completed') existing.completed++
    projectMap.set(key, existing)
  })

  const tasksByProject = Array.from(projectMap.entries()).map(([projectId, data]) => ({
    projectId,
    projectName: data.name,
    count: data.count,
    completedCount: data.completed,
  }))

  // 找最佳表現日
  const productiveDays = dailyStats
    .filter(d => d.completedTaskCount > 0)
    .sort((a, b) => b.completedTaskCount - a.completedTaskCount)

  const mostProductiveDay = productiveDays.length > 0
    ? {
        date: productiveDays[0].date,
        completedTasks: productiveDays[0].completedTaskCount,
        completedMinutes: productiveDays[0].totalCompletedMinutes,
      }
    : null

  // 計算平均值
  const activeDays = dailyStats.filter(d => d.scheduledTaskCount > 0)
  const avgTasksPerDay = activeDays.length > 0
    ? weekTasks.length / activeDays.length
    : 0

  const avgCompletionRate = activeDays.length > 0
    ? activeDays.reduce((sum, d) => sum + d.completionRate, 0) / activeDays.length
    : 0

  const avgUtilizationRate = activeDays.length > 0
    ? activeDays.reduce((sum, d) => sum + d.utilizationRate, 0) / activeDays.length
    : 0

  return {
    weekStart: weekStartStr,
    weekEnd: weekEndStr,
    weekNumber: getWeekNumber(monday),
    year: monday.getFullYear(),
    totalScheduledTasks: weekTasks.length,
    totalCompletedTasks: completedTasks.length,
    totalScheduledMinutes,
    totalCompletedMinutes,
    avgTasksPerDay,
    avgCompletionRate,
    avgUtilizationRate,
    dailyStats,
    tasksByPriority,
    tasksByProject,
    mostProductiveDay,
  }
}

/**
 * 計算月報表
 */
export function calculateMonthlyReport(
  year: number,
  month: number, // 1-12
  tasks: TaskData[]
): MonthlyReport {
  const monthStart = new Date(year, month - 1, 1)
  const monthEnd = new Date(year, month, 0) // 最後一天

  const monthStartStr = formatDate(monthStart)
  const monthEndStr = formatDate(monthEnd)

  // 計算該月的所有週報
  const weeklyReports: WeeklyReport[] = []
  let currentMonday = getMonday(monthStart)

  // 如果週一不在本月，從本月第一天開始
  if (currentMonday < monthStart) {
    currentMonday = getMonday(new Date(monthStart.getTime() + 7 * 24 * 60 * 60 * 1000))
  }

  while (currentMonday <= monthEnd) {
    const report = calculateWeeklyReport(currentMonday, tasks)
    weeklyReports.push(report)
    currentMonday = new Date(currentMonday.getTime() + 7 * 24 * 60 * 60 * 1000)
  }

  // 篩選該月的任務
  const monthTasks = tasks.filter(task => {
    if (!task.scheduledStart) return false
    const taskDate = task.scheduledStart.split('T')[0]
    return taskDate >= monthStartStr && taskDate <= monthEndStr
  })

  const completedTasks = monthTasks.filter(t => t.status === 'completed')

  // 總計
  const totalScheduledMinutes = monthTasks.reduce(
    (sum, t) => sum + (t.estimatedMinutes || 0),
    0
  )
  const totalCompletedMinutes = completedTasks.reduce(
    (sum, t) => sum + (t.estimatedMinutes || 0),
    0
  )

  // 趨勢資料
  const completionRateTrend = weeklyReports.map(w => w.avgCompletionRate)
  const utilizationRateTrend = weeklyReports.map(w => w.avgUtilizationRate)

  // 找最佳週
  const bestWeekReport = weeklyReports
    .filter(w => w.totalScheduledTasks > 0)
    .sort((a, b) => b.avgCompletionRate - a.avgCompletionRate)[0]

  const bestWeek = bestWeekReport
    ? {
        weekStart: bestWeekReport.weekStart,
        completionRate: bestWeekReport.avgCompletionRate,
      }
    : null

  return {
    month,
    year,
    monthStart: monthStartStr,
    monthEnd: monthEndStr,
    totalScheduledTasks: monthTasks.length,
    totalCompletedTasks: completedTasks.length,
    totalScheduledMinutes,
    totalCompletedMinutes,
    weeklyReports,
    completionRateTrend,
    utilizationRateTrend,
    bestWeek,
  }
}

/**
 * 產生報表摘要卡片資料
 */
export function generateSummaryCards(
  report: WeeklyReport,
  previousReport?: WeeklyReport
): ReportSummaryCard[] {
  const cards: ReportSummaryCard[] = []

  // 完成任務數
  const taskTrend = previousReport
    ? ((report.totalCompletedTasks - previousReport.totalCompletedTasks) /
        (previousReport.totalCompletedTasks || 1)) *
      100
    : 0

  cards.push({
    title: '完成任務',
    value: report.totalCompletedTasks,
    unit: '個',
    trend: taskTrend > 0 ? 'up' : taskTrend < 0 ? 'down' : 'neutral',
    trendValue: Math.abs(Math.round(taskTrend)),
    icon: '✅',
  })

  // 完成率
  const rateTrend = previousReport
    ? (report.avgCompletionRate - previousReport.avgCompletionRate) * 100
    : 0

  cards.push({
    title: '完成率',
    value: `${Math.round(report.avgCompletionRate * 100)}%`,
    trend: rateTrend > 0 ? 'up' : rateTrend < 0 ? 'down' : 'neutral',
    trendValue: Math.abs(Math.round(rateTrend)),
    icon: '📊',
  })

  // 總工作時間
  const hours = Math.round(report.totalCompletedMinutes / 60 * 10) / 10
  cards.push({
    title: '總工作時間',
    value: hours,
    unit: '小時',
    icon: '⏱️',
  })

  // 時間利用率
  cards.push({
    title: '時間利用率',
    value: `${Math.round(report.avgUtilizationRate * 100)}%`,
    icon: '📈',
  })

  return cards
}

/**
 * 產生每日任務完成數長條圖資料
 */
export function generateDailyBarChartData(
  dailyStats: DailyStats[]
): BarChartData {
  const dayNames = ['日', '一', '二', '三', '四', '五', '六']
  const labels = dailyStats.map(d => {
    // 使用本地時區解析日期，避免 UTC 偏移
    const [year, month, day] = d.date.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    return `週${dayNames[date.getDay()]} (${month}/${day})`
  })

  return {
    labels,
    datasets: [
      {
        label: '已排程',
        data: dailyStats.map(d => d.scheduledTaskCount),
        backgroundColor: dailyStats.map(() => 'rgba(59, 130, 246, 0.5)'),
      },
      {
        label: '已完成',
        data: dailyStats.map(d => d.completedTaskCount),
        backgroundColor: dailyStats.map(() => 'rgba(34, 197, 94, 0.7)'),
      },
    ],
  }
}

/**
 * 產生優先級分布圓餅圖資料
 */
export function generatePriorityChartData(
  tasksByPriority: WeeklyReport['tasksByPriority']
): BarChartData {
  return {
    labels: ['緊急', '高', '中', '低'],
    datasets: [
      {
        label: '任務數',
        data: [
          tasksByPriority.urgent,
          tasksByPriority.high,
          tasksByPriority.medium,
          tasksByPriority.low,
        ],
        backgroundColor: [
          'rgba(239, 68, 68, 0.7)',   // 紅
          'rgba(249, 115, 22, 0.7)',  // 橙
          'rgba(234, 179, 8, 0.7)',   // 黃
          'rgba(34, 197, 94, 0.7)',   // 綠
        ],
      },
    ],
  }
}

/**
 * 格式化時間（分鐘轉為可讀格式）
 */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} 分鐘`
  }
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (mins === 0) {
    return `${hours} 小時`
  }
  return `${hours} 小時 ${mins} 分鐘`
}

/**
 * 取得報表期間描述
 */
export function getReportPeriodDescription(report: WeeklyReport): string {
  const start = new Date(report.weekStart)
  const end = new Date(report.weekEnd)
  return `${start.getMonth() + 1}/${start.getDate()} - ${end.getMonth() + 1}/${end.getDate()}`
}
