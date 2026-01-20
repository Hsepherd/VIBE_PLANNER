'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  CheckCircle2,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  Target,
  Award,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { WeeklyReport, ReportSummaryCard, BarChartData } from '@/lib/reports/types'

// 優先級顏色
const priorityColors = {
  urgent: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-green-500',
}

// 趨勢圖標
function TrendIcon({ trend }: { trend?: 'up' | 'down' | 'neutral' }) {
  if (trend === 'up') return <TrendingUp className="h-4 w-4 text-green-500" />
  if (trend === 'down') return <TrendingDown className="h-4 w-4 text-red-500" />
  return <Minus className="h-4 w-4 text-gray-400" />
}

// 摘要卡片元件
function SummaryCard({ card }: { card: ReportSummaryCard }) {
  const iconMap: Record<string, React.ReactNode> = {
    '✅': <CheckCircle2 className="h-5 w-5 text-green-500" />,
    '📊': <BarChart3 className="h-5 w-5 text-blue-500" />,
    '⏱️': <Clock className="h-5 w-5 text-purple-500" />,
    '📈': <Target className="h-5 w-5 text-orange-500" />,
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {iconMap[card.icon || ''] || <BarChart3 className="h-5 w-5" />}
            <span className="text-sm text-muted-foreground">{card.title}</span>
          </div>
          {card.trend && card.trendValue !== undefined && (
            <div className="flex items-center gap-1">
              <TrendIcon trend={card.trend} />
              <span
                className={`text-xs ${
                  card.trend === 'up'
                    ? 'text-green-500'
                    : card.trend === 'down'
                      ? 'text-red-500'
                      : 'text-gray-400'
                }`}
              >
                {card.trendValue}%
              </span>
            </div>
          )}
        </div>
        <div className="mt-2 text-2xl font-bold">
          {card.value}
          {card.unit && <span className="text-sm font-normal text-muted-foreground ml-1">{card.unit}</span>}
        </div>
      </CardContent>
    </Card>
  )
}

// 每日任務長條圖元件
function DailyBarChart({ data }: { data: BarChartData }) {
  const maxValue = Math.max(
    ...data.datasets.flatMap((d) => d.data),
    1
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          每日任務統計
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {data.labels.map((label, idx) => (
            <div key={label} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{label}</span>
                <span>
                  <span className="text-green-600">{data.datasets[1]?.data[idx] || 0}</span>
                  {' / '}
                  <span className="text-blue-600">{data.datasets[0]?.data[idx] || 0}</span>
                </span>
              </div>
              <div className="flex gap-1 h-4">
                {/* 已排程 */}
                <div
                  className="bg-blue-200 rounded-l transition-all duration-300"
                  style={{
                    width: `${((data.datasets[0]?.data[idx] || 0) / maxValue) * 100}%`,
                  }}
                />
                {/* 已完成 */}
                <div
                  className="bg-green-500 rounded-r transition-all duration-300"
                  style={{
                    width: `${((data.datasets[1]?.data[idx] || 0) / maxValue) * 100}%`,
                    marginLeft: `-${((data.datasets[0]?.data[idx] || 0) / maxValue) * 100}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-200 rounded" />
            已排程
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-500 rounded" />
            已完成
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// 優先級分布元件
function PriorityDistribution({ data }: { data: BarChartData }) {
  const total = data.datasets[0]?.data.reduce((a, b) => a + b, 0) || 0
  const priorityLabels = ['緊急', '高', '中', '低']
  const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500']

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="h-4 w-4" />
          優先級分布
        </CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <div className="text-center text-muted-foreground py-4">本週無任務資料</div>
        ) : (
          <>
            {/* 長條分布 */}
            <div className="flex h-8 rounded-lg overflow-hidden">
              {data.datasets[0]?.data.map((value, idx) => (
                value > 0 && (
                  <div
                    key={priorityLabels[idx]}
                    className={`${colors[idx]} transition-all duration-300`}
                    style={{ width: `${(value / total) * 100}%` }}
                    title={`${priorityLabels[idx]}: ${value} 個`}
                  />
                )
              ))}
            </div>
            {/* 圖例 */}
            <div className="mt-4 grid grid-cols-2 gap-2">
              {priorityLabels.map((label, idx) => (
                <div key={label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 ${colors[idx]} rounded`} />
                    <span className="text-sm text-muted-foreground">{label}</span>
                  </div>
                  <span className="text-sm font-medium">
                    {data.datasets[0]?.data[idx] || 0}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

// 最佳表現卡片
function BestDayCard({ report }: { report: WeeklyReport }) {
  if (!report.mostProductiveDay) {
    return (
      <Card>
        <CardContent className="p-4 text-center text-muted-foreground">
          本週尚無完成任務紀錄
        </CardContent>
      </Card>
    )
  }

  const date = new Date(report.mostProductiveDay.date)
  const dayNames = ['週日', '週一', '週二', '週三', '週四', '週五', '週六']
  const hours = Math.round(report.mostProductiveDay.completedMinutes / 60 * 10) / 10

  return (
    <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-200 dark:border-amber-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Award className="h-4 w-4 text-amber-500" />
          最佳表現日
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-lg font-bold">
          {dayNames[date.getDay()]} ({date.getMonth() + 1}/{date.getDate()})
        </div>
        <div className="mt-1 text-sm text-muted-foreground">
          完成 {report.mostProductiveDay.completedTasks} 個任務
          {hours > 0 && `，共 ${hours} 小時`}
        </div>
      </CardContent>
    </Card>
  )
}

// 專案分布卡片
function ProjectDistribution({ report }: { report: WeeklyReport }) {
  const projects = report.tasksByProject.filter(p => p.count > 0)

  if (projects.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">專案分布</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {projects.map((project) => (
          <div key={project.projectId || 'none'} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="truncate">{project.projectName}</span>
              <span className="text-muted-foreground">
                {project.completedCount}/{project.count}
              </span>
            </div>
            <Progress
              value={(project.completedCount / project.count) * 100}
              className="h-2"
            />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

// 載入骨架
function ReportSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <Skeleton className="h-40" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <Skeleton className="h-40" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// 主頁面
export default function ReportsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [weekStart, setWeekStart] = useState<Date>(() => {
    const today = new Date()
    const dayOfWeek = today.getDay()
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const monday = new Date(today)
    monday.setDate(today.getDate() + mondayOffset)
    monday.setHours(0, 0, 0, 0)
    return monday
  })
  const [report, setReport] = useState<WeeklyReport | null>(null)
  const [summaryCards, setSummaryCards] = useState<ReportSummaryCard[]>([])
  const [dailyChartData, setDailyChartData] = useState<BarChartData | null>(null)
  const [priorityChartData, setPriorityChartData] = useState<BarChartData | null>(null)

  // 本地時區日期格式化
  const formatLocalDate = (date: Date): string => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // 取得報表資料
  const fetchReport = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        weekStart: formatLocalDate(weekStart),
        compare: 'true',
      })

      const res = await fetch(`/api/reports/weekly?${params}`)
      const data = await res.json()

      if (!data.success) {
        throw new Error(data.error || '取得報表失敗')
      }

      setReport(data.report)
      setSummaryCards(data.summaryCards || [])
      setDailyChartData(data.charts?.daily || null)
      setPriorityChartData(data.charts?.priority || null)
    } catch (err) {
      console.error('取得報表失敗:', err)
      setError(err instanceof Error ? err.message : '取得報表失敗')
    } finally {
      setLoading(false)
    }
  }, [weekStart])

  useEffect(() => {
    fetchReport()
  }, [fetchReport])

  // 切換週
  const changeWeek = (delta: number) => {
    const newWeek = new Date(weekStart)
    newWeek.setDate(weekStart.getDate() + delta * 7)
    setWeekStart(newWeek)
  }

  // 回到本週
  const goToCurrentWeek = () => {
    const today = new Date()
    const dayOfWeek = today.getDay()
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const monday = new Date(today)
    monday.setDate(today.getDate() + mondayOffset)
    monday.setHours(0, 0, 0, 0)
    setWeekStart(monday)
  }

  // 週範圍顯示
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  const weekLabel = `${weekStart.getMonth() + 1}/${weekStart.getDate()} - ${weekEnd.getMonth() + 1}/${weekEnd.getDate()}`

  // 是否為本週
  const isCurrentWeek = (() => {
    const today = new Date()
    const dayOfWeek = today.getDay()
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const currentMonday = new Date(today)
    currentMonday.setDate(today.getDate() + mondayOffset)
    currentMonday.setHours(0, 0, 0, 0)
    return weekStart.getTime() === currentMonday.getTime()
  })()

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/50">
      <div className="p-6 space-y-6">
        {/* 頁首 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">📊 排程報表</h1>
          </div>
          <div className="flex items-center gap-2">
            {!isCurrentWeek && (
              <Button variant="outline" size="sm" onClick={goToCurrentWeek}>
                回到本週
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => router.push('/calendar')}>
              <Calendar className="h-4 w-4 mr-2" />
              行事曆
            </Button>
          </div>
        </div>

        {/* 週選擇器 */}
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon" onClick={() => changeWeek(-1)}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div className="text-center">
                <div className="text-lg font-semibold">{weekLabel}</div>
                <div className="text-sm text-muted-foreground">
                  {weekStart.getFullYear()} 年第 {report?.weekNumber || '--'} 週
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => changeWeek(1)}>
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 錯誤訊息 */}
        {error && (
          <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30">
            <CardContent className="p-4 text-red-600 dark:text-red-400">
              {error}
            </CardContent>
          </Card>
        )}

        {/* 載入中 */}
        {loading ? (
          <ReportSkeleton />
        ) : report ? (
          <>
            {/* 摘要卡片 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {summaryCards.map((card, idx) => (
                <SummaryCard key={idx} card={card} />
              ))}
            </div>

            {/* 圖表區 */}
            <div className="grid lg:grid-cols-2 gap-4">
              {dailyChartData && <DailyBarChart data={dailyChartData} />}
              {priorityChartData && <PriorityDistribution data={priorityChartData} />}
            </div>

            {/* 詳細資訊 */}
            <div className="grid lg:grid-cols-2 gap-4">
              <BestDayCard report={report} />
              <ProjectDistribution report={report} />
            </div>

            {/* 本週完成率進度條 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">本週完成進度</CardTitle>
                <CardDescription>
                  {report.totalCompletedTasks} / {report.totalScheduledTasks} 任務已完成
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Progress
                  value={report.totalScheduledTasks > 0
                    ? (report.totalCompletedTasks / report.totalScheduledTasks) * 100
                    : 0}
                  className="h-4"
                />
                <div className="mt-2 text-right text-sm text-muted-foreground">
                  {report.totalScheduledTasks > 0
                    ? Math.round((report.totalCompletedTasks / report.totalScheduledTasks) * 100)
                    : 0}%
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              無法載入報表資料
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
