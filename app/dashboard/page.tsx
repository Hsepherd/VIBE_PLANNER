'use client'

import { useState, useMemo, ReactNode, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { useSupabaseTasks, type Task } from '@/lib/useSupabaseTasks'
import { useSupabaseProjects } from '@/lib/useSupabaseProjects'
import type { Project } from '@/lib/useSupabaseProjects'
import { TaskDetailDialog } from '@/components/task/TaskDetailDialog'
import {
  format,
  isToday,
  isTomorrow,
  isThisWeek,
  isPast,
  addDays,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
} from 'date-fns'
import { zhTW } from 'date-fns/locale'
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  TrendingUp,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Edit3,
  X,
  ChevronDown,
  Circle,
  Flag,
} from 'lucide-react'
import Link from 'next/link'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// 優先級配置
const priorityConfig = {
  low: { label: '低', color: 'bg-gray-100 text-gray-600' },
  medium: { label: '中', color: 'bg-blue-100 text-blue-600' },
  high: { label: '高', color: 'bg-orange-100 text-orange-600' },
  urgent: { label: '緊急', color: 'bg-red-100 text-red-600' },
}

// 狀態配置
const statusConfig: Record<string, { label: string; color: string; icon: typeof Circle }> = {
  pending: { label: '待處理', color: 'text-gray-500', icon: Circle },
  in_progress: { label: '進行中', color: 'text-blue-500', icon: Clock },
  completed: { label: '已完成', color: 'text-green-500', icon: CheckCircle2 },
  cancelled: { label: '已取消', color: 'text-gray-400', icon: Circle },
  on_hold: { label: '暫停', color: 'text-yellow-500', icon: Clock },
}

// 區塊類型定義
type WidgetId = 'overdue' | 'today' | 'upcoming' | 'projects' | 'calendar' | 'calendarTasks'

interface WidgetConfig {
  id: WidgetId
  title: string
  colSpan: 1 | 2
  visible: boolean
}

// 預設區塊配置
const defaultWidgets: WidgetConfig[] = [
  { id: 'overdue', title: '過期任務', colSpan: 2, visible: true },
  { id: 'today', title: '今日任務', colSpan: 1, visible: true },
  { id: 'upcoming', title: '即將到期', colSpan: 1, visible: true },
  { id: 'projects', title: '專案進度', colSpan: 2, visible: true },
  { id: 'calendar', title: '行事曆', colSpan: 2, visible: true },
]

// 可拖曳的區塊容器
function SortableWidget({
  id,
  children,
  colSpan,
  isEditMode,
}: {
  id: string
  children: ReactNode
  colSpan: 1 | 2
  isEditMode: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${colSpan === 2 ? 'lg:col-span-2' : ''} ${isEditMode ? 'relative' : ''}`}
    >
      {isEditMode && (
        <div
          {...attributes}
          {...listeners}
          className="absolute -top-2 -left-2 z-10 p-1 rounded bg-primary text-primary-foreground cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </div>
      )}
      {children}
    </div>
  )
}

export default function DashboardPage() {
  // 使用 Supabase 同步的任務資料
  const { tasks, completeTask, updateTask, isLoading, refresh: refreshTasks } = useSupabaseTasks()
  // 使用 Supabase 同步的專案資料
  const { projects: rawProjects, loading: projectsLoading } = useSupabaseProjects()

  // 專案排序（從 localStorage 載入）
  const [projectOrder, setProjectOrder] = useState<string[]>([])
  // 展開的專案
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set())
  // 選中的任務（用於 TaskDetailDialog）
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)

  // 初始化專案順序
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('project-order')
      if (saved) {
        try {
          setProjectOrder(JSON.parse(saved))
        } catch {
          // ignore
        }
      }
    }
  }, [])

  // 當專案列表變化時，更新排序
  useEffect(() => {
    if (rawProjects.length > 0) {
      setProjectOrder(prev => {
        const existingIds = new Set(prev)
        const newIds = rawProjects
          .filter(p => !existingIds.has(p.id))
          .map(p => p.id)
        if (newIds.length > 0) {
          const updated = [...newIds, ...prev]
          localStorage.setItem('project-order', JSON.stringify(updated))
          return updated
        }
        const validIds = new Set(rawProjects.map(p => p.id))
        const cleaned = prev.filter(id => validIds.has(id))
        if (cleaned.length !== prev.length) {
          localStorage.setItem('project-order', JSON.stringify(cleaned))
          return cleaned
        }
        return prev
      })
    }
  }, [rawProjects])

  // 根據排序順序排列專案
  const projects = [...rawProjects].sort((a, b) => {
    const aIndex = projectOrder.indexOf(a.id)
    const bIndex = projectOrder.indexOf(b.id)
    if (aIndex === -1 && bIndex === -1) return 0
    if (aIndex === -1) return 1
    if (bIndex === -1) return -1
    return aIndex - bIndex
  })

  // 編輯模式
  const [isEditMode, setIsEditMode] = useState(false)

  // 區塊排序配置（使用 lazy initialization 從 localStorage 載入）
  const [widgets, setWidgets] = useState<WidgetConfig[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dashboard-layout')
      if (saved) {
        try {
          return JSON.parse(saved)
        } catch {
          // ignore
        }
      }
    }
    return defaultWidgets
  })

  // 儲存配置
  const saveLayout = () => {
    localStorage.setItem('dashboard-layout', JSON.stringify(widgets))
    setIsEditMode(false)
  }

  // 行事曆狀態
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  // 統計資料
  const stats = {
    pending: tasks.filter((t: Task) => t.status === 'pending').length,
    inProgress: tasks.filter((t: Task) => t.status === 'in_progress').length,
    completed: tasks.filter((t: Task) => t.status === 'completed').length,
    urgent: tasks.filter((t: Task) => t.priority === 'urgent' && t.status !== 'completed').length,
  }

  // 今日任務
  const todayTasks = tasks.filter((t: Task) => {
    if (t.status === 'completed') return false
    if (!t.dueDate) return false
    return isToday(new Date(t.dueDate))
  })

  // 即將到期（7天內）
  const upcomingTasks = tasks
    .filter((t: Task) => {
      if (t.status === 'completed') return false
      if (!t.dueDate) return false
      const due = new Date(t.dueDate)
      return !isPast(due) && due <= addDays(new Date(), 7)
    })
    .sort((a: Task, b: Task) => {
      if (!a.dueDate || !b.dueDate) return 0
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    })
    .slice(0, 5)

  // 過期任務
  const overdueTasks = tasks.filter((t: Task) => {
    if (t.status === 'completed') return false
    if (!t.dueDate) return false
    return isPast(new Date(t.dueDate)) && !isToday(new Date(t.dueDate))
  })

  // 格式化日期
  const formatDueDate = (date: Date) => {
    const d = new Date(date)
    if (isToday(d)) return '今天'
    if (isTomorrow(d)) return '明天'
    if (isThisWeek(d)) return format(d, 'EEEE', { locale: zhTW })
    return format(d, 'M/d', { locale: zhTW })
  }

  // 優先級顏色
  const priorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'destructive'
      case 'high': return 'default'
      case 'medium': return 'secondary'
      default: return 'outline'
    }
  }

  // 行事曆：取得某天的任務
  const getTasksForDate = (date: Date) => {
    return tasks.filter((task: Task) => {
      if (!task.dueDate) return false
      return isSameDay(new Date(task.dueDate), date)
    })
  }

  // 行事曆：生成日曆格子
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 })
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 })
    const days: Date[] = []
    let day = startDate
    while (day <= endDate) {
      days.push(day)
      day = addDays(day, 1)
    }
    return days
  }, [currentMonth])

  const priorityDotColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500'
      case 'high': return 'bg-orange-500'
      case 'medium': return 'bg-yellow-500'
      default: return 'bg-green-500'
    }
  }

  const selectedDateTasks = selectedDate ? getTasksForDate(selectedDate) : []

  // 計算專案統計
  const getProjectStats = (projectId: string) => {
    const projectTasks = tasks.filter((t: Task) => t.projectId === projectId)
    const completed = projectTasks.filter((t: Task) => t.status === 'completed').length
    const inProgress = projectTasks.filter((t: Task) => t.status === 'in_progress').length
    const pending = projectTasks.filter((t: Task) => t.status === 'pending').length
    const total = projectTasks.length
    return {
      completed,
      inProgress,
      pending,
      total,
      progress: total > 0 ? Math.round((completed / total) * 100) : 0,
    }
  }

  // 取得專案的任務列表
  const getProjectTasks = (projectId: string) => {
    return tasks
      .filter((t: Task) => t.projectId === projectId)
      .sort((a, b) => {
        const statusOrder: Record<string, number> = { pending: 0, in_progress: 1, on_hold: 2, completed: 3, cancelled: 4 }
        const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 }
        const statusDiff = (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99)
        if (statusDiff !== 0) return statusDiff
        return (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99)
      })
  }

  // 切換專案展開/收合
  const toggleProjectExpand = (projectId: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev)
      if (next.has(projectId)) {
        next.delete(projectId)
      } else {
        next.add(projectId)
      }
      return next
    })
  }

  // 快速完成/取消完成任務
  const handleToggleComplete = async (task: Task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed'
    try {
      await updateTask(task.id, {
        status: newStatus,
        completedAt: newStatus === 'completed' ? new Date() : undefined,
      })
      refreshTasks()
    } catch (err) {
      console.error('更新任務狀態失敗:', err)
    }
  }

  // 處理任務更新
  const handleTaskUpdate = async (taskId: string, updates: Partial<Task>) => {
    try {
      await updateTask(taskId, updates)
      refreshTasks()
    } catch (err) {
      console.error('更新任務失敗:', err)
    }
  }

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setWidgets((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id)
        const newIndex = items.findIndex((i) => i.id === over.id)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  // 渲染各區塊內容
  const renderWidget = (widget: WidgetConfig) => {
    switch (widget.id) {
      case 'overdue':
        if (overdueTasks.length === 0) return null
        return (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                過期任務 ({overdueTasks.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {overdueTasks.map((task: Task) => (
                  <div key={task.id} className="flex items-center justify-between p-3 rounded-lg bg-destructive/10">
                    <div>
                      <p className="font-medium">{task.title}</p>
                      <p className="text-sm text-muted-foreground">
                        截止日：{task.dueDate && format(new Date(task.dueDate), 'M/d')}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => completeTask(task.id)}>
                      <Check className="h-4 w-4 mr-1" />完成
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )

      case 'today':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                今日任務 ({todayTasks.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {todayTasks.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">今天沒有待辦任務 🎉</p>
              ) : (
                <div className="space-y-2">
                  {todayTasks.map((task: Task) => (
                    <div key={task.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2">
                        <Badge variant={priorityColor(task.priority) as "default" | "secondary" | "destructive" | "outline"}>
                          {task.priority}
                        </Badge>
                        <span>{task.title}</span>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => completeTask(task.id)}>
                        <Check className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )

      case 'upcoming':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                即將到期
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingTasks.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">7 天內沒有任務到期</p>
              ) : (
                <div className="space-y-2">
                  {upcomingTasks.map((task: Task) => (
                    <div key={task.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div>
                        <p className="font-medium">{task.title}</p>
                        {task.assignee && <p className="text-sm text-muted-foreground">@{task.assignee}</p>}
                      </div>
                      <Badge variant="outline">{task.dueDate && formatDueDate(new Date(task.dueDate))}</Badge>
                    </div>
                  ))}
                </div>
              )}
              <Link href="/tasks">
                <Button variant="ghost" className="w-full mt-4">查看所有任務</Button>
              </Link>
            </CardContent>
          </Card>
        )

      case 'projects':
        return (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                專案進度
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              {projects.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">尚未建立任何專案</p>
              ) : (
                <div className="space-y-2">
                  {projects.slice(0, 5).map((project: Project) => {
                    const stats = getProjectStats(project.id)
                    const projectTasks = getProjectTasks(project.id)
                    const isExpanded = expandedProjects.has(project.id)

                    return (
                      <div key={project.id} className="border rounded-lg overflow-hidden">
                        {/* 專案標題 - 可點擊展開 */}
                        <button
                          className="w-full p-3 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left"
                          onClick={() => toggleProjectExpand(project.id)}
                        >
                          <ChevronDown
                            className={`h-4 w-4 text-muted-foreground transition-transform ${
                              isExpanded ? '' : '-rotate-90'
                            }`}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium truncate">{project.name}</span>
                              <span className="text-xs text-muted-foreground shrink-0">{stats.progress}%</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-1">
                              <div
                                className="h-full bg-primary transition-all"
                                style={{ width: `${stats.progress}%` }}
                              />
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3 text-green-500" />
                                {stats.completed}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3 text-blue-500" />
                                {stats.inProgress}
                              </span>
                              <span className="flex items-center gap-1">
                                <Circle className="h-3 w-3 text-gray-400" />
                                {stats.pending}
                              </span>
                            </div>
                          </div>
                        </button>

                        {/* 展開的任務列表 */}
                        {isExpanded && (
                          <div className="border-t bg-muted/30">
                            {projectTasks.length === 0 ? (
                              <div className="p-3 text-center text-sm text-muted-foreground">
                                此專案尚無任務
                              </div>
                            ) : (
                              <div className="divide-y divide-border/50">
                                {projectTasks.slice(0, 5).map((task) => {
                                  const StatusIcon = statusConfig[task.status].icon

                                  return (
                                    <div
                                      key={task.id}
                                      className={`p-2.5 hover:bg-muted/50 transition-colors cursor-pointer flex items-start gap-2 ${
                                        task.status === 'completed' ? 'opacity-60' : ''
                                      }`}
                                      onClick={() => setSelectedTask(task)}
                                    >
                                      <Checkbox
                                        checked={task.status === 'completed'}
                                        onCheckedChange={() => handleToggleComplete(task)}
                                        onClick={(e) => e.stopPropagation()}
                                        className="mt-0.5"
                                      />
                                      <div className="flex-1 min-w-0">
                                        <span className={`text-sm ${
                                          task.status === 'completed' ? 'line-through text-muted-foreground' : ''
                                        }`}>
                                          {task.title}
                                        </span>
                                        <div className="flex items-center gap-2 mt-0.5 text-xs">
                                          <span className={statusConfig[task.status].color}>
                                            {statusConfig[task.status].label}
                                          </span>
                                          <span className={`px-1.5 py-0.5 rounded ${priorityConfig[task.priority].color}`}>
                                            {priorityConfig[task.priority].label}
                                          </span>
                                          {task.dueDate && (
                                            <span className="text-muted-foreground">
                                              {format(new Date(task.dueDate), 'M/d')}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  )
                                })}
                                {projectTasks.length > 5 && (
                                  <Link href="/projects" className="block p-2 text-center text-xs text-muted-foreground hover:text-foreground">
                                    還有 {projectTasks.length - 5} 個任務...
                                  </Link>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {projects.length > 5 && (
                    <p className="text-xs text-muted-foreground text-center">
                      還有 {projects.length - 5} 個專案
                    </p>
                  )}
                </div>
              )}
              <Link href="/projects">
                <Button variant="ghost" className="w-full mt-3" size="sm">完整專案管理</Button>
              </Link>
            </CardContent>
          </Card>
        )

      case 'calendar':
        return (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <CardTitle className="text-base">{format(currentMonth, 'yyyy年 M月', { locale: zhTW })}</CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-1 mb-1">
                {['一', '二', '三', '四', '五', '六', '日'].map((day) => (
                  <div key={day} className="text-center text-xs font-medium text-muted-foreground py-1">{day}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, idx) => {
                  const dayTasks = getTasksForDate(day)
                  const isCurrentMonth = isSameMonth(day, currentMonth)
                  const isSelected = selectedDate && isSameDay(day, selectedDate)
                  const isTodayDate = isToday(day)
                  const hasIncompleteTasks = dayTasks.some((t) => t.status !== 'completed')
                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedDate(isSelected ? null : day)}
                      className={`
                        relative min-h-[48px] p-1 rounded transition-all text-sm
                        ${!isCurrentMonth ? 'opacity-30' : ''}
                        ${isSelected ? 'bg-primary text-primary-foreground' : 'hover:bg-muted/50'}
                        ${isTodayDate && !isSelected ? 'ring-1 ring-primary' : ''}
                      `}
                    >
                      <div className="font-medium">{format(day, 'd')}</div>
                      {hasIncompleteTasks && (
                        <div className="flex justify-center gap-0.5 mt-0.5">
                          {dayTasks.filter((t) => t.status !== 'completed').slice(0, 3).map((task, i) => (
                            <div key={i} className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-primary-foreground' : priorityDotColor(task.priority)}`} />
                          ))}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
              <Link href="/calendar">
                <Button variant="ghost" className="w-full mt-3" size="sm">完整行事曆</Button>
              </Link>
            </CardContent>
          </Card>
        )

      case 'calendarTasks':
        if (!selectedDate) return null
        return (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {format(selectedDate, 'M月d日 EEEE', { locale: zhTW })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedDateTasks.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-4">這天沒有任務</p>
              ) : (
                <div className="space-y-2">
                  {selectedDateTasks.map((task) => (
                    <div key={task.id} className={`p-2 rounded-lg border text-sm ${task.status === 'completed' ? 'opacity-60 bg-muted/30' : 'bg-card'}`}>
                      <div className="flex items-start gap-2">
                        <Button
                          variant={task.status === 'completed' ? 'default' : 'outline'}
                          size="icon"
                          className="h-5 w-5 shrink-0"
                          onClick={() => {
                            if (task.status === 'completed') {
                              updateTask(task.id, { status: 'pending', completedAt: undefined })
                            } else {
                              completeTask(task.id)
                            }
                          }}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium ${task.status === 'completed' ? 'line-through' : ''}`}>{task.title}</p>
                          <Badge variant={priorityColor(task.priority) as "default" | "secondary" | "destructive" | "outline"} className="text-xs mt-1">
                            {task.priority}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )

      default:
        return null
    }
  }

  // 過濾可見的區塊
  const visibleWidgets = widgets.filter((w) => w.visible)
  // 特殊處理：當選中日期時，顯示 calendarTasks
  const displayWidgets = selectedDate
    ? [...visibleWidgets.filter(w => w.id !== 'calendar'), { id: 'calendar' as WidgetId, title: '行事曆', colSpan: 1 as const, visible: true }, { id: 'calendarTasks' as WidgetId, title: '日期任務', colSpan: 1 as const, visible: true }]
    : visibleWidgets

  // Loading 狀態
  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">📊 Dashboard</h1>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="pb-2">
                  <div className="h-4 bg-muted rounded w-20" />
                </CardHeader>
                <CardContent>
                  <div className="h-8 bg-muted rounded w-12 mb-2" />
                  <div className="h-3 bg-muted rounded w-24" />
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="text-center text-muted-foreground py-8">
            載入中...
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 space-y-6">
        {/* 標題列 */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">📊 Dashboard</h1>
          <div className="flex items-center gap-2">
            <p className="text-muted-foreground hidden sm:block">
              {format(new Date(), 'yyyy年M月d日 EEEE', { locale: zhTW })}
            </p>
            {isEditMode ? (
              <>
                <Button variant="outline" size="sm" onClick={() => setIsEditMode(false)}>
                  <X className="h-4 w-4 mr-1" />取消
                </Button>
                <Button size="sm" onClick={saveLayout}>
                  <Check className="h-4 w-4 mr-1" />儲存
                </Button>
              </>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setIsEditMode(true)}>
                <Edit3 className="h-4 w-4 mr-1" />編輯排版
              </Button>
            )}
          </div>
        </div>

        {/* 統計卡片 - 不可拖曳 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">待處理</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pending}</div>
              <p className="text-xs text-muted-foreground">個任務等待處理</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">進行中</CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.inProgress}</div>
              <p className="text-xs text-muted-foreground">個任務正在進行</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">已完成</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completed}</div>
              <p className="text-xs text-muted-foreground">個任務已完成</p>
            </CardContent>
          </Card>
          <Card className={stats.urgent > 0 ? 'border-destructive' : ''}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">緊急</CardTitle>
              <AlertCircle className={`h-4 w-4 ${stats.urgent > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${stats.urgent > 0 ? 'text-destructive' : ''}`}>{stats.urgent}</div>
              <p className="text-xs text-muted-foreground">個緊急任務</p>
            </CardContent>
          </Card>
        </div>

        {/* 可拖曳區塊 */}
        {isEditMode ? (
          <div className={`${isEditMode ? 'ring-2 ring-dashed ring-primary/30 rounded-lg p-4' : ''}`}>
            <p className="text-sm text-muted-foreground mb-4">拖曳區塊左上角的圖示來調整順序</p>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={displayWidgets.map((w) => w.id)} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {displayWidgets.map((widget) => {
                    const content = renderWidget(widget)
                    if (!content) return null
                    return (
                      <SortableWidget key={widget.id} id={widget.id} colSpan={widget.colSpan} isEditMode={isEditMode}>
                        {content}
                      </SortableWidget>
                    )
                  })}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {displayWidgets.map((widget) => {
              const content = renderWidget(widget)
              if (!content) return null
              return (
                <div key={widget.id} className={widget.colSpan === 2 ? 'lg:col-span-2' : ''}>
                  {content}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 任務詳細編輯對話框 */}
      <TaskDetailDialog
        task={selectedTask}
        projects={projects}
        onClose={() => setSelectedTask(null)}
        onUpdate={handleTaskUpdate}
      />
    </div>
  )
}
