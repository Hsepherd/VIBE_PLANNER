'use client'

import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useSupabaseTasks, type Task } from '@/lib/useSupabaseTasks'
import { useSupabaseProjects, type Project } from '@/lib/useSupabaseProjects'
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
  Undo2,
  Pencil,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TaskDetailDialog } from '@/components/task/TaskDetailDialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { getTeamMembers, addTeamMember, removeTeamMember } from '@/lib/team-members'
import { getTags, addTag, removeTag, type Tag } from '@/lib/tags'
import { getGroups, addGroup, removeGroup, type Group } from '@/lib/groups'

type ViewMode = 'day' | 'week' | 'month'

export default function CalendarPage() {
  const { tasks, isLoading, updateTask: updateSupabaseTask, addTask, completeTask, deleteTask } = useSupabaseTasks()
  const { projects, addProject: addProjectToDb } = useSupabaseProjects()

  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [expandedAllDay, setExpandedAllDay] = useState(false) // 全天區域是否展開

  // 右鍵選單狀態
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; task: Task } | null>(null)

  // 觸控裝置偵測
  const [isTouchDevice, setIsTouchDevice] = useState(false)
  useEffect(() => {
    setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0)
  }, [])

  // 團隊成員
  const [teamMembers, setTeamMembers] = useState<string[]>([])
  useEffect(() => {
    setTeamMembers(getTeamMembers())
  }, [])

  const handleAddMember = useCallback((name: string) => {
    const updated = addTeamMember(name)
    setTeamMembers(updated)
  }, [])

  const handleRemoveMember = useCallback((name: string) => {
    const updated = removeTeamMember(name)
    setTeamMembers(updated)
  }, [])

  // 標籤
  const [availableTags, setAvailableTags] = useState<Tag[]>([])
  useEffect(() => {
    setAvailableTags(getTags())
  }, [])

  const handleAddTag = useCallback((name: string, color: string) => {
    const updated = addTag(name, color)
    setAvailableTags(updated)
  }, [])

  const handleRemoveTag = useCallback((name: string) => {
    const updated = removeTag(name)
    setAvailableTags(updated)
  }, [])

  // 組別
  const [availableGroups, setAvailableGroups] = useState<Group[]>([])
  useEffect(() => {
    setAvailableGroups(getGroups())
  }, [])

  const handleAddGroup = useCallback((name: string, color: string) => {
    const updated = addGroup(name, color)
    setAvailableGroups(updated)
  }, [])

  const handleRemoveGroup = useCallback((name: string) => {
    const updated = removeGroup(name)
    setAvailableGroups(updated)
  }, [])

  // 新增專案（從任務詳情彈窗）
  const handleAddProject = useCallback(async (name: string): Promise<Project | null> => {
    try {
      const newProject = await addProjectToDb({
        name,
        status: 'active',
        progress: 0,
      })
      return newProject
    } catch (err) {
      console.error('新增專案失敗:', err)
      return null
    }
  }, [addProjectToDb])

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

  // 重複任務拖曳確認對話框狀態
  const [pendingRecurringEdit, setPendingRecurringEdit] = useState<{
    task: Task           // 被拖曳的任務（含新時間）
    originalTaskId: string // 原始父任務 ID
    instanceDate: string   // 該實例的日期 yyyy-MM-dd
    newStartDate?: Date
    newDueDate?: Date
    mode: 'move' | 'resize'
  } | null>(null)

  // 長按觸發調整模式（觸控裝置專用）
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [longPressTask, setLongPressTask] = useState<Task | null>(null)
  const [showResizeMode, setShowResizeMode] = useState(false)

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

  // 檢查重複任務是否應該出現在某天
  const isRecurringOnDate = (task: Task, targetDate: Date): boolean => {
    if (!task.recurrenceType || task.recurrenceType === 'none') return false
    if (!task.startDate) return false

    // 檢查是否為被排除的日期（單次修改後該日期已獨立）
    const excludedDates = task.recurrenceConfig?.excludedDates || []
    const targetStr = format(targetDate, 'yyyy-MM-dd')
    if (excludedDates.includes(targetStr)) return false

    const taskStart = startOfDay(new Date(task.startDate))
    // 只在開始日期之後（含當天）顯示
    if (targetDate < taskStart) return false
    // 如果有結束日期限制
    if (task.recurrenceConfig?.endDate) {
      const endDate = startOfDay(new Date(task.recurrenceConfig.endDate))
      if (targetDate > endDate) return false
    }

    const interval = task.recurrenceConfig?.interval || 1
    const diffDays = Math.round((targetDate.getTime() - taskStart.getTime()) / (1000 * 60 * 60 * 24))

    switch (task.recurrenceType) {
      case 'daily':
        return diffDays % interval === 0
      case 'weekly': {
        const weekdays = task.recurrenceConfig?.weekdays
        if (weekdays && weekdays.length > 0) {
          const dayOfWeek = targetDate.getDay() === 0 ? 7 : targetDate.getDay()
          if (!weekdays.includes(dayOfWeek)) return false
          // 檢查 interval: 計算第幾週
          if (interval > 1) {
            const diffWeeks = Math.floor(diffDays / 7)
            if (diffWeeks % interval !== 0) return false
          }
          return true
        }
        return diffDays % (7 * interval) === 0
      }
      case 'monthly': {
        const monthDay = task.recurrenceConfig?.monthDay || taskStart.getDate()
        // 處理月底情況（如 31 號在只有 30 天的月份）
        const lastDayOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate()
        const effectiveDay = Math.min(monthDay, lastDayOfMonth)
        if (targetDate.getDate() !== effectiveDay) return false
        // 檢查 interval
        const monthDiff = (targetDate.getFullYear() - taskStart.getFullYear()) * 12 +
                          (targetDate.getMonth() - taskStart.getMonth())
        return monthDiff >= 0 && monthDiff % interval === 0
      }
      case 'yearly': {
        if (targetDate.getMonth() !== taskStart.getMonth()) return false
        // 處理閏年 2/29
        const lastDay = new Date(targetDate.getFullYear(), taskStart.getMonth() + 1, 0).getDate()
        const effectiveDay = Math.min(taskStart.getDate(), lastDay)
        if (targetDate.getDate() !== effectiveDay) return false
        const yearDiff = targetDate.getFullYear() - taskStart.getFullYear()
        return yearDiff >= 0 && yearDiff % interval === 0
      }
      default:
        return false
    }
  }

  // 為重複任務產生該天的虛擬實例（保留原始時間）
  const createRecurringInstance = (task: Task, targetDate: Date): Task => {
    const originalStart = task.startDate ? new Date(task.startDate) : new Date()
    const originalEnd = task.dueDate ? new Date(task.dueDate) : null

    // 複製原始時間到目標日期
    const newStart = new Date(targetDate)
    newStart.setHours(originalStart.getHours(), originalStart.getMinutes(), 0, 0)

    let newEnd: Date | undefined
    if (originalEnd) {
      newEnd = new Date(targetDate)
      newEnd.setHours(originalEnd.getHours(), originalEnd.getMinutes(), 0, 0)
    }

    return {
      ...task,
      id: `${task.id}__${format(targetDate, 'yyyy-MM-dd')}`, // 虛擬實例唯一 ID
      startDate: newStart,
      dueDate: newEnd,
      _isVirtualInstance: true, // 標記為虛擬實例
      _originalTaskId: task.id, // 保留原始 ID
    } as Task
  }

  // 取得某天的任務（支援日期區間 + 重複任務展開）
  const getTasksForDate = (date: Date) => {
    const targetDate = startOfDay(date)
    const today = startOfDay(new Date())
    const result: Task[] = []

    tasks.forEach((task: Task) => {
      // 已完成的重複任務不展開
      const isRecurring = task.recurrenceType && task.recurrenceType !== 'none'

      // 先檢查是否為重複任務且應出現在這天
      if (isRecurring && task.status !== 'completed') {
        if (isRecurringOnDate(task, targetDate)) {
          // 如果是原始日期就用原始任務，否則產生虛擬實例
          if (task.startDate && isSameDay(new Date(task.startDate), targetDate)) {
            result.push(task)
          } else {
            result.push(createRecurringInstance(task, targetDate))
          }
        }
        return
      }

      // 非重複任務：原始邏輯
      if (task.startDate && task.dueDate) {
        const start = startOfDay(new Date(task.startDate))
        const end = startOfDay(new Date(task.dueDate))
        if (targetDate >= start && targetDate <= end) {
          result.push(task)
        }
        return
      }

      if (task.startDate) {
        const start = startOfDay(new Date(task.startDate))
        const maxEnd = addDays(start, 7)
        if (targetDate >= start && targetDate <= maxEnd) {
          result.push(task)
        }
        return
      }

      if (task.dueDate) {
        const end = startOfDay(new Date(task.dueDate))
        if (end < today) {
          if (isSameDay(end, targetDate)) result.push(task)
        } else {
          if (targetDate >= today && targetDate <= end) result.push(task)
        }
        return
      }
    })

    return result
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

  // 時間列（0:00 - 23:00，完整 24 小時）
  const hours = Array.from({ length: 24 }, (_, i) => i)

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

  // 右鍵選單處理
  const handleTaskContextMenu = useCallback((e: React.MouseEvent, task: Task) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, task })
  }, [])

  const handleDeleteTask = useCallback(async (task: Task) => {
    setContextMenu(null)
    // 虛擬重複實例用原始 ID
    const taskId = (task as any)._originalTaskId || task.id
    if (!confirm(`確定要刪除「${task.title}」嗎？`)) return
    try {
      await deleteTask(taskId)
      if (selectedTask?.id === taskId) setSelectedTask(null)
      toast.success(`已刪除「${task.title}」`)
    } catch {
      toast.error('刪除失敗')
    }
  }, [deleteTask, selectedTask])

  // 點擊任意處關閉右鍵選單
  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [contextMenu])

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

  // 將 Y 座標轉換為時間（每小時 56px，從 0:00 開始）
  const yToTime = useCallback((y: number, baseDate: Date): Date => {
    const totalMinutes = Math.round((y / 56) * 60) // 從 0:00 開始
    const hours = Math.floor(totalMinutes / 60)
    const minutes = Math.round((totalMinutes % 60) / 15) * 15 // 15 分鐘為單位
    return setMinutes(setHours(baseDate, Math.min(23, Math.max(0, hours))), minutes)
  }, [])

  // 長按開始（觸控裝置）
  const handleTouchStart = useCallback((task: Task, dayIdx: number) => {
    // 清除之前的計時器
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
    }

    // 設定長按計時器（300ms）
    longPressTimerRef.current = setTimeout(() => {
      setLongPressTask(task)
      setShowResizeMode(true)
      // 觸覺回饋（如果支援）
      if (navigator.vibrate) {
        navigator.vibrate(50)
      }
    }, 300)
  }, [])

  // 長按結束
  const handleTouchEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }, [])

  // 取消長按調整模式
  const cancelResizeMode = useCallback(() => {
    setLongPressTask(null)
    setShowResizeMode(false)
  }, [])

  // 開始拖曳任務（移動或調整時長）
  const handleDragStart = useCallback((e: React.MouseEvent, task: Task, mode: 'move' | 'resize', dayIndex: number = 0) => {
    // 只處理左鍵，右鍵留給 context menu
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()

    // 取得時間，如果只有 dueDate，就用 dueDate 作為 startTime
    let startTime = task.startDate ? new Date(task.startDate) : null
    let endTime = task.dueDate ? new Date(task.dueDate) : null

    // 如果只有 dueDate 沒有 startDate，將 dueDate 當作開始時間（允許移動）
    if (!startTime && endTime) {
      startTime = endTime
      // 預設結束時間為開始後 1 小時
      endTime = addMinutes(startTime, 60)
    }

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

    setDraggingTask({
      ...task,
      startDate: startTime || undefined,
      dueDate: endTime || (startTime ? addMinutes(startTime, 60) : undefined),
    })
    setDragMode(mode)
    setDragStartY(e.clientY)
    setDragStartX(e.clientX)
    setDragStartTime(startTime)
    setDragEndTime(endTime || (startTime ? addMinutes(startTime, 60) : null))
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

      // 限制在 0:00 - 23:00 之間
      if (newStart.getHours() >= 0 && newStart.getHours() <= 23) {
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

      // 確保結束時間在開始時間之後（至少 15 分鐘），且在 0:00 - 23:59 之間
      const minEnd = addMinutes(dragStartTime, 15)
      if (newEnd >= minEnd && newEnd.getHours() >= 0 && (newEnd.getHours() < 24)) {
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
        // 判斷是否為重複任務（虛擬實例或原始重複任務）
        const isVirtual = (draggingTask as any)._isVirtualInstance
        const originalTaskId = isVirtual
          ? (draggingTask as any)._originalTaskId
          : draggingTask.id
        const parentTask = tasks.find((t: Task) => t.id === originalTaskId)
        const isRecurring = parentTask?.recurrenceType && parentTask.recurrenceType !== 'none'

        if (isRecurring && parentTask) {
          // 重複任務：先提取該實例的日期，再彈出確認對話框
          let instanceDateStr: string
          if (isVirtual) {
            // 從虛擬 ID 取得日期：格式 "parentId__yyyy-MM-dd"
            const parts = draggingTask.id.split('__')
            instanceDateStr = parts[parts.length - 1]
          } else {
            // 原始任務本身在其 startDate 日期
            instanceDateStr = format(new Date(parentTask.startDate!), 'yyyy-MM-dd')
          }

          setPendingRecurringEdit({
            task: draggingTask,
            originalTaskId,
            instanceDate: instanceDateStr,
            newStartDate: draggingTask.startDate,
            newDueDate: draggingTask.dueDate,
            mode: dragMode,
          })
        } else {
          // 非重複任務：直接儲存（原有邏輯）
          const originalTask = tasks.find((t: Task) => t.id === draggingTask.id)
          const originalStartDate = originalTask?.startDate
          const originalDueDate = originalTask?.dueDate

          await updateSupabaseTask(draggingTask.id, {
            startDate: draggingTask.startDate,
            dueDate: draggingTask.dueDate,
          })

          const newStart = draggingTask.startDate ? format(new Date(draggingTask.startDate), 'HH:mm') : ''
          const newEnd = draggingTask.dueDate ? format(new Date(draggingTask.dueDate), 'HH:mm') : ''
          const timeText = newStart && newEnd ? `${newStart} - ${newEnd}` : newStart || newEnd

          toast.success(
            dragMode === 'move' ? '已移動任務' : '已調整時長',
            {
              description: `${draggingTask.title}: ${timeText}`,
              action: {
                label: '還原',
                onClick: async () => {
                  await updateSupabaseTask(draggingTask.id, {
                    startDate: originalStartDate,
                    dueDate: originalDueDate,
                  })
                  toast.info('已還原任務時間')
                },
              },
              duration: 5000,
            }
          )
        }
      } else {
        // 只是點擊，打開 popup（找回原始任務資料）
        const taskId = (draggingTask as any)._originalTaskId || draggingTask.id
        const originalTask = tasks.find((t: Task) => t.id === taskId)
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

  // 重複任務拖曳：只更動本次
  const handleRecurringEditThisOnly = useCallback(async () => {
    if (!pendingRecurringEdit) return
    const { originalTaskId, instanceDate, newStartDate, newDueDate, mode } = pendingRecurringEdit
    const parentTask = tasks.find((t: Task) => t.id === originalTaskId)
    if (!parentTask) return

    try {
      // 1. 在父任務的 recurrenceConfig 加入排除日期
      const currentConfig = parentTask.recurrenceConfig || {}
      const excludedDates = [...(currentConfig.excludedDates || []), instanceDate]
      await updateSupabaseTask(originalTaskId, {
        recurrenceConfig: { ...currentConfig, excludedDates },
      })

      // 2. 建立一個獨立的新任務（不重複），時間為拖曳後的新時間
      await addTask({
        title: parentTask.title,
        description: parentTask.description,
        notes: parentTask.notes,
        status: parentTask.status,
        priority: parentTask.priority,
        startDate: newStartDate,
        dueDate: newDueDate,
        assignee: parentTask.assignee,
        projectId: parentTask.projectId,
        tags: parentTask.tags,
        groupName: parentTask.groupName,
        estimatedMinutes: parentTask.estimatedMinutes,
        taskType: parentTask.taskType,
        parentTaskId: originalTaskId,
        isRecurringInstance: true,
        // 不設定 recurrenceType，讓這個任務獨立
      })

      const newStart = newStartDate ? format(new Date(newStartDate), 'M/d HH:mm') : ''
      const newEnd = newDueDate ? format(new Date(newDueDate), 'HH:mm') : ''
      const timeText = newStart && newEnd ? `${newStart} - ${newEnd}` : newStart || newEnd
      toast.success('已更動本次任務', {
        description: `${parentTask.title}: ${timeText}`,
        duration: 3000,
      })
    } catch (err) {
      console.error('更動本次任務失敗:', err)
      toast.error('更動失敗，請重試')
    }

    setPendingRecurringEdit(null)
  }, [pendingRecurringEdit, tasks, updateSupabaseTask, addTask])

  // 重複任務拖曳：全部一起更動（更新父任務的時間）
  const handleRecurringEditAll = useCallback(async () => {
    if (!pendingRecurringEdit) return
    const { originalTaskId, newStartDate, newDueDate, mode } = pendingRecurringEdit
    const parentTask = tasks.find((t: Task) => t.id === originalTaskId)
    if (!parentTask) return

    try {
      // 更新父任務的時間（只更新時分，保留原始日期）
      // 「全部一起更動」只改時間，不改日期，這樣所有重複實例都會在新時間出現
      const updates: Partial<Task> = {}

      if (newStartDate && parentTask.startDate) {
        const updatedStart = new Date(parentTask.startDate)
        updatedStart.setHours(newStartDate.getHours(), newStartDate.getMinutes(), 0, 0)
        updates.startDate = updatedStart
      }

      if (newDueDate && parentTask.dueDate) {
        const updatedEnd = new Date(parentTask.dueDate)
        updatedEnd.setHours(newDueDate.getHours(), newDueDate.getMinutes(), 0, 0)
        updates.dueDate = updatedEnd
      } else if (newDueDate && parentTask.startDate) {
        // 沒有原始 dueDate 時，用 startDate 的日期 + 新的結束時間
        const updatedEnd = new Date(parentTask.startDate)
        updatedEnd.setHours(newDueDate.getHours(), newDueDate.getMinutes(), 0, 0)
        updates.dueDate = updatedEnd
      }

      await updateSupabaseTask(originalTaskId, updates)

      const newStart = newStartDate ? format(new Date(newStartDate), 'HH:mm') : ''
      const newEnd = newDueDate ? format(new Date(newDueDate), 'HH:mm') : ''
      const timeText = newStart && newEnd ? `${newStart} - ${newEnd}` : newStart || newEnd
      toast.success('已更動所有重複任務', {
        description: `${parentTask.title}: ${timeText}`,
        duration: 3000,
      })
    } catch (err) {
      console.error('更動所有重複任務失敗:', err)
      toast.error('更動失敗，請重試')
    }

    setPendingRecurringEdit(null)
  }, [pendingRecurringEdit, tasks, updateSupabaseTask])

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
      onContextMenu={(e) => handleTaskContextMenu(e, task)}
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
                top: `${(new Date().getHours() * 64 + (new Date().getMinutes() / 60) * 64)}px`,
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

  // 展開重複任務到本週每一天（放在 CalendarPage 層級避免 hook 順序問題）
  const expandedTasks = useMemo(() => {
    const result: Task[] = []
    const seen = new Set<string>()

    tasks.forEach((task: Task) => {
      const isRecurring = task.recurrenceType && task.recurrenceType !== 'none' && task.status !== 'completed'

      if (isRecurring) {
        weekDays.forEach(day => {
          const dayStart = startOfDay(day)
          if (isRecurringOnDate(task, dayStart)) {
            const key = `${task.id}-${format(dayStart, 'yyyy-MM-dd')}`
            if (!seen.has(key)) {
              seen.add(key)
              if (task.startDate && isSameDay(new Date(task.startDate), dayStart)) {
                result.push(task)
              } else {
                result.push(createRecurringInstance(task, dayStart))
              }
            }
          }
        })
      } else {
        result.push(task)
      }
    })

    return result
  }, [tasks, weekDays])

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
      const relevantTasks = expandedTasks.filter((task: Task) => {
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
        className="flex flex-col flex-1 overflow-y-auto relative"
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: isAnimating ? 'transform 150ms ease-out' : 'none',
        }}
      >
        {/* 頂部：日期標題 + 跨日任務橫條區（sticky 凍結） */}
        <div className="shrink-0 border-b bg-background sticky top-0 z-20">
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
                        onContextMenu={(e) => handleTaskContextMenu(e, task)}
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
              {/* 欄位分隔線（極淡） */}
              <div className="absolute inset-0 grid grid-cols-7 pointer-events-none">
                {weekDays.map((_, idx) => (
                  <div key={idx} className="border-r border-gray-200/30 last:border-r-0" />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 下方：時間軸 + 有時間的任務 */}
        <div
          className="flex-1"
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
                // 注意：如果有拖曳中的任務，使用拖曳後的位置來判斷
                const timedTasks = expandedTasks.filter((task: Task) => {
                  // 如果是正在拖曳的任務，使用拖曳後的位置判斷
                  const currentTask = draggingTask?.id === task.id ? draggingTask : task

                  // 只顯示單日時間任務
                  if (!isSingleDayTimedTask(currentTask)) return false

                  const taskStart = currentTask.startDate ? new Date(currentTask.startDate) : null
                  const taskEnd = currentTask.dueDate ? new Date(currentTask.dueDate) : null

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
                      if (taskEnd && isSameDay(taskEnd, day) && taskEnd.getTime() !== taskStart.getTime()) {
                        // 有不同的結束時間
                        endMinutes = taskEnd.getHours() * 60 + taskEnd.getMinutes()
                      } else if (currentTask.estimatedMinutes) {
                        // 用預估時間計算結束
                        endMinutes = startMinutes + currentTask.estimatedMinutes
                      } else {
                        endMinutes = startMinutes + 60
                      }
                    } else if (taskEnd && isSameDay(taskEnd, day)) {
                      endMinutes = taskEnd.getHours() * 60 + taskEnd.getMinutes()
                      startMinutes = endMinutes - (currentTask.estimatedMinutes || 60)
                    }

                    // 確保至少有 15 分鐘的範圍，避免零寬度導致重疊偵測失敗
                    if (endMinutes <= startMinutes) {
                      endMinutes = startMinutes + (currentTask.estimatedMinutes || 60)
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
                      // 使用拖曳中的位置（如果正在拖曳這個任務）
                      const displayTask = draggingTask?.id === task.id ? draggingTask : task
                      const isDragging = draggingTask?.id === task.id

                      const taskStart = displayTask.startDate ? new Date(displayTask.startDate) : null
                      const taskEnd = displayTask.dueDate ? new Date(displayTask.dueDate) : null

                      let displayTime: Date
                      let endTime: Date | null = null

                      // 判斷是否為時間點任務（開始=結束且無預估時間）
                      const isPointTask = taskStart && taskEnd
                        && taskStart.getTime() === taskEnd.getTime()
                        && !displayTask.estimatedMinutes

                      if (taskStart && isSameDay(taskStart, day)) {
                        // 有開始時間且在這天
                        displayTime = taskStart
                        if (taskEnd && isSameDay(taskEnd, day) && taskEnd.getTime() !== taskStart.getTime()) {
                          endTime = taskEnd
                        }
                      } else if (taskEnd && isSameDay(taskEnd, day)) {
                        displayTime = taskEnd
                      } else {
                        return null
                      }

                      // 推算結束時間：優先用 endTime，其次用 estimatedMinutes，最後預設 1 小時
                      const inferredEndTime = endTime
                        || addMinutes(displayTime, displayTask.estimatedMinutes || 60)

                      const startHour = displayTime.getHours()
                      const startMinute = displayTime.getMinutes()

                      // 計算位置：從 0:00 開始
                      const topOffset = startHour * 56 + (startMinute / 60) * 56

                      let height = 50
                      if (inferredEndTime && !isPointTask) {
                        const durationMinutes = differenceInMinutes(inferredEndTime, displayTime)
                        height = Math.max(24, (durationMinutes / 60) * 56 - 4)
                      }

                      const colors = getTaskBarStyle(displayTask)

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
                            ${displayTask.status === 'completed' ? 'opacity-50' : ''}
                            ${isDragging ? 'shadow-xl ring-2 ring-primary cursor-grabbing z-30 scale-[1.02]' : 'cursor-grab hover:brightness-95 hover:shadow-md z-5'}
                            ${showResizeMode && longPressTask?.id === task.id ? 'ring-2 ring-primary ring-offset-2 animate-pulse' : ''}
                            transition-shadow
                          `}
                          style={{
                            top: `${topOffset}px`,
                            height: `${height}px`,
                            left: `calc(${leftOffset}% + 2px)`,
                            width: `calc(${columnWidth}% - 4px)`,
                          }}
                          onMouseDown={(e) => handleDragStart(e, task, 'move', dayIdx)}
                          onContextMenu={(e) => handleTaskContextMenu(e, task)}
                          onTouchStart={() => isTouchDevice && handleTouchStart(task, dayIdx)}
                          onTouchEnd={handleTouchEnd}
                          onTouchCancel={handleTouchEnd}
                          title={`${displayTask.title} - ${format(displayTime, 'HH:mm')}${inferredEndTime ? ` ~ ${format(inferredEndTime, 'HH:mm')}` : ''}`}
                        >
                          {/* 拖曳時的時間預覽 Tooltip */}
                          {isDragging && (
                            <>
                              {/* 移動模式：頂部顯示完整時間範圍 */}
                              {dragMode === 'move' && displayTask.startDate && (
                                <div className="absolute -top-7 left-1/2 -translate-x-1/2 z-50
                                                bg-gray-900 text-white text-[10px] font-medium
                                                px-2 py-1 rounded shadow-lg whitespace-nowrap
                                                pointer-events-none">
                                  {format(new Date(displayTask.startDate), 'HH:mm')}
                                  {displayTask.dueDate && ` - ${format(new Date(displayTask.dueDate), 'HH:mm')}`}
                                  <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px
                                                  border-4 border-transparent border-t-gray-900" />
                                </div>
                              )}
                              {/* Resize 模式：底部顯示結束時間 */}
                              {dragMode === 'resize' && displayTask.dueDate && (
                                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 z-50
                                                bg-primary text-primary-foreground text-[10px] font-medium
                                                px-2 py-1 rounded shadow-lg whitespace-nowrap
                                                pointer-events-none">
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-px
                                                  border-4 border-transparent border-b-primary" />
                                  結束 {format(new Date(displayTask.dueDate), 'HH:mm')}
                                </div>
                              )}
                            </>
                          )}
                          <div className="flex items-start gap-0.5 h-full">
                            <span className={`w-1 h-full rounded-full shrink-0 ${colors.dot}`} />
                            <div className="flex-1 min-w-0 overflow-hidden">
                              <p className={`font-medium leading-tight text-[11px] break-words ${displayTask.status === 'completed' ? 'line-through' : ''}`}>
                                {displayTask.title}
                              </p>
                              {height > 35 && (
                                <p className="text-[10px] opacity-75 whitespace-nowrap">
                                  {(() => {
                                    // 緊湊時間格式：整點省略 :00（如 12 代替 12:00）
                                    const fmtShort = (d: Date) => d.getMinutes() === 0 ? format(d, 'H') : format(d, 'H:mm')
                                    return `${fmtShort(displayTime)}${inferredEndTime ? `-${fmtShort(inferredEndTime)}` : ''}`
                                  })()}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* 底部 resize handle - 只在最底部 6px 觸發 */}
                          {(taskStart || taskEnd) && !isDragging && (
                            <div
                              className={`absolute bottom-0 left-0 right-0 cursor-ns-resize group z-20
                                         transition-all duration-150 rounded-b-md
                                         ${isTouchDevice ? 'h-4' : 'h-[6px]'}
                                         ${showResizeMode && longPressTask?.id === task.id ? 'bg-primary/30' : ''}`}
                              onMouseDown={(e) => {
                                e.stopPropagation()
                                e.preventDefault()
                                handleDragStart(e, task, 'resize', dayIdx)
                              }}
                              onTouchStart={(e) => {
                                if (showResizeMode && longPressTask?.id === task.id) {
                                  e.stopPropagation()
                                }
                              }}
                            >
                              {/* 底部拖曳指示條 - hover 時顯示 */}
                              <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2
                                              w-8 h-1 rounded-full bg-current opacity-0
                                              group-hover:opacity-50
                                              transition-all duration-150" />
                            </div>
                          )}
                        </div>
                      )
                    })}


                    {/* 當前時間線 */}
                    {isTodayDate && (
                      <div
                        className="absolute left-0 right-0 border-t-2 border-red-500 z-10"
                        style={{
                          top: `${(new Date().getHours() * 56 + (new Date().getMinutes() / 60) * 56)}px`,
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
          <div className="flex-1 flex flex-col overflow-hidden">
            {viewMode === 'day' && DayView()}
            {viewMode === 'week' && WeekView()}
            {viewMode === 'month' && MonthView()}
          </div>
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
              <h2 className="text-lg font-semibold">新增任務</h2>
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
                  <span>
                    {newTaskData.startDate && format(newTaskData.startDate, 'yyyy/MM/dd HH:mm', { locale: zhTW })}
                    {newTaskData.dueDate && ` ~ ${format(newTaskData.dueDate, 'HH:mm')}`}
                  </span>
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

      {/* 觸控長按調整模式面板 */}
      {showResizeMode && longPressTask && (
        <div className="fixed inset-x-0 bottom-0 z-50 p-4 bg-background border-t shadow-lg animate-in slide-in-from-bottom duration-200">
          <div className="max-w-md mx-auto">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-medium text-sm">{longPressTask.title}</p>
                <p className="text-xs text-muted-foreground">
                  {longPressTask.startDate && format(new Date(longPressTask.startDate), 'HH:mm')}
                  {longPressTask.dueDate && ` - ${format(new Date(longPressTask.dueDate), 'HH:mm')}`}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={cancelResizeMode}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="h-12"
                onClick={() => {
                  setSelectedTask(longPressTask)
                  cancelResizeMode()
                }}
              >
                <CalendarIcon className="h-4 w-4 mr-2" />
                編輯詳情
              </Button>
              <Button
                variant="outline"
                className="h-12"
                onClick={() => {
                  // 快速延長 30 分鐘
                  const currentEnd = longPressTask.dueDate ? new Date(longPressTask.dueDate) : new Date()
                  const newEnd = addMinutes(currentEnd, 30)
                  updateSupabaseTask(longPressTask.id, { dueDate: newEnd })
                  toast.success('已延長 30 分鐘')
                  cancelResizeMode()
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                延長 30 分鐘
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 重複任務拖曳確認對話框 */}
      <Dialog
        open={!!pendingRecurringEdit}
        onOpenChange={(open) => { if (!open) setPendingRecurringEdit(null) }}
      >
        <DialogContent className="sm:max-w-[400px]" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>修改重複任務</DialogTitle>
            <DialogDescription>
              {pendingRecurringEdit && (() => {
                const newStart = pendingRecurringEdit.newStartDate
                  ? format(new Date(pendingRecurringEdit.newStartDate), 'M/d HH:mm')
                  : ''
                const newEnd = pendingRecurringEdit.newDueDate
                  ? format(new Date(pendingRecurringEdit.newDueDate), 'HH:mm')
                  : ''
                const parentTask = tasks.find((t: Task) => t.id === pendingRecurringEdit.originalTaskId)
                return `「${parentTask?.title || ''}」${pendingRecurringEdit.mode === 'move' ? '移動' : '調整'}至 ${newStart}${newEnd ? ` - ${newEnd}` : ''}`
              })()}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 mt-2">
            <Button
              variant="outline"
              className="w-full justify-start h-auto py-3 px-4"
              onClick={handleRecurringEditThisOnly}
            >
              <div className="text-left">
                <div className="font-medium">只更動本次</div>
                <div className="text-xs text-muted-foreground mt-0.5">僅修改這一次的時間，其他重複不受影響</div>
              </div>
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start h-auto py-3 px-4"
              onClick={handleRecurringEditAll}
            >
              <div className="text-left">
                <div className="font-medium">全部一起更動</div>
                <div className="text-xs text-muted-foreground mt-0.5">所有重複任務都套用新的時間</div>
              </div>
            </Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setPendingRecurringEdit(null)}>
              取消
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 任務詳情彈窗 - 與任務列表共用 */}
      <TaskDetailDialog
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onUpdate={async (id, updates) => { await updateSupabaseTask(id, updates) }}
        onComplete={completeTask}
        teamMembers={teamMembers}
        onAddMember={handleAddMember}
        onRemoveMember={handleRemoveMember}
        availableTags={availableTags}
        onAddTag={handleAddTag}
        onRemoveTag={handleRemoveTag}
        availableGroups={availableGroups}
        onAddGroup={handleAddGroup}
        onRemoveGroup={handleRemoveGroup}
        projects={projects}
        onAddProject={handleAddProject}
      />

      {/* 右鍵選單 */}
      {contextMenu && (() => {
        // 限制選單不超出螢幕
        const menuW = 160, menuH = 88
        const x = Math.min(contextMenu.x, window.innerWidth - menuW - 8)
        const y = Math.min(contextMenu.y, window.innerHeight - menuH - 8)
        return (
        <div
          className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 min-w-[160px]"
          style={{ left: `${x}px`, top: `${y}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            onClick={() => {
              // 虛擬實例找回原始任務
              const originalId = (contextMenu.task as any)._originalTaskId || contextMenu.task.id
              const originalTask = tasks.find((t: Task) => t.id === originalId) || contextMenu.task
              setSelectedTask(originalTask)
              setContextMenu(null)
            }}
          >
            <Pencil className="h-4 w-4" />
            編輯任務
          </button>
          <button
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
            onClick={() => handleDeleteTask(contextMenu.task)}
          >
            <Trash2 className="h-4 w-4" />
            刪除任務
          </button>
        </div>
        )
      })()}
    </div>
  )
}
