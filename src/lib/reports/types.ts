/**
 * 排程報表資料結構定義
 * S-013: 排程報表（每週排程統計）
 */

// 單日統計
export interface DailyStats {
  date: string // YYYY-MM-DD
  dayOfWeek: number // 0-6 (週日-週六)
  scheduledTaskCount: number // 排程任務數
  completedTaskCount: number // 完成任務數
  totalScheduledMinutes: number // 總排程時間（分鐘）
  totalCompletedMinutes: number // 實際完成時間（分鐘）
  utilizationRate: number // 時間利用率 (0-1)
  completionRate: number // 完成率 (0-1)
}

// 週報表
export interface WeeklyReport {
  weekStart: string // YYYY-MM-DD (週一)
  weekEnd: string // YYYY-MM-DD (週日)
  weekNumber: number // 年度週數
  year: number

  // 總計
  totalScheduledTasks: number
  totalCompletedTasks: number
  totalScheduledMinutes: number
  totalCompletedMinutes: number

  // 平均值
  avgTasksPerDay: number
  avgCompletionRate: number
  avgUtilizationRate: number

  // 每日明細
  dailyStats: DailyStats[]

  // 任務分類統計
  tasksByPriority: {
    urgent: number
    high: number
    medium: number
    low: number
  }

  tasksByProject: {
    projectId: string | null
    projectName: string
    count: number
    completedCount: number
  }[]

  // 最佳表現日
  mostProductiveDay: {
    date: string
    completedTasks: number
    completedMinutes: number
  } | null
}

// 月報表摘要
export interface MonthlyReport {
  month: number // 1-12
  year: number
  monthStart: string // YYYY-MM-DD
  monthEnd: string // YYYY-MM-DD

  // 總計
  totalScheduledTasks: number
  totalCompletedTasks: number
  totalScheduledMinutes: number
  totalCompletedMinutes: number

  // 週統計
  weeklyReports: WeeklyReport[]

  // 趨勢
  completionRateTrend: number[] // 每週完成率陣列
  utilizationRateTrend: number[] // 每週利用率陣列

  // 月度最佳
  bestWeek: {
    weekStart: string
    completionRate: number
  } | null
}

// 報表查詢參數
export interface ReportQueryParams {
  type: 'daily' | 'weekly' | 'monthly'
  startDate?: string // YYYY-MM-DD
  endDate?: string // YYYY-MM-DD
  weekNumber?: number
  month?: number
  year?: number
  projectId?: string
}

// 報表回應
export interface ReportResponse {
  success: boolean
  data?: WeeklyReport | MonthlyReport | DailyStats[]
  error?: string
}

// 圖表資料格式
export interface ChartDataPoint {
  label: string
  value: number
  color?: string
}

export interface BarChartData {
  labels: string[]
  datasets: {
    label: string
    data: number[]
    backgroundColor: string[]
  }[]
}

export interface LineChartData {
  labels: string[]
  datasets: {
    label: string
    data: number[]
    borderColor: string
    fill: boolean
  }[]
}

// 報表摘要卡片資料
export interface ReportSummaryCard {
  title: string
  value: number | string
  unit?: string
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: number // 百分比變化
  icon?: string
}
