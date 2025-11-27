'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAppStore, type AppState, type Task } from '@/lib/store'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
} from 'date-fns'
import { zhTW } from 'date-fns/locale'
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Calendar as CalendarIcon,
} from 'lucide-react'

export default function CalendarPage() {
  const tasks = useAppStore((state: AppState) => state.tasks)
  const completeTask = useAppStore((state: AppState) => state.completeTask)
  const updateTask = useAppStore((state: AppState) => state.updateTask)

  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  // 取得某天的任務
  const getTasksForDate = (date: Date) => {
    return tasks.filter((task: Task) => {
      if (!task.dueDate) return false
      return isSameDay(new Date(task.dueDate), date)
    })
  }

  // 生成日曆格子
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

  // 優先級顏色
  const priorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-500'
      case 'high':
        return 'bg-orange-500'
      case 'medium':
        return 'bg-yellow-500'
      default:
        return 'bg-green-500'
    }
  }

  const priorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'destructive'
      case 'high':
        return 'default'
      case 'medium':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  // 選中日期的任務
  const selectedDateTasks = selectedDate ? getTasksForDate(selectedDate) : []

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">📅 行事曆</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 日曆 */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <CardTitle className="text-lg">
                  {format(currentMonth, 'yyyy年 M月', { locale: zhTW })}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* 星期標題 */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['一', '二', '三', '四', '五', '六', '日'].map((day) => (
                  <div
                    key={day}
                    className="text-center text-sm font-medium text-muted-foreground py-2"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* 日曆格子 */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, idx) => {
                  const dayTasks = getTasksForDate(day)
                  const isCurrentMonth = isSameMonth(day, currentMonth)
                  const isSelected = selectedDate && isSameDay(day, selectedDate)
                  const isTodayDate = isToday(day)
                  const hasIncompleteTasks = dayTasks.some(
                    (t) => t.status !== 'completed'
                  )

                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedDate(day)}
                      className={`
                        relative min-h-[80px] p-1 rounded-lg border transition-all
                        ${!isCurrentMonth ? 'opacity-30' : ''}
                        ${isSelected ? 'border-primary bg-primary/10' : 'border-transparent hover:bg-muted/50'}
                        ${isTodayDate ? 'ring-2 ring-primary' : ''}
                      `}
                    >
                      <div
                        className={`
                          text-sm font-medium mb-1
                          ${isTodayDate ? 'text-primary' : ''}
                        `}
                      >
                        {format(day, 'd')}
                      </div>

                      {/* 任務指示點 */}
                      <div className="flex flex-wrap gap-0.5">
                        {dayTasks.slice(0, 3).map((task) => (
                          <div
                            key={task.id}
                            className={`
                              w-2 h-2 rounded-full
                              ${task.status === 'completed' ? 'bg-gray-300' : priorityColor(task.priority)}
                            `}
                            title={task.title}
                          />
                        ))}
                        {dayTasks.length > 3 && (
                          <span className="text-xs text-muted-foreground">
                            +{dayTasks.length - 3}
                          </span>
                        )}
                      </div>

                      {/* 任務數量標記 */}
                      {hasIncompleteTasks && (
                        <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                          {dayTasks.filter((t) => t.status !== 'completed').length}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* 選中日期的任務 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                {selectedDate
                  ? format(selectedDate, 'M月d日 EEEE', { locale: zhTW })
                  : '選擇日期'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedDate ? (
                <p className="text-center text-muted-foreground py-8">
                  點擊日曆上的日期查看任務
                </p>
              ) : selectedDateTasks.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  這天沒有任務
                </p>
              ) : (
                <div className="space-y-3">
                  {selectedDateTasks.map((task) => (
                    <div
                      key={task.id}
                      className={`
                        p-3 rounded-lg border
                        ${task.status === 'completed' ? 'opacity-60 bg-muted/30' : 'bg-card'}
                      `}
                    >
                      <div className="flex items-start gap-2">
                        <Button
                          variant={task.status === 'completed' ? 'default' : 'outline'}
                          size="icon"
                          className="h-6 w-6 shrink-0 mt-0.5"
                          onClick={() => {
                            if (task.status === 'completed') {
                              updateTask(task.id, {
                                status: 'pending',
                                completedAt: undefined,
                              })
                            } else {
                              completeTask(task.id)
                            }
                          }}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                        <div className="flex-1 min-w-0">
                          <p
                            className={`
                              font-medium text-sm
                              ${task.status === 'completed' ? 'line-through' : ''}
                            `}
                          >
                            {task.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge
                              variant={priorityBadge(task.priority) as "default" | "secondary" | "destructive" | "outline"}
                              className="text-xs"
                            >
                              {task.priority}
                            </Badge>
                            {task.assignee && (
                              <span className="text-xs text-muted-foreground">
                                @{task.assignee}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 本月任務統計 */}
        <Card>
          <CardHeader>
            <CardTitle>本月統計</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {(() => {
                const monthStart = startOfMonth(currentMonth)
                const monthEnd = endOfMonth(currentMonth)
                const monthTasks = tasks.filter((t: Task) => {
                  if (!t.dueDate) return false
                  const due = new Date(t.dueDate)
                  return due >= monthStart && due <= monthEnd
                })
                const completed = monthTasks.filter(
                  (t: Task) => t.status === 'completed'
                ).length
                const pending = monthTasks.filter(
                  (t: Task) => t.status !== 'completed'
                ).length
                const urgent = monthTasks.filter(
                  (t: Task) => t.priority === 'urgent' && t.status !== 'completed'
                ).length

                return (
                  <>
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <p className="text-2xl font-bold">{monthTasks.length}</p>
                      <p className="text-sm text-muted-foreground">總任務</p>
                    </div>
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <p className="text-2xl font-bold text-green-600">
                        {completed}
                      </p>
                      <p className="text-sm text-muted-foreground">已完成</p>
                    </div>
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <p className="text-2xl font-bold text-blue-600">{pending}</p>
                      <p className="text-sm text-muted-foreground">待處理</p>
                    </div>
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <p className="text-2xl font-bold text-red-600">{urgent}</p>
                      <p className="text-sm text-muted-foreground">緊急</p>
                    </div>
                  </>
                )
              })()}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
