'use client'

import { useState, useMemo } from 'react'
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
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import {
  FileText,
  Calendar,
  Users,
  Search,
  RefreshCw,
  MessageSquare,
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
  Trash2,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  X,
  UsersRound,
} from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

// Mock 資料
const mockMeetingNote = {
  id: '1',
  title: '新功能個人化推薦與設計討論會議',
  date: new Date('2026-01-29'),
  participants: ['Lisa（產品經理）', 'Mike（設計師）', 'Kevin（工程師）', 'Amy（QA）'],
  discussionPoints: [
    { topic: '個人化推薦功能需求', details: 'Lisa 提出希望增加使用者個人化推薦功能，並討論需求內容。' },
    { topic: 'UI 設計稿展示', details: 'Mike 展示新的 UI 設計稿，獲得團隊認可。' },
    { topic: '技術可行性與開發時程', details: 'Kevin 評估技術可行性，預計需要 2 週開發時間。' },
    { topic: '自動化測試覆蓋率', details: 'Amy 建議將自動化測試覆蓋率提升至 85%。' },
  ],
  decisions: [
    '下週三進行設計評審會議',
    '2 月 15 日為新功能上線目標日期',
  ],
  actionItems: [
    {
      id: 't1',
      title: '準備設計評審相關資料',
      assignee: 'Mike',
      group: '設計組',
      project: '個人化推薦專案',
      priority: 'high' as const,
      startDate: new Date('2026-01-30'),
      dueDate: new Date('2026-02-04'),
      createdAt: new Date('2026-01-29T10:30:00'),
      status: 'pending' as const,
    },
    {
      id: 't2',
      title: '完成個人化推薦功能開發',
      assignee: 'Kevin',
      group: '工程組',
      project: '個人化推薦專案',
      priority: 'urgent' as const,
      startDate: new Date('2026-02-01'),
      dueDate: new Date('2026-02-12'),
      createdAt: new Date('2026-01-29T10:35:00'),
      status: 'in_progress' as const,
    },
    {
      id: 't3',
      title: '提升自動化測試覆蓋率至 85%',
      assignee: 'Amy',
      group: 'QA組',
      project: '個人化推薦專案',
      priority: 'medium' as const,
      startDate: new Date('2026-02-05'),
      dueDate: new Date('2026-02-15'),
      createdAt: new Date('2026-01-29T10:40:00'),
      status: 'pending' as const,
    },
  ],
  chatHistory: [
    { role: 'user' as const, content: '這次會議有提到什麼技術挑戰嗎？' },
    { role: 'assistant' as const, content: 'Kevin 在會議中提到，個人化推薦功能需要整合機器學習模型，預計需要 2 週的開發時間。主要挑戰包括：\n1. 資料收集與處理\n2. 模型訓練與部署\n3. 與現有系統整合' },
  ],
}

// 優先級設定 - 與任務列表一致
const priorityConfig = {
  urgent: { label: '緊急', emoji: '🔴' },
  high: { label: '高', emoji: '🟠' },
  medium: { label: '中', emoji: '🟡' },
  low: { label: '低', emoji: '🟢' },
}

// 組別選項
const groupOptions = ['設計組', '工程組', 'QA組', '行銷組', '業務組', '行政組', '客服組', '財務組']

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

interface TaskItem {
  id: string
  title: string
  assignee?: string
  group?: string
  project?: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  startDate?: Date
  dueDate?: Date
  createdAt: Date
  status: 'pending' | 'in_progress' | 'completed' | 'on_hold'
}

// 格式化日期
function formatDate(date: Date) {
  return format(date, 'M/d HH:mm', { locale: zhTW })
}

function formatShortDate(date: Date) {
  return format(date, 'M/d', { locale: zhTW })
}

// 排序圖示
function SortIcon({ field, sortField, sortDirection }: { field: string; sortField: SortField; sortDirection: SortDirection }) {
  if (sortField !== field) {
    return <ChevronsUpDown className="h-3 w-3 text-gray-300" />
  }
  return sortDirection === 'asc'
    ? <ChevronUp className="h-3 w-3 text-blue-500" />
    : <ChevronDown className="h-3 w-3 text-blue-500" />
}

// 任務行元件 - 與任務列表風格一致
function TaskRow({ task, onUpdate, onDelete }: {
  task: TaskItem
  onUpdate: (updates: Partial<TaskItem>) => void
  onDelete: () => void
}) {
  const [assigneeOpen, setAssigneeOpen] = useState(false)
  const [startDateOpen, setStartDateOpen] = useState(false)
  const [dueDateOpen, setDueDateOpen] = useState(false)
  const [priorityOpen, setPriorityOpen] = useState(false)
  const [projectOpen, setProjectOpen] = useState(false)
  const [groupOpen, setGroupOpen] = useState(false)

  const isCompleted = task.status === 'completed'
  const isOverdue = task.dueDate && task.dueDate < new Date() && !isCompleted

  return (
    <div className="group flex items-center h-11 border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
      {/* Checkbox + 狀態 */}
      <div className="w-9 flex items-center justify-center shrink-0">
        <button
          onClick={() => onUpdate({ status: isCompleted ? 'pending' : 'completed' })}
          className="p-1 rounded hover:bg-gray-200 transition-colors"
        >
          {isCompleted ? (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          ) : (
            <Circle className="h-4 w-4 text-blue-500" />
          )}
        </button>
      </div>

      {/* 任務名稱 */}
      <div className="flex-1 min-w-0 pr-2">
        <span className={cn(
          "text-sm truncate",
          isCompleted ? "line-through text-gray-400" : "text-gray-800"
        )}>
          {task.title}
        </span>
      </div>

      {/* 負責人 */}
      <div className="shrink-0 flex items-center" style={{ width: columnConfig.assignee.width }}>
        <Popover open={assigneeOpen} onOpenChange={setAssigneeOpen}>
          <PopoverTrigger asChild>
            <button className="inline-flex items-center gap-1 text-xs px-1.5 py-1 rounded hover:bg-gray-100 transition-colors w-full text-gray-600">
              <User className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1 text-left truncate">{task.assignee || '-'}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-40 p-2" align="start">
            <Input
              placeholder="輸入負責人"
              defaultValue={task.assignee}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onUpdate({ assignee: (e.target as HTMLInputElement).value })
                  setAssigneeOpen(false)
                }
              }}
              autoFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* 開始日 */}
      <div className="shrink-0 flex items-center" style={{ width: columnConfig.startDate.width }}>
        <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
          <PopoverTrigger asChild>
            <button className="inline-flex items-center gap-1 text-xs px-1.5 py-1 rounded hover:bg-gray-100 transition-colors w-full text-gray-600">
              <CalendarDays className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1 text-left">{task.startDate ? formatDate(task.startDate) : '-'}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarComponent
              mode="single"
              selected={task.startDate}
              onSelect={(date) => {
                onUpdate({ startDate: date || undefined })
                setStartDateOpen(false)
              }}
              locale={zhTW}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* 截止日 */}
      <div className="shrink-0 flex items-center" style={{ width: columnConfig.dueDate.width }}>
        <Popover open={dueDateOpen} onOpenChange={setDueDateOpen}>
          <PopoverTrigger asChild>
            <button className={cn(
              "inline-flex items-center gap-1 text-xs px-1.5 py-1 rounded hover:bg-gray-100 transition-colors w-full",
              isOverdue ? "text-red-600 bg-red-50" : "text-gray-600"
            )}>
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1 text-left">{task.dueDate ? formatDate(task.dueDate) : '-'}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarComponent
              mode="single"
              selected={task.dueDate}
              onSelect={(date) => {
                onUpdate({ dueDate: date || undefined })
                setDueDateOpen(false)
              }}
              locale={zhTW}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* 優先級 */}
      <div className="shrink-0 flex items-center" style={{ width: columnConfig.priority.width }}>
        <DropdownMenu open={priorityOpen} onOpenChange={setPriorityOpen}>
          <DropdownMenuTrigger asChild>
            <button className="inline-flex items-center gap-1 text-xs px-1.5 py-1 rounded hover:bg-gray-100 transition-colors w-full text-gray-600">
              <span className="text-sm">{priorityConfig[task.priority].emoji}</span>
              <span className="flex-1 text-left">{priorityConfig[task.priority].label}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-24">
            {(Object.keys(priorityConfig) as Array<keyof typeof priorityConfig>).map((key) => (
              <DropdownMenuItem
                key={key}
                onClick={() => onUpdate({ priority: key })}
                className="text-xs"
              >
                <span className="mr-2">{priorityConfig[key].emoji}</span>
                {priorityConfig[key].label}
                {task.priority === key && <Check className="h-3 w-3 ml-auto" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* 專案 */}
      <div className="shrink-0 flex items-center" style={{ width: columnConfig.project.width }}>
        <Popover open={projectOpen} onOpenChange={setProjectOpen}>
          <PopoverTrigger asChild>
            <button className="inline-flex items-center gap-1 text-xs px-1.5 py-1 rounded hover:bg-gray-100 transition-colors w-full text-gray-600">
              <FolderKanban className="h-3.5 w-3.5 shrink-0 text-violet-500" />
              <span className="flex-1 text-left truncate">{task.project || '-'}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2" align="start">
            <Input
              placeholder="輸入專案名稱"
              defaultValue={task.project}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onUpdate({ project: (e.target as HTMLInputElement).value })
                  setProjectOpen(false)
                }
              }}
              autoFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* 組別 */}
      <div className="shrink-0 flex items-center" style={{ width: columnConfig.group.width }}>
        <DropdownMenu open={groupOpen} onOpenChange={setGroupOpen}>
          <DropdownMenuTrigger asChild>
            <button className="inline-flex items-center gap-1 text-xs px-1.5 py-1 rounded hover:bg-gray-100 transition-colors w-full text-gray-600">
              <UsersRound className="h-3.5 w-3.5 shrink-0 text-teal-500" />
              <span className="flex-1 text-left truncate">{task.group || '-'}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-28">
            {groupOptions.map((g) => (
              <DropdownMenuItem
                key={g}
                onClick={() => onUpdate({ group: g })}
                className="text-xs"
              >
                {g}
                {task.group === g && <Check className="h-3 w-3 ml-auto" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onUpdate({ group: undefined })}
              className="text-xs text-gray-500"
            >
              <X className="h-3 w-3 mr-1" />
              清除組別
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* 加入日期 */}
      <div className="shrink-0 flex items-center" style={{ width: columnConfig.createdAt.width }}>
        <span className="text-xs text-gray-500 px-1.5">
          {formatShortDate(task.createdAt)}
        </span>
      </div>

      {/* 刪除按鈕 */}
      <div className="w-7 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onDelete}
          className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-500 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

// 新增任務行
function AddTaskRow({ onAdd, onCancel }: {
  onAdd: (task: Omit<TaskItem, 'id' | 'status' | 'createdAt'>) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState('')
  const [assignee, setAssignee] = useState('')
  const [project, setProject] = useState('')
  const [group, setGroup] = useState('')
  const [priority, setPriority] = useState<TaskItem['priority']>('medium')

  const handleSubmit = () => {
    if (!title.trim()) return
    onAdd({
      title: title.trim(),
      assignee: assignee || undefined,
      project: project || undefined,
      group: group || undefined,
      priority,
      startDate: undefined,
      dueDate: undefined,
    })
  }

  return (
    <div className="flex items-center h-11 border-b border-gray-100 bg-blue-50/30">
      <div className="w-9 flex items-center justify-center shrink-0">
        <Circle className="h-4 w-4 text-gray-300" />
      </div>
      <div className="flex-1 min-w-0 pr-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="輸入任務名稱..."
          className="h-7 text-sm border-0 bg-transparent focus-visible:ring-0 px-0"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit()
            if (e.key === 'Escape') onCancel()
          }}
        />
      </div>
      <div className="shrink-0" style={{ width: columnConfig.assignee.width }}>
        <Input value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="-" className="h-6 text-xs" />
      </div>
      <div className="shrink-0 px-1 text-xs text-gray-400" style={{ width: columnConfig.startDate.width }}>-</div>
      <div className="shrink-0 px-1 text-xs text-gray-400" style={{ width: columnConfig.dueDate.width }}>-</div>
      <div className="shrink-0" style={{ width: columnConfig.priority.width }}>
        <Select value={priority} onValueChange={(v: TaskItem['priority']) => setPriority(v)}>
          <SelectTrigger className="h-6 text-xs border-gray-200 px-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(priorityConfig) as Array<keyof typeof priorityConfig>).map((key) => (
              <SelectItem key={key} value={key} className="text-xs">
                {priorityConfig[key].emoji} {priorityConfig[key].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="shrink-0" style={{ width: columnConfig.project.width }}>
        <Input value={project} onChange={(e) => setProject(e.target.value)} placeholder="-" className="h-6 text-xs" />
      </div>
      <div className="shrink-0" style={{ width: columnConfig.group.width }}>
        <Select value={group} onValueChange={setGroup}>
          <SelectTrigger className="h-6 text-xs border-gray-200 px-1">
            <SelectValue placeholder="-" />
          </SelectTrigger>
          <SelectContent>
            {groupOptions.map((g) => (
              <SelectItem key={g} value={g} className="text-xs">{g}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="shrink-0 px-1 text-xs text-gray-400" style={{ width: columnConfig.createdAt.width }}>-</div>
      <div className="w-7 flex items-center">
        <button onClick={handleSubmit} className="p-1 rounded hover:bg-green-100 text-green-600"><Check className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  )
}

export default function MeetingNotesV2DemoPage() {
  const [tasks, setTasks] = useState<TaskItem[]>(mockMeetingNote.actionItems)
  const [showAddTask, setShowAddTask] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [sortField, setSortField] = useState<SortField>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  // 排序邏輯
  const sortedTasks = useMemo(() => {
    if (!sortField) return tasks

    return [...tasks].sort((a, b) => {
      let comparison = 0

      switch (sortField) {
        case 'title':
          comparison = a.title.localeCompare(b.title)
          break
        case 'assignee':
          comparison = (a.assignee || '').localeCompare(b.assignee || '')
          break
        case 'startDate':
          comparison = (a.startDate?.getTime() || 0) - (b.startDate?.getTime() || 0)
          break
        case 'dueDate':
          comparison = (a.dueDate?.getTime() || 0) - (b.dueDate?.getTime() || 0)
          break
        case 'priority':
          const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 }
          comparison = priorityOrder[a.priority] - priorityOrder[b.priority]
          break
        case 'project':
          comparison = (a.project || '').localeCompare(b.project || '')
          break
        case 'group':
          comparison = (a.group || '').localeCompare(b.group || '')
          break
        case 'createdAt':
          comparison = a.createdAt.getTime() - b.createdAt.getTime()
          break
      }

      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [tasks, sortField, sortDirection])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const handleRegenerate = () => {
    setIsRegenerating(true)
    setTimeout(() => setIsRegenerating(false), 2000)
  }

  const handleUpdateTask = (taskId: string, updates: Partial<TaskItem>) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t))
  }

  const handleDeleteTask = (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId))
  }

  const handleAddTask = (taskData: Omit<TaskItem, 'id' | 'status' | 'createdAt'>) => {
    const newTask: TaskItem = {
      ...taskData,
      id: `t${Date.now()}`,
      status: 'pending',
      createdAt: new Date(),
    }
    setTasks(prev => [...prev, newTask])
    setShowAddTask(false)
  }

  return (
    <div className="h-full flex bg-[#fbfbfa] overflow-hidden">
      {/* 左側列表 */}
      <div className="w-72 border-r bg-[#f7f6f3] flex flex-col shrink-0 min-h-0">
        <div className="p-3 border-b bg-[#f7f6f3]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-[#37352f]">
              <FileText className="h-4 w-4" />
              <span>會議記錄</span>
              <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-600">V2</Badge>
            </div>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-[#9b9a97]">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#9b9a97]" />
            <Input placeholder="搜尋..." className="pl-7 h-8 bg-white border-[#e3e2e0] text-xs" />
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-1.5">
            <div className="bg-[#ebebea] text-[#37352f] px-2.5 py-2 rounded-md text-sm">
              <div className="font-medium truncate text-xs">新功能個人化推薦與設計討論會議</div>
              <div className="text-xs text-[#9b9a97] mt-0.5">2026/01/29</div>
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* 右側內容 */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <ScrollArea className="flex-1 h-0">
          <div className="max-w-5xl mx-auto px-6 py-8">
            {/* 標題區 */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-[#37352f] mb-2">{mockMeetingNote.title}</h1>
              <div className="flex flex-wrap gap-3 text-sm text-[#9b9a97]">
                <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{format(mockMeetingNote.date, 'yyyy年MM月dd日 EEEE', { locale: zhTW })}</span>
                <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{mockMeetingNote.participants.length} 位參與者</span>
              </div>
            </div>

            {/* 參與者 */}
            <div className="mb-5 p-3 bg-[#f7f6f3] rounded-lg">
              <div className="text-xs uppercase tracking-wider text-[#9b9a97] mb-1.5 font-medium">參與者</div>
              <div className="flex flex-wrap gap-1.5">
                {mockMeetingNote.participants.map((p, i) => (
                  <span key={i} className="px-2 py-1 bg-white rounded text-xs text-[#37352f] border border-[#e3e2e0]">{p}</span>
                ))}
              </div>
            </div>

            {/* 討論要點 */}
            <section className="mb-5">
              <h2 className="text-base font-semibold text-[#37352f] mb-2 flex items-center gap-1.5">
                <MessageSquare className="h-4 w-4 text-[#9b9a97]" />討論要點
              </h2>
              <div className="space-y-1.5">
                {mockMeetingNote.discussionPoints.map((point, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="flex-shrink-0 w-5 h-5 rounded bg-[#f1f1ef] text-[#9b9a97] text-xs flex items-center justify-center">{i + 1}</span>
                    <div><div className="font-medium text-[#37352f] text-sm">{point.topic}</div><div className="text-[#73726e] text-xs">{point.details}</div></div>
                  </div>
                ))}
              </div>
            </section>

            {/* 決議事項 */}
            <section className="mb-5">
              <h2 className="text-base font-semibold text-[#37352f] mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-green-600" />決議事項
              </h2>
              <div className="space-y-1.5">
                {mockMeetingNote.decisions.map((d, i) => (
                  <div key={i} className="flex items-center gap-2 text-[#37352f] text-sm p-2 bg-green-50/50 rounded border border-green-100">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" /><span>{d}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* 待辦任務 - 完整表格 */}
            <section className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-base font-semibold text-[#37352f] flex items-center gap-1.5">
                  <Target className="h-4 w-4 text-blue-600" />待辦任務
                  <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-600">{tasks.length}</Badge>
                </h2>
                <div className="flex gap-1.5">
                  <Button variant="outline" size="sm" onClick={handleRegenerate} disabled={isRegenerating} className="text-xs h-7 px-2">
                    {isRegenerating ? <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}重新萃取
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setShowAddTask(true)} className="text-xs h-7 px-2">
                    <Plus className="h-3 w-3 mr-1" />手動新增
                  </Button>
                </div>
              </div>

              {/* 表頭 - 可點擊排序 */}
              <div className="flex items-center h-8 border-b border-gray-200 bg-gray-50/50 text-xs text-gray-500 font-medium">
                <div className="w-9 shrink-0" />
                <button onClick={() => handleSort('title')} className="flex-1 min-w-0 pr-2 flex items-center gap-1 hover:text-gray-700">
                  任務名稱 <SortIcon field="title" sortField={sortField} sortDirection={sortDirection} />
                </button>
                <button onClick={() => handleSort('assignee')} className="shrink-0 px-1 flex items-center gap-0.5 hover:text-gray-700" style={{ width: columnConfig.assignee.width }}>
                  負責人 <SortIcon field="assignee" sortField={sortField} sortDirection={sortDirection} />
                </button>
                <button onClick={() => handleSort('startDate')} className="shrink-0 px-1 flex items-center gap-0.5 hover:text-gray-700" style={{ width: columnConfig.startDate.width }}>
                  開始日 <SortIcon field="startDate" sortField={sortField} sortDirection={sortDirection} />
                </button>
                <button onClick={() => handleSort('dueDate')} className="shrink-0 px-1 flex items-center gap-0.5 hover:text-gray-700" style={{ width: columnConfig.dueDate.width }}>
                  截止日 <SortIcon field="dueDate" sortField={sortField} sortDirection={sortDirection} />
                </button>
                <button onClick={() => handleSort('priority')} className="shrink-0 px-1 flex items-center gap-0.5 hover:text-gray-700" style={{ width: columnConfig.priority.width }}>
                  優先級 <SortIcon field="priority" sortField={sortField} sortDirection={sortDirection} />
                </button>
                <button onClick={() => handleSort('project')} className="shrink-0 px-1 flex items-center gap-0.5 hover:text-gray-700" style={{ width: columnConfig.project.width }}>
                  專案 <SortIcon field="project" sortField={sortField} sortDirection={sortDirection} />
                </button>
                <button onClick={() => handleSort('group')} className="shrink-0 px-1 flex items-center gap-0.5 hover:text-gray-700" style={{ width: columnConfig.group.width }}>
                  組別 <SortIcon field="group" sortField={sortField} sortDirection={sortDirection} />
                </button>
                <button onClick={() => handleSort('createdAt')} className="shrink-0 px-1 flex items-center gap-0.5 hover:text-gray-700" style={{ width: columnConfig.createdAt.width }}>
                  加入日期 <SortIcon field="createdAt" sortField={sortField} sortDirection={sortDirection} />
                </button>
                <div className="w-7 shrink-0" />
              </div>

              {/* 任務列表 */}
              <div className="border border-gray-200 border-t-0 rounded-b-lg overflow-hidden">
                {sortedTasks.map((task) => (
                  <TaskRow key={task.id} task={task} onUpdate={(updates) => handleUpdateTask(task.id, updates)} onDelete={() => handleDeleteTask(task.id)} />
                ))}
                {showAddTask && <AddTaskRow onAdd={handleAddTask} onCancel={() => setShowAddTask(false)} />}
                {!showAddTask && (
                  <button onClick={() => setShowAddTask(true)} className="flex items-center w-full h-8 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-50">
                    <div className="w-9 flex items-center justify-center"><Plus className="h-3.5 w-3.5" /></div><span>新增任務</span>
                  </button>
                )}
              </div>

              <div className="mt-1.5 flex items-center gap-1 text-xs text-[#9b9a97]">
                <CheckCircle2 className="h-3 w-3 text-green-500" />任務已自動同步至主任務列表
              </div>
            </section>

            {/* 會議問答區 */}
            <section className="mt-6 pt-5 border-t border-[#e3e2e0]">
              <h2 className="text-base font-semibold text-[#37352f] mb-3 flex items-center gap-1.5">
                <MessageSquare className="h-4 w-4 text-purple-600" />會議問答
              </h2>
              <div className="space-y-2 mb-3">
                {mockMeetingNote.chatHistory.map((msg, i) => (
                  <div key={i} className={cn("p-2.5 rounded-lg text-sm", msg.role === 'user' ? "bg-blue-50 ml-10" : "bg-[#f7f6f3] mr-10")}>
                    <div className="text-xs text-[#9b9a97] mb-0.5">{msg.role === 'user' ? '你' : 'AI 助手'}</div>
                    <div className="text-[#37352f] whitespace-pre-wrap text-sm">{msg.content}</div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Textarea value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="詢問這次會議的內容..." className="min-h-[50px] bg-white resize-none text-sm" />
                <Button className="self-end bg-purple-600 hover:bg-purple-700 h-8 px-3"><Send className="h-4 w-4" /></Button>
              </div>
            </section>
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
