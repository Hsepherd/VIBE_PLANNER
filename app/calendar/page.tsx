'use client'

import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useSupabaseTasks, type Task } from '@/lib/useSupabaseTasks'
import { useSwipeable } from 'react-swipeable'
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
  setMinutes,
  differenceInMinutes,
  differenceInDays,
  isBefore,
  isAfter,
  max,
  min,
  addMinutes,
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
  Plus,
  X,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type ViewMode = 'day' | 'week' | 'month'

export default function CalendarPage() {
  const { tasks, isLoading, updateTask: updateSupabaseTask, addTask } = useSupabaseTasks()

  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [expandedAllDay, setExpandedAllDay] = useState(false) // 全天區域是否展開

  // 新增任務彈窗狀態
  const [showNewTaskForm, setShowNewTaskForm] = useState(false)
  const [newTaskData, setNewTaskData] = useState({
    title: '',
    description: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    startDate: null as Date | null,
    dueDate: null as Date | null,
    isAllDay: false,
  })
  const [isCreating, setIsCreating] = useState(false)

  // 滑動切換日期狀態
  const [swipeOffset, setSwipeOffset] = useState(0) // 滑動位移（用於視覺回饋）
  const [isAnimating, setIsAnimating] = useState(false) // 是否正在動畫中

  // 拖曳狀態
  const [draggingTask, setDraggingTask] = useState<Task | null>(null)
  const [dragMode, setDragMode] = useState<'move' | 'resize' | null>(null)
  const [dragStartY, setDragStartY] = useState(0)
  const [dragStartX, setDragStartX] = useState(0) // 追蹤 X 座標以支援跨天拖曳
  const [dragStartTime, setDragStartTime] = useState<Date | null>(null)
  const [dragEndTime, setDragEndTime] = useState<Date | null>(null)
  const [hasDragged, setHasDragged] = useState(false) // 追蹤是否真的有拖曳
  const [dragStartDayIndex, setDragStartDayIndex] = useState(0) // 開始拖曳時的天數索引
  const timeGridRef = useRef<HTMLDivElement>(null)

  // 鍵盤左右箭頭切換日期
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 如果正在輸入文字，不處理
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      // 如果有任務被選中（popup 開啟），不處理
      if (selectedTask) return

      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setCurrentDate(prev => addDays(prev, -1))
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        setCurrentDate(prev => addDays(prev, 1))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedTask])

  // 取得某天的任務（支援日期區間）
  const getTasksForDate = (date: Date) => {
    const targetDate = startOfDay(date)
    const today = startOfDay(new Date())

    return tasks.filter((task: Task) => {
      // 如果有開始日期和截止日期，檢查目標日期是否在區間內
      if (task.startDate && task.dueDate) {
        const start = startOfDay(new Date(task.startDate))
        const end = startOfDay(new Date(task.dueDate))
        return targetDate >= start && targetDate <= end
      }

      // 只有開始日期：從開始日期當天及之後顯示（但不超過 7 天後）
      if (task.startDate) {
        const start = startOfDay(new Date(task.startDate))
        const maxEnd = addDays(start, 7)
        return targetDate >= start && targetDate <= maxEnd
      }

      // 只有截止日期：從今天到截止日都顯示（讓用戶提前看到即將到期的任務）
      if (task.dueDate) {
        const end = startOfDay(new Date(task.dueDate))
        // 如果截止日在今天之前，只在截止日當天顯示
        if (end < today) {
          return isSameDay(end, targetDate)
        }
        // 截止日在今天或之後，從今天到截止日都顯示
        return targetDate >= today && targetDate <= end
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

  // 點擊時間格新增任務
  const handleTimeSlotClick = useCallback((day: Date, hour: number, minute: number = 0) => {
    const startTime = setMinutes(setHours(day, hour), minute)
    const endTime = addMinutes(startTime, 60) // 預設 1 小時
    setNewTaskData({
      title: '',
      description: '',
      priority: 'medium',
      startDate: startTime,
      dueDate: endTime,
      isAllDay: false,
    })
    setShowNewTaskForm(true)
  }, [])

  // 點擊全天區域新增全天任務
  const handleAllDayClick = useCallback((day: Date) => {
    const dayStart = startOfDay(day)
    setNewTaskData({
      title: '',
      description: '',
      priority: 'medium',
      startDate: dayStart,
      dueDate: dayStart, // 全天任務開始=結束（同一天 00:00）
      isAllDay: true,
    })
    setShowNewTaskForm(true)
  }, [])

  // 建立新任務
  const handleCreateTask = async () => {
    if (!newTaskData.title.trim()) return

    setIsCreating(true)
    try {
      await addTask({
        title: newTaskData.title.trim(),
        description: newTaskData.description.trim() || undefined,
        status: 'pending',
        priority: newTaskData.priority,
        startDate: newTaskData.startDate || undefined,
        dueDate: newTaskData.dueDate || undefined,
      })
      setShowNewTaskForm(false)
      setNewTaskData({
        title: '',
        description: '',
        priority: 'medium',
        startDate: null,
        dueDate: null,
        isAllDay: false,
      })
    } catch (err) {
      console.error('建立任務失敗:', err)
    } finally {
      setIsCreating(false)
    }
  }

  // 將 Y 座標轉換為時間（每小時 56px，從 6:00 開始）
  const yToTime = useCallback((y: number, baseDate: Date): Date => {
    const totalMinutes = Math.round((y / 56) * 60) + 6 * 60 // 從 6:00 開始
    const hours = Math.floor(totalMinutes / 60)
    const minutes = Math.round((totalMinutes % 60) / 15) * 15 // 15 分鐘為單位
    return setMinutes(setHours(baseDate, Math.min(23, Math.max(6, hours))), minutes)
  }, [])

  // 開始拖曳任務（移動或調整時長）
  const handleDragStart = useCallback((e: React.MouseEvent, task: Task, mode: 'move' | 'resize', dayIndex: number = 0) => {
    e.preventDefault()
    e.stopPropagation()

    // 確保有開始和結束時間才能操作
    const startTime = task.startDate ? new Date(task.startDate) : null
    const endTime = task.dueDate ? new Date(task.dueDate) : null

    // resize 模式需要有開始時間（結束時間可以自動設定）
    if (mode === 'resize' && !startTime) {
      console.log('無法調整時長：需要設定開始時間')
      return
    }

    // move 模式需要有開始時間
    if (mode === 'move' && !startTime) {
      console.log('無法移動：需要設定開始時間')
      return
    }

    setDraggingTask(task)
    setDragMode(mode)
    setDragStartY(e.clientY)
    setDragStartX(e.clientX)
    setDragStartTime(startTime)
    setDragEndTime(endTime)
    setHasDragged(false) // 重置拖曳標記
    setDragStartDayIndex(dayIndex)
  }, [])

  // 拖曳中
  const handleDragMove = useCallback((e: React.MouseEvent) => {
    if (!draggingTask || !dragMode || !timeGridRef.current) return

    const deltaY = e.clientY - dragStartY
    const deltaX = e.clientX - dragStartX
    const deltaMinutes = Math.round((deltaY / 56) * 60 / 15) * 15 // 15 分鐘為單位

    // 只有當移動超過閾值（8px）才算真正拖曳
    if (Math.abs(deltaY) > 8 || Math.abs(deltaX) > 20) {
      setHasDragged(true)
    }

    if (dragMode === 'move' && dragStartTime) {
      // 計算跨天的天數差異
      const gridRect = timeGridRef.current.getBoundingClientRect()
      const columnWidth = (gridRect.width - 56) / 7 // 減去時間軸寬度，除以 7 天
      const deltaDays = Math.round(deltaX / columnWidth)

      // 移動：同時更新開始和結束時間（包含跨天）
      let newStart = addMinutes(dragStartTime, deltaMinutes)
      newStart = addDays(newStart, deltaDays)

      let newEnd = dragEndTime ? addMinutes(dragEndTime, deltaMinutes) : null
      if (newEnd) {
        newEnd = addDays(newEnd, deltaDays)
      }

      // 限制在 6:00 - 23:00 之間
      if (newStart.getHours() >= 6 && newStart.getHours() <= 23) {
        setDraggingTask({
          ...draggingTask,
          startDate: newStart,
          dueDate: newEnd || undefined,
        })
      }
    } else if (dragMode === 'resize' && dragStartTime) {
      // 調整時長：只更新結束時間
      // 如果沒有結束時間，從開始時間 + 1 小時作為基準
      const baseEndTime = dragEndTime || addMinutes(dragStartTime, 60)
      const newEnd = addMinutes(baseEndTime, deltaMinutes)

      // 確保結束時間在開始時間之後（至少 15 分鐘），且在 6:00 - 23:59 之間
      const minEnd = addMinutes(dragStartTime, 15)
      if (newEnd >= minEnd && newEnd.getHours() >= 6 && (newEnd.getHours() < 24)) {
        setDraggingTask({
          ...draggingTask,
          dueDate: newEnd,
        })
      }
    }
  }, [draggingTask, dragMode, dragStartY, dragStartX, dragStartTime, dragEndTime])

  // 結束拖曳
  const handleDragEnd = useCallback(async () => {
    if (draggingTask && dragMode) {
      if (hasDragged) {
        // 真的有拖曳，儲存更新
        await updateSupabaseTask(draggingTask.id, {
          startDate: draggingTask.startDate,
          dueDate: draggingTask.dueDate,
        })
      } else {
        // 只是點擊，打開 popup（找回原始任務資料）
        const originalTask = tasks.find((t: Task) => t.id === draggingTask.id)
        if (originalTask) {
          setSelectedTask(originalTask)
        }
      }
    }
    setDraggingTask(null)
    setDragMode(null)
    setDragStartY(0)
    setDragStartX(0)
    setDragStartTime(null)
    setDragEndTime(null)
    setHasDragged(false)
    setDragStartDayIndex(0)
  }, [draggingTask, dragMode, hasDragged, tasks, updateSupabaseTask])

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


  // 週視圖滑動手勢
  const swipeHandlers = useSwipeable({
    onSwiping: (e) => {
      // 只在水平滑動時處理，且沒有正在拖曳任務
      if (draggingTask || isAnimating) return
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        // 提供即時的視覺回饋（限制最大位移）
        const maxOffset = 150
        setSwipeOffset(Math.max(-maxOffset, Math.min(maxOffset, e.deltaX)))
      }
    },
    onSwipedLeft: (e) => {
      // 向左滑 = 下一天（如果不是在拖曳任務）
      if (draggingTask || isAnimating) return
      if (Math.abs(e.deltaX) > 50) { // 閾值 50px
        setIsAnimating(true)
        setSwipeOffset(-150) // 動畫到邊緣
        setTimeout(() => {
          setCurrentDate(prev => addDays(prev, 1))
          setSwipeOffset(0)
          setIsAnimating(false)
        }, 150)
      } else {
        // 回彈
        setSwipeOffset(0)
      }
    },
    onSwipedRight: (e) => {
      // 向右滑 = 前一天
      if (draggingTask || isAnimating) return
      if (Math.abs(e.deltaX) > 50) {
        setIsAnimating(true)
        setSwipeOffset(150)
        setTimeout(() => {
          setCurrentDate(prev => addDays(prev, -1))
          setSwipeOffset(0)
          setIsAnimating(false)
        }, 150)
      } else {
        setSwipeOffset(0)
      }
    },
    onSwiped: () => {
      // 滑動結束，如果沒觸發切換就回彈
      if (!isAnimating) {
        setSwipeOffset(0)
      }
    },
    trackMouse: true, // 也支援滑鼠拖曳
    preventScrollOnSwipe: true,
    delta: 10, // 開始追蹤的最小距離
  })

  // 週視圖 - 支援跨日任務橫條顯示
  const WeekView = () => {
    const weekStart = startOfDay(weekDays[0])
    const weekEnd = startOfDay(weekDays[6])

    // 判斷任務是否為「單日時間任務」（應顯示在時間格裡而非全天區）
    const isSingleDayTimedTask = (task: Task) => {
      const taskStart = task.startDate ? new Date(task.startDate) : null
      const taskEnd = task.dueDate ? new Date(task.dueDate) : null

      // 情況 1: 開始和截止時間完全相同（時間點任務）- 即使是 00:00 也顯示在時間格
      if (taskStart && taskEnd && taskStart.getTime() === taskEnd.getTime()) {
        return true
      }

      // 情況 2: 有特定時間（不是 00:00）且同一天
      const hasTime = (taskStart && (taskStart.getHours() !== 0 || taskStart.getMinutes() !== 0)) ||
                     (taskEnd && (taskEnd.getHours() !== 0 || taskEnd.getMinutes() !== 0))

      if (!hasTime) return false

      // 如果有開始和結束時間，檢查是否同一天
      if (taskStart && taskEnd) {
        return isSameDay(taskStart, taskEnd)
      }

      // 只有一個時間點，算單日
      return true
    }

    // 計算任務在這週的顯示資訊（全天任務 + 跨日任務都在這裡顯示）
    const getTaskBarsForWeek = () => {
      // 找出所有與這週有交集的「全天或跨日」任務
      const relevantTasks = tasks.filter((task: Task) => {
        // 排除單日時間任務（這些會在時間格裡顯示）
        if (isSingleDayTimedTask(task)) return false

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
      <div
        {...swipeHandlers}
        className="flex flex-col flex-1 overflow-hidden relative"
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: isAnimating ? 'transform 150ms ease-out' : 'none',
        }}
      >
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
                {(expandedAllDay ? taskBars : taskBars.slice(0, 3)).map(({ task, startCol, span }) => {
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
                    onClick={() => setExpandedAllDay(!expandedAllDay)}
                  >
                    {expandedAllDay ? '收合' : `還有 ${taskBars.length - 3} 項...`}
                  </button>
                )}
              </div>
              {/* 欄位分隔線 + 點擊新增全天任務 */}
              <div className="absolute inset-0 grid grid-cols-7">
                {weekDays.map((day, idx) => (
                  <div
                    key={idx}
                    className="border-r border-gray-200/30 last:border-r-0 cursor-pointer hover:bg-blue-50/30 transition-colors"
                    onClick={() => handleAllDayClick(day)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 下方：時間軸 + 有時間的任務 */}
        <div
          className="flex-1 overflow-y-auto"
          ref={timeGridRef}
          onMouseMove={handleDragMove}
          onMouseUp={handleDragEnd}
          onMouseLeave={handleDragEnd}
        >
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

                // 取得這天的「單日時間任務」（有時間且同一天結束）
                const timedTasks = tasks.filter((task: Task) => {
                  // 只顯示單日時間任務
                  if (!isSingleDayTimedTask(task)) return false

                  const taskStart = task.startDate ? new Date(task.startDate) : null
                  const taskEnd = task.dueDate ? new Date(task.dueDate) : null

                  if (taskStart && isSameDay(taskStart, day)) return true
                  if (taskEnd && isSameDay(taskEnd, day)) return true

                  return false
                })

                // 計算重疊任務的並排位置（Apple Calendar 風格）
                const getTaskLayout = (tasksToLayout: Task[]) => {
                  const layoutMap = new Map<string, { column: number; totalColumns: number }>()

                  // 為每個任務計算時間範圍
                  const taskRanges = tasksToLayout.map(task => {
                    const currentTask = draggingTask?.id === task.id ? draggingTask : task
                    const taskStart = currentTask.startDate ? new Date(currentTask.startDate) : null
                    const taskEnd = currentTask.dueDate ? new Date(currentTask.dueDate) : null

                    let startMinutes = 0
                    let endMinutes = 60 // 預設 1 小時

                    if (taskStart && isSameDay(taskStart, day)) {
                      startMinutes = taskStart.getHours() * 60 + taskStart.getMinutes()
                      if (taskEnd && isSameDay(taskEnd, day)) {
                        endMinutes = taskEnd.getHours() * 60 + taskEnd.getMinutes()
                      } else {
                        endMinutes = startMinutes + 60
                      }
                    } else if (taskEnd && isSameDay(taskEnd, day)) {
                      endMinutes = taskEnd.getHours() * 60 + taskEnd.getMinutes()
                      startMinutes = endMinutes - 60
                    }

                    return { task, startMinutes, endMinutes }
                  }).sort((a, b) => a.startMinutes - b.startMinutes)

                  // 找出重疊的任務群組
                  const groups: typeof taskRanges[] = []
                  let currentGroup: typeof taskRanges = []

                  taskRanges.forEach(range => {
                    if (currentGroup.length === 0) {
                      currentGroup.push(range)
                    } else {
                      const overlaps = currentGroup.some(r =>
                        range.startMinutes < r.endMinutes && range.endMinutes > r.startMinutes
                      )
                      if (overlaps) {
                        currentGroup.push(range)
                      } else {
                        groups.push(currentGroup)
                        currentGroup = [range]
                      }
                    }
                  })
                  if (currentGroup.length > 0) groups.push(currentGroup)

                  // 為每個群組分配欄位
                  groups.forEach(group => {
                    const columns: typeof taskRanges[] = []

                    group.forEach(range => {
                      let placed = false
                      for (let col = 0; col < columns.length; col++) {
                        const canPlace = columns[col].every(r =>
                          range.startMinutes >= r.endMinutes || range.endMinutes <= r.startMinutes
                        )
                        if (canPlace) {
                          columns[col].push(range)
                          layoutMap.set(range.task.id, { column: col, totalColumns: 0 })
                          placed = true
                          break
                        }
                      }
                      if (!placed) {
                        columns.push([range])
                        layoutMap.set(range.task.id, { column: columns.length - 1, totalColumns: 0 })
                      }
                    })

                    // 更新總欄數
                    group.forEach(range => {
                      const layout = layoutMap.get(range.task.id)!
                      layout.totalColumns = columns.length
                    })
                  })

                  return layoutMap
                }

                const taskLayout = getTaskLayout(timedTasks)

                return (
                  <div key={dayIdx} className="border-r border-gray-200/30 last:border-r-0 relative">
                    {hours.map((hour) => (
                      <div
                        key={hour}
                        className="h-14 border-b border-gray-100/50 cursor-pointer hover:bg-blue-50/30 transition-colors"
                        onClick={() => handleTimeSlotClick(day, hour)}
                      />
                    ))}

                    {/* 有時間的任務 */}
                    {timedTasks.map((task) => {
                      // 如果這個任務正在被拖曳，跳過（會在下面單獨渲染）
                      if (draggingTask?.id === task.id) return null

                      const taskStart = task.startDate ? new Date(task.startDate) : null
                      const taskEnd = task.dueDate ? new Date(task.dueDate) : null

                      let displayTime: Date
                      let endTime: Date | null = null

                      // 判斷是否為時間點任務（開始=結束）
                      const isPointTask = taskStart && taskEnd && taskStart.getTime() === taskEnd.getTime()

                      if (taskStart && isSameDay(taskStart, day)) {
                        // 有開始時間且在這天
                        displayTime = taskStart
                        if (taskEnd && isSameDay(taskEnd, day)) {
                          endTime = taskEnd
                        }
                      } else if (taskEnd && isSameDay(taskEnd, day)) {
                        displayTime = taskEnd
                      } else {
                        return null
                      }

                      const startHour = displayTime.getHours()
                      const startMinute = displayTime.getMinutes()

                      // 計算位置：如果是 00:00 的時間點任務，顯示在 6:00 位置
                      let effectiveHour = startHour
                      if (startHour < 6) {
                        effectiveHour = 6 // 早於 6:00 的任務顯示在 6:00 位置
                      }
                      const topOffset = (effectiveHour - 6) * 56 + (startHour >= 6 ? (startMinute / 60) * 56 : 0)

                      let height = 50
                      if (endTime && !isPointTask) {
                        const durationMinutes = differenceInMinutes(endTime, displayTime)
                        height = Math.max(24, (durationMinutes / 60) * 56 - 4)
                      }

                      const colors = getTaskBarStyle(task)

                      // 取得並排位置
                      const layout = taskLayout.get(task.id) || { column: 0, totalColumns: 1 }
                      const columnWidth = 100 / layout.totalColumns
                      const leftOffset = layout.column * columnWidth

                      return (
                        <div
                          key={task.id}
                          className={`
                            absolute rounded-md px-1 py-1 text-xs
                            overflow-hidden select-none
                            ${colors.bg} ${colors.text}
                            ${task.status === 'completed' ? 'opacity-50' : ''}
                            cursor-grab hover:brightness-95 hover:shadow-md
                          `}
                          style={{
                            top: `${topOffset}px`,
                            height: `${height}px`,
                            left: `calc(${leftOffset}% + 2px)`,
                            width: `calc(${columnWidth}% - 4px)`,
                            zIndex: 5,
                          }}
                          onMouseDown={(e) => handleDragStart(e, task, 'move', dayIdx)}
                          title={`${task.title} - ${format(displayTime, 'HH:mm')}${endTime ? ` ~ ${format(endTime, 'HH:mm')}` : ''}`}
                        >
                          <div className="flex items-start gap-0.5 h-full">
                            <span className={`w-1 h-full rounded-full shrink-0 ${colors.dot}`} />
                            <div className="flex-1 min-w-0 overflow-hidden">
                              <p className={`font-medium truncate leading-tight text-[11px] ${task.status === 'completed' ? 'line-through' : ''}`}>
                                {task.title}
                              </p>
                              {height > 35 && (
                                <p className="text-[10px] opacity-75 truncate">
                                  {format(displayTime, 'HH:mm')}{endTime ? ` - ${format(endTime, 'HH:mm')}` : ''}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* 底部 resize handle - 只要有開始時間就可以調整 */}
                          {taskStart && (
                            <div
                              className="absolute bottom-0 left-0 right-0 h-6 cursor-ns-resize group z-10"
                              onMouseDown={(e) => {
                                e.stopPropagation()
                                e.preventDefault()
                                handleDragStart(e, task, 'resize', dayIdx)
                              }}
                            >
                              <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-12 h-2 rounded-full bg-current opacity-30 group-hover:opacity-70 transition-opacity" />
                            </div>
                          )}
                        </div>
                      )
                    })}

                    {/* 拖曳中的任務 - 單獨渲染以支援跨天顯示 */}
                    {draggingTask && (() => {
                      const dragTaskStart = draggingTask.startDate ? new Date(draggingTask.startDate) : null
                      const dragTaskEnd = draggingTask.dueDate ? new Date(draggingTask.dueDate) : null

                      // 檢查拖曳中的任務是否應該顯示在這一天
                      if (!dragTaskStart || !isSameDay(dragTaskStart, day)) return null
                      if (dragTaskStart.getHours() === 0 && dragTaskStart.getMinutes() === 0) return null

                      const displayTime = dragTaskStart
                      const endTime = dragTaskEnd && isSameDay(dragTaskEnd, day) ? dragTaskEnd : null

                      const startHour = displayTime.getHours()
                      const startMinute = displayTime.getMinutes()
                      const topOffset = (startHour - 6) * 56 + (startMinute / 60) * 56

                      let height = 50
                      if (endTime) {
                        const durationMinutes = differenceInMinutes(endTime, displayTime)
                        height = Math.max(24, (durationMinutes / 60) * 56 - 4)
                      }

                      if (startHour < 6) return null

                      const colors = getTaskBarStyle(draggingTask)

                      return (
                        <div
                          key={`dragging-${draggingTask.id}`}
                          className={`
                            absolute rounded-md px-1 py-1 text-xs
                            overflow-hidden select-none
                            ${colors.bg} ${colors.text}
                            ${draggingTask.status === 'completed' ? 'opacity-50' : ''}
                            shadow-lg ring-2 ring-primary cursor-grabbing
                          `}
                          style={{
                            top: `${topOffset}px`,
                            height: `${height}px`,
                            left: '2px',
                            right: '2px',
                            zIndex: 30,
                          }}
                        >
                          <div className="flex items-start gap-0.5 h-full">
                            <span className={`w-1 h-full rounded-full shrink-0 ${colors.dot}`} />
                            <div className="flex-1 min-w-0 overflow-hidden">
                              <p className={`font-medium truncate leading-tight text-[11px] ${draggingTask.status === 'completed' ? 'line-through' : ''}`}>
                                {draggingTask.title}
                              </p>
                              {height > 35 && (
                                <p className="text-[10px] opacity-75 truncate">
                                  {format(displayTime, 'HH:mm')}{endTime ? ` - ${format(endTime, 'HH:mm')}` : ''}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })()}

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

      {/* 新增任務彈窗 */}
      {showNewTaskForm && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center"
          onClick={() => setShowNewTaskForm(false)}
        >
          <div
            className="bg-background rounded-lg shadow-xl w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {newTaskData.isAllDay ? '新增全天任務' : '新增任務'}
              </h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowNewTaskForm(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="p-4 space-y-4">
              {/* 任務標題 */}
              <div>
                <label className="text-sm font-medium mb-1.5 block">任務名稱</label>
                <Input
                  placeholder="輸入任務名稱..."
                  value={newTaskData.title}
                  onChange={(e) => setNewTaskData(prev => ({ ...prev, title: e.target.value }))}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newTaskData.title.trim()) {
                      handleCreateTask()
                    }
                  }}
                />
              </div>

              {/* 任務描述 */}
              <div>
                <label className="text-sm font-medium mb-1.5 block">描述（選填）</label>
                <Textarea
                  placeholder="輸入任務描述..."
                  value={newTaskData.description}
                  onChange={(e) => setNewTaskData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                />
              </div>

              {/* 優先級 */}
              <div>
                <label className="text-sm font-medium mb-1.5 block">優先級</label>
                <Select
                  value={newTaskData.priority}
                  onValueChange={(value: 'low' | 'medium' | 'high' | 'urgent') =>
                    setNewTaskData(prev => ({ ...prev, priority: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">低</SelectItem>
                    <SelectItem value="medium">中</SelectItem>
                    <SelectItem value="high">高</SelectItem>
                    <SelectItem value="urgent">緊急</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 時間顯示 */}
              <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  {newTaskData.isAllDay ? (
                    <span>
                      {newTaskData.startDate && format(newTaskData.startDate, 'yyyy/MM/dd (EEE)', { locale: zhTW })}
                      {' '}全天
                    </span>
                  ) : (
                    <span>
                      {newTaskData.startDate && format(newTaskData.startDate, 'yyyy/MM/dd HH:mm', { locale: zhTW })}
                      {newTaskData.dueDate && ` ~ ${format(newTaskData.dueDate, 'HH:mm')}`}
                    </span>
                  )}
                </div>
              </div>

              {/* 操作按鈕 */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowNewTaskForm(false)}
                >
                  取消
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleCreateTask}
                  disabled={!newTaskData.title.trim() || isCreating}
                >
                  {isCreating ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  建立任務
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

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

                {/* 開始日期 */}
                {selectedTask.startDate && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground w-20">開始時間</span>
                    <span className="text-sm">
                      {format(new Date(selectedTask.startDate), 'yyyy/MM/dd HH:mm', { locale: zhTW })}
                    </span>
                  </div>
                )}

                {/* 截止日期 */}
                {selectedTask.dueDate && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground w-20">截止時間</span>
                    <span className="text-sm">
                      {format(new Date(selectedTask.dueDate), 'yyyy/MM/dd HH:mm', { locale: zhTW })}
                    </span>
                  </div>
                )}

                {/* 時長 */}
                {selectedTask.startDate && selectedTask.dueDate && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground w-20">時長</span>
                    <span className="text-sm">
                      {(() => {
                        const minutes = differenceInMinutes(new Date(selectedTask.dueDate), new Date(selectedTask.startDate))
                        const hours = Math.floor(minutes / 60)
                        const mins = minutes % 60
                        if (hours > 0 && mins > 0) return `${hours} 小時 ${mins} 分鐘`
                        if (hours > 0) return `${hours} 小時`
                        return `${mins} 分鐘`
                      })()}
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
