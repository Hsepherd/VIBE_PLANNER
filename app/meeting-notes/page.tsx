'use client'

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Calendar as CalendarComponent } from '@/components/ui/calendar'
import { useSupabaseMeetingNotes, type MeetingNote } from '@/lib/useSupabaseMeetingNotes'
import { useSupabaseTasks, type Task } from '@/lib/useSupabaseTasks'
import { useSupabaseProjects } from '@/lib/useSupabaseProjects'
import { getGroups, type Group } from '@/lib/groups'
import { getTeamMembers } from '@/lib/team-members'
import { getTags } from '@/lib/tags'
import { TaskDetailDialog } from '@/components/task/TaskDetailDialog'
import { createTasksFromMeetingNotes } from '@/lib/supabase-api'
import { createClient } from '@/lib/supabase-client'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { toast } from 'sonner'
import {
  FileText,
  Calendar,
  Users,
  Search,
  Loader2,
  RefreshCw,
  Trash2,
  MessageSquare,
  X,
  CheckCircle2,
  Target,
  Plus,
  Send,
  Sparkles,
  User,
  FolderKanban,
  CalendarDays,
  Check,
  Circle,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  UsersRound,
  Settings2,
  Eye,
  EyeOff,
} from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

// 擴充的任務類型（會議記錄用）
interface MeetingTask {
  id: string
  title: string
  description?: string    // 任務描述
  assignee: string
  group: string
  project: string
  projectId?: string
  priority: 'urgent' | 'high' | 'medium' | 'low'
  startDate: Date | null
  dueDate: Date | null
  createdAt: Date
  status: 'pending' | 'in_progress' | 'completed'
  isSystemTask?: boolean  // 是否為系統任務（已同步）
  isLegacy?: boolean      // 是否為舊資料（未同步）
}

// 聊天訊息類型
interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

// 優先級設定
const priorityConfig = {
  urgent: { label: '緊急', emoji: '🔴', color: 'text-red-600' },
  high: { label: '高', emoji: '🟠', color: 'text-orange-500' },
  medium: { label: '中', emoji: '🟡', color: 'text-yellow-500' },
  low: { label: '低', emoji: '🟢', color: 'text-green-500' },
}

// 靜態資料已移除，改用系統設定的 groups, projects, teamMembers

// 欄位設定
const columnConfig = {
  assignee: { label: '負責人', width: 90, icon: User },
  startDate: { label: '開始日', width: 95, icon: CalendarDays },
  dueDate: { label: '截止日', width: 95, icon: Calendar },
  priority: { label: '優先級', width: 75, icon: null },
  project: { label: '專案', width: 110, icon: FolderKanban },
  group: { label: '組別', width: 80, icon: UsersRound },
  createdAt: { label: '加入日期', width: 85, icon: Calendar },
}

type SortField = 'title' | 'assignee' | 'startDate' | 'dueDate' | 'priority' | 'project' | 'group' | 'createdAt' | null
type SortDirection = 'asc' | 'desc'

export default function MeetingNotesPage() {
  const {
    meetingNotes,
    isLoading,
    error,
    deleteMeetingNote,
    searchMeetingNotes,
    refresh,
  } = useSupabaseMeetingNotes()

  // 系統資料 hooks
  const { tasks: allTasks, updateTask: updateSystemTask, deleteTask: deleteSystemTask, refresh: refreshTasks } = useSupabaseTasks()
  const { projects } = useSupabaseProjects()
  const [groups, setGroups] = useState<Group[]>([])
  const [teamMembers, setTeamMembers] = useState<string[]>([])
  const [tags, setTags] = useState<{ name: string; color: string }[]>([])

  // 載入系統資料
  useEffect(() => {
    setGroups(getGroups())
    setTeamMembers(getTeamMembers())
    setTags(getTags())
  }, [])

  const [selectedNote, setSelectedNote] = useState<MeetingNote | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<MeetingNote[] | null>(null)
  const [isSearching, setIsSearching] = useState(false)

  // 任務狀態管理（保留用於舊會議記錄的本地任務）
  const [tasksByNote, setTasksByNote] = useState<Record<string, MeetingTask[]>>({})
  const [sortField, setSortField] = useState<SortField>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [isAddingTask, setIsAddingTask] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null)
  const [selectedTaskForDialog, setSelectedTaskForDialog] = useState<Task | null>(null)

  // 欄位設定
  const columnConfig = {
    title: { label: '任務名稱', defaultWidth: 200, minWidth: 100, required: true },
    assignee: { label: '負責人', defaultWidth: 90, minWidth: 60 },
    startDate: { label: '開始日', defaultWidth: 95, minWidth: 60 },
    dueDate: { label: '截止日', defaultWidth: 95, minWidth: 60 },
    priority: { label: '優先級', defaultWidth: 75, minWidth: 50 },
    project: { label: '專案', defaultWidth: 110, minWidth: 60 },
    group: { label: '組別', defaultWidth: 80, minWidth: 50 },
    createdAt: { label: '加入日期', defaultWidth: 85, minWidth: 50 },
  }

  // 欄位顯示狀態
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('meeting-notes-visible-columns')
      if (saved) {
        try {
          return { ...Object.fromEntries(Object.keys(columnConfig).map(k => [k, true])), ...JSON.parse(saved) }
        } catch {
          // ignore
        }
      }
    }
    return Object.fromEntries(Object.keys(columnConfig).map(k => [k, true]))
  })

  const toggleColumnVisibility = (column: string) => {
    // title 欄位不能隱藏
    if (column === 'title') return
    setVisibleColumns(prev => {
      const newState = { ...prev, [column]: !prev[column] }
      localStorage.setItem('meeting-notes-visible-columns', JSON.stringify(newState))
      return newState
    })
  }

  // 欄位寬度狀態（可拖曳調整）
  const defaultColumnWidths = {
    title: 200,
    assignee: 90,
    startDate: 95,
    dueDate: 95,
    priority: 75,
    project: 110,
    group: 80,
    createdAt: 85,
  }
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    // 從 localStorage 讀取已儲存的欄位寬度
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('meeting-notes-column-widths')
      if (saved) {
        try {
          return { ...defaultColumnWidths, ...JSON.parse(saved) }
        } catch {
          // ignore
        }
      }
    }
    return defaultColumnWidths
  })
  const resizingRef = useRef<{ column: string; startX: number; startWidth: number } | null>(null)
  const columnWidthsRef = useRef(columnWidths)

  // 同步 columnWidths 到 ref
  useEffect(() => {
    columnWidthsRef.current = columnWidths
  }, [columnWidths])

  // 開始拖曳調整欄位寬度
  const startResize = useCallback((column: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const currentWidth = columnWidthsRef.current[column] || defaultColumnWidths[column as keyof typeof defaultColumnWidths] || 100
    resizingRef.current = {
      column,
      startX: e.clientX,
      startWidth: currentWidth,
    }

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!resizingRef.current) return
      const { column, startX, startWidth } = resizingRef.current
      const diff = moveEvent.clientX - startX
      const newWidth = Math.max(50, startWidth + diff) // 最小寬度 50px
      setColumnWidths(prev => ({ ...prev, [column]: newWidth }))
    }

    const handleMouseUp = () => {
      if (resizingRef.current) {
        // 儲存到 localStorage（使用最新的 state）
        setColumnWidths(prev => {
          localStorage.setItem('meeting-notes-column-widths', JSON.stringify(prev))
          return prev
        })
      }
      resizingRef.current = null
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [])

  // 聊天狀態管理
  const [chatByNote, setChatByNote] = useState<Record<string, ChatMessage[]>>({})
  const [chatInput, setChatInput] = useState('')
  const [isSendingChat, setIsSendingChat] = useState(false)

  // 執行搜尋
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults(null)
      return
    }

    try {
      setIsSearching(true)
      const results = await searchMeetingNotes(searchQuery)
      setSearchResults(results)
    } catch (err) {
      console.error('搜尋失敗:', err)
    } finally {
      setIsSearching(false)
    }
  }

  // 清除搜尋
  const clearSearch = () => {
    setSearchQuery('')
    setSearchResults(null)
  }

  // 刪除會議記錄
  const handleDelete = async (id: string) => {
    if (!confirm('確定要刪除這筆會議記錄嗎？')) return

    try {
      await deleteMeetingNote(id)
      if (selectedNote?.id === id) {
        setSelectedNote(null)
      }
    } catch (err) {
      console.error('刪除失敗:', err)
      alert('刪除失敗，請稍後再試')
    }
  }

  // 顯示的會議記錄列表
  const displayNotes = searchResults || meetingNotes

  // 自動選擇第一筆（如果沒有選擇的話）
  const currentNote = selectedNote || (displayNotes.length > 0 ? displayNotes[0] : null)

  // 初始化任務（從會議記錄的 actionItems 轉換）
  const initializeTasksForNote = (note: MeetingNote): MeetingTask[] => {
    if (tasksByNote[note.id]) {
      return tasksByNote[note.id]
    }

    const tasks: MeetingTask[] = note.organized.actionItems.map((item, index) => {
      const task = typeof item === 'string' ? item : item.task || ''
      const description = typeof item === 'object' ? (item as { description?: string }).description || '' : ''
      const assignee = typeof item === 'object' ? item.assignee || '' : ''
      const group = typeof item === 'object' ? (item as { group?: string }).group || '' : ''
      const dueDate = typeof item === 'object' && item.dueDate ? new Date(item.dueDate) : null
      const startDate = typeof item === 'object' && (item as { startDate?: string }).startDate
        ? new Date((item as { startDate?: string }).startDate!)
        : note.createdAt  // 預設使用會議記錄建立日期

      return {
        id: `${note.id}-task-${index}`,
        title: task,
        description: description,
        assignee: assignee,
        group: group,
        project: '',
        priority: 'medium' as const,
        startDate: startDate,
        dueDate: dueDate,
        createdAt: note.createdAt,
        status: 'pending' as const,
      }
    })

    // 儲存到狀態
    setTasksByNote(prev => ({ ...prev, [note.id]: tasks }))
    return tasks
  }

  // 取得當前筆記關聯的系統任務
  const meetingTasks = useMemo(() => {
    if (!currentNote) return []
    return allTasks.filter(t => t.meetingNoteId === currentNote.id)
  }, [allTasks, currentNote])

  // 當選擇新的會議記錄時刷新任務
  useEffect(() => {
    if (currentNote) {
      refreshTasks()
    }
  }, [currentNote?.id])

  // 取得當前筆記的任務（優先使用系統任務，fallback 到舊資料）
  const currentTasks = useMemo(() => {
    if (!currentNote) return []

    // 優先使用資料庫關聯任務
    if (meetingTasks.length > 0) {
      return meetingTasks.map(t => ({
        id: t.id,
        title: t.title,
        description: t.description || '',
        assignee: t.assignee || '',
        group: t.groupName || '',
        project: projects.find(p => p.id === t.projectId)?.name || '',
        projectId: t.projectId,
        priority: t.priority as MeetingTask['priority'],
        startDate: t.startDate || null,
        dueDate: t.dueDate || null,
        createdAt: t.createdAt,
        status: t.status as MeetingTask['status'],
        isSystemTask: true,
        isLegacy: false,
      }))
    }

    // Fallback: 從 organized.actionItems 轉換（舊資料）
    const actionItems = currentNote.organized?.actionItems || []
    return actionItems.map((item, i) => {
      const task = typeof item === 'string' ? item : item.task || ''
      const assignee = typeof item === 'object' ? item.assignee || '' : ''
      const dueDate = typeof item === 'object' && item.dueDate ? new Date(item.dueDate) : null

      return {
        id: `legacy-${currentNote.id}-${i}`,
        title: task,
        assignee: assignee,
        group: '',
        project: '',
        priority: 'medium' as const,
        startDate: null,
        dueDate: dueDate,
        createdAt: currentNote.createdAt,
        status: 'pending' as const,
        isSystemTask: false,
        isLegacy: true,
      }
    })
  }, [currentNote, meetingTasks, projects])

  // 檢查是否有舊資料需要同步
  const hasLegacyTasks = currentTasks.some(t => t.isLegacy)

  // 同步舊資料到系統
  const syncLegacyTasks = async () => {
    if (!currentNote || !hasLegacyTasks) return

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error('請先登入')
        return
      }

      const legacyItems = currentNote.organized.actionItems || []
      const actionItems = legacyItems.map(item => ({
        task: typeof item === 'string' ? item : item.task || '',
        assignee: typeof item === 'object' ? item.assignee : undefined,
        dueDate: typeof item === 'object' ? item.dueDate : undefined,
      }))

      await createTasksFromMeetingNotes(currentNote.id, actionItems, user.id)
      await refreshTasks()
      toast.success('任務已同步到系統')
    } catch (err) {
      console.error('同步失敗:', err)
      toast.error('同步失敗，請稍後再試')
    }
  }

  // 排序後的任務
  const sortedTasks = useMemo(() => {
    if (!sortField) return currentTasks
    return [...currentTasks].sort((a, b) => {
      let comparison = 0
      switch (sortField) {
        case 'title':
          comparison = a.title.localeCompare(b.title, 'zh-TW')
          break
        case 'assignee':
          comparison = a.assignee.localeCompare(b.assignee, 'zh-TW')
          break
        case 'startDate':
          if (!a.startDate && !b.startDate) comparison = 0
          else if (!a.startDate) comparison = 1
          else if (!b.startDate) comparison = -1
          else comparison = a.startDate.getTime() - b.startDate.getTime()
          break
        case 'dueDate':
          if (!a.dueDate && !b.dueDate) comparison = 0
          else if (!a.dueDate) comparison = 1
          else if (!b.dueDate) comparison = -1
          else comparison = a.dueDate.getTime() - b.dueDate.getTime()
          break
        case 'priority':
          const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 }
          comparison = priorityOrder[a.priority] - priorityOrder[b.priority]
          break
        case 'project':
          comparison = a.project.localeCompare(b.project, 'zh-TW')
          break
        case 'group':
          comparison = a.group.localeCompare(b.group, 'zh-TW')
          break
        case 'createdAt':
          comparison = a.createdAt.getTime() - b.createdAt.getTime()
          break
      }
      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [currentTasks, sortField, sortDirection])

  // 切換排序
  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc')
      } else {
        setSortField(null)
        setSortDirection('asc')
      }
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  // 更新任務（支援系統任務和本地任務）
  const updateTask = async (taskId: string, updates: Partial<MeetingTask>) => {
    if (!currentNote) return

    // 檢查是否為系統任務
    const task = currentTasks.find(t => t.id === taskId)
    if (task?.isSystemTask) {
      // 系統任務：同步到 Supabase
      try {
        const systemUpdates: Record<string, unknown> = {}
        if ('assignee' in updates) systemUpdates.assignee = updates.assignee || undefined
        if ('group' in updates) systemUpdates.groupName = updates.group || undefined
        if ('project' in updates) {
          // 用專案名稱查找專案 ID
          const proj = projects.find(p => p.name === updates.project)
          systemUpdates.projectId = proj?.id || undefined
        }
        if ('priority' in updates) systemUpdates.priority = updates.priority
        if ('startDate' in updates) systemUpdates.startDate = updates.startDate || undefined
        if ('dueDate' in updates) systemUpdates.dueDate = updates.dueDate || undefined
        if ('status' in updates) systemUpdates.status = updates.status

        await updateSystemTask(taskId, systemUpdates as Partial<Task>)
      } catch (err) {
        console.error('更新任務失敗:', err)
        toast.error('更新失敗')
      }
    } else {
      // 本地任務：更新本地狀態
      setTasksByNote(prev => ({
        ...prev,
        [currentNote.id]: prev[currentNote.id].map(t =>
          t.id === taskId ? { ...t, ...updates } : t
        )
      }))
    }
  }

  // 刪除任務（支援系統任務和本地任務）
  const deleteTask = async (taskId: string) => {
    if (!currentNote) return

    const task = currentTasks.find(t => t.id === taskId)
    if (task?.isSystemTask) {
      // 系統任務：從 Supabase 刪除
      try {
        await deleteSystemTask(taskId)
        toast.success('任務已刪除')
      } catch (err) {
        console.error('刪除任務失敗:', err)
        toast.error('刪除失敗')
      }
    } else {
      // 本地任務：從本地狀態刪除
      setTasksByNote(prev => ({
        ...prev,
        [currentNote.id]: prev[currentNote.id].filter(t => t.id !== taskId)
      }))
    }
  }

  // 新增任務
  const addTask = () => {
    if (!currentNote || !newTaskTitle.trim()) return
    const newTask: MeetingTask = {
      id: `${currentNote.id}-task-${Date.now()}`,
      title: newTaskTitle.trim(),
      assignee: '',
      group: '',
      project: '',
      priority: 'medium',
      startDate: null,
      dueDate: null,
      createdAt: new Date(),
      status: 'pending',
    }
    setTasksByNote(prev => ({
      ...prev,
      [currentNote.id]: [...(prev[currentNote.id] || []), newTask]
    }))
    setNewTaskTitle('')
    setIsAddingTask(false)
  }

  // 重新萃取任務狀態
  const [isRegenerating, setIsRegenerating] = useState(false)

  // 重新萃取任務
  const regenerateTasks = async () => {
    if (!currentNote || isRegenerating) return

    const confirmed = window.confirm(
      '確定要重新萃取任務嗎？\n\n這會：\n1. 使用 AI 重新解析會議內容\n2. 刪除現有的關聯任務\n3. 建立新的任務（正確分離負責人和組別）\n\n此操作無法復原。'
    )

    if (!confirmed) return

    setIsRegenerating(true)
    try {
      const response = await fetch('/api/meeting-notes/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingNoteId: currentNote.id }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '重新萃取失敗')
      }

      toast.success(`已重新萃取 ${result.tasksCount} 個任務`)

      // 重新載入會議記錄和任務
      await refresh()
      await refreshTasks()

      // 清除本地任務快取
      setTasksByNote(prev => {
        const newState = { ...prev }
        delete newState[currentNote.id]
        return newState
      })
    } catch (error) {
      console.error('Regenerate tasks error:', error)
      toast.error(error instanceof Error ? error.message : '重新萃取失敗')
    } finally {
      setIsRegenerating(false)
    }
  }

  // 取得當前筆記的聊天記錄
  const currentChat = currentNote ? (chatByNote[currentNote.id] || []) : []

  // 發送聊天訊息
  const sendChatMessage = async () => {
    if (!currentNote || !chatInput.trim() || isSendingChat) return

    // 捕獲 noteId 以避免閉包問題
    const noteId = currentNote.id

    // 準備聊天歷史（只包含 role 和 content）- 在加入新訊息前取得
    const currentChatHistory = chatByNote[noteId] || []
    const chatHistory = currentChatHistory.map(msg => ({
      role: msg.role,
      content: msg.content
    }))

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: chatInput.trim(),
      timestamp: new Date(),
    }

    // 建立 AI 訊息佔位符
    const aiMessageId = `msg-${Date.now() + 1}`
    const aiMessage: ChatMessage = {
      id: aiMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    }

    // 先加入使用者訊息和 AI 佔位符
    setChatByNote(prev => ({
      ...prev,
      [noteId]: [...(prev[noteId] || []), userMessage, aiMessage]
    }))

    const question = chatInput.trim()
    setChatInput('')
    setIsSendingChat(true)

    try {

      // 呼叫串流 API
      const response = await fetch('/api/meeting-notes/qa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          meetingNoteId: noteId,
          question,
          chatHistory,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `API 錯誤: ${response.status}`)
      }

      // 讀取串流回應
      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('無法讀取回應串流')
      }

      const decoder = new TextDecoder()
      let accumulatedContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue

          const data = line.slice(6).trim()
          if (!data || data === '[DONE]') continue

          try {
            const event = JSON.parse(data)

            if (event.type === 'content') {
              // 累積內容並即時更新
              accumulatedContent += event.content
              setChatByNote(prev => ({
                ...prev,
                [noteId]: prev[noteId].map(msg =>
                  msg.id === aiMessageId
                    ? { ...msg, content: accumulatedContent }
                    : msg
                )
              }))
            } else if (event.type === 'done') {
              // 完成，使用完整內容更新
              setChatByNote(prev => ({
                ...prev,
                [noteId]: prev[noteId].map(msg =>
                  msg.id === aiMessageId
                    ? { ...msg, content: event.fullContent || accumulatedContent }
                    : msg
                )
              }))
            } else if (event.type === 'error') {
              throw new Error(event.error || '回覆生成失敗')
            }
          } catch (parseError) {
            // 忽略 JSON 解析錯誤（可能是不完整的資料）
            if (parseError instanceof SyntaxError) continue
            throw parseError
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error)
      const errorMessage = error instanceof Error ? error.message : '發送訊息失敗'
      toast.error(errorMessage)

      // 更新 AI 訊息顯示錯誤
      setChatByNote(prev => ({
        ...prev,
        [noteId]: prev[noteId].map(msg =>
          msg.id === aiMessageId
            ? { ...msg, content: `❌ 錯誤：${errorMessage}` }
            : msg
        )
      }))
    } finally {
      setIsSendingChat(false)
    }
  }

  // 排序圖示元件
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ChevronsUpDown className="h-3 w-3 text-[#9b9a97]" />
    }
    return sortDirection === 'asc'
      ? <ChevronUp className="h-3 w-3 text-[#37352f]" />
      : <ChevronDown className="h-3 w-3 text-[#37352f]" />
  }

  // 任務列元件（含展開功能）- 使用動態欄位寬度
  const TaskRow = ({ task }: { task: MeetingTask }) => {
    const isExpanded = expandedTaskId === task.id

    return (
      <div className="border-b border-[#f1f1ef] last:border-b-0">
        {/* 主要列 */}
        <div className="group flex items-center gap-0 py-2 px-3 hover:bg-[#f7f6f3] rounded-md transition-colors text-sm">
          {/* 勾選 */}
          <button
            onClick={() => updateTask(task.id, { status: task.status === 'completed' ? 'pending' : 'completed' })}
            className="flex-shrink-0 w-6"
          >
            {task.status === 'completed' ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
              <Circle className="h-4 w-4 text-[#d3d3d0] hover:text-[#9b9a97]" />
            )}
          </button>

          {/* 任務名稱 - 點擊開啟詳細 */}
          <div
            className={cn(
              "truncate cursor-pointer hover:text-blue-600 flex items-center gap-1",
              task.status === 'completed' && "line-through text-[#9b9a97]"
            )}
            style={{ width: columnWidths.title, minWidth: 100 }}
            onClick={() => {
              // 將 MeetingTask 轉換為 Task 格式以供 Dialog 使用
              const taskForDialog: Task = {
                id: task.id,
                title: task.title,
                description: task.description || '',
                status: task.status,
                priority: task.priority,
                projectId: task.projectId,
                assignee: task.assignee || undefined,
                dueDate: task.dueDate || undefined,
                startDate: task.startDate || undefined,
                createdAt: task.createdAt,
                updatedAt: task.createdAt,
                groupName: task.group || undefined,
              }
              setSelectedTaskForDialog(taskForDialog)
            }}
          >
            <span className="truncate">{task.title}</span>
          </div>

          {/* 負責人 */}
          {visibleColumns.assignee && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-1 text-[#73726e] hover:text-[#37352f] truncate"
                  style={{ width: columnWidths.assignee, minWidth: 60 }}
                >
                  <User className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{task.assignee || '未指派'}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => updateTask(task.id, { assignee: '' })}>
                  未指派
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {teamMembers.map(name => (
                  <DropdownMenuItem key={name} onClick={() => updateTask(task.id, { assignee: name })}>
                    {name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* 開始日 */}
          {visibleColumns.startDate && (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className="flex items-center gap-1 text-[#73726e] hover:text-[#37352f]"
                  style={{ width: columnWidths.startDate, minWidth: 60 }}
                >
                  <CalendarDays className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">
                    {task.startDate ? format(task.startDate, 'M/dd') : '-'}
                  </span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={task.startDate || undefined}
                  onSelect={(date) => updateTask(task.id, { startDate: date || null })}
                  locale={zhTW}
                />
              </PopoverContent>
            </Popover>
          )}

          {/* 截止日 */}
          {visibleColumns.dueDate && (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className="flex items-center gap-1 text-[#73726e] hover:text-[#37352f]"
                  style={{ width: columnWidths.dueDate, minWidth: 60 }}
                >
                  <Calendar className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">
                    {task.dueDate ? format(task.dueDate, 'M/dd') : '-'}
                  </span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={task.dueDate || undefined}
                  onSelect={(date) => updateTask(task.id, { dueDate: date || null })}
                  locale={zhTW}
                />
              </PopoverContent>
            </Popover>
          )}

          {/* 優先級 */}
          {visibleColumns.priority && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center justify-center"
                  style={{ width: columnWidths.priority, minWidth: 50 }}
                >
                  <span>{priorityConfig[task.priority].emoji}</span>
                  <span className="ml-1 text-xs text-[#73726e]">{priorityConfig[task.priority].label}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center">
                {Object.entries(priorityConfig).map(([key, config]) => (
                  <DropdownMenuItem
                    key={key}
                    onClick={() => updateTask(task.id, { priority: key as MeetingTask['priority'] })}
                  >
                    {config.emoji} {config.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* 專案 */}
          {visibleColumns.project && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-1 text-[#73726e] hover:text-[#37352f] truncate"
                  style={{ width: columnWidths.project, minWidth: 60 }}
                >
                  <FolderKanban className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{task.project || '未分類'}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => updateTask(task.id, { project: '' })}>
                  未分類
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {projects.map(proj => (
                  <DropdownMenuItem key={proj.id} onClick={() => updateTask(task.id, { project: proj.name })}>
                    {proj.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* 組別 */}
          {visibleColumns.group && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-1 text-[#73726e] hover:text-[#37352f] truncate"
                  style={{ width: columnWidths.group, minWidth: 50 }}
                >
                  <UsersRound className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{task.group || '未分組'}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => updateTask(task.id, { group: '' })}>
                  未分組
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {groups.map(g => (
                  <DropdownMenuItem key={g.name} onClick={() => updateTask(task.id, { group: g.name })}>
                    {g.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* 加入日期 */}
          {visibleColumns.createdAt && (
            <div
              className="text-[#9b9a97] text-xs"
              style={{ width: columnWidths.createdAt, minWidth: 50 }}
            >
              {format(task.createdAt, 'M/dd')}
            </div>
          )}

          {/* 刪除按鈕 */}
          <button
            onClick={() => deleteTask(task.id)}
            className="opacity-0 group-hover:opacity-100 p-1 text-[#9b9a97] hover:text-red-500 transition-opacity w-6 flex-shrink-0"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>

        {/* 展開的詳情區 */}
        {isExpanded && (
          <div className="px-10 py-3 bg-gray-50 border-t border-gray-100">
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span>優先級: {priorityConfig[task.priority].label}</span>
              {task.startDate && <span>開始: {format(task.startDate, 'MM/dd')}</span>}
              {task.dueDate && <span>截止: {format(task.dueDate, 'MM/dd')}</span>}
              {task.assignee && <span>負責人: {task.assignee}</span>}
              {task.group && <span>組別: {task.group}</span>}
            </div>
            {task.isSystemTask && (
              <div className="mt-2">
                <a
                  href={`/tasks?highlight=${task.id}`}
                  className="text-xs text-blue-500 hover:underline"
                >
                  在任務列表中查看完整詳情 →
                </a>
              </div>
            )}
            {task.isLegacy && (
              <div className="mt-2 text-xs text-amber-600">
                ⚠️ 這是舊會議記錄的任務，尚未同步到系統
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="h-full flex bg-[#fbfbfa] overflow-hidden">
      {/* 左側列表 - Notion 風格 */}
      <div className="w-80 border-r bg-[#f7f6f3] flex flex-col shrink-0 min-h-0">
        {/* 標題區 */}
        <div className="p-4 border-b bg-[#f7f6f3]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-[#37352f]">
              <FileText className="h-4 w-4" />
              <span>會議記錄</span>
              {searchResults && (
                <Badge variant="secondary" className="text-xs bg-[#e3e2e0] text-[#73726e]">
                  {searchResults.length} 筆結果
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={refresh}
              disabled={isLoading}
              className="h-7 w-7 p-0 text-[#9b9a97] hover:text-[#37352f] hover:bg-[#ebebea]"
            >
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </Button>
          </div>
        </div>

        {/* 搜尋 */}
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9b9a97]" />
            <Input
              placeholder="搜尋會議記錄..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-9 pr-9 bg-white border-[#e3e2e0] text-sm placeholder:text-[#9b9a97] focus-visible:ring-[#2eaadc]"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSearch}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0 text-[#9b9a97] hover:text-[#37352f]"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        {/* 列表 */}
        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-[#9b9a97]" />
            </div>
          ) : error ? (
            <div className="p-4 text-center">
              <p className="text-sm text-red-500 mb-2">載入失敗</p>
              <Button variant="outline" size="sm" onClick={refresh}>
                重試
              </Button>
            </div>
          ) : displayNotes.length === 0 ? (
            <div className="p-6 text-center">
              <FileText className="h-10 w-10 mx-auto mb-3 text-[#c4c4c2]" />
              <p className="text-sm text-[#9b9a97]">
                {searchResults ? '沒有找到相關會議記錄' : '還沒有會議記錄'}
              </p>
              {searchResults && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSearch}
                  className="mt-2 text-[#2eaadc]"
                >
                  清除搜尋
                </Button>
              )}
            </div>
          ) : (
            <div className="p-2 space-y-0.5">
              {displayNotes.map((note) => (
                <div
                  key={note.id}
                  onClick={() => setSelectedNote(note)}
                  className={cn(
                    "group w-full text-left px-3 py-2.5 rounded-md text-sm transition-all cursor-pointer",
                    currentNote?.id === note.id
                      ? "bg-[#ebebea] text-[#37352f]"
                      : "text-[#73726e] hover:bg-[#ebebea]/50"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate text-[#37352f]">{note.title}</div>
                      <div className="text-xs text-[#9b9a97] mt-0.5">
                        {format(note.date, 'yyyy/MM/dd', { locale: zhTW })}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(note.id)
                      }}
                      className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0 text-[#9b9a97] hover:text-red-500 hover:bg-red-50 transition-opacity"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* 右側內容 */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {currentNote ? (
          <ScrollArea className="flex-1 h-0">
            <div className="max-w-4xl mx-auto px-8 py-8">
              {/* 標題區 */}
              <div className="mb-6">
                <h1 className="text-3xl font-bold text-[#37352f] mb-3 leading-tight">
                  {currentNote.title}
                </h1>
                <div className="flex flex-wrap gap-4 text-sm text-[#9b9a97]">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    {format(currentNote.date, 'yyyy年MM月dd日 EEEE', { locale: zhTW })}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Users className="h-4 w-4" />
                    {currentNote.participants.length} 位參與者
                  </span>
                </div>
              </div>

              {/* 參與者 */}
              {currentNote.participants.length > 0 && (
                <div className="mb-6 p-4 bg-[#f7f6f3] rounded-lg">
                  <div className="text-xs uppercase tracking-wider text-[#9b9a97] mb-2 font-medium">
                    參與者
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {currentNote.participants.map((p, i) => (
                      <span
                        key={i}
                        className="px-3 py-1.5 bg-white rounded-md text-sm text-[#37352f] border border-[#e3e2e0]"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 討論要點 */}
              {currentNote.organized.discussionPoints.length > 0 && (
                <section className="mb-6">
                  <h2 className="text-lg font-semibold text-[#37352f] mb-3 flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-[#9b9a97]" />
                    討論要點
                  </h2>
                  <div className="space-y-2">
                    {currentNote.organized.discussionPoints.map((point, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded bg-[#f1f1ef] text-[#9b9a97] text-sm flex items-center justify-center font-medium">
                          {i + 1}
                        </span>
                        <div className="flex-1">
                          <div className="font-medium text-[#37352f]">
                            {typeof point === 'string' ? point : point.topic || ''}
                          </div>
                          {typeof point === 'object' && point.details && (
                            <div className="text-[#73726e] text-sm mt-1">
                              {point.details}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* 決議事項 */}
              {currentNote.organized.decisions.length > 0 && (
                <section className="mb-6">
                  <h2 className="text-lg font-semibold text-[#37352f] mb-3 flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    決議事項
                  </h2>
                  <div className="space-y-2">
                    {currentNote.organized.decisions.map((d, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 text-[#37352f] p-3 bg-green-50/50 rounded-lg border border-green-100"
                      >
                        <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                        <span>{typeof d === 'string' ? d : (d as { content?: string }).content || d}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* 待辦任務 - 表格式 */}
              <section className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold text-[#37352f] flex items-center gap-2">
                    <Target className="h-5 w-5 text-blue-600" />
                    待辦任務
                    <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                      {sortedTasks.length}
                    </Badge>
                  </h2>
                  <div className="flex gap-2">
                    {/* 欄位顯示設定 */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="text-xs h-7">
                          <Settings2 className="h-3 w-3 mr-1" />
                          欄位
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        {Object.entries(columnConfig).map(([key, config]) => (
                          <DropdownMenuItem
                            key={key}
                            onClick={(e) => {
                              e.preventDefault()
                              toggleColumnVisibility(key)
                            }}
                            disabled={'required' in config && config.required}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            {visibleColumns[key] ? (
                              <Eye className="h-4 w-4 text-green-600" />
                            ) : (
                              <EyeOff className="h-4 w-4 text-gray-400" />
                            )}
                            <span className={!visibleColumns[key] ? 'text-gray-400' : ''}>
                              {config.label}
                            </span>
                            {'required' in config && config.required && (
                              <span className="text-[10px] text-gray-400 ml-auto">必顯示</span>
                            )}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={regenerateTasks}
                      disabled={isRegenerating}
                      className="text-xs h-7"
                    >
                      {isRegenerating ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <Sparkles className="h-3 w-3 mr-1" />
                      )}
                      {isRegenerating ? '萃取中...' : '重新萃取'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsAddingTask(true)}
                      className="text-xs h-7"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      手動新增
                    </Button>
                  </div>
                </div>

                {/* 舊資料同步提示 */}
                {hasLegacyTasks && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3 text-sm flex items-center justify-between">
                    <span className="text-amber-800">
                      ⚠️ 這是舊會議記錄，任務尚未同步到系統。
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={syncLegacyTasks}
                      className="text-amber-700 border-amber-300 hover:bg-amber-100"
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      立即同步
                    </Button>
                  </div>
                )}

                {/* 表頭 - 可調整寬度 */}
                <div className="flex items-center gap-0 py-2 px-3 bg-[#f7f6f3] rounded-t-lg text-xs font-medium text-[#9b9a97] border-b border-[#e3e2e0] select-none">
                  <div className="w-6 flex-shrink-0" /> {/* 勾選佔位 */}

                  {/* 任務名稱 - 彈性寬度 */}
                  <div className="relative flex items-center" style={{ width: columnWidths.title, minWidth: 100 }}>
                    <button
                      onClick={() => toggleSort('title')}
                      className="flex-1 flex items-center gap-1 hover:text-[#37352f] truncate pr-2"
                    >
                      任務名稱 <SortIcon field="title" />
                    </button>
                    <div
                      className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize group"
                      onMouseDown={(e) => startResize('title', e)}
                    >
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-transparent group-hover:bg-blue-400 rounded transition-colors" />
                    </div>
                  </div>

                  {/* 負責人 */}
                  {visibleColumns.assignee && (
                    <div className="relative flex items-center" style={{ width: columnWidths.assignee, minWidth: 60 }}>
                      <button
                        onClick={() => toggleSort('assignee')}
                        className="flex-1 flex items-center gap-1 hover:text-[#37352f] truncate pr-2"
                      >
                        負責人 <SortIcon field="assignee" />
                      </button>
                      <div
                        className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize group"
                        onMouseDown={(e) => startResize('assignee', e)}
                      >
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-transparent group-hover:bg-blue-400 rounded transition-colors" />
                      </div>
                    </div>
                  )}

                  {/* 開始日 */}
                  {visibleColumns.startDate && (
                    <div className="relative flex items-center" style={{ width: columnWidths.startDate, minWidth: 60 }}>
                      <button
                        onClick={() => toggleSort('startDate')}
                        className="flex-1 flex items-center gap-1 hover:text-[#37352f] truncate pr-2"
                      >
                        開始日 <SortIcon field="startDate" />
                      </button>
                      <div
                        className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize group"
                        onMouseDown={(e) => startResize('startDate', e)}
                      >
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-transparent group-hover:bg-blue-400 rounded transition-colors" />
                      </div>
                    </div>
                  )}

                  {/* 截止日 */}
                  {visibleColumns.dueDate && (
                    <div className="relative flex items-center" style={{ width: columnWidths.dueDate, minWidth: 60 }}>
                      <button
                        onClick={() => toggleSort('dueDate')}
                        className="flex-1 flex items-center gap-1 hover:text-[#37352f] truncate pr-2"
                      >
                        截止日 <SortIcon field="dueDate" />
                      </button>
                      <div
                        className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize group"
                        onMouseDown={(e) => startResize('dueDate', e)}
                      >
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-transparent group-hover:bg-blue-400 rounded transition-colors" />
                      </div>
                    </div>
                  )}

                  {/* 優先級 */}
                  {visibleColumns.priority && (
                    <div className="relative flex items-center" style={{ width: columnWidths.priority, minWidth: 50 }}>
                      <button
                        onClick={() => toggleSort('priority')}
                        className="flex-1 flex items-center justify-center gap-1 hover:text-[#37352f] truncate pr-2"
                      >
                        優先級 <SortIcon field="priority" />
                      </button>
                      <div
                        className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize group"
                        onMouseDown={(e) => startResize('priority', e)}
                      >
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-transparent group-hover:bg-blue-400 rounded transition-colors" />
                      </div>
                    </div>
                  )}

                  {/* 專案 */}
                  {visibleColumns.project && (
                    <div className="relative flex items-center" style={{ width: columnWidths.project, minWidth: 60 }}>
                      <button
                        onClick={() => toggleSort('project')}
                        className="flex-1 flex items-center gap-1 hover:text-[#37352f] truncate pr-2"
                      >
                        專案 <SortIcon field="project" />
                      </button>
                      <div
                        className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize group"
                        onMouseDown={(e) => startResize('project', e)}
                      >
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-transparent group-hover:bg-blue-400 rounded transition-colors" />
                      </div>
                    </div>
                  )}

                  {/* 組別 */}
                  {visibleColumns.group && (
                    <div className="relative flex items-center" style={{ width: columnWidths.group, minWidth: 50 }}>
                      <button
                        onClick={() => toggleSort('group')}
                        className="flex-1 flex items-center gap-1 hover:text-[#37352f] truncate pr-2"
                      >
                        組別 <SortIcon field="group" />
                      </button>
                      <div
                        className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize group"
                        onMouseDown={(e) => startResize('group', e)}
                      >
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-transparent group-hover:bg-blue-400 rounded transition-colors" />
                      </div>
                    </div>
                  )}

                  {/* 加入日期 */}
                  {visibleColumns.createdAt && (
                    <div className="relative flex items-center" style={{ width: columnWidths.createdAt, minWidth: 50 }}>
                      <button
                        onClick={() => toggleSort('createdAt')}
                        className="flex-1 flex items-center gap-1 hover:text-[#37352f] truncate pr-2"
                      >
                        加入日期 <SortIcon field="createdAt" />
                      </button>
                      <div
                        className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize group"
                        onMouseDown={(e) => startResize('createdAt', e)}
                      >
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-transparent group-hover:bg-blue-400 rounded transition-colors" />
                      </div>
                    </div>
                  )}

                  <div className="w-6 flex-shrink-0" /> {/* 刪除按鈕佔位 */}
                </div>

                {/* 任務列表 */}
                <div className="bg-white rounded-b-lg border border-t-0 border-[#e3e2e0]">
                  {sortedTasks.length === 0 ? (
                    <div className="py-8 text-center text-[#9b9a97] text-sm">
                      尚無任務
                    </div>
                  ) : (
                    sortedTasks.map((task) => (
                      <TaskRow key={task.id} task={task} />
                    ))
                  )}

                  {/* 新增任務列 */}
                  {isAddingTask && (
                    <div className="flex items-center gap-2 py-2 px-3 border-t border-[#f1f1ef]">
                      <Circle className="h-4 w-4 text-[#d3d3d0] flex-shrink-0" />
                      <Input
                        autoFocus
                        placeholder="輸入任務名稱..."
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') addTask()
                          if (e.key === 'Escape') {
                            setIsAddingTask(false)
                            setNewTaskTitle('')
                          }
                        }}
                        className="flex-1 h-7 text-sm border-0 p-0 focus-visible:ring-0"
                      />
                      <Button size="sm" variant="ghost" onClick={addTask} className="h-6 px-2">
                        <Check className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setIsAddingTask(false)
                          setNewTaskTitle('')
                        }}
                        className="h-6 px-2"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}

                  {/* 新增按鈕 */}
                  {!isAddingTask && (
                    <button
                      onClick={() => setIsAddingTask(true)}
                      className="w-full flex items-center gap-2 py-2 px-3 text-sm text-[#9b9a97] hover:bg-[#f7f6f3] border-t border-[#f1f1ef] transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                      新增任務
                    </button>
                  )}
                </div>

                <p className="text-xs text-[#9b9a97] mt-2 flex items-center gap-1">
                  <Check className="h-3 w-3" />
                  任務已自動同步至主任務列表
                </p>
              </section>

              {/* 會議問答 */}
              <section className="mb-6">
                <h2 className="text-lg font-semibold text-[#37352f] mb-3 flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-purple-600" />
                  會議問答
                </h2>

                <div className="bg-[#f7f6f3] rounded-lg p-4">
                  {/* 聊天記錄 */}
                  {currentChat.length > 0 && (
                    <div className="space-y-4 mb-4">
                      {currentChat.map((msg) => (
                        <div
                          key={msg.id}
                          className={cn(
                            "p-3 rounded-lg",
                            msg.role === 'user'
                              ? "bg-white border border-[#e3e2e0]"
                              : "bg-purple-50 border border-purple-100"
                          )}
                        >
                          <div className="text-xs text-[#9b9a97] mb-1">
                            {msg.role === 'user' ? '你' : 'AI 助手'}
                          </div>
                          <div className="text-sm text-[#37352f] whitespace-pre-wrap">
                            {msg.content}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 輸入框 */}
                  <div className="flex gap-2">
                    <Input
                      placeholder="詢問這次會議的內容..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendChatMessage()}
                      disabled={isSendingChat}
                      className="flex-1 bg-white"
                    />
                    <Button
                      onClick={sendChatMessage}
                      disabled={!chatInput.trim() || isSendingChat}
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      {isSendingChat ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </section>

              {/* 原始內容 */}
              {currentNote.markdown && (
                <details className="mt-6 pt-6 border-t border-[#e3e2e0]">
                  <summary className="text-sm text-[#9b9a97] cursor-pointer hover:text-[#37352f]">
                    查看原始會議記錄
                  </summary>
                  <div className="mt-4 p-4 bg-[#f7f6f3] rounded-lg">
                    <pre className="text-sm text-[#73726e] whitespace-pre-wrap font-mono">
                      {currentNote.markdown}
                    </pre>
                  </div>
                </details>
              )}
            </div>
          </ScrollArea>
        ) : (
          // 空狀態
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md">
              <FileText className="h-16 w-16 mx-auto mb-4 text-[#c4c4c2]" />
              <h3 className="text-lg font-semibold text-[#37352f] mb-2">
                選擇一個會議記錄
              </h3>
              <p className="text-[#9b9a97]">
                從左側列表選擇一個會議記錄來查看內容，或在對話頁面使用會議記錄整理功能創建新的記錄。
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 任務詳細彈窗 */}
      <TaskDetailDialog
        task={selectedTaskForDialog}
        onClose={() => setSelectedTaskForDialog(null)}
        meetingTranscript={currentNote?.rawContent}
        onUpdate={async (id, updates) => {
          // 更新系統任務
          await updateSystemTask(id, updates)
          // 同步更新本地任務狀態
          if (selectedNote) {
            const noteId = selectedNote.id
            setTasksByNote(prev => ({
              ...prev,
              [noteId]: (prev[noteId] || []).map(t =>
                t.id === id
                  ? {
                      ...t,
                      title: updates.title ?? t.title,
                      assignee: updates.assignee ?? t.assignee,
                      startDate: updates.startDate ?? t.startDate,
                      dueDate: updates.dueDate ?? t.dueDate,
                      priority: (updates.priority as MeetingTask['priority']) ?? t.priority,
                      project: updates.projectId ? projects.find(p => p.id === updates.projectId)?.name || t.project : t.project,
                      projectId: updates.projectId ?? t.projectId,
                      group: updates.groupName ?? t.group,
                      status: (updates.status as MeetingTask['status']) ?? t.status,
                    }
                  : t
              ),
            }))
          }
          // 更新 dialog 中的 task
          setSelectedTaskForDialog(prev => prev ? { ...prev, ...updates } : null)
        }}
        onComplete={async (id) => {
          await updateSystemTask(id, { status: 'completed', completedAt: new Date() })
        }}
        teamMembers={teamMembers}
        availableTags={tags}
        availableGroups={groups}
        projects={projects}
      />
    </div>
  )
}
