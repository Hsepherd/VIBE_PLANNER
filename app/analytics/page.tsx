'use client'

import { useState, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useSupabaseTasks, type Task } from '@/lib/useSupabaseTasks'
import { useSupabaseProjects } from '@/lib/useSupabaseProjects'
import { useCategoryMappings } from '@/lib/useCategoryMappings'
import {
  format,
  startOfDay,
  startOfWeek,
  endOfWeek,
  subDays,
  subWeeks,
  isWithinInterval,
  eachDayOfInterval,
  differenceInMinutes,
  isSameDay,
} from 'date-fns'
import { zhTW } from 'date-fns/locale'
import {
  CheckCircle2,
  Calendar,
  TrendingUp,
  Target,
  Loader2,
  Flame,
  Trophy,
  Zap,
  Star,
  ArrowUp,
  ArrowDown,
  Clock,
  PieChart,
  Briefcase,
  Sparkles,
  Settings,
  Users,
  Edit3,
  BookOpen,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart as RechartsPie,
  Pie,
} from 'recharts'

// 每日目標（可以之後做成可設定的）
const DAILY_GOAL = 5
const WEEKLY_GOAL = 25

// 任務類別定義
type TaskCategory = '銷售業務' | '內部優化' | '自我提升' | '客戶服務' | '行政庶務' | '其他'

interface CategoryConfig {
  name: TaskCategory
  color: string
  icon: typeof Briefcase
}

const CATEGORIES: CategoryConfig[] = [
  { name: '銷售業務', color: '#10B981', icon: TrendingUp },
  { name: '內部優化', color: '#3B82F6', icon: Settings },
  { name: '自我提升', color: '#8B5CF6', icon: Sparkles },
  { name: '客戶服務', color: '#F59E0B', icon: Users },
  { name: '行政庶務', color: '#6B7280', icon: Briefcase },
  { name: '其他', color: '#9CA3AF', icon: CheckCircle2 },
]

// 自訂柱狀圖 Tooltip（移到組件外部避免每次 render 重新創建）
interface DayData {
  day: string
  total: number
  reachedGoal: boolean
  fullDate: string
}

function CustomBarTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: DayData }> }) {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="bg-white border rounded-lg shadow-lg p-3 text-sm">
        <p className="font-medium">{data.fullDate}</p>
        <p className="text-muted-foreground">完成 {data.total} 項任務</p>
        {data.reachedGoal && (
          <p className="text-green-600 flex items-center gap-1 mt-1">
            <CheckCircle2 className="h-3 w-3" /> 達成目標！
          </p>
        )}
      </div>
    )
  }
  return null
}

// 計算任務時間（分鐘）
function getTaskDuration(task: Task): number {
  if (task.startDate && task.dueDate) {
    const minutes = differenceInMinutes(new Date(task.dueDate), new Date(task.startDate))
    // 如果時間差異很大（超過 8 小時），可能是跨天任務，預設 1 小時
    if (minutes > 480) return 60
    if (minutes < 0) return 30 // 異常情況預設 30 分鐘
    return Math.max(15, minutes) // 最少 15 分鐘
  }
  // 沒有時間的任務預設 30 分鐘
  return 30
}

// 格式化時間
function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} 分鐘`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (mins === 0) return `${hours} 小時`
  return `${hours} 小時 ${mins} 分`
}

// 專案顏色
const PROJECT_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
]

export default function AnalyticsPage() {
  const { tasks, isLoading } = useSupabaseTasks()
  const { projects } = useSupabaseProjects()
  const { classifyTask, learnCategory, mappings } = useCategoryMappings()
  const [activeTab, setActiveTab] = useState<'daily' | 'weekly'>('daily')
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)

  const today = startOfDay(new Date())
  const thisWeekStart = startOfWeek(today, { locale: zhTW })
  const thisWeekEnd = endOfWeek(today, { locale: zhTW })

  // 今日完成的任務
  const todayCompleted = useMemo(() => {
    return tasks.filter(task => {
      if (task.status !== 'completed' || !task.completedAt) return false
      return isSameDay(new Date(task.completedAt), today)
    })
  }, [tasks, today])

  // 本週完成的任務
  const weekCompleted = useMemo(() => {
    return tasks.filter(task => {
      if (task.status !== 'completed' || !task.completedAt) return false
      return isWithinInterval(new Date(task.completedAt), { start: thisWeekStart, end: thisWeekEnd })
    })
  }, [tasks, thisWeekStart, thisWeekEnd])

  // 總完成任務數
  const totalCompleted = useMemo(() => {
    return tasks.filter(task => task.status === 'completed').length
  }, [tasks])

  // 計算連續達標天數（streak）
  const streak = useMemo(() => {
    let currentStreak = 0
    let checkDate = subDays(today, 1) // 從昨天開始檢查

    // 先檢查今天是否達標
    if (todayCompleted.length >= DAILY_GOAL) {
      currentStreak = 1
      checkDate = subDays(today, 1)
    } else {
      // 今天還沒達標，從昨天開始算
      checkDate = subDays(today, 1)
    }

    // 往前檢查每一天
    for (let i = 0; i < 365; i++) {
      const dayTasks = tasks.filter(task => {
        if (task.status !== 'completed' || !task.completedAt) return false
        return isSameDay(new Date(task.completedAt), checkDate)
      })

      if (dayTasks.length >= DAILY_GOAL) {
        currentStreak++
        checkDate = subDays(checkDate, 1)
      } else {
        break
      }
    }

    return currentStreak
  }, [tasks, today, todayCompleted])

  // 最長連續天數
  const longestStreak = useMemo(() => {
    let longest = 0
    let current = 0
    const last90Days = eachDayOfInterval({
      start: subDays(today, 90),
      end: today
    })

    for (const day of last90Days) {
      const dayTasks = tasks.filter(task => {
        if (task.status !== 'completed' || !task.completedAt) return false
        return isSameDay(new Date(task.completedAt), day)
      })

      if (dayTasks.length >= DAILY_GOAL) {
        current++
        longest = Math.max(longest, current)
      } else {
        current = 0
      }
    }

    return longest
  }, [tasks, today])

  // 過去 7 天每日完成數據（用於柱狀圖）
  const last7DaysData = useMemo(() => {
    const days = eachDayOfInterval({
      start: subDays(today, 6),
      end: today
    })

    return days.map(day => {
      const dayTasks = tasks.filter(task => {
        if (task.status !== 'completed' || !task.completedAt) return false
        return isSameDay(new Date(task.completedAt), day)
      })

      // 依專案分組
      const byProject: Record<string, number> = {}
      dayTasks.forEach(task => {
        const projectId = task.projectId || 'no-project'
        byProject[projectId] = (byProject[projectId] || 0) + 1
      })

      return {
        date: format(day, 'E', { locale: zhTW }),
        fullDate: format(day, 'M/d'),
        total: dayTasks.length,
        isToday: isSameDay(day, today),
        reachedGoal: dayTasks.length >= DAILY_GOAL,
        byProject,
      }
    })
  }, [tasks, today])

  // 過去 4 週每週完成數據
  const last4WeeksData = useMemo(() => {
    const weeks = []
    for (let i = 3; i >= 0; i--) {
      const weekStart = subWeeks(thisWeekStart, i)
      const weekEnd = endOfWeek(weekStart, { locale: zhTW })

      const weekTasks = tasks.filter(task => {
        if (task.status !== 'completed' || !task.completedAt) return false
        return isWithinInterval(new Date(task.completedAt), { start: weekStart, end: weekEnd })
      })

      weeks.push({
        label: i === 0 ? '本週' : `${i}週前`,
        total: weekTasks.length,
        reachedGoal: weekTasks.length >= WEEKLY_GOAL,
      })
    }
    return weeks
  }, [tasks, thisWeekStart])

  // 處理分類修正（學習功能）
  const handleCategoryChange = useCallback(async (task: Task, newCategory: string) => {
    try {
      // 學習這個任務標題對應到新分類
      await learnCategory(task.title, newCategory, 'exact')
      setEditingTaskId(null)
    } catch (err) {
      console.error('儲存分類失敗:', err)
    }
  }, [learnCategory])

  // 今日任務類別分布（使用知識庫分類）
  const todayCategoryStats = useMemo(() => {
    const stats: Record<TaskCategory, { count: number; minutes: number; tasks: Array<Task & { category: string }> }> = {
      '銷售業務': { count: 0, minutes: 0, tasks: [] },
      '內部優化': { count: 0, minutes: 0, tasks: [] },
      '自我提升': { count: 0, minutes: 0, tasks: [] },
      '客戶服務': { count: 0, minutes: 0, tasks: [] },
      '行政庶務': { count: 0, minutes: 0, tasks: [] },
      '其他': { count: 0, minutes: 0, tasks: [] },
    }

    todayCompleted.forEach(task => {
      const category = classifyTask(task) as TaskCategory
      const duration = getTaskDuration(task)
      stats[category].count++
      stats[category].minutes += duration
      stats[category].tasks.push({ ...task, category })
    })

    return stats
  }, [todayCompleted, classifyTask, mappings])

  // 本週任務類別分布
  const weekCategoryStats = useMemo(() => {
    const stats: Record<TaskCategory, { count: number; minutes: number }> = {
      '銷售業務': { count: 0, minutes: 0 },
      '內部優化': { count: 0, minutes: 0 },
      '自我提升': { count: 0, minutes: 0 },
      '客戶服務': { count: 0, minutes: 0 },
      '行政庶務': { count: 0, minutes: 0 },
      '其他': { count: 0, minutes: 0 },
    }

    weekCompleted.forEach(task => {
      const category = classifyTask(task) as TaskCategory
      const duration = getTaskDuration(task)
      stats[category].count++
      stats[category].minutes += duration
    })

    return stats
  }, [weekCompleted, classifyTask, mappings])

  // 今日總時間
  const todayTotalMinutes = useMemo(() => {
    return todayCompleted.reduce((sum, task) => sum + getTaskDuration(task), 0)
  }, [todayCompleted])

  // 本週總時間
  const weekTotalMinutes = useMemo(() => {
    return weekCompleted.reduce((sum, task) => sum + getTaskDuration(task), 0)
  }, [weekCompleted])

  // 類別圓餅圖數據
  const categoryPieData = useMemo(() => {
    const data = activeTab === 'daily' ? todayCategoryStats : weekCategoryStats
    return CATEGORIES
      .filter(cat => data[cat.name].count > 0)
      .map(cat => ({
        name: cat.name,
        value: data[cat.name].count,
        minutes: data[cat.name].minutes,
        color: cat.color,
      }))
  }, [activeTab, todayCategoryStats, weekCategoryStats])

  // 專案分布（本週）
  const projectDistribution = useMemo(() => {
    const distribution: Record<string, { name: string; count: number; color: string }> = {}

    weekCompleted.forEach(task => {
      const projectId = task.projectId || 'no-project'
      if (!distribution[projectId]) {
        const project = projects.find(p => p.id === projectId)
        const colorIndex = Object.keys(distribution).length % PROJECT_COLORS.length
        distribution[projectId] = {
          name: project?.name || '無專案',
          count: 0,
          color: PROJECT_COLORS[colorIndex],
        }
      }
      distribution[projectId].count++
    })

    return Object.values(distribution).sort((a, b) => b.count - a.count)
  }, [weekCompleted, projects])

  // 與上週比較
  const weekComparison = useMemo(() => {
    const lastWeekStart = subWeeks(thisWeekStart, 1)
    const lastWeekEnd = endOfWeek(lastWeekStart, { locale: zhTW })

    const lastWeekTasks = tasks.filter(task => {
      if (task.status !== 'completed' || !task.completedAt) return false
      return isWithinInterval(new Date(task.completedAt), { start: lastWeekStart, end: lastWeekEnd })
    })

    const diff = weekCompleted.length - lastWeekTasks.length
    const percentage = lastWeekTasks.length > 0
      ? Math.round((diff / lastWeekTasks.length) * 100)
      : weekCompleted.length > 0 ? 100 : 0

    return { diff, percentage, lastWeek: lastWeekTasks.length }
  }, [tasks, weekCompleted, thisWeekStart])

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const dailyProgress = Math.min(100, Math.round((todayCompleted.length / DAILY_GOAL) * 100))
  const weeklyProgress = Math.min(100, Math.round((weekCompleted.length / WEEKLY_GOAL) * 100))

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-gray-50/50">
      {/* 頂部 */}
      <div className="shrink-0 bg-background border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">生產力</h1>
            <p className="text-sm text-muted-foreground">追蹤你的任務完成進度</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Trophy className="h-4 w-4 text-amber-500" />
            <span>總完成 <span className="font-semibold text-foreground">{totalCompleted}</span> 項任務</span>
          </div>
        </div>
      </div>

      {/* 主要內容 */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6 max-w-4xl mx-auto">

          {/* 核心指標區 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 今日進度 */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Target className="h-5 w-5 text-blue-600" />
                    </div>
                    <span className="font-medium">今日目標</span>
                  </div>
                  <span className="text-2xl font-bold">{todayCompleted.length}/{DAILY_GOAL}</span>
                </div>
                <Progress value={dailyProgress} className="h-2" />
                <p className="text-xs text-muted-foreground mt-2">
                  {dailyProgress >= 100 ? '已達成目標！' : `還需完成 ${DAILY_GOAL - todayCompleted.length} 項`}
                </p>
              </CardContent>
            </Card>

            {/* 本週進度 */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <Calendar className="h-5 w-5 text-green-600" />
                    </div>
                    <span className="font-medium">本週目標</span>
                  </div>
                  <span className="text-2xl font-bold">{weekCompleted.length}/{WEEKLY_GOAL}</span>
                </div>
                <Progress value={weeklyProgress} className="h-2" />
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-muted-foreground">
                    {weeklyProgress >= 100 ? '已達成目標！' : `還需完成 ${WEEKLY_GOAL - weekCompleted.length} 項`}
                  </p>
                  {weekComparison.diff !== 0 && (
                    <div className={`flex items-center gap-1 text-xs ${weekComparison.diff > 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {weekComparison.diff > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                      <span>較上週 {weekComparison.diff > 0 ? '+' : ''}{weekComparison.diff}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 連續天數 */}
            <Card className={streak >= 7 ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200' : ''}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg ${streak >= 7 ? 'bg-amber-200' : 'bg-orange-100'}`}>
                      <Flame className={`h-5 w-5 ${streak >= 7 ? 'text-amber-600' : 'text-orange-500'}`} />
                    </div>
                    <span className="font-medium">連續達標</span>
                  </div>
                  <span className="text-2xl font-bold">{streak} 天</span>
                </div>
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-amber-500" />
                  <span className="text-sm text-muted-foreground">最長紀錄：{longestStreak} 天</span>
                </div>
                {streak >= 7 && (
                  <Badge className="mt-2 bg-amber-100 text-amber-700 hover:bg-amber-100">
                    <Zap className="h-3 w-3 mr-1" /> 保持火熱！
                  </Badge>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Tab 切換 */}
          <div className="flex gap-2">
            <Button
              variant={activeTab === 'daily' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('daily')}
            >
              每日
            </Button>
            <Button
              variant={activeTab === 'weekly' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('weekly')}
            >
              每週
            </Button>
          </div>

          {/* 圖表區 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {activeTab === 'daily' ? '過去 7 天' : '過去 4 週'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={activeTab === 'daily' ? last7DaysData : last4WeeksData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <XAxis
                      dataKey={activeTab === 'daily' ? 'date' : 'label'}
                      tick={{ fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    {activeTab === 'daily' && <Tooltip content={<CustomBarTooltip />} />}
                    {activeTab !== 'daily' && <Tooltip />}
                    <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                      {(activeTab === 'daily' ? last7DaysData : last4WeeksData).map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.reachedGoal ? '#10B981' : '#E5E7EB'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {/* 目標線說明 */}
              <div className="flex items-center justify-center gap-4 mt-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-emerald-500" />
                  <span>達成目標</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-gray-200" />
                  <span>未達成</span>
                </div>
                <span>目標：{activeTab === 'daily' ? `${DAILY_GOAL} 項/天` : `${WEEKLY_GOAL} 項/週`}</span>
              </div>
            </CardContent>
          </Card>

          {/* 時間追蹤 + 類別分布 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 時間統計卡片 */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {activeTab === 'daily' ? '今日時間' : '本週時間'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary mb-4">
                  {formatDuration(activeTab === 'daily' ? todayTotalMinutes : weekTotalMinutes)}
                </div>
                <div className="space-y-2">
                  {CATEGORIES.filter(cat => {
                    const stats = activeTab === 'daily' ? todayCategoryStats : weekCategoryStats
                    return stats[cat.name].minutes > 0
                  }).map(cat => {
                    const stats = activeTab === 'daily' ? todayCategoryStats : weekCategoryStats
                    const totalMins = activeTab === 'daily' ? todayTotalMinutes : weekTotalMinutes
                    const percentage = totalMins > 0 ? Math.round((stats[cat.name].minutes / totalMins) * 100) : 0
                    const Icon = cat.icon
                    return (
                      <div key={cat.name} className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm flex-1 truncate">{cat.name}</span>
                        <span className="text-sm text-muted-foreground">{formatDuration(stats[cat.name].minutes)}</span>
                        <span className="text-xs text-muted-foreground w-10 text-right">{percentage}%</span>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* 類別分布圓餅圖 */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <PieChart className="h-4 w-4" />
                  {activeTab === 'daily' ? '今日類別' : '本週類別'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {categoryPieData.length > 0 ? (
                  <div className="h-[180px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPie>
                        <Pie
                          data={categoryPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={70}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {categoryPieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload
                              return (
                                <div className="bg-white border rounded-lg shadow-lg p-2 text-sm">
                                  <p className="font-medium">{data.name}</p>
                                  <p className="text-muted-foreground">{data.value} 項任務</p>
                                  <p className="text-muted-foreground">{formatDuration(data.minutes)}</p>
                                </div>
                              )
                            }
                            return null
                          }}
                        />
                      </RechartsPie>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">
                    尚無數據
                  </div>
                )}
                {/* 圖例 */}
                <div className="flex flex-wrap gap-3 justify-center mt-2">
                  {categoryPieData.map((cat, index) => (
                    <div key={index} className="flex items-center gap-1.5 text-xs">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                      <span>{cat.name}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 今日任務詳情（依類別）- 支援手動修正 */}
          {activeTab === 'daily' && todayCompleted.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  今日完成任務 - 依類別
                  <Badge variant="outline" className="ml-2 text-xs font-normal">
                    <BookOpen className="h-3 w-3 mr-1" />
                    點擊分類可修正
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {CATEGORIES.filter(cat => todayCategoryStats[cat.name].count > 0).map(cat => {
                    const Icon = cat.icon
                    return (
                      <div key={cat.name}>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                          <Icon className="h-4 w-4" style={{ color: cat.color }} />
                          <span className="font-medium">{cat.name}</span>
                          <Badge variant="secondary" className="ml-auto">
                            {todayCategoryStats[cat.name].count} 項 · {formatDuration(todayCategoryStats[cat.name].minutes)}
                          </Badge>
                        </div>
                        <div className="ml-5 space-y-1.5">
                          {todayCategoryStats[cat.name].tasks.map(task => (
                            <div key={task.id} className="flex items-center gap-2 text-sm p-2 rounded-lg bg-muted/30 group">
                              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                              <span className="flex-1 truncate">{task.title}</span>

                              {/* 分類修正選單 */}
                              <Popover
                                open={editingTaskId === task.id}
                                onOpenChange={(open) => setEditingTaskId(open ? task.id : null)}
                              >
                                <PopoverTrigger asChild>
                                  <button
                                    className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full transition-colors shrink-0"
                                    style={{
                                      backgroundColor: `${cat.color}20`,
                                      color: cat.color,
                                    }}
                                  >
                                    {cat.name}
                                    <Edit3 className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent className="w-48 p-2" align="end">
                                  <div className="text-xs font-medium text-muted-foreground mb-2">
                                    修正分類
                                  </div>
                                  <div className="space-y-1">
                                    {CATEGORIES.map(c => (
                                      <button
                                        key={c.name}
                                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-muted transition-colors ${
                                          c.name === cat.name ? 'bg-muted' : ''
                                        }`}
                                        onClick={() => handleCategoryChange(task, c.name)}
                                      >
                                        <div
                                          className="w-2.5 h-2.5 rounded-full"
                                          style={{ backgroundColor: c.color }}
                                        />
                                        <span>{c.name}</span>
                                        {c.name === cat.name && (
                                          <CheckCircle2 className="h-3 w-3 ml-auto text-green-500" />
                                        )}
                                      </button>
                                    ))}
                                  </div>
                                  <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
                                    系統會記住此分類
                                  </div>
                                </PopoverContent>
                              </Popover>

                              <span className="text-xs text-muted-foreground shrink-0">
                                {formatDuration(getTaskDuration(task))}
                              </span>
                              {task.completedAt && (
                                <span className="text-xs text-muted-foreground shrink-0">
                                  {format(new Date(task.completedAt), 'HH:mm')}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* 知識庫統計 */}
                {mappings.length > 0 && (
                  <div className="mt-4 pt-4 border-t flex items-center gap-2 text-xs text-muted-foreground">
                    <BookOpen className="h-3.5 w-3.5" />
                    <span>已學習 {mappings.length} 個分類規則</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* 專案分布 */}
          {projectDistribution.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">本週專案分布</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {projectDistribution.map((project, index) => {
                    const percentage = Math.round((project.count / weekCompleted.length) * 100)
                    return (
                      <div key={index} className="flex items-center gap-3">
                        <div
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: project.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium truncate">{project.name}</span>
                            <span className="text-sm text-muted-foreground">{project.count} 項</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${percentage}%`, backgroundColor: project.color }}
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* 專案比例視覺化 */}
                <div className="mt-4 space-y-2">
                  <div className="flex justify-center">
                    <div className="flex items-center gap-1">
                      {projectDistribution.slice(0, 5).map((project, index) => {
                        const percentage = (project.count / weekCompleted.length) * 100
                        return (
                          <div
                            key={index}
                            className="h-8 rounded-sm"
                            style={{
                              width: `${Math.max(percentage * 2, 8)}px`,
                              backgroundColor: project.color,
                            }}
                            title={`${project.name}: ${project.count} 項`}
                          />
                        )
                      })}
                    </div>
                  </div>
                  {/* 圖例說明 */}
                  <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
                    {projectDistribution.slice(0, 5).map((project, index) => (
                      <div key={index} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <div
                          className="w-2.5 h-2.5 rounded-sm"
                          style={{ backgroundColor: project.color }}
                        />
                        <span>{project.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 最近完成的任務 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>今日完成</span>
                <Badge variant="secondary">{todayCompleted.length} 項</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {todayCompleted.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>今天還沒有完成任務</p>
                  <p className="text-xs mt-1">完成 {DAILY_GOAL} 項任務來達成每日目標！</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {todayCompleted.map((task) => {
                    const project = projects.find(p => p.id === task.projectId)
                    const projectColor = project
                      ? PROJECT_COLORS[projects.indexOf(project) % PROJECT_COLORS.length]
                      : '#6B7280'

                    return (
                      <div
                        key={task.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50"
                      >
                        <div
                          className="w-1 h-8 rounded-full shrink-0"
                          style={{ backgroundColor: projectColor }}
                        />
                        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{task.title}</p>
                          {project && (
                            <p className="text-xs text-muted-foreground">{project.name}</p>
                          )}
                        </div>
                        {task.completedAt && (
                          <span className="text-xs text-muted-foreground shrink-0">
                            {format(new Date(task.completedAt), 'HH:mm')}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  )
}
