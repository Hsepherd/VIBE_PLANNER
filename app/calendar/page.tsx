'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useSupabaseTasks, type Task } from '@/lib/useSupabaseTasks'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  startOfDay,
  addDays,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  isSameMonth,
  isSameDay,
  isToday,
  getHours,
  setHours,
  differenceInMinutes,
  differenceInDays,
  isBefore,
  isAfter,
  max,
  min,
} from 'date-fns'
import { zhTW } from 'date-fns/locale'
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Calendar as CalendarIcon,
  User,
  FolderKanban,
  Loader2,
} from 'lucide-react'

type ViewMode = 'day' | 'week' | 'month'

export default function CalendarPage() {
  const { tasks, isLoading, updateTask: updateSupabaseTask } = useSupabaseTasks()

  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)

  // 取得某天的任務（支援日期區間）
  const getTasksForDate = (date: Date) => {
    const targetDate = startOfDay(date)

    return tasks.filter((task: Task) => {
      // 如果有開始日期和截止日期，檢查目標日期是否在區間內
      if (task.startDate && task.dueDate) {
        const start = startOfDay(new Date(task.startDate))
        const end = startOfDay(new Date(task.dueDate))
        return targetDate >= start && targetDate <= end
      }

      // 只有開始日期：僅在開始日期當天顯示
      if (task.startDate) {
        return isSameDay(new Date(task.startDate), date)
      }

      // 只有截止日期：僅在截止日期當天顯示
      if (task.dueDate) {
        return isSameDay(new Date(task.dueDate), date)
      }

      return false
    })
  }

  // 優先級顏色
  const priorityColor = (priority: string, isCompleted: boolean = false) => {
    if (isCompleted) return 'bg-gray-300 dark:bg-gray-600'
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

  const priorityBgColor = (priority: string, isCompleted: boolean = false) => {
    if (isCompleted) return 'bg-gray-100 dark:bg-gray-800 border-gray-300'
    switch (priority) {
      case 'urgent':
        return 'bg-red-50 dark:bg-red-950/30 border-red-200'
      case 'high':
        return 'bg-orange-50 dark:bg-orange-950/30 border-orange-200'
      case 'medium':
        return 'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200'
      default:
        return 'bg-green-50 dark:bg-green-950/30 border-green-200'
    }
  }

  // 專案色盤（淡色系，Apple Calendar 風格）
  const projectColors = [
    { bg: 'bg-sky-200', text: 'text-sky-800', dot: 'bg-sky-500' },        // 天藍
    { bg: 'bg-rose-200', text: 'text-rose-800', dot: 'bg-rose-500' },     // 玫瑰
    { bg: 'bg-amber-200', text: 'text-amber-800', dot: 'bg-amber-500' },  // 琥珀
    { bg: 'bg-emerald-200', text: 'text-emerald-800', dot: 'bg-emerald-500' }, // 翠綠
    { bg: 'bg-violet-200', text: 'text-violet-800', dot: 'bg-violet-500' }, // 紫羅蘭
    { bg: 'bg-orange-200', text: 'text-orange-800', dot: 'bg-orange-500' }, // 橙
    { bg: 'bg-cyan-200', text: 'text-cyan-800', dot: 'bg-cyan-500' },     // 青
    { bg: 'bg-pink-200', text: 'text-pink-800', dot: 'bg-pink-500' },     // 粉
    { bg: 'bg-lime-200', text: 'text-lime-800', dot: 'bg-lime-500' },     // 萊姆
    { bg: 'bg-indigo-200', text: 'text-indigo-800', dot: 'bg-indigo-500' }, // 靛藍
  ]

  // 根據專案名稱取得顏色（用 hash 確保同專案同顏色）
  const getProjectColor = (projectName: string | undefined) => {
    if (!projectName) return projectColors[0] // 預設天藍
    let hash = 0
    for (let i = 0; i < projectName.length; i++) {
      hash = projectName.charCodeAt(i) + ((hash << 5) - hash)
    }
    return projectColors[Math.abs(hash) % projectColors.length]
  }

  // 任務橫條樣式（根據專案色）
  const getTaskBarStyle = (task: Task) => {
    if (task.status === 'completed') {
      return { bg: 'bg-gray-200', text: 'text-gray-500', dot: 'bg-gray-400' }
    }
    return getProjectColor(task.project || task.groupName)
  }

  // 導航
  const navigatePrev = () => {
    switch (viewMode) {
      case 'day':
        setCurrentDate(addDays(currentDate, -1))
        break
      case 'week':
        setCurrentDate(subWeeks(currentDate, 1))
        break
      case 'month':
        setCurrentDate(subMonths(currentDate, 1))
        break
    }
  }

  const navigateNext = () => {
    switch (viewMode) {
      case 'day':
        setCurrentDate(addDays(currentDate, 1))
        break
      case 'week':
        setCurrentDate(addWeeks(currentDate, 1))
        break
      case 'month':
        setCurrentDate(addMonths(currentDate, 1))
        break
    }
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  // 標題文字
  const getTitle = () => {
    switch (viewMode) {
      case 'day':
        return format(currentDate, 'yyyy年 M月 d日 EEEE', { locale: zhTW })
      case 'week':
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
        const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 })
        if (weekStart.getMonth() === weekEnd.getMonth()) {
          return `${format(weekStart, 'yyyy年 M月 d日', { locale: zhTW })} - ${format(weekEnd, 'd日', { locale: zhTW })}`
        }
        return `${format(weekStart, 'M月d日', { locale: zhTW })} - ${format(weekEnd, 'M月d日', { locale: zhTW })}`
      case 'month':
        return format(currentDate, 'yyyy年 M月', { locale: zhTW })
    }
  }

  // 時間列（6:00 - 23:00）
  const hours = Array.from({ length: 18 }, (_, i) => i + 6)

  // 週視圖的天數
  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 })
    return Array.from({ length: 7 }, (_, i) => addDays(start, i))
  }, [currentDate])

  // 月視圖的天數
  const monthDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(currentDate)
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 })
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 })

    const days: Date[] = []
    let day = startDate
    while (day <= endDate) {
      days.push(day)
      day = addDays(day, 1)
    }
    return days
  }, [currentDate])

  // 切換任務完成狀態
  const toggleTaskComplete = async (task: Task) => {
    if (task.status === 'completed') {
      await updateSupabaseTask(task.id, { status: 'pending', completedAt: undefined })
    } else {
      await updateSupabaseTask(task.id, { status: 'completed', completedAt: new Date() })
    }
  }

  // 格式化日期顯示
  const formatTaskDate = (date: Date) => {
    if (isToday(date)) return '今天'
    return format(date, 'M/d', { locale: zhTW })
  }

  // 渲染任務卡片
  const TaskCard = ({ task, compact = false }: { task: Task; compact?: boolean }) => (
    <div
      className={`
        rounded-md border p-2 cursor-pointer transition-all hover:shadow-md
        ${priorityBgColor(task.priority, task.status === 'completed')}
        ${task.status === 'completed' ? 'opacity-60' : ''}
        ${compact ? 'text-xs' : 'text-sm'}
      `}
      onClick={() => setSelectedTask(task)}
    >
      <div className="flex items-start gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation()
            toggleTaskComplete(task)
          }}
          className={`
            shrink-0 mt-0.5 w-4 h-4 rounded border flex items-center justify-center
            ${task.status === 'completed'
              ? 'bg-green-500 border-green-500 text-white'
              : 'border-gray-400 hover:border-primary'}
          `}
        >
          {task.status === 'completed' && <Check className="h-3 w-3" />}
        </button>
        <div className="flex-1 min-w-0">
          <p className={`font-medium truncate ${task.status === 'completed' ? 'line-through' : ''}`}>
            {task.title}
          </p>
          {!compact && (
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {/* 顯示日期範圍 */}
              {(task.startDate || task.dueDate) && (
                <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                  <CalendarIcon className="h-3 w-3" />
                  {task.startDate && task.dueDate ? (
                    <>
                      {formatTaskDate(new Date(task.startDate))} - {formatTaskDate(new Date(task.dueDate))}
                    </>
                  ) : task.dueDate ? (
                    <>截止 {formatTaskDate(new Date(task.dueDate))}</>
                  ) : task.startDate ? (
                    <>開始 {formatTaskDate(new Date(task.startDate))}</>
                  ) : null}
                </span>
              )}
              {task.assignee && (
                <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                  <User className="h-3 w-3" />
                  {task.assignee}
                </span>
              )}
              {task.project && (
                <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                  <FolderKanban className="h-3 w-3" />
                  {task.project}
                </span>
              )}
            </div>
          )}
        </div>
        <div className={`w-2 h-2 rounded-full shrink-0 ${priorityColor(task.priority, task.status === 'completed')}`} />
      </div>
    </div>
  )

  // 日視圖
  const DayView = () => {
    const dayTasks = getTasksForDate(currentDate)

    return (
      <div className="flex flex-1 overflow-hidden">
        {/* 時間軸 */}
        <div className="w-16 shrink-0 border-r border-gray-100">
          {hours.map((hour) => (
            <div
              key={hour}
              className="h-16 border-b border-gray-100 text-xs text-muted-foreground pr-2 text-right pt-1"
            >
              {hour}:00
            </div>
          ))}
        </div>

        {/* 任務區域 */}
        <div className="flex-1 relative">
          {/* 時間格線 */}
          {hours.map((hour) => (
            <div
              key={hour}
              className="h-16 border-b border-gray-50 border-dashed"
            />
          ))}

          {/* 當前時間線 */}
          {isToday(currentDate) && (
            <div
              className="absolute left-0 right-0 border-t-2 border-red-500 z-10"
              style={{
                top: `${((new Date().getHours() - 6) * 64 + (new Date().getMinutes() / 60) * 64)}px`,
              }}
            >
              <div className="w-3 h-3 bg-red-500 rounded-full -mt-1.5 -ml-1.5" />
            </div>
          )}

          {/* 任務列表（側邊顯示） */}
          <div className="absolute top-2 right-2 left-2">
            <ScrollArea className="h-[calc(18*64px-16px)]">
              <div className="space-y-2 pr-2">
                {dayTasks.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    今日沒有任務
                  </div>
                ) : (
                  dayTasks.map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>
    )
  }

  // 週視圖 - 支援跨日任務橫條顯示
  const WeekView = () => {
    const weekStart = startOfDay(weekDays[0])
    const weekEnd = startOfDay(weekDays[6])

    // 計算任務在這週的顯示資訊
    const getTaskBarsForWeek = () => {
      // 找出所有與這週有交集的任務
      const relevantTasks = tasks.filter((task: Task) => {
        const taskStart = task.startDate ? startOfDay(new Date(task.startDate)) : null
        const taskEnd = task.dueDate ? startOfDay(new Date(task.dueDate)) : null

        if (taskStart && taskEnd) {
          return !(isAfter(taskStart, weekEnd) || isBefore(taskEnd, weekStart))
        }

        const singleDate = taskStart || taskEnd
        if (singleDate) {
          return !isBefore(singleDate, weekStart) && !isAfter(singleDate, weekEnd)
        }

        return false
      })

      return relevantTasks.map((task: Task) => {
        const taskStart = task.startDate ? startOfDay(new Date(task.startDate)) : null
        const taskEnd = task.dueDate ? startOfDay(new Date(task.dueDate)) : null

        let displayStart: Date
        let displayEnd: Date

        if (taskStart && taskEnd) {
          displayStart = max([taskStart, weekStart])
          displayEnd = min([taskEnd, weekEnd])
        } else {
          displayStart = taskStart || taskEnd!
          displayEnd = displayStart
        }

        const startCol = differenceInDays(displayStart, weekStart)
        const endCol = differenceInDays(displayEnd, weekStart)
        const span = endCol - startCol + 1

        const isStart = taskStart ? isSameDay(displayStart, taskStart) : true
        const isEnd = taskEnd ? isSameDay(displayEnd, taskEnd) : true

        return { task, startCol, span, isStart, isEnd }
      }).sort((a, b) => {
        if (a.startCol !== b.startCol) return a.startCol - b.startCol
        return b.span - a.span
      })
    }

    const taskBars = getTaskBarsForWeek()

    return (
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* 頂部：日期標題 + 跨日任務橫條區 */}
        <div className="shrink-0 border-b">
          {/* 日期標題 */}
          <div className="flex">
            <div className="w-14 shrink-0" />
            <div className="flex-1 grid grid-cols-7">
              {weekDays.map((day, dayIdx) => {
                const isTodayDate = isToday(day)
                return (
                  <div
                    key={dayIdx}
                    className={`
                      py-2 flex flex-col items-center border-r border-gray-200/50 last:border-r-0
                      ${isTodayDate ? 'bg-blue-50/50' : ''}
                    `}
                  >
                    <span className="text-xs font-medium text-gray-500">
                      {format(day, 'EEE', { locale: zhTW })}
                    </span>
                    <span
                      className={`
                        text-lg font-bold text-gray-800
                        ${isTodayDate ? 'bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center' : ''}
                      `}
                    >
                      {format(day, 'd')}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 跨日任務橫條區 */}
          <div className="flex">
            <div className="w-14 shrink-0 border-r border-gray-200/50 text-xs font-medium text-gray-500 pr-2 text-right py-1">
              全天
            </div>
            <div className="flex-1 relative min-h-[80px] py-1">
              <div className="space-y-0.5 px-1">
                {taskBars.slice(0, 3).map(({ task, startCol, span }) => {
                  const colors = getTaskBarStyle(task)
                  return (
                    <div
                      key={task.id}
                      className="h-[22px] flex"
                      style={{
                        marginLeft: `calc(${startCol} * (100% / 7))`,
                        width: `calc(${span} * (100% / 7) - 4px)`,
                      }}
                    >
                      <div
                        className={`
                          flex-1 flex items-center gap-1.5 px-2 text-xs font-semibold cursor-pointer
                          rounded-[4px] hover:brightness-95 transition-all
                          ${colors.bg} ${colors.text}
                          ${task.status === 'completed' ? 'opacity-50' : ''}
                        `}
                        onClick={() => setSelectedTask(task)}
                        title={task.title}
                      >
                        <span className={`w-2 h-2 rounded-full shrink-0 ${colors.dot}`} />
                        <span className={`truncate ${task.status === 'completed' ? 'line-through' : ''}`}>
                          {task.title}
                        </span>
                      </div>
                    </div>
                  )
                })}
                {taskBars.length > 3 && (
                  <button
                    className="text-xs font-medium text-gray-500 hover:text-gray-700 pl-2 py-0.5"
                    onClick={() => {/* TODO: 展開更多 */}}
                  >
                    還有 {taskBars.length - 3} 項...
                  </button>
                )}
              </div>
              {/* 欄位分隔線（極淡） */}
              <div className="absolute inset-0 grid grid-cols-7 pointer-events-none">
                {weekDays.map((_, idx) => (
                  <div key={idx} className="border-r border-gray-200/30 last:border-r-0" />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 下方：時間軸（簡化版，不顯示時間格） */}
        <div className="flex-1 overflow-y-auto">
          <div className="flex">
            <div className="w-14 shrink-0 border-r border-gray-200/50">
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="h-14 border-b border-gray-200/30 text-xs font-medium text-gray-500 pr-2 text-right pt-1"
                >
                  {hour}:00
                </div>
              ))}
            </div>
            <div className="flex-1 grid grid-cols-7">
              {weekDays.map((day, dayIdx) => {
                const isTodayDate = isToday(day)
                return (
                  <div key={dayIdx} className="border-r border-gray-200/30 last:border-r-0 relative">
                    {hours.map((hour) => (
                      <div key={hour} className="h-14 border-b border-gray-100/50" />
                    ))}
                    {/* 當前時間線 */}
                    {isTodayDate && (
                      <div
                        className="absolute left-0 right-0 border-t-2 border-red-500 z-10"
                        style={{
                          top: `${((new Date().getHours() - 6) * 56 + (new Date().getMinutes() / 60) * 56)}px`,
                        }}
                      >
                        <div className="w-2 h-2 bg-red-500 rounded-full -mt-1 -ml-1" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 月視圖 - 支援跨日任務橫條顯示
  const MonthView = () => {
    // 將月曆分成週（每週一行）
    const weeks: Date[][] = []
    for (let i = 0; i < monthDays.length; i += 7) {
      weeks.push(monthDays.slice(i, i + 7))
    }

    // 計算任務在某週的顯示資訊
    const getTaskBarsForWeek = (weekDays: Date[]) => {
      const weekStart = startOfDay(weekDays[0])
      const weekEnd = startOfDay(weekDays[6])

      // 找出所有與這週有交集的任務
      const relevantTasks = tasks.filter((task: Task) => {
        const taskStart = task.startDate ? startOfDay(new Date(task.startDate)) : null
        const taskEnd = task.dueDate ? startOfDay(new Date(task.dueDate)) : null

        // 如果有區間，檢查是否與這週有交集
        if (taskStart && taskEnd) {
          return !(isAfter(taskStart, weekEnd) || isBefore(taskEnd, weekStart))
        }

        // 只有開始日期或截止日期，檢查是否在這週內
        const singleDate = taskStart || taskEnd
        if (singleDate) {
          return !isBefore(singleDate, weekStart) && !isAfter(singleDate, weekEnd)
        }

        return false
      })

      // 為每個任務計算在這週的顯示範圍
      return relevantTasks.map((task: Task) => {
        const taskStart = task.startDate ? startOfDay(new Date(task.startDate)) : null
        const taskEnd = task.dueDate ? startOfDay(new Date(task.dueDate)) : null

        // 計算在這週顯示的起始和結束位置
        let displayStart: Date
        let displayEnd: Date

        if (taskStart && taskEnd) {
          // 有區間：截取在這週的部分
          displayStart = max([taskStart, weekStart])
          displayEnd = min([taskEnd, weekEnd])
        } else {
          // 單一日期
          displayStart = taskStart || taskEnd!
          displayEnd = displayStart
        }

        // 計算在週內的欄位位置（0-6）
        const startCol = differenceInDays(displayStart, weekStart)
        const endCol = differenceInDays(displayEnd, weekStart)
        const span = endCol - startCol + 1

        // 判斷是否為跨日任務的開始/結束/中間段
        const isStart = taskStart ? isSameDay(displayStart, taskStart) : true
        const isEnd = taskEnd ? isSameDay(displayEnd, taskEnd) : true

        return {
          task,
          startCol,
          span,
          isStart,
          isEnd,
        }
      }).sort((a, b) => {
        // 依開始位置和跨度排序
        if (a.startCol !== b.startCol) return a.startCol - b.startCol
        return b.span - a.span
      })
    }

    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 星期標題 */}
        <div className="grid grid-cols-7 border-b border-gray-200">
          {['一', '二', '三', '四', '五', '六', '日'].map((day) => (
            <div
              key={day}
              className="text-center text-sm font-semibold text-gray-700 py-2 border-r border-gray-200/50 last:border-r-0"
            >
              {day}
            </div>
          ))}
        </div>

        {/* 週列表 */}
        <div className="flex-1 overflow-y-auto">
          {weeks.map((weekDays, weekIdx) => {
            const taskBars = getTaskBarsForWeek(weekDays)

            return (
              <div key={weekIdx} className="relative border-b border-gray-200/50 last:border-b-0">
                {/* 日期格子（背景） */}
                <div className="grid grid-cols-7">
                  {weekDays.map((day, dayIdx) => {
                    const isCurrentMonth = isSameMonth(day, currentDate)
                    const isTodayDate = isToday(day)

                    return (
                      <div
                        key={dayIdx}
                        className={`
                          min-h-[130px] p-1 border-r border-gray-200/50 last:border-r-0
                          ${!isCurrentMonth ? 'bg-gray-50/50' : ''}
                          ${isTodayDate ? 'bg-blue-50/50' : ''}
                        `}
                      >
                        <div
                          className={`
                            text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full
                            ${!isCurrentMonth ? 'text-gray-400' : 'text-gray-800'}
                            ${isTodayDate ? 'bg-primary text-primary-foreground' : ''}
                          `}
                        >
                          {format(day, 'd')}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* 任務橫條（絕對定位覆蓋在格子上）- Apple Calendar 風格 */}
                <div className="absolute top-8 left-0 right-0 space-y-0.5 px-1">
                  {taskBars.slice(0, 4).map(({ task, startCol, span }) => {
                    const colors = getTaskBarStyle(task)
                    return (
                      <div
                        key={task.id}
                        className="h-[20px] flex"
                        style={{
                          marginLeft: `calc(${startCol} * (100% / 7))`,
                          width: `calc(${span} * (100% / 7) - 4px)`,
                        }}
                      >
                        <div
                          className={`
                            flex-1 flex items-center gap-1 px-1.5 text-[11px] font-semibold cursor-pointer
                            rounded-[4px] hover:brightness-95 transition-all
                            ${colors.bg} ${colors.text}
                            ${task.status === 'completed' ? 'opacity-50' : ''}
                          `}
                          onClick={() => setSelectedTask(task)}
                          title={task.title}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${colors.dot}`} />
                          <span className={`truncate ${task.status === 'completed' ? 'line-through' : ''}`}>
                            {task.title}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                  {taskBars.length > 4 && (
                    <button
                      className="text-[10px] font-medium text-gray-500 hover:text-gray-700 pl-1"
                      onClick={() => {/* TODO: 展開更多 */}}
                    >
                      +{taskBars.length - 4} 更多
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* 頂部控制欄 */}
      <div className="shrink-0 p-4 border-b bg-background">
        <div className="flex items-center justify-between gap-4">
          {/* 左側：導航 */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToToday}>
              今天
            </Button>
            <div className="flex items-center">
              <Button variant="ghost" size="icon" onClick={navigatePrev}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={navigateNext}>
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
            <h1 className="text-lg font-semibold min-w-[200px]">{getTitle()}</h1>
          </div>

          {/* 右側：視圖切換 */}
          <div className="flex items-center bg-muted rounded-lg p-1">
            <Button
              variant={viewMode === 'day' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('day')}
              className="px-4"
            >
              日
            </Button>
            <Button
              variant={viewMode === 'week' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('week')}
              className="px-4"
            >
              週
            </Button>
            <Button
              variant={viewMode === 'month' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('month')}
              className="px-4"
            >
              月
            </Button>
          </div>
        </div>
      </div>

      {/* 行事曆主體 */}
      <div className="flex-1 overflow-hidden flex">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">載入任務中...</p>
            </div>
          </div>
        ) : (
          <ScrollArea className="flex-1">
            <div className="h-full">
              {viewMode === 'day' && <DayView />}
              {viewMode === 'week' && <WeekView />}
              {viewMode === 'month' && <MonthView />}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* 任務詳情側邊欄 */}
      {selectedTask && (
        <div
          className="fixed inset-0 z-50 bg-black/50"
          onClick={() => setSelectedTask(null)}
        >
          <div
            className="absolute right-0 top-0 bottom-0 w-96 bg-background shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold">任務詳情</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedTask(null)}
              >
                ✕
              </Button>
            </div>
            <div className="p-6 space-y-4">
              {/* 完成狀態 */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleTaskComplete(selectedTask)}
                  className={`
                    w-6 h-6 rounded-full border-2 flex items-center justify-center
                    ${selectedTask.status === 'completed'
                      ? 'bg-green-500 border-green-500 text-white'
                      : 'border-gray-400 hover:border-primary'}
                  `}
                >
                  {selectedTask.status === 'completed' && <Check className="h-4 w-4" />}
                </button>
                <span
                  className={`text-xl font-medium ${selectedTask.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}
                >
                  {selectedTask.title}
                </span>
              </div>

              {/* 詳細資訊 */}
              <div className="space-y-3 pt-4 border-t">
                {/* 優先級 */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground w-20">優先級</span>
                  <Badge
                    variant={
                      selectedTask.priority === 'urgent'
                        ? 'destructive'
                        : selectedTask.priority === 'high'
                        ? 'default'
                        : 'secondary'
                    }
                  >
                    {selectedTask.priority === 'urgent' ? '緊急' :
                     selectedTask.priority === 'high' ? '高' :
                     selectedTask.priority === 'medium' ? '中' : '低'}
                  </Badge>
                </div>

                {/* 截止日期 */}
                {selectedTask.dueDate && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground w-20">截止日期</span>
                    <span className="text-sm">
                      {format(new Date(selectedTask.dueDate), 'yyyy/MM/dd', { locale: zhTW })}
                    </span>
                  </div>
                )}

                {/* 負責人 */}
                {selectedTask.assignee && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground w-20">負責人</span>
                    <span className="text-sm flex items-center gap-1">
                      <User className="h-4 w-4" />
                      {selectedTask.assignee}
                    </span>
                  </div>
                )}

                {/* 專案 */}
                {selectedTask.project && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground w-20">專案</span>
                    <span className="text-sm flex items-center gap-1">
                      <FolderKanban className="h-4 w-4" />
                      {selectedTask.project}
                    </span>
                  </div>
                )}

                {/* 描述 */}
                {selectedTask.description && (
                  <div className="pt-3 border-t">
                    <span className="text-sm text-muted-foreground block mb-2">描述</span>
                    <p className="text-sm whitespace-pre-wrap">{selectedTask.description}</p>
                  </div>
                )}
              </div>

              {/* 操作按鈕 */}
              <div className="pt-4 border-t flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    toggleTaskComplete(selectedTask)
                    setSelectedTask(null)
                  }}
                >
                  {selectedTask.status === 'completed' ? '標記未完成' : '標記完成'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
