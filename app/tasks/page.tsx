'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { DateTimePicker } from '@/components/ui/datetime-picker'
import { useSupabaseTasks, type Task, type RecurrenceType } from '@/lib/useSupabaseTasks'
import { useSupabaseProjects, type Project } from '@/lib/useSupabaseProjects'
import type { RecurrenceConfig } from '@/lib/supabase-api'
import { RecurrenceSelector, RecurrenceBadge } from '@/components/task/RecurrenceSelector'
import { getTeamMembers, addTeamMember, removeTeamMember } from '@/lib/team-members'
import { getTags, addTag, removeTag, getTagColor, TAG_COLORS, type Tag } from '@/lib/tags'
import { getGroups, addGroup, removeGroup, getGroupColor, GROUP_COLORS, type Group } from '@/lib/groups'
import { format, isToday, isTomorrow, isThisWeek, isPast, addDays, startOfDay } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import {
  DndContext,
  closestCenter,
  pointerWithin,
  rectIntersection,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
  type CollisionDetection,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Check,
  CheckCircle2,
  Circle,
  Trash2,
  Plus,
  Calendar,
  ChevronDown,
  ChevronRight,
  ArrowUpDown,
  RefreshCw,
  Loader2,
  User,
  FolderOpen,
  FolderKanban,
  FileText,
  MessageSquareQuote,
  ListChecks,
  Info,
  X,
  CalendarDays,
  Settings,
  Tag as TagIcon,
  AlertCircle,
  Filter,
  Users,
  Search,
  CheckSquare,
  Square,
  Edit3,
  Pencil,
  GripVertical,
  Undo2,
  LayoutGrid,
  ChevronsUpDown,
  ChevronUp,
  Clock,
} from 'lucide-react'

type SortMode = 'priority' | 'dueDate' | 'assignee' | 'tag' | 'group' | 'project'

// 二次排序欄位
type SecondarySort = {
  field: 'title' | 'assignee' | 'startDate' | 'dueDate' | 'priority' | null
  direction: 'asc' | 'desc'
}

// 優先級設定
type PriorityConfig = {
  [key in 'urgent' | 'high' | 'medium' | 'low']: {
    label: string
    emoji: string
    color: 'destructive' | 'default' | 'secondary' | 'outline'
  }
}

const priorityConfig: PriorityConfig = {
  urgent: { label: '緊急', emoji: '🔴', color: 'destructive' },
  high: { label: '高', emoji: '🟠', color: 'default' },
  medium: { label: '中', emoji: '🟡', color: 'secondary' },
  low: { label: '低', emoji: '🟢', color: 'outline' },
}

// 解析 description 的各個區塊
function parseDescription(description: string) {
  const sections: {
    summary: string
    steps: string[]
    context: string
    quotes: string[]
  } = {
    summary: '',
    steps: [],
    context: '',
    quotes: [],
  }

  const summaryMatch = description.match(/【任務摘要】\s*([\s\S]*?)(?=【執行細節】|【會議脈絡】|【原文引用】|$)/i)
  const stepsMatch = description.match(/【執行細節】\s*([\s\S]*?)(?=【會議脈絡】|【原文引用】|$)/i)
  const contextMatch = description.match(/【會議脈絡】\s*([\s\S]*?)(?=【原文引用】|$)/i)
  const quotesMatch = description.match(/【原文引用】\s*([\s\S]*?)$/i)

  if (summaryMatch) sections.summary = summaryMatch[1].trim()

  if (stepsMatch) {
    const stepsText = stepsMatch[1].trim()
    const stepLines = stepsText.split('\n').filter(line => line.trim())
    sections.steps = stepLines.map(line => line.replace(/^\d+\.\s*/, '').trim())
  }

  if (contextMatch) sections.context = contextMatch[1].trim()

  if (quotesMatch) {
    const quotesText = quotesMatch[1].trim()
    // 如果原文引用區塊有內容，嘗試解析
    if (quotesText.length > 0) {
      const quoteLines = quotesText.split('\n').filter(line => {
        const trimmed = line.trim()
        // 放寬過濾條件：只要不是空行或純符號就保留
        if (!trimmed || trimmed === '「' || trimmed === '」') return false
        return trimmed.startsWith('「') ||
               trimmed.startsWith('【') ||
               /^\d{1,2}:\d{2}/.test(trimmed) ||
               /^[A-Za-z\u4e00-\u9fff]+[:：]/.test(trimmed) ||
               trimmed.length > 10 // 保留長度超過 10 字元的內容
      })
      sections.quotes = quoteLines.map(line => {
        let trimmed = line.trim()
        // 嘗試轉換時間戳格式
        const timeMatch = trimmed.match(/^(\d{1,2}:\d{2})\s+(.+)/)
        if (timeMatch) {
          trimmed = `【${timeMatch[1]}】${timeMatch[2]}`
        }
        return trimmed
      })
      // 如果過濾後沒有內容，但原文有超過 20 字元，則顯示原文
      if (sections.quotes.length === 0 && quotesText.length > 20) {
        sections.quotes = [quotesText]
      }
    }
  }

  if (!sections.summary && !sections.steps.length && !sections.context && !sections.quotes.length) {
    sections.summary = description
  }

  return sections
}

// 任務詳情彈窗組件（獨立出來避免重新渲染）
// 智慧分組映射 - 根據任務內容關鍵字自動分配組別
const GROUP_KEYWORDS: Record<string, string[]> = {
  '電訪組': ['電訪', '接通', '電話', '撥打', '通話', '名單', '電銷'],
  '業務組': ['業務', '銷售', 'SOP', '話術', '成交', '業績', '客戶開發', '報價'],
  '行政組': ['行政', '文件', '報表', '整理', '歸檔', '會議紀錄'],
  '客服組': ['客服', '服務', '投訴', '退款', '售後'],
  '行銷組': ['行銷', '廣告', '推廣', '活動', '促銷'],
}

// 根據任務內容推薦組別
function suggestGroupFromContent(title: string, description?: string): string | null {
  const content = `${title} ${description || ''}`.toLowerCase()

  for (const [groupName, keywords] of Object.entries(GROUP_KEYWORDS)) {
    for (const keyword of keywords) {
      if (content.includes(keyword.toLowerCase())) {
        return groupName
      }
    }
  }
  return null
}

function TaskDetailDialog({
  task,
  onClose,
  onUpdate,
  onComplete,
  teamMembers,
  onAddMember,
  onRemoveMember,
  availableTags,
  onAddTag,
  onRemoveTag,
  availableGroups,
  onAddGroup,
  onRemoveGroup,
  projects,
  onAddProject,
}: {
  task: Task | null
  onClose: () => void
  onUpdate: (id: string, updates: Partial<Task>) => Promise<void>
  onComplete: (id: string) => Promise<unknown>
  teamMembers: string[]
  onAddMember: (name: string) => void
  onRemoveMember: (name: string) => void
  availableTags: Tag[]
  onAddTag: (name: string, color: string) => void
  onRemoveTag: (name: string) => void
  availableGroups: Group[]
  onAddGroup: (name: string, color: string) => void
  onRemoveGroup: (name: string) => void
  projects: Project[]
  onAddProject: (name: string) => Promise<Project | null>
}) {
  // 本地狀態用於編輯
  const [localTask, setLocalTask] = useState<Task | null>(null)
  const [showMemberManager, setShowMemberManager] = useState(false)
  const [showTagManager, setShowTagManager] = useState(false)
  const [showGroupManager, setShowGroupManager] = useState(false)
  const [showProjectManager, setShowProjectManager] = useState(false)
  const [newMemberName, setNewMemberName] = useState('')
  const [newProjectName, setNewProjectName] = useState('')
  const [isAddingProject, setIsAddingProject] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('gray')
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupColor, setNewGroupColor] = useState('gray')
  // 執行細節的勾選狀態
  const [stepChecks, setStepChecks] = useState<boolean[]>([])
  // 編輯模式狀態
  const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null)
  const [editingStepText, setEditingStepText] = useState('')
  // 編輯任務名稱
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editingTitle, setEditingTitle] = useState('')

  // 當 task 變化時更新本地狀態
  useEffect(() => {
    setLocalTask(task)
    setShowMemberManager(false)
    setShowTagManager(false)
    setShowGroupManager(false)
    setEditingStepIndex(null)
    // 初始化步驟勾選狀態
    if (task?.description) {
      const sections = parseDescription(task.description)
      setStepChecks(new Array(sections.steps.length).fill(false))
    }
  }, [task])

  if (!localTask) return null

  const sections = localTask.description ? parseDescription(localTask.description) : null
  const hasStructuredContent = sections && (sections.summary || sections.steps.length > 0 || sections.context || sections.quotes.length > 0)

  // 智慧推薦組別
  const suggestedGroup = !localTask.groupName ? suggestGroupFromContent(localTask.title, localTask.description) : null

  // 更新處理函數
  const handleUpdate = async (updates: Partial<Task>) => {
    try {
      await onUpdate(localTask.id, updates)
      setLocalTask(prev => prev ? { ...prev, ...updates } : null)
    } catch (err) {
      console.error('更新失敗:', err)
    }
  }

  return (
    <Dialog open={!!task} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col bg-white rounded-xl shadow-xl border-0">
        <DialogHeader className="pb-4 border-b border-gray-100 shrink-0">
          <div className="flex-1">
            {isEditingTitle ? (
              <div className="flex items-center gap-2 pr-8">
                <Input
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  className="text-xl font-bold h-auto py-1 px-2"
                  autoFocus
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter' && editingTitle.trim()) {
                      e.preventDefault()
                      await handleUpdate({ title: editingTitle.trim() })
                      setIsEditingTitle(false)
                    } else if (e.key === 'Escape') {
                      e.preventDefault()
                      setIsEditingTitle(false)
                      setEditingTitle(localTask.title)
                    }
                  }}
                  onBlur={async () => {
                    if (editingTitle.trim() && editingTitle.trim() !== localTask.title) {
                      await handleUpdate({ title: editingTitle.trim() })
                    }
                    setIsEditingTitle(false)
                  }}
                />
              </div>
            ) : (
              <DialogTitle
                className="text-xl font-bold leading-relaxed pr-8 text-gray-900 cursor-pointer hover:bg-gray-100 rounded px-2 py-1 -mx-2 -my-1 transition-colors"
                onClick={() => {
                  setEditingTitle(localTask.title)
                  setIsEditingTitle(true)
                }}
              >
                {localTask.title}
              </DialogTitle>
            )}
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {/* 優先級選擇 */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-gray-200 hover:bg-gray-50 transition-colors text-sm">
                    <span className={`w-2.5 h-2.5 rounded-full ${
                      localTask.priority === 'urgent' ? 'bg-red-500' :
                      localTask.priority === 'high' ? 'bg-orange-400' :
                      localTask.priority === 'medium' ? 'bg-yellow-400' : 'bg-green-400'
                    }`} />
                    {priorityConfig[localTask.priority].label}
                    <ChevronDown className="h-3 w-3 opacity-50" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {(Object.keys(priorityConfig) as Array<keyof typeof priorityConfig>).map((key) => (
                    <DropdownMenuItem
                      key={key}
                      onClick={() => handleUpdate({ priority: key })}
                      className={localTask.priority === key ? 'bg-gray-100' : ''}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full mr-2 ${
                        key === 'urgent' ? 'bg-red-500' :
                        key === 'high' ? 'bg-orange-400' :
                        key === 'medium' ? 'bg-yellow-400' : 'bg-green-400'
                      }`} />
                      {priorityConfig[key].label}
                      {localTask.priority === key && <Check className="h-4 w-4 ml-auto" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* 負責人選擇 */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="text-sm text-gray-600 flex items-center gap-1.5 hover:text-gray-900 hover:bg-gray-50 px-2.5 py-1 rounded-md border border-gray-200 transition-colors">
                    <User className="h-3.5 w-3.5" />
                    {localTask.assignee || '負責人'}
                    <ChevronDown className="h-3 w-3 opacity-50" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  {showMemberManager ? (
                    <div className="p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-sm">管理團隊成員</h4>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setShowMemberManager(false)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex gap-2">
                        <Input
                          value={newMemberName}
                          onChange={(e) => setNewMemberName(e.target.value)}
                          placeholder="新增成員..."
                          className="h-8 text-sm"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && newMemberName.trim()) {
                              onAddMember(newMemberName)
                              setNewMemberName('')
                            }
                          }}
                        />
                        <Button size="sm" className="h-8 px-2" onClick={() => {
                          if (newMemberName.trim()) {
                            onAddMember(newMemberName)
                            setNewMemberName('')
                          }
                        }}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {teamMembers.map((member) => (
                          <div key={member} className="flex items-center justify-between px-2 py-1 rounded hover:bg-muted">
                            <span className="text-sm">{member}</span>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive" onClick={() => onRemoveMember(member)}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      <DropdownMenuItem onClick={() => handleUpdate({ assignee: undefined })} className="text-muted-foreground">
                        <X className="h-4 w-4 mr-2" />
                        不指定
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {teamMembers.map((member) => (
                        <DropdownMenuItem
                          key={member}
                          onClick={() => handleUpdate({ assignee: member })}
                          className={localTask.assignee === member ? 'bg-muted' : ''}
                        >
                          <User className="h-4 w-4 mr-2" />
                          {member}
                          {localTask.assignee === member && <Check className="h-4 w-4 ml-auto" />}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onSelect={(e) => {
                          e.preventDefault()
                          setShowMemberManager(true)
                        }}
                        className="text-muted-foreground"
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        管理成員...
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* 截止日期選擇 */}
              <Popover>
                <PopoverTrigger asChild>
                  <button className="text-sm text-gray-600 flex items-center gap-1.5 hover:text-gray-900 hover:bg-gray-50 px-2.5 py-1 rounded-md border border-gray-200 transition-colors">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {localTask.dueDate
                      ? format(new Date(localTask.dueDate), 'yyyy/M/d', { locale: zhTW })
                      : '截止日'}
                    <ChevronDown className="h-3 w-3 opacity-50" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={localTask.dueDate ? new Date(localTask.dueDate) : undefined}
                    onSelect={(date) => handleUpdate({ dueDate: date })}
                    locale={zhTW}
                    defaultMonth={localTask.dueDate ? new Date(localTask.dueDate) : new Date()}
                  />
                  {localTask.dueDate && (
                    <div className="p-2 border-t">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-destructive hover:text-destructive"
                        onClick={() => handleUpdate({ dueDate: undefined })}
                      >
                        清除日期
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>

              {/* 重複設定 */}
              <RecurrenceSelector
                value={localTask.recurrenceType}
                config={localTask.recurrenceConfig}
                onChange={(type, config) => handleUpdate({ recurrenceType: type, recurrenceConfig: config })}
              />

              {/* 專案 */}
              {localTask.project && (
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <FolderOpen className="h-4 w-4" />
                  {localTask.project}
                </span>
              )}
            </div>

            {/* 標籤和組別區域 - 同一列 */}
            <div className="flex items-center gap-1.5 mt-3 flex-wrap">
              {/* 智慧推薦組別提示 */}
              {suggestedGroup && !localTask.groupName && (
                <button
                  onClick={() => handleUpdate({ groupName: suggestedGroup })}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors animate-pulse"
                >
                  <span className="text-amber-500">💡</span>
                  建議分到「{suggestedGroup}」
                  <Check className="h-3 w-3" />
                </button>
              )}

              {/* 組別 */}
              {localTask.groupName && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getGroupColor(localTask.groupName).bg} ${getGroupColor(localTask.groupName).text}`}>
                  <Users className="h-3 w-3" />
                  {localTask.groupName}
                  <button
                    onClick={() => handleUpdate({ groupName: undefined })}
                    className="hover:opacity-70"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}

              {/* 專案 */}
              {localTask.projectId && (() => {
                const project = projects.find(p => p.id === localTask.projectId)
                return project ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-violet-50 text-violet-700">
                    <FolderKanban className="h-3 w-3" />
                    {project.name}
                    <button
                      onClick={() => handleUpdate({ projectId: undefined })}
                      className="hover:opacity-70"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ) : null
              })()}

              {/* 標籤 */}
              {(localTask.tags || []).map((tagName) => {
                const colors = getTagColor(tagName)
                return (
                  <span
                    key={tagName}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}
                  >
                    {tagName}
                    <button
                      onClick={() => handleUpdate({ tags: (localTask.tags || []).filter(t => t !== tagName) })}
                      className="hover:opacity-70"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )
              })}

              {/* 選擇組別 */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border border-dashed border-gray-300 text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors">
                    <Users className="h-3 w-3" />
                    {localTask.groupName ? '更換組別' : '組別'}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  {showGroupManager ? (
                    <div className="p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-sm">管理組別</h4>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setShowGroupManager(false)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex gap-2">
                        <Input
                          value={newGroupName}
                          onChange={(e) => setNewGroupName(e.target.value)}
                          placeholder="新增組別..."
                          className="h-8 text-sm flex-1"
                        />
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className={`h-8 w-8 rounded ${GROUP_COLORS[newGroupColor].bg} border`} />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <div className="grid grid-cols-3 gap-1 p-2">
                              {Object.keys(GROUP_COLORS).map((color) => (
                                <button
                                  key={color}
                                  className={`h-6 w-6 rounded ${GROUP_COLORS[color].bg} border ${newGroupColor === color ? 'ring-2 ring-primary' : ''}`}
                                  onClick={() => setNewGroupColor(color)}
                                />
                              ))}
                            </div>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Button size="sm" className="h-8 px-2" onClick={() => {
                          if (newGroupName.trim()) {
                            onAddGroup(newGroupName, newGroupColor)
                            setNewGroupName('')
                          }
                        }}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {availableGroups.map((group) => {
                          const colors = getGroupColor(group.name)
                          return (
                            <div key={group.name} className="flex items-center justify-between px-2 py-1 rounded hover:bg-muted">
                              <span className={`text-sm px-2 py-0.5 rounded ${colors.bg} ${colors.text}`}>{group.name}</span>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive" onClick={() => onRemoveGroup(group.name)}>
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    <>
                      <DropdownMenuItem onClick={() => handleUpdate({ groupName: undefined })} className="text-muted-foreground">
                        <X className="h-4 w-4 mr-2" />
                        不指定
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {availableGroups.map((group) => {
                        const colors = getGroupColor(group.name)
                        return (
                          <DropdownMenuItem
                            key={group.name}
                            onClick={() => handleUpdate({ groupName: group.name })}
                            className={localTask.groupName === group.name ? 'bg-muted' : ''}
                          >
                            <span className={`px-2 py-0.5 rounded text-xs ${colors.bg} ${colors.text}`}>{group.name}</span>
                            {localTask.groupName === group.name && <Check className="h-4 w-4 ml-auto" />}
                          </DropdownMenuItem>
                        )
                      })}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onSelect={(e) => {
                          e.preventDefault()
                          setShowGroupManager(true)
                        }}
                        className="text-muted-foreground"
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        管理組別...
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* 選擇專案 */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border border-dashed border-gray-300 text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors">
                    <FolderKanban className="h-3 w-3" />
                    {localTask.projectId ? '更換專案' : '專案'}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  {showProjectManager ? (
                    <div className="p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-sm">新增專案</h4>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => {
                          setShowProjectManager(false)
                          setNewProjectName('')
                        }}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex gap-2">
                        <Input
                          value={newProjectName}
                          onChange={(e) => setNewProjectName(e.target.value)}
                          placeholder="專案名稱..."
                          className="h-8 text-sm flex-1"
                          autoFocus
                          onKeyDown={async (e) => {
                            if (e.key === 'Enter' && newProjectName.trim()) {
                              e.preventDefault()
                              setIsAddingProject(true)
                              const newProject = await onAddProject(newProjectName.trim())
                              if (newProject) {
                                handleUpdate({ projectId: newProject.id })
                              }
                              setNewProjectName('')
                              setShowProjectManager(false)
                              setIsAddingProject(false)
                            }
                          }}
                        />
                        <Button
                          size="sm"
                          className="h-8"
                          disabled={!newProjectName.trim() || isAddingProject}
                          onClick={async () => {
                            if (newProjectName.trim()) {
                              setIsAddingProject(true)
                              const newProject = await onAddProject(newProjectName.trim())
                              if (newProject) {
                                handleUpdate({ projectId: newProject.id })
                              }
                              setNewProjectName('')
                              setShowProjectManager(false)
                              setIsAddingProject(false)
                            }
                          }}
                        >
                          {isAddingProject ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <DropdownMenuItem onClick={() => handleUpdate({ projectId: undefined })} className="text-muted-foreground">
                        <X className="h-4 w-4 mr-2" />
                        不指定
                      </DropdownMenuItem>
                      {projects.length > 0 && <DropdownMenuSeparator />}
                      {projects.filter(p => p.status === 'active').map((project) => (
                        <DropdownMenuItem
                          key={project.id}
                          onClick={() => handleUpdate({ projectId: project.id })}
                          className={localTask.projectId === project.id ? 'bg-muted' : ''}
                        >
                          <FolderKanban className="h-4 w-4 mr-2 text-violet-500" />
                          {project.name}
                          {localTask.projectId === project.id && <Check className="h-4 w-4 ml-auto" />}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onSelect={(e) => {
                          e.preventDefault()
                          setShowProjectManager(true)
                        }}
                        className="text-primary"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        新增專案...
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* 新增標籤 */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border border-dashed border-gray-300 text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors">
                    <Plus className="h-3 w-3" />
                    標籤
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  {showTagManager ? (
                    <div className="p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-sm">管理標籤</h4>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setShowTagManager(false)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex gap-2">
                        <Input
                          value={newTagName}
                          onChange={(e) => setNewTagName(e.target.value)}
                          placeholder="新增標籤..."
                          className="h-8 text-sm flex-1"
                        />
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className={`h-8 w-8 rounded ${TAG_COLORS[newTagColor].bg} border`} />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <div className="grid grid-cols-3 gap-1 p-2">
                              {Object.keys(TAG_COLORS).map((color) => (
                                <button
                                  key={color}
                                  className={`h-6 w-6 rounded ${TAG_COLORS[color].bg} border ${newTagColor === color ? 'ring-2 ring-primary' : ''}`}
                                  onClick={() => setNewTagColor(color)}
                                />
                              ))}
                            </div>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Button size="sm" className="h-8 px-2" onClick={() => {
                          if (newTagName.trim()) {
                            onAddTag(newTagName, newTagColor)
                            setNewTagName('')
                          }
                        }}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {availableTags.map((tag) => {
                          const colors = getTagColor(tag.name)
                          return (
                            <div key={tag.name} className="flex items-center justify-between px-2 py-1 rounded hover:bg-muted">
                              <span className={`text-sm px-2 py-0.5 rounded ${colors.bg} ${colors.text}`}>{tag.name}</span>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive" onClick={() => onRemoveTag(tag.name)}>
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    <>
                      {availableTags.filter(tag => !(localTask.tags || []).includes(tag.name)).map((tag) => {
                        const colors = getTagColor(tag.name)
                        return (
                          <DropdownMenuItem
                            key={tag.name}
                            onClick={() => handleUpdate({ tags: [...(localTask.tags || []), tag.name] })}
                          >
                            <span className={`px-2 py-0.5 rounded text-xs ${colors.bg} ${colors.text}`}>{tag.name}</span>
                          </DropdownMenuItem>
                        )
                      })}
                      {availableTags.filter(tag => !(localTask.tags || []).includes(tag.name)).length === 0 && (
                        <div className="px-3 py-2 text-sm text-muted-foreground">沒有更多標籤</div>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onSelect={(e) => {
                          e.preventDefault()
                          setShowTagManager(true)
                        }}
                        className="text-muted-foreground"
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        管理標籤...
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </DialogHeader>

        {/* 可滾動的內容區域 */}
        <div className="flex-1 overflow-y-auto space-y-6 pt-4 pr-2">
          {hasStructuredContent ? (
            <>
              {/* 任務摘要 - 重點突出 */}
              {sections.summary && (
                <div className="space-y-3">
                  <h3 className="text-base font-semibold flex items-center gap-2 text-gray-900">
                    <div className="w-1 h-5 bg-blue-500 rounded-full" />
                    任務摘要
                  </h3>
                  <div className="bg-blue-50/50 rounded-lg p-4 border border-blue-100">
                    <p className="text-base text-gray-800 leading-relaxed">
                      {sections.summary}
                    </p>
                  </div>
                </div>
              )}

              {/* 執行細節 - Checklist 形式 */}
              {sections.steps.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold flex items-center gap-2 text-gray-900">
                      <div className="w-1 h-5 bg-green-500 rounded-full" />
                      執行細節
                      <span className="text-xs font-normal text-gray-500 ml-2">
                        {stepChecks.filter(Boolean).length}/{sections.steps.length} 完成
                      </span>
                    </h3>
                  </div>
                  <div className="bg-green-50/30 rounded-lg border border-green-100 divide-y divide-green-100">
                    {sections.steps.map((step, i) => (
                      <div
                        key={i}
                        className={`flex items-start gap-3 p-3 group transition-colors ${
                          stepChecks[i] ? 'bg-green-50/50' : 'hover:bg-green-50/50'
                        }`}
                      >
                        {/* Checkbox */}
                        <button
                          onClick={() => {
                            const newChecks = [...stepChecks]
                            newChecks[i] = !newChecks[i]
                            setStepChecks(newChecks)
                          }}
                          className={`mt-0.5 h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                            stepChecks[i]
                              ? 'bg-green-500 border-green-500 text-white'
                              : 'border-gray-300 hover:border-green-400'
                          }`}
                        >
                          {stepChecks[i] && <Check className="h-3 w-3" />}
                        </button>

                        {/* 步驟內容 - 可編輯 */}
                        <div className="flex-1 min-w-0">
                          {editingStepIndex === i ? (
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={editingStepText}
                                onChange={(e) => setEditingStepText(e.target.value)}
                                className="flex-1 text-sm px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    // 儲存編輯（這裡只是本地狀態，實際需要更新 description）
                                    setEditingStepIndex(null)
                                  } else if (e.key === 'Escape') {
                                    setEditingStepIndex(null)
                                  }
                                }}
                              />
                              <button
                                onClick={() => setEditingStepIndex(null)}
                                className="text-xs px-2 py-1 text-gray-500 hover:text-gray-700"
                              >
                                完成
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-start gap-2">
                              <span className={`text-sm font-medium shrink-0 ${stepChecks[i] ? 'text-green-600' : 'text-green-700'}`}>
                                {i + 1}.
                              </span>
                              <span className={`text-sm leading-relaxed ${
                                stepChecks[i] ? 'line-through text-gray-400' : 'text-gray-700'
                              }`}>
                                {step}
                              </span>
                              <button
                                onClick={() => {
                                  setEditingStepIndex(i)
                                  setEditingStepText(step)
                                }}
                                className="opacity-0 group-hover:opacity-100 ml-auto shrink-0 p-1 text-gray-400 hover:text-gray-600 transition-opacity"
                                title="編輯"
                              >
                                <Edit3 className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 會議脈絡 */}
              {sections.context && (
                <div className="space-y-3">
                  <h3 className="text-base font-semibold flex items-center gap-2 text-gray-900">
                    <div className="w-1 h-5 bg-purple-500 rounded-full" />
                    會議脈絡
                  </h3>
                  <div className="bg-purple-50/30 rounded-lg p-4 border border-purple-100">
                    <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {sections.context}
                    </div>
                  </div>
                </div>
              )}

              {/* 原文引用 */}
              {sections.quotes.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-base font-semibold flex items-center gap-2 text-gray-900">
                    <div className="w-1 h-5 bg-amber-500 rounded-full" />
                    原文引用
                  </h3>
                  <div className="space-y-2">
                    {sections.quotes.map((quote, i) => {
                      const timestampMatch = quote.match(/^「?【(\d{1,2}:\d{2})】(.*)」?$/)
                      if (timestampMatch) {
                        const [, timestamp, content] = timestampMatch
                        return (
                          <div key={i} className="bg-amber-50/50 rounded-lg p-3 border-l-4 border-amber-400 flex gap-3 items-start">
                            <span className="shrink-0 font-mono text-xs bg-amber-200 text-amber-800 px-2 py-1 rounded font-medium">
                              {timestamp}
                            </span>
                            <span className="text-sm text-gray-700 leading-relaxed italic">「{content}」</span>
                          </div>
                        )
                      }
                      return (
                        <div key={i} className="bg-amber-50/50 rounded-lg p-3 border-l-4 border-amber-400">
                          <span className="text-sm text-gray-700 leading-relaxed italic">「{quote}」</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <h3 className="text-base font-semibold flex items-center gap-2 text-gray-900">
                <div className="w-1 h-5 bg-blue-500 rounded-full" />
                任務內容
              </h3>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {localTask.description || '無詳細描述'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 底部按鈕區域 - 固定在底部 */}
        <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 mt-4 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            關閉
          </button>
          <button
            onClick={async () => {
              if (localTask.status === 'completed') {
                await handleUpdate({ status: 'pending', completedAt: undefined })
              } else {
                await onComplete(localTask.id)
              }
              onClose()
            }}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
              localTask.status === 'completed'
                ? 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                : 'text-white bg-green-600 hover:bg-green-700'
            }`}
          >
            <Check className="h-4 w-4" />
            {localTask.status === 'completed' ? '標記為未完成' : '標記為完成'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// 負責人下拉選單組件（支援新增/刪除成員）
function AssigneeDropdown({
  task,
  teamMembers,
  onUpdate,
  onAddMember,
  onRemoveMember,
  open,
  onOpenChange,
}: {
  task: Task
  teamMembers: string[]
  onUpdate: (assignee: string | undefined) => void
  onAddMember: (name: string) => void
  onRemoveMember: (name: string) => void
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [showManager, setShowManager] = useState(false)
  const [newMemberName, setNewMemberName] = useState('')

  return (
    <DropdownMenu open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setShowManager(false) }}>
      <DropdownMenuTrigger asChild>
        <button className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded hover:bg-gray-100 transition-colors w-full h-full text-gray-600">
          <User className="h-4 w-4 shrink-0" />
          <span className="truncate flex-1 text-left">{task.assignee || '-'}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {showManager ? (
          <div className="p-3 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-xs">管理團隊成員</h4>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setShowManager(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-2">
              <Input
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                placeholder="新增成員..."
                className="h-7 text-xs"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newMemberName.trim()) {
                    onAddMember(newMemberName.trim())
                    setNewMemberName('')
                  }
                }}
              />
              <Button size="sm" className="h-7 px-2" onClick={() => {
                if (newMemberName.trim()) {
                  onAddMember(newMemberName.trim())
                  setNewMemberName('')
                }
              }}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {teamMembers.map((member) => (
                <div key={member} className="flex items-center justify-between px-2 py-1 rounded hover:bg-gray-100 text-xs">
                  <span>{member}</span>
                  <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-gray-400 hover:text-red-500" onClick={() => onRemoveMember(member)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              {teamMembers.length === 0 && (
                <div className="text-xs text-gray-400 text-center py-2">尚無成員</div>
              )}
            </div>
          </div>
        ) : (
          <>
            <DropdownMenuItem onClick={() => onUpdate(undefined)} className="text-xs text-gray-500">
              <X className="h-3 w-3 mr-2" />不指定
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {teamMembers.map((member) => (
              <DropdownMenuItem key={member} onClick={() => onUpdate(member)} className="text-xs">
                <User className="h-3.5 w-3.5 mr-2 shrink-0" />{member}
                {task.assignee === member && <Check className="h-3 w-3 ml-auto" />}
              </DropdownMenuItem>
            ))}
            {teamMembers.length === 0 && (
              <div className="px-2 py-1.5 text-xs text-gray-400">尚無成員，請先新增</div>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(e) => { e.preventDefault(); setShowManager(true) }}
              className="text-xs text-gray-500"
            >
              <Settings className="h-3.5 w-3.5 mr-2" />管理成員...
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default function TasksPage() {
  const { tasks, isLoading, error, addTask, updateTask, deleteTask, completeTask, refresh } = useSupabaseTasks()
  const { projects, addProject: addProjectToDb, deleteProject: deleteProjectFromDb } = useSupabaseProjects()

  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [addingInGroup, setAddingInGroup] = useState<string | null>(null) // 追蹤哪個分類正在新增任務
  const [filter, setFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed'>('all')
  const [showCompleted, setShowCompleted] = useState(false)
  // 從 localStorage 讀取排序模式，預設為截止日
  const [sortMode, setSortModeState] = useState<SortMode>('dueDate')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null)
  const [groupFilter, setGroupFilter] = useState<string | null>(null)
  const [projectFilter, setProjectFilter] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // 從 localStorage 初始化排序模式
  useEffect(() => {
    const savedSortMode = localStorage.getItem('vibe-planner-task-sort-mode')
    if (savedSortMode && ['priority', 'dueDate', 'assignee', 'tag', 'group', 'project'].includes(savedSortMode)) {
      setSortModeState(savedSortMode as SortMode)
    }
  }, [])

  // 設定排序模式並保存到 localStorage
  const setSortMode = useCallback((mode: SortMode) => {
    setSortModeState(mode)
    localStorage.setItem('vibe-planner-task-sort-mode', mode)
  }, [])

  // 二次排序狀態
  const [secondarySort, setSecondarySortState] = useState<SecondarySort>({ field: null, direction: 'asc' })

  // 從 localStorage 初始化二次排序
  useEffect(() => {
    const savedSecondarySort = localStorage.getItem('vibe-planner-task-secondary-sort')
    if (savedSecondarySort) {
      try {
        const parsed = JSON.parse(savedSecondarySort)
        if (parsed.field && ['title', 'assignee', 'startDate', 'dueDate', 'priority'].includes(parsed.field)) {
          setSecondarySortState(parsed)
        }
      } catch {
        // 忽略解析錯誤
      }
    }
  }, [])

  // 設定二次排序並保存到 localStorage
  const setSecondarySort = useCallback((field: SecondarySort['field']) => {
    setSecondarySortState(prev => {
      const newSort: SecondarySort = {
        field,
        direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
      }
      localStorage.setItem('vibe-planner-task-secondary-sort', JSON.stringify(newSort))
      return newSort
    })
  }, [])

  // 批次選取狀態
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set())
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [showBatchEditDialog, setShowBatchEditDialog] = useState(false)
  const [lastSelectedTaskId, setLastSelectedTaskId] = useState<string | null>(null) // 用於 Shift 範圍選取

  // 復原功能：儲存上一次批量操作前的任務狀態
  // 復原堆疊（支援多步復原，每一步可包含多個任務變更）
  const [undoHistory, setUndoHistory] = useState<Array<{
    type: 'single' | 'batch'
    changes: Array<{ taskId: string; previousState: Partial<Task> }>
    description: string
  }>>([])
  const canUndo = undoHistory.length > 0

  // 復原按鈕顯示狀態（操作後短暫顯示，5秒後自動隱藏）
  const [showUndoButton, setShowUndoButton] = useState(false)
  const undoTimerRef = useRef<NodeJS.Timeout | null>(null)

  // 顯示復原按鈕（帶自動隱藏計時器）
  const showUndoButtonWithTimer = useCallback(() => {
    setShowUndoButton(true)
    // 清除之前的計時器
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current)
    }
    // 5秒後自動隱藏
    undoTimerRef.current = setTimeout(() => {
      setShowUndoButton(false)
    }, 5000)
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

  // 過濾任務
  const filteredTasks = useMemo(() => {
    const query = searchQuery.toLowerCase().trim()

    return tasks.filter((task: Task) => {
      // 狀態過濾
      if (filter === 'all' && task.status === 'completed') return false
      if (filter === 'pending' && task.status !== 'pending') return false
      if (filter === 'in_progress' && task.status !== 'in_progress') return false
      if (filter === 'completed' && task.status !== 'completed') return false

      // 標籤過濾
      if (tagFilter && !(task.tags || []).includes(tagFilter)) return false

      // 負責人過濾
      if (assigneeFilter && task.assignee !== assigneeFilter) return false

      // 組別過濾
      if (groupFilter && task.groupName !== groupFilter) return false

      // 專案過濾
      if (projectFilter && task.projectId !== projectFilter) return false

      // 搜尋過濾
      if (query) {
        const titleMatch = task.title.toLowerCase().includes(query)
        const descriptionMatch = task.description?.toLowerCase().includes(query) || false
        const assigneeMatch = task.assignee?.toLowerCase().includes(query) || false
        const groupMatch = task.groupName?.toLowerCase().includes(query) || false
        const tagsMatch = (task.tags || []).some(tag => tag.toLowerCase().includes(query))
        const dateMatch = task.dueDate
          ? format(new Date(task.dueDate), 'yyyy/M/d', { locale: zhTW }).includes(query) ||
            format(new Date(task.dueDate), 'M/d', { locale: zhTW }).includes(query)
          : false

        if (!titleMatch && !descriptionMatch && !assigneeMatch && !groupMatch && !tagsMatch && !dateMatch) {
          return false
        }
      }

      return true
    })
  }, [tasks, filter, tagFilter, assigneeFilter, groupFilter, projectFilter, searchQuery])

  const completedTasks = useMemo(() => tasks.filter((t: Task) => t.status === 'completed'), [tasks])

  // 二次排序函數
  const sortTasksBySecondary = useCallback((tasksToSort: Task[]): Task[] => {
    if (!secondarySort.field) return tasksToSort

    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 }

    return [...tasksToSort].sort((a, b) => {
      let comparison = 0

      switch (secondarySort.field) {
        case 'title':
          comparison = a.title.localeCompare(b.title, 'zh-TW')
          break
        case 'assignee':
          const assigneeA = a.assignee || ''
          const assigneeB = b.assignee || ''
          comparison = assigneeA.localeCompare(assigneeB, 'zh-TW')
          break
        case 'startDate':
          const startA = a.startDate ? new Date(a.startDate).getTime() : Infinity
          const startB = b.startDate ? new Date(b.startDate).getTime() : Infinity
          comparison = startA - startB
          break
        case 'dueDate':
          const dueA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity
          const dueB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity
          comparison = dueA - dueB
          break
        case 'priority':
          const prioA = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 4
          const prioB = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 4
          comparison = prioA - prioB
          break
      }

      return secondarySort.direction === 'asc' ? comparison : -comparison
    })
  }, [secondarySort])

  // 取得所有使用中的標籤
  const usedTags = useMemo(() => {
    const tagSet = new Set<string>()
    tasks.forEach(task => {
      (task.tags || []).forEach(tag => tagSet.add(tag))
    })
    return Array.from(tagSet)
  }, [tasks])

  // 取得所有負責人
  const usedAssignees = useMemo(() => {
    const assigneeSet = new Set<string>()
    tasks.forEach(task => {
      if (task.assignee) assigneeSet.add(task.assignee)
    })
    return Array.from(assigneeSet)
  }, [tasks])

  // 取得所有使用中的組別
  const usedGroups = useMemo(() => {
    const groupSet = new Set<string>()
    tasks.forEach(task => {
      if (task.groupName) groupSet.add(task.groupName)
    })
    return Array.from(groupSet)
  }, [tasks])

  // 取得所有使用中的專案
  const usedProjects = useMemo(() => {
    const projectIds = new Set<string>()
    tasks.forEach(task => {
      if (task.projectId) projectIds.add(task.projectId)
    })
    return projects.filter(p => projectIds.has(p.id))
  }, [tasks, projects])

  // 根據 projectId 取得專案名稱
  const getProjectName = useCallback((projectId: string | undefined) => {
    if (!projectId) return undefined
    const project = projects.find(p => p.id === projectId)
    return project?.name
  }, [projects])

  // 按截止日期分組（按實際日期分類）
  const today = startOfDay(new Date())
  const groupedByDueDate = useMemo(() => {
    const groups: Record<string, Task[]> = {}

    filteredTasks.forEach((task: Task) => {
      let key: string

      if (!task.dueDate) {
        key = 'noDueDate'
      } else {
        const due = startOfDay(new Date(task.dueDate))

        if (isPast(due) && !isToday(due)) {
          key = 'overdue'
        } else if (isToday(due)) {
          key = 'today'
        } else if (isTomorrow(due)) {
          key = 'tomorrow'
        } else {
          // 使用實際日期作為 key，格式：date_2025-12-01
          key = `date_${format(due, 'yyyy-MM-dd')}`
        }
      }

      if (!groups[key]) groups[key] = []
      groups[key].push(task)
    })

    return groups
  }, [filteredTasks])

  // 產生截止日期分組的標籤
  const dueDateLabels = useMemo(() => {
    const labels: Record<string, { emoji?: string; label: string; className?: string }> = {
      overdue: { emoji: '⚠️', label: '已過期', className: 'text-destructive' },
      today: { emoji: '📅', label: '今天', className: 'text-orange-600 dark:text-orange-400' },
      tomorrow: { emoji: '📆', label: '明天', className: 'text-yellow-600 dark:text-yellow-400' },
      noDueDate: { emoji: '📝', label: '無截止日', className: 'text-muted-foreground' },
    }

    // 動態產生日期標籤
    Object.keys(groupedByDueDate).forEach(key => {
      if (key.startsWith('date_')) {
        const dateStr = key.replace('date_', '')
        const date = new Date(dateStr)
        const dayName = format(date, 'EEEE', { locale: zhTW })
        const dateLabel = format(date, 'M/d (EEEE)', { locale: zhTW })
        labels[key] = { emoji: '🗓️', label: dateLabel }
      }
    })

    return labels
  }, [groupedByDueDate])

  // 按優先級分組
  const groupedByPriority = useMemo(() => ({
    urgent: filteredTasks.filter((t: Task) => t.priority === 'urgent'),
    high: filteredTasks.filter((t: Task) => t.priority === 'high'),
    medium: filteredTasks.filter((t: Task) => t.priority === 'medium'),
    low: filteredTasks.filter((t: Task) => t.priority === 'low'),
  }), [filteredTasks])

  // 按負責人分組
  const groupedByAssignee = useMemo(() => {
    const groups: Record<string, Task[]> = { '未指定': [] }
    filteredTasks.forEach((task: Task) => {
      const key = task.assignee || '未指定'
      if (!groups[key]) groups[key] = []
      groups[key].push(task)
    })
    return groups
  }, [filteredTasks])

  // 按標籤分組
  const groupedByTag = useMemo(() => {
    const groups: Record<string, Task[]> = { '無標籤': [] }
    filteredTasks.forEach((task: Task) => {
      if (!task.tags || task.tags.length === 0) {
        groups['無標籤'].push(task)
      } else {
        task.tags.forEach(tag => {
          if (!groups[tag]) groups[tag] = []
          groups[tag].push(task)
        })
      }
    })
    return groups
  }, [filteredTasks])

  // 按組別分組
  const groupedByGroup = useMemo(() => {
    const groups: Record<string, Task[]> = { '未指定組別': [] }
    filteredTasks.forEach((task: Task) => {
      const key = task.groupName || '未指定組別'
      if (!groups[key]) groups[key] = []
      groups[key].push(task)
    })
    return groups
  }, [filteredTasks])

  // 依專案分組（使用專案 ID 作為 key，方便拖曳識別）
  const groupedByProject = useMemo(() => {
    const projectGroups: Record<string, Task[]> = { 'uncategorized': [] }
    filteredTasks.forEach((task: Task) => {
      const projectId = task.projectId || 'uncategorized'
      if (!projectGroups[projectId]) projectGroups[projectId] = []
      projectGroups[projectId].push(task)
    })
    return projectGroups
  }, [filteredTasks])

  // 專案 ID 對應顯示名稱
  const getProjectDisplayName = useCallback((projectId: string) => {
    if (projectId === 'uncategorized') return '未分類'
    const project = projects.find(p => p.id === projectId)
    return project?.name || projectId
  }, [projects])

  // 新增任務
  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return
    try {
      await addTask({
        title: newTaskTitle.trim(),
        status: 'pending',
        priority: 'medium',
      })
      setNewTaskTitle('')
    } catch (err) {
      console.error('新增任務失敗:', err)
    }
  }

  // 在分類中新增任務（接受來自 AddTaskRow 的數據）
  const handleAddTaskInGroup = async (
    groupKey: string,
    data: { title: string; assignee?: string; startDate?: Date; dueDate?: Date; priority: Task['priority']; projectId?: string }
  ) => {
    if (!data.title.trim()) return
    try {
      const taskData: Partial<Task> = {
        title: data.title.trim(),
        status: 'in_progress',
        priority: data.priority,
        assignee: data.assignee,
        startDate: data.startDate,
        dueDate: data.dueDate,
        projectId: data.projectId,
      }

      // 根據目前的分類模式設定預設值（如果用戶沒有手動選擇）
      if (sortMode === 'project') {
        // groupKey 現在是專案 ID 或 'uncategorized'
        if (groupKey !== 'uncategorized') {
          taskData.projectId = groupKey
        }
      } else if (sortMode === 'assignee') {
        if (groupKey !== 'noAssignee' && !data.assignee) {
          taskData.assignee = groupKey
        }
      } else if (sortMode === 'priority') {
        if (['urgent', 'high', 'medium', 'low'].includes(groupKey) && data.priority === 'medium') {
          taskData.priority = groupKey as Task['priority']
        }
      } else if (sortMode === 'group') {
        if (groupKey !== 'noGroup') {
          taskData.groupName = groupKey
        }
      } else if (sortMode === 'dueDate') {
        // 根據日期分組設定截止日（如果用戶沒有手動選擇）
        if (!data.dueDate) {
          if (groupKey === 'today') {
            taskData.dueDate = new Date()
          } else if (groupKey === 'tomorrow') {
            taskData.dueDate = addDays(new Date(), 1)
          } else if (groupKey.startsWith('date_')) {
            const dateStr = groupKey.replace('date_', '')
            taskData.dueDate = new Date(dateStr)
          }
        }
      }

      await addTask(taskData as Parameters<typeof addTask>[0])
      setAddingInGroup(null)
    } catch (err) {
      console.error('新增任務失敗:', err)
    }
  }

  // 任務更新處理（支援復原）
  const handleUpdateTask = useCallback(async (id: string, updates: Partial<Task>, skipUndo = false) => {
    const task = tasks.find(t => t.id === id)

    // 日期驗證：開始日不能晚於截止日
    if (task) {
      const newStartDate = 'startDate' in updates ? updates.startDate : task.startDate
      const newDueDate = 'dueDate' in updates ? updates.dueDate : task.dueDate

      if (newStartDate && newDueDate) {
        const startTime = new Date(newStartDate).getTime()
        const dueTime = new Date(newDueDate).getTime()

        // 如果更新開始日，且開始日晚於截止日，自動調整截止日
        if ('startDate' in updates && startTime > dueTime) {
          updates.dueDate = updates.startDate
        }
        // 如果更新截止日，且截止日早於開始日，自動調整開始日
        if ('dueDate' in updates && dueTime < startTime) {
          updates.startDate = updates.dueDate
        }
      }
    }

    // 備份目前狀態（除非明確跳過）
    if (!skipUndo) {
      if (task) {
        // 只備份被更新的欄位
        const previousState: Partial<Task> = {}
        for (const key of Object.keys(updates)) {
          (previousState as Record<string, unknown>)[key] = (task as unknown as Record<string, unknown>)[key]
        }
        // 產生操作描述
        const fieldNames: Record<string, string> = {
          status: '狀態',
          priority: '優先級',
          assignee: '負責人',
          dueDate: '截止日期',
          startDate: '開始日期',
          groupName: '組別',
          title: '標題',
          description: '描述',
        }
        const changedFields = Object.keys(updates).map(k => fieldNames[k] || k).join('、')
        setUndoHistory(prev => [...prev.slice(-19), {
          type: 'single',
          changes: [{ taskId: id, previousState }],
          description: `修改${changedFields}`,
        }])
        // 顯示復原按鈕
        showUndoButtonWithTimer()
      }
    }
    await updateTask(id, updates)
  }, [updateTask, tasks, showUndoButtonWithTimer])

  // 批次選取功能（支援 Shift 範圍選取）
  const toggleTaskSelection = useCallback((taskId: string, shiftKey: boolean = false) => {
    // 取得目前顯示的任務列表（按照目前排序）
    const taskIds = filteredTasks.map(t => t.id)

    if (shiftKey && lastSelectedTaskId && lastSelectedTaskId !== taskId) {
      // Shift+點擊：範圍選取
      const lastIndex = taskIds.indexOf(lastSelectedTaskId)
      const currentIndex = taskIds.indexOf(taskId)

      if (lastIndex !== -1 && currentIndex !== -1) {
        const start = Math.min(lastIndex, currentIndex)
        const end = Math.max(lastIndex, currentIndex)
        const rangeIds = taskIds.slice(start, end + 1)

        setSelectedTaskIds(prev => {
          const next = new Set(prev)
          rangeIds.forEach(id => next.add(id))
          return next
        })
        return
      }
    }

    // 一般點擊：切換單一任務選取
    setSelectedTaskIds(prev => {
      const next = new Set(prev)
      if (next.has(taskId)) {
        next.delete(taskId)
      } else {
        next.add(taskId)
      }
      return next
    })
    setLastSelectedTaskId(taskId)
  }, [filteredTasks, lastSelectedTaskId])

  const selectAllTasks = useCallback(() => {
    // 當 filter 是 'all' 時，也要選取已完成的任務
    if (filter === 'all') {
      const allTaskIds = [...filteredTasks, ...completedTasks].map(t => t.id)
      setSelectedTaskIds(new Set(allTaskIds))
    } else {
      setSelectedTaskIds(new Set(filteredTasks.map(t => t.id)))
    }
  }, [filteredTasks, completedTasks, filter])

  const deselectAllTasks = useCallback(() => {
    setSelectedTaskIds(new Set())
  }, [])

  const toggleSelectionMode = useCallback(() => {
    setIsSelectionMode(prev => !prev)
    if (isSelectionMode) {
      setSelectedTaskIds(new Set())
    }
  }, [isSelectionMode])

  // 批次刪除（刪除不支援復原）
  const handleBatchDelete = useCallback(async () => {
    if (selectedTaskIds.size === 0) return
    if (!confirm(`確定要刪除 ${selectedTaskIds.size} 個任務嗎？此操作無法復原。`)) return

    for (const taskId of selectedTaskIds) {
      await deleteTask(taskId)
    }
    setSelectedTaskIds(new Set())
    setIsSelectionMode(false)
  }, [selectedTaskIds, deleteTask])

  // 批次更新（支援復原）
  const handleBatchUpdate = useCallback(async (updates: Partial<Task>) => {
    if (selectedTaskIds.size === 0) return

    // 備份當前狀態以便復原
    const backupStates: Array<{ taskId: string; previousState: Partial<Task> }> = []
    for (const taskId of selectedTaskIds) {
      const task = tasks.find(t => t.id === taskId)
      if (task) {
        // 只備份被更新的欄位
        const previousState: Partial<Task> = {}
        for (const key of Object.keys(updates)) {
          (previousState as Record<string, unknown>)[key] = (task as unknown as Record<string, unknown>)[key]
        }
        backupStates.push({ taskId, previousState })
      }
    }

    // 產生操作描述
    const fieldNames: Record<string, string> = {
      status: '狀態',
      priority: '優先級',
      assignee: '負責人',
      dueDate: '截止日期',
      startDate: '開始日期',
      groupName: '組別',
    }
    const changedFields = Object.keys(updates).map(k => fieldNames[k] || k).join('、')
    setUndoHistory(prev => [...prev.slice(-19), {
      type: 'batch',
      changes: backupStates,
      description: `批次修改 ${selectedTaskIds.size} 個任務的${changedFields}`,
    }])
    // 顯示復原按鈕
    showUndoButtonWithTimer()

    // 執行更新
    for (const taskId of selectedTaskIds) {
      await updateTask(taskId, updates)
    }
    setShowBatchEditDialog(false)
  }, [selectedTaskIds, updateTask, tasks, showUndoButtonWithTimer])

  // 批次完成（支援復原）
  const handleBatchComplete = useCallback(async () => {
    if (selectedTaskIds.size === 0) return

    // 備份當前狀態以便復原
    const backupStates: Array<{ taskId: string; previousState: Partial<Task> }> = []
    for (const taskId of selectedTaskIds) {
      const task = tasks.find(t => t.id === taskId)
      if (task) {
        backupStates.push({
          taskId,
          previousState: { status: task.status, completedAt: task.completedAt }
        })
      }
    }
    setUndoHistory(prev => [...prev.slice(-19), {
      type: 'batch',
      changes: backupStates,
      description: `批次完成 ${selectedTaskIds.size} 個任務`,
    }])
    // 顯示復原按鈕
    showUndoButtonWithTimer()

    // 執行完成
    for (const taskId of selectedTaskIds) {
      await completeTask(taskId)
    }
    setSelectedTaskIds(new Set())
  }, [selectedTaskIds, completeTask, tasks, showUndoButtonWithTimer])

  // 復原上一步操作
  const handleUndo = useCallback(async () => {
    if (undoHistory.length === 0) return

    // 取出最後一步操作
    const lastAction = undoHistory[undoHistory.length - 1]

    // 執行復原（跳過備份，避免無限循環）
    for (const { taskId, previousState } of lastAction.changes) {
      await updateTask(taskId, previousState)
    }

    // 移除已復原的操作
    setUndoHistory(prev => prev.slice(0, -1))
    // 如果還有更多可復原的操作，繼續顯示按鈕
    if (undoHistory.length > 1) {
      showUndoButtonWithTimer()
    } else {
      setShowUndoButton(false)
    }
  }, [undoHistory, updateTask, showUndoButtonWithTimer])

  // Cmd+Z / Ctrl+Z 快捷鍵支援
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 檢查是否在輸入框中
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }

      // Cmd+Z (Mac) 或 Ctrl+Z (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        if (canUndo) {
          e.preventDefault()
          // 顯示按鈕並執行復原
          setShowUndoButton(true)
          handleUndo()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [canUndo, handleUndo])

  // 清理計時器
  useEffect(() => {
    return () => {
      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current)
      }
    }
  }, [])

  // 狀態顏色對應
  const statusColors: Record<string, { bg: string; border: string; text: string; dotBg: string }> = {
    pending: { bg: 'bg-gray-50', border: 'border-gray-300', text: '未開始', dotBg: 'bg-gray-400' },
    in_progress: { bg: 'bg-blue-50', border: 'border-blue-400', text: '進行中', dotBg: 'bg-blue-500' },
    completed: { bg: 'bg-green-50', border: 'border-green-400', text: '已完成', dotBg: 'bg-green-500' },
    on_hold: { bg: 'bg-amber-50', border: 'border-amber-400', text: '暫停', dotBg: 'bg-amber-500' },
  }

  // 欄位寬度狀態（可拖曳調整）
  const [columnWidths, setColumnWidths] = useState({
    assignee: 120,
    startDate: 110,
    dueDate: 110,
    priority: 80,
    project: 100,
    createdAt: 100,
  })

  // 欄位順序（可拖曳調整）
  const [columnOrder, setColumnOrder] = useState<string[]>([
    'assignee', 'startDate', 'dueDate', 'priority', 'project', 'createdAt'
  ])

  // 拖曳調整欄位寬度
  const [resizing, setResizing] = useState<string | null>(null)
  const [resizeStartX, setResizeStartX] = useState(0)
  const [resizeStartWidth, setResizeStartWidth] = useState(0)

  const handleResizeStart = useCallback((column: string, e: React.MouseEvent) => {
    e.preventDefault()
    setResizing(column)
    setResizeStartX(e.clientX)
    setResizeStartWidth(columnWidths[column as keyof typeof columnWidths])
  }, [columnWidths])

  useEffect(() => {
    if (!resizing) return

    const handleMouseMove = (e: MouseEvent) => {
      // 向左拖曳縮小，向右拖曳放大（反轉方向）
      const diff = resizeStartX - e.clientX
      const newWidth = Math.max(70, Math.min(200, resizeStartWidth + diff))
      setColumnWidths(prev => ({ ...prev, [resizing]: newWidth }))
    }

    const handleMouseUp = () => {
      setResizing(null)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [resizing, resizeStartX, resizeStartWidth])

  // 分組收合狀態
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  const toggleGroupCollapse = useCallback((groupKey: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupKey)) {
        next.delete(groupKey)
      } else {
        next.add(groupKey)
      }
      return next
    })
  }, [])

  // dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // 任務順序狀態（本地排序用）
  const [taskOrder, setTaskOrder] = useState<string[]>([])
  // 正在拖曳的任務 ID
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)

  // 當任務變更時同步順序
  useEffect(() => {
    const currentIds = tasks.map(t => t.id)
    setTaskOrder(prev => {
      // 保留已存在的順序，新增的放最後
      const existingOrder = prev.filter(id => currentIds.includes(id))
      const newIds = currentIds.filter(id => !prev.includes(id))
      return [...existingOrder, ...newIds]
    })
  }, [tasks])

  // 自定義 collision detection：優先檢測專案標題 droppable
  const customCollisionDetection: CollisionDetection = useCallback((args) => {
    // 使用 rectIntersection 檢測所有碰撞
    const rectCollisions = rectIntersection(args)

    // 優先查找專案標題碰撞（ID 以 project- 開頭）
    const projectCollision = rectCollisions.find(
      collision => (collision.id as string).startsWith('project-')
    )
    if (projectCollision) {
      return [projectCollision]
    }

    // 如果沒有碰到專案標題，再用 pointerWithin 精確檢測
    const pointerCollisions = pointerWithin(args)
    const preciseProjectCollision = pointerCollisions.find(
      collision => (collision.id as string).startsWith('project-')
    )
    if (preciseProjectCollision) {
      return [preciseProjectCollision]
    }

    // 如果都沒有，使用 closestCenter 處理排序
    return closestCenter(args)
  }, [])

  // 拖曳開始處理
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveTaskId(event.active.id as string)
  }, [])

  // 拖曳結束處理 - 支援跨專案拖曳
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    setActiveTaskId(null)

    console.log('[DragEnd] active:', active.id, 'over:', over?.id)

    if (!over) {
      console.log('[DragEnd] No over target')
      return
    }

    const activeId = active.id as string
    const overId = over.id as string

    console.log('[DragEnd] activeId:', activeId, 'overId:', overId, 'startsWithProject:', overId.startsWith('project-'))

    // 檢查是否拖曳到專案分組標題上（ID 以 project- 開頭）
    if (overId.startsWith('project-')) {
      const targetProjectId = overId.replace('project-', '')
      const newProjectId = targetProjectId === 'uncategorized' ? undefined : targetProjectId

      console.log('[DragEnd] Moving task to project:', targetProjectId, 'newProjectId:', newProjectId)

      // 更新任務的專案
      handleUpdateTask(activeId, { projectId: newProjectId })
      return
    }

    // 同一列表內的排序
    if (activeId !== overId) {
      setTaskOrder(prev => {
        const oldIndex = prev.indexOf(activeId)
        const newIndex = prev.indexOf(overId)
        if (oldIndex !== -1 && newIndex !== -1) {
          return arrayMove(prev, oldIndex, newIndex)
        }
        return prev
      })
    }
  }, [handleUpdateTask])

  // 可拖曳的任務項目組件 - 單行設計
  const SortableTaskItem = ({ task }: { task: Task }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: task.id })

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
      zIndex: isDragging ? 1000 : 'auto',
    }

    const hasDescription = task.description && task.description.trim().length > 0
    const [startDatePickerOpen, setStartDatePickerOpen] = useState(false)
    const [datePickerOpen, setDatePickerOpen] = useState(false)
    const [assigneeOpen, setAssigneeOpen] = useState(false)
    const [groupOpen, setGroupOpen] = useState(false)
    const [tagOpen, setTagOpen] = useState(false)
    const [projectOpen, setProjectOpen] = useState(false)
    const [priorityOpen, setPriorityOpen] = useState(false)
    const [statusOpen, setStatusOpen] = useState(false)
    const [isEditingTitle, setIsEditingTitle] = useState(false)
    const [editingTitle, setEditingTitle] = useState(task.title)
    const isSelected = selectedTaskIds.has(task.id)

    const currentStatus = statusColors[task.status] || statusColors.pending

    // 日期顯示格式化（全部顯示年份）
    const formatDueDate = (date: Date) => {
      const hasTime = date.getHours() !== 0 || date.getMinutes() !== 0
      const timeStr = hasTime ? ` ${format(date, 'HH:mm')}` : ''
      if (isToday(date)) return `今天${timeStr}`
      if (isTomorrow(date)) return `明天${timeStr}`
      return format(date, 'M/d', { locale: zhTW }) + timeStr
    }

    // 日期是否過期
    const isOverdue = task.dueDate && isPast(startOfDay(new Date(task.dueDate))) && !isToday(new Date(task.dueDate)) && task.status !== 'completed'

    return (
      <div
        ref={setNodeRef}
        style={style as React.CSSProperties}
        className={`group flex items-center bg-white border-b border-gray-100 hover:bg-blue-50/40 transition-colors ${
          task.status === 'completed' ? 'opacity-60' : ''
        } ${isSelected ? 'bg-blue-50/60' : ''} ${isDragging ? 'shadow-lg bg-white rounded-lg border border-blue-200' : ''}`}
      >
        {/* 拖曳手柄 - 固定寬度 */}
        <div
          {...attributes}
          {...listeners}
          className="flex items-center justify-center w-10 h-12 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        >
          <GripVertical className="h-4 w-4" />
        </div>

        {/* 選取框 - 固定寬度（支援 Shift+點擊 範圍選取）*/}
        <div className="w-8 h-12 flex items-center justify-center shrink-0">
          <button
            className={`w-4 h-4 flex items-center justify-center transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
            onClick={(e) => { e.stopPropagation(); toggleTaskSelection(task.id, e.shiftKey) }}
          >
            {isSelected ? <CheckSquare className="h-4 w-4 text-blue-600" /> : <Square className="h-4 w-4 text-gray-400 hover:text-blue-600" />}
          </button>
        </div>

        {/* 狀態指示點 - 固定寬度 */}
        <div className="w-8 h-12 flex items-center justify-center shrink-0">
          <DropdownMenu open={statusOpen} onOpenChange={setStatusOpen}>
            <DropdownMenuTrigger asChild>
              <button className={`w-3.5 h-3.5 rounded-full transition-all hover:scale-125 ring-2 ring-white shadow-sm ${currentStatus.dotBg}`} title={currentStatus.text} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-28">
              <DropdownMenuItem onClick={() => handleUpdateTask(task.id, { status: 'pending', completedAt: undefined })} className="gap-2 text-xs">
                <span className="w-2.5 h-2.5 rounded-full bg-gray-400 shrink-0" />未開始
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleUpdateTask(task.id, { status: 'in_progress', completedAt: undefined })} className="gap-2 text-xs">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />進行中
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleUpdateTask(task.id, { status: 'completed', completedAt: new Date() })} className="gap-2 text-xs">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" />已完成
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleUpdateTask(task.id, { status: 'on_hold', completedAt: undefined })} className="gap-2 text-xs">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />暫停
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* 標題 - 彈性寬度 */}
        <div className="flex-1 min-w-0 h-12 flex items-center pr-4">
          {isEditingTitle ? (
            <textarea
              value={editingTitle}
              onChange={(e) => setEditingTitle(e.target.value)}
              className="flex-1 min-h-[32px] max-h-[120px] px-3 py-1.5 text-sm rounded-md border border-input bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus
              rows={1}
              onKeyDown={async (e) => {
                // ⌘/Ctrl + Enter 送出
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && editingTitle.trim()) {
                  e.preventDefault()
                  const newTitle = editingTitle.trim()
                  setIsEditingTitle(false)
                  await handleUpdateTask(task.id, { title: newTitle })
                } else if (e.key === 'Escape') {
                  e.preventDefault()
                  setIsEditingTitle(false)
                  setEditingTitle(task.title)
                }
              }}
              onBlur={async () => {
                if (editingTitle.trim() && editingTitle.trim() !== task.title) {
                  const newTitle = editingTitle.trim()
                  await handleUpdateTask(task.id, { title: newTitle })
                }
                setIsEditingTitle(false)
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <div className="flex items-center gap-1 min-w-0">
              <span
                className={`text-sm truncate cursor-pointer hover:text-blue-600 ${
                  task.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-800'
                }`}
                onClick={() => setSelectedTask(task)}
              >
                {task.title}
              </span>
              {/* 編輯按鈕 - 整行 hover 時顯示 */}
              <button
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-200 transition-all shrink-0"
                onClick={(e) => {
                  e.stopPropagation()
                  setEditingTitle(task.title)
                  setIsEditingTitle(true)
                }}
                title="編輯任務名稱"
              >
                <Pencil className="h-3.5 w-3.5 text-gray-500" />
              </button>
              {/* 例行任務標籤 */}
              <RecurrenceBadge type={task.recurrenceType} config={task.recurrenceConfig} />
            </div>
          )}
        </div>

        {/* 動態欄位 - 根據 columnOrder 順序渲染 */}
        {columnOrder.map((colKey) => {
          const width = columnWidths[colKey as keyof typeof columnWidths]

          // 負責人欄位
          if (colKey === 'assignee') {
            return (
              <div key={colKey} className="h-12 flex items-center shrink-0" style={{ width }}>
                <AssigneeDropdown
                  task={task}
                  teamMembers={teamMembers}
                  onUpdate={(assignee) => handleUpdateTask(task.id, { assignee })}
                  onAddMember={handleAddMember}
                  onRemoveMember={handleRemoveMember}
                  open={assigneeOpen}
                  onOpenChange={setAssigneeOpen}
                />
              </div>
            )
          }

          // 開始日欄位
          if (colKey === 'startDate') {
            return (
              <div key={colKey} className="h-12 flex items-center shrink-0" style={{ width }}>
                <Popover open={startDatePickerOpen} onOpenChange={setStartDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <button className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded hover:bg-gray-100 transition-colors w-full h-full text-gray-600">
                      <CalendarDays className="h-4 w-4 shrink-0" />
                      <span className="flex-1 text-left">{task.startDate ? formatDueDate(new Date(task.startDate)) : '-'}</span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <DateTimePicker
                      value={task.startDate ? new Date(task.startDate) : undefined}
                      onChange={(date) => { handleUpdateTask(task.id, { startDate: date || undefined }); setStartDatePickerOpen(false) }}
                      onClose={() => setStartDatePickerOpen(false)}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )
          }

          // 截止日欄位
          if (colKey === 'dueDate') {
            return (
              <div key={colKey} className="h-12 flex items-center shrink-0" style={{ width }}>
                <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <button className={`inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded hover:bg-gray-100 transition-colors w-full h-full ${
                      isOverdue ? 'text-red-600 bg-red-50' : 'text-gray-600'
                    }`}>
                      <Calendar className="h-4 w-4 shrink-0" />
                      <span className="flex-1 text-left">{task.dueDate ? formatDueDate(new Date(task.dueDate)) : '-'}</span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <DateTimePicker
                      value={task.dueDate ? new Date(task.dueDate) : undefined}
                      onChange={(date) => { handleUpdateTask(task.id, { dueDate: date || undefined }); setDatePickerOpen(false) }}
                      onClose={() => setDatePickerOpen(false)}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )
          }

          // 優先級欄位
          if (colKey === 'priority') {
            return (
              <div key={colKey} className="h-12 flex items-center shrink-0" style={{ width }}>
                <DropdownMenu open={priorityOpen} onOpenChange={setPriorityOpen}>
                  <DropdownMenuTrigger asChild>
                    <button className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded hover:bg-gray-100 transition-colors w-full h-full text-gray-600">
                      <span className="text-base shrink-0">{priorityConfig[task.priority].emoji}</span>
                      <span className="flex-1 text-left hidden sm:inline">{priorityConfig[task.priority].label}</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-28">
                    {(Object.keys(priorityConfig) as Array<keyof typeof priorityConfig>).map((key) => (
                      <DropdownMenuItem key={key} onClick={() => handleUpdateTask(task.id, { priority: key })} className="text-xs">
                        <span className="mr-2">{priorityConfig[key].emoji}</span>{priorityConfig[key].label}
                        {task.priority === key && <Check className="h-3 w-3 ml-auto" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )
          }

          // 專案欄位
          if (colKey === 'project') {
            return (
              <div key={colKey} className="h-12 flex items-center shrink-0" style={{ width }}>
                <DropdownMenu open={projectOpen} onOpenChange={setProjectOpen}>
                  <DropdownMenuTrigger asChild>
                    <button className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded hover:bg-gray-100 transition-colors w-full h-full text-gray-600">
                      <FolderKanban className="h-4 w-4 shrink-0 text-violet-500" />
                      <span className="flex-1 text-left truncate">{getProjectName(task.projectId) || '-'}</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-40">
                    {projects.filter(p => p.status === 'active').map((project) => (
                      <DropdownMenuItem key={project.id} onClick={() => handleUpdateTask(task.id, { projectId: project.id })} className="text-xs">
                        <FolderKanban className="h-3 w-3 mr-2 text-violet-500" />{project.name}
                        {task.projectId === project.id && <Check className="h-3 w-3 ml-auto" />}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-xs text-gray-500" onClick={() => handleUpdateTask(task.id, { projectId: undefined })}>清除專案</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )
          }

          // 加入日期欄位（唯讀）
          if (colKey === 'createdAt') {
            return (
              <div key={colKey} className="h-12 flex items-center shrink-0" style={{ width }}>
                <div className="inline-flex items-center gap-2 text-xs px-3 py-1.5 w-full h-full text-gray-500">
                  <Clock className="h-4 w-4 shrink-0" />
                  <span className="flex-1 text-left">{task.createdAt ? format(new Date(task.createdAt), 'M/d', { locale: zhTW }) : '-'}</span>
                </div>
              </div>
            )
          }

          return null
        })}

        {/* 更多操作 - 固定寬度 */}
        <div className="w-12 h-12 flex items-center justify-center shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors opacity-0 group-hover:opacity-100">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
                </svg>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              {/* 組別 */}
              <DropdownMenu open={groupOpen} onOpenChange={setGroupOpen}>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center w-full px-2 py-1.5 text-xs hover:bg-gray-100 rounded">
                    <FolderOpen className="h-3.5 w-3.5 mr-2" />
                    組別：{task.groupName || '無'}
                    <ChevronRight className="h-3 w-3 ml-auto" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="left" className="w-36">
                  {availableGroups.map((group) => (
                    <DropdownMenuItem key={group.name} onClick={() => handleUpdateTask(task.id, { groupName: group.name })} className="text-xs">
                      <span className={`w-2 h-2 rounded-full mr-2 ${getGroupColor(group.name).bg}`} />{group.name}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-xs text-gray-500" onClick={() => handleUpdateTask(task.id, { groupName: undefined })}>清除組別</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {/* 標籤 */}
              <DropdownMenu open={tagOpen} onOpenChange={setTagOpen}>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center w-full px-2 py-1.5 text-xs hover:bg-gray-100 rounded">
                    <TagIcon className="h-3.5 w-3.5 mr-2" />
                    標籤：{task.tags?.length ? task.tags[0] : '無'}
                    <ChevronRight className="h-3 w-3 ml-auto" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="left" className="w-36">
                  {availableTags.map((tag) => {
                    const tagSelected = (task.tags || []).includes(tag.name)
                    return (
                      <DropdownMenuItem key={tag.name} onClick={() => {
                        const currentTags = task.tags || []
                        const newTags = tagSelected ? currentTags.filter(t => t !== tag.name) : [...currentTags, tag.name]
                        handleUpdateTask(task.id, { tags: newTags })
                      }} className="text-xs">
                        <span className={`w-2 h-2 rounded-full mr-2 ${getTagColor(tag.name).bg}`} />{tag.name}
                        {tagSelected && <Check className="h-3 w-3 ml-auto" />}
                      </DropdownMenuItem>
                    )
                  })}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-xs text-gray-500" onClick={() => handleUpdateTask(task.id, { tags: [] })}>清除標籤</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {/* 專案 */}
              <DropdownMenu open={projectOpen} onOpenChange={setProjectOpen}>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center w-full px-2 py-1.5 text-xs hover:bg-gray-100 rounded">
                    <FolderKanban className="h-3.5 w-3.5 mr-2" />
                    專案：{getProjectName(task.projectId) || '無'}
                    <ChevronRight className="h-3 w-3 ml-auto" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="left" className="w-40">
                  {projects.filter(p => p.status === 'active').map((project) => (
                    <DropdownMenuItem key={project.id} onClick={() => handleUpdateTask(task.id, { projectId: project.id })} className="text-xs">
                      <FolderKanban className="h-3 w-3 mr-2 text-violet-500" />{project.name}
                      {task.projectId === project.id && <Check className="h-3 w-3 ml-auto" />}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-xs text-gray-500" onClick={() => handleUpdateTask(task.id, { projectId: undefined })}>清除專案</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-xs text-red-600" onClick={() => deleteTask(task.id)}>
                <Trash2 className="h-3.5 w-3.5 mr-2" />刪除任務
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    )
  }

  // 為了向後兼容，TaskItem 使用 SortableTaskItem
  const TaskItem = SortableTaskItem

  // 新增任務列組件 - ClickUp 風格（內部狀態管理，避免父組件 re-render）
  const AddTaskRow = ({
    groupKey,
    teamMembers,
    priorityConfig,
    columnWidths,
    onSubmit,
    onCancel,
  }: {
    groupKey: string
    teamMembers: string[]
    priorityConfig: PriorityConfig
    columnWidths: { assignee: number; startDate: number; dueDate: number; priority: number; project: number; createdAt: number }
    columnOrder: string[]
    projects: Project[]
    onSubmit: (data: { title: string; assignee?: string; startDate?: Date; dueDate?: Date; priority: Task['priority']; projectId?: string }) => void
    onCancel: () => void
  }) => {
    // 所有狀態內部管理，避免輸入時觸發父組件 re-render
    const [title, setTitle] = useState('')
    const [assignee, setAssignee] = useState<string | undefined>(undefined)
    const [startDate, setStartDate] = useState<Date | undefined>(undefined)
    const [dueDate, setDueDate] = useState<Date | undefined>(undefined)
    const [priority, setPriority] = useState<Task['priority']>('medium')
    const [projectId, setProjectId] = useState<string | undefined>(undefined)
    const [assigneeOpen, setAssigneeOpen] = useState(false)
    const [startDateOpen, setStartDateOpen] = useState(false)
    const [dueDateOpen, setDueDateOpen] = useState(false)
    const [priorityOpen, setPriorityOpen] = useState(false)
    const [projectPickerOpen, setProjectPickerOpen] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
      inputRef.current?.focus()
    }, [])

    const formatDate = (date: Date) => {
      if (isToday(date)) return '今天'
      if (isTomorrow(date)) return '明天'
      return format(date, 'M/d', { locale: zhTW })
    }

    const handleSubmit = () => {
      if (!title.trim()) return
      onSubmit({ title: title.trim(), assignee, startDate, dueDate, priority, projectId })
    }

    return (
      <div className="flex items-center bg-blue-50/50 border-t border-blue-100 hover:bg-blue-50/70 transition-colors">
        {/* 左側空間 - 與表格對齊 */}
        <div className="w-10 shrink-0" />
        <div className="w-8 shrink-0" />
        <div className="w-8 shrink-0" />

        {/* 任務名稱輸入 */}
        <div className="flex-1 min-w-0 h-11 flex items-center pr-4">
          <input
            ref={inputRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && title.trim()) handleSubmit()
              if (e.key === 'Escape') onCancel()
            }}
            placeholder="輸入任務名稱，按 Enter 新增"
            className="w-full text-sm bg-transparent border-0 outline-none placeholder:text-gray-400"
          />
        </div>

        {/* 動態欄位 - 根據 columnOrder 順序渲染 */}
        {columnOrder.map((colKey) => {
          const width = columnWidths[colKey as keyof typeof columnWidths]

          // 負責人欄位
          if (colKey === 'assignee') {
            return (
              <div key={colKey} className="h-11 flex items-center shrink-0" style={{ width }}>
                <Popover open={assigneeOpen} onOpenChange={setAssigneeOpen}>
                  <PopoverTrigger asChild>
                    <button className="inline-flex items-center gap-2 text-xs px-2 py-1.5 rounded hover:bg-white/60 transition-colors w-full h-full text-gray-500">
                      <User className="h-4 w-4 shrink-0" />
                      <span className="flex-1 text-left truncate">{assignee || '-'}</span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-40 p-1" align="start">
                    <div className="space-y-0.5">
                      {teamMembers.map((member) => (
                        <button
                          key={member}
                          onClick={() => { setAssignee(member); setAssigneeOpen(false) }}
                          className="flex items-center w-full px-2 py-1.5 text-xs rounded hover:bg-gray-100 transition-colors"
                        >
                          <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-medium mr-2 shrink-0">
                            {member.charAt(0).toUpperCase()}
                          </span>
                          <span className="truncate">{member}</span>
                          {assignee === member && <Check className="h-3 w-3 ml-auto text-blue-600" />}
                        </button>
                      ))}
                      {assignee && (
                        <>
                          <Separator className="my-1" />
                          <button
                            onClick={() => { setAssignee(undefined); setAssigneeOpen(false) }}
                            className="flex items-center w-full px-2 py-1.5 text-xs text-gray-500 rounded hover:bg-gray-100 transition-colors"
                          >
                            清除
                          </button>
                        </>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            )
          }

          // 開始日欄位
          if (colKey === 'startDate') {
            return (
              <div key={colKey} className="h-11 flex items-center shrink-0" style={{ width }}>
                <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                  <PopoverTrigger asChild>
                    <button className="inline-flex items-center gap-2 text-xs px-2 py-1.5 rounded hover:bg-white/60 transition-colors w-full h-full text-gray-500">
                      <CalendarDays className="h-4 w-4 shrink-0" />
                      <span className="flex-1 text-left">{startDate ? formatDate(startDate) : '-'}</span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <DateTimePicker
                      value={startDate}
                      onChange={(date) => { setStartDate(date || undefined); setStartDateOpen(false) }}
                      onClose={() => setStartDateOpen(false)}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )
          }

          // 截止日欄位
          if (colKey === 'dueDate') {
            return (
              <div key={colKey} className="h-11 flex items-center shrink-0" style={{ width }}>
                <Popover open={dueDateOpen} onOpenChange={setDueDateOpen}>
                  <PopoverTrigger asChild>
                    <button className="inline-flex items-center gap-2 text-xs px-2 py-1.5 rounded hover:bg-white/60 transition-colors w-full h-full text-gray-500">
                      <Calendar className="h-4 w-4 shrink-0" />
                      <span className="flex-1 text-left">{dueDate ? formatDate(dueDate) : '-'}</span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <DateTimePicker
                      value={dueDate}
                      onChange={(date) => { setDueDate(date || undefined); setDueDateOpen(false) }}
                      onClose={() => setDueDateOpen(false)}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )
          }

          // 優先級欄位
          if (colKey === 'priority') {
            return (
              <div key={colKey} className="h-11 flex items-center shrink-0" style={{ width }}>
                <DropdownMenu open={priorityOpen} onOpenChange={setPriorityOpen}>
                  <DropdownMenuTrigger asChild>
                    <button className="inline-flex items-center gap-2 text-xs px-2 py-1.5 rounded hover:bg-white/60 transition-colors w-full h-full text-gray-500">
                      <span className="text-base shrink-0">{priorityConfig[priority].emoji}</span>
                      <span className="flex-1 text-left hidden sm:inline">{priorityConfig[priority].label}</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-28">
                    {(Object.keys(priorityConfig) as Array<Task['priority']>).map((key) => (
                      <DropdownMenuItem key={key} onClick={() => setPriority(key)} className="text-xs">
                        <span className="mr-2">{priorityConfig[key].emoji}</span>{priorityConfig[key].label}
                        {priority === key && <Check className="h-3 w-3 ml-auto" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )
          }

          // 專案欄位
          if (colKey === 'project') {
            return (
              <div key={colKey} className="h-11 flex items-center shrink-0" style={{ width }}>
                <DropdownMenu open={projectPickerOpen} onOpenChange={setProjectPickerOpen}>
                  <DropdownMenuTrigger asChild>
                    <button className="inline-flex items-center gap-2 text-xs px-2 py-1.5 rounded hover:bg-white/60 transition-colors w-full h-full text-gray-500">
                      <FolderKanban className="h-4 w-4 shrink-0 text-violet-500" />
                      <span className="flex-1 text-left truncate">{projects.find(p => p.id === projectId)?.name || '-'}</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-40">
                    {projects.filter(p => p.status === 'active').map((project) => (
                      <DropdownMenuItem key={project.id} onClick={() => setProjectId(project.id)} className="text-xs">
                        <FolderKanban className="h-3 w-3 mr-2 text-violet-500" />{project.name}
                        {projectId === project.id && <Check className="h-3 w-3 ml-auto" />}
                      </DropdownMenuItem>
                    ))}
                    {projectId && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-xs text-gray-500" onClick={() => setProjectId(undefined)}>清除專案</DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )
          }

          // 加入日期欄位（新增時不顯示）
          if (colKey === 'createdAt') {
            return (
              <div key={colKey} className="h-11 flex items-center shrink-0" style={{ width }}>
                <div className="inline-flex items-center gap-2 text-xs px-2 py-1.5 w-full h-full text-gray-400">
                  <Clock className="h-4 w-4 shrink-0" />
                  <span className="flex-1 text-left">-</span>
                </div>
              </div>
            )
          }

          return null
        })}

        {/* 操作按鈕 */}
        <div className="w-12 h-11 flex items-center justify-center shrink-0 gap-1">
          <button
            onClick={handleSubmit}
            disabled={!title.trim()}
            className="p-1.5 rounded text-blue-600 hover:text-blue-700 hover:bg-white/60 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="新增任務"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            onClick={onCancel}
            className="p-1.5 rounded text-gray-400 hover:text-gray-600 hover:bg-white/60 transition-colors"
            title="取消"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    )
  }

  // 依照 taskOrder 或二次排序來排序任務
  const sortTasksByOrder = useCallback((tasksToSort: Task[]) => {
    // 如果有二次排序，優先使用二次排序
    if (secondarySort.field) {
      return sortTasksBySecondary(tasksToSort)
    }
    // 否則使用原本的拖曳順序
    return [...tasksToSort].sort((a, b) => {
      const aIndex = taskOrder.indexOf(a.id)
      const bIndex = taskOrder.indexOf(b.id)
      if (aIndex === -1 && bIndex === -1) return 0
      if (aIndex === -1) return 1
      if (bIndex === -1) return -1
      return aIndex - bIndex
    })
  }, [taskOrder, secondarySort.field, sortTasksBySecondary])

  // 可拖曳調整寬度的分隔線元件（放在欄位左側）
  const ResizeHandle = ({ column }: { column: string }) => (
    <div
      className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-400/50 active:bg-blue-500/50 transition-colors z-20"
      onMouseDown={(e) => handleResizeStart(column, e)}
    />
  )

  // 判斷是否全選（filter 為 'all' 時要包含已完成的任務）
  const totalSelectableTasks = filter === 'all' ? filteredTasks.length + completedTasks.length : filteredTasks.length
  const isAllSelected = totalSelectableTasks > 0 && selectedTaskIds.size === totalSelectableTasks
  const isPartiallySelected = selectedTaskIds.size > 0 && selectedTaskIds.size < totalSelectableTasks

  // 欄位設定
  const columnConfig: Record<string, { label: string; icon: React.ReactNode; sortable?: boolean; sortField?: 'assignee' | 'startDate' | 'dueDate' | 'priority' }> = {
    assignee: { label: '負責人', icon: <User className="h-4 w-4 shrink-0 mr-1" />, sortable: true, sortField: 'assignee' },
    startDate: { label: '開始日', icon: <CalendarDays className="h-4 w-4 shrink-0 mr-1" />, sortable: true, sortField: 'startDate' },
    dueDate: { label: '截止日', icon: <Calendar className="h-4 w-4 shrink-0 mr-1" />, sortable: true, sortField: 'dueDate' },
    priority: { label: '優先級', icon: null, sortable: true, sortField: 'priority' },
    project: { label: '專案', icon: <FolderKanban className="h-4 w-4 shrink-0 mr-1" />, sortable: false },
    createdAt: { label: '加入日期', icon: <Clock className="h-4 w-4 shrink-0 mr-1" />, sortable: false },
  }

  // 欄位拖曳狀態
  const [draggingColumn, setDraggingColumn] = useState<string | null>(null)

  // 欄位拖曳處理
  const handleColumnDragStart = (e: React.DragEvent, column: string) => {
    setDraggingColumn(column)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', column)
  }

  const handleColumnDragOver = (e: React.DragEvent, targetColumn: string) => {
    e.preventDefault()
    if (!draggingColumn || draggingColumn === targetColumn) return

    const dragIndex = columnOrder.indexOf(draggingColumn)
    const targetIndex = columnOrder.indexOf(targetColumn)

    if (dragIndex !== -1 && targetIndex !== -1) {
      const newOrder = [...columnOrder]
      newOrder.splice(dragIndex, 1)
      newOrder.splice(targetIndex, 0, draggingColumn)
      setColumnOrder(newOrder)
    }
  }

  const handleColumnDragEnd = () => {
    setDraggingColumn(null)
  }

  // ClickUp 風格的表格標題列（含可拖曳調整寬度和順序）
  const TableHeader = () => (
    <div className={`flex items-center bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 sticky top-0 z-10 ${resizing ? 'select-none' : ''}`}>
      {/* 拖曳手柄佔位 */}
      <div className="w-10 h-10 shrink-0" />
      {/* 全選核取框 */}
      <div className="w-8 h-10 flex items-center justify-center shrink-0">
        <button
          className="w-4 h-4 flex items-center justify-center"
          onClick={isAllSelected ? deselectAllTasks : selectAllTasks}
          title={isAllSelected ? '取消全選' : '全選所有任務'}
        >
          {isAllSelected ? (
            <CheckSquare className="h-4 w-4 text-blue-600" />
          ) : isPartiallySelected ? (
            <div className="w-4 h-4 border-2 border-blue-600 rounded flex items-center justify-center">
              <div className="w-2 h-0.5 bg-blue-600" />
            </div>
          ) : (
            <Square className="h-4 w-4 text-gray-400 hover:text-blue-600" />
          )}
        </button>
      </div>
      {/* 狀態佔位 */}
      <div className="w-8 h-10 shrink-0" />
      {/* 任務名稱 - 可點擊排序 */}
      <div className="flex-1 min-w-0 h-10 flex items-center pr-4">
        <button
          onClick={() => setSecondarySort('title')}
          className={`flex items-center gap-1 hover:text-gray-900 transition-colors ${secondarySort.field === 'title' ? 'text-gray-900 font-semibold' : 'text-gray-500'}`}
        >
          任務名稱
          {secondarySort.field === 'title' && (
            secondarySort.direction === 'asc'
              ? <ChevronUp className="h-3 w-3 ml-1" />
              : <ChevronUp className="h-3 w-3 ml-1 rotate-180" />
          )}
          {secondarySort.field !== 'title' && <ChevronsUpDown className="h-3 w-3 ml-1 opacity-0 group-hover:opacity-50" />}
        </button>
      </div>
      {/* 動態欄位 - 根據 columnOrder 順序渲染 */}
      {columnOrder.map((colKey) => {
        const config = columnConfig[colKey]
        if (!config) return null
        const width = columnWidths[colKey as keyof typeof columnWidths]

        return (
          <div
            key={colKey}
            className={`h-10 flex items-center px-3 shrink-0 relative cursor-grab active:cursor-grabbing ${draggingColumn === colKey ? 'opacity-50 bg-blue-100' : ''}`}
            style={{ width }}
            draggable
            onDragStart={(e) => handleColumnDragStart(e, colKey)}
            onDragOver={(e) => handleColumnDragOver(e, colKey)}
            onDragEnd={handleColumnDragEnd}
          >
            <ResizeHandle column={colKey} />
            {config.sortable && config.sortField ? (
              <button
                onClick={() => setSecondarySort(config.sortField!)}
                className={`flex items-center gap-1 hover:text-gray-900 transition-colors ${secondarySort.field === config.sortField ? 'text-gray-900 font-semibold' : 'text-gray-500'}`}
              >
                {config.icon}
                {config.label}
                {secondarySort.field === config.sortField && (
                  secondarySort.direction === 'asc'
                    ? <ChevronUp className="h-3 w-3 ml-1" />
                    : <ChevronUp className="h-3 w-3 ml-1 rotate-180" />
                )}
              </button>
            ) : (
              <span className="flex items-center gap-1 text-gray-500">
                {config.icon}
                {config.label}
              </span>
            )}
          </div>
        )
      })}
      {/* 更多操作佔位 */}
      <div className="w-12 h-10 shrink-0" />
    </div>
  )

  // 渲染分組任務（支援拖曳 + 收合）
  const renderGroupedTasks = (groups: Record<string, Task[]>, labels: Record<string, { emoji?: string; label: string; className?: string }>) => {
    // 排序 keys：overdue > today > tomorrow > date_xxx（按日期） > noDueDate
    const sortedKeys = Object.keys(groups).sort((a, b) => {
      const order: Record<string, number> = { overdue: 0, today: 1, tomorrow: 2, noDueDate: 999 }
      const aOrder = order[a] ?? (a.startsWith('date_') ? 3 : 998)
      const bOrder = order[b] ?? (b.startsWith('date_') ? 3 : 998)

      if (aOrder !== bOrder) return aOrder - bOrder
      if (a.startsWith('date_') && b.startsWith('date_')) {
        return a.localeCompare(b)
      }
      return 0
    })

    // 合併所有可見任務 ID 用於 SortableContext（只包含未收合的分組）
    const allTaskIds = sortedKeys.flatMap(key => {
      if (collapsedGroups.has(key)) return []
      return (groups[key] || []).map(t => t.id)
    })

    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        {/* 表格標題列 */}
        <TableHeader />

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={allTaskIds} strategy={verticalListSortingStrategy}>
            {sortedKeys.map(key => {
              const groupTasks = sortTasksByOrder(groups[key] || [])
              if (!groupTasks || groupTasks.length === 0) return null
              const config = labels[key] || { label: key }
              const isCollapsed = collapsedGroups.has(key)

              return (
                <div key={key}>
                  {/* 分組標題行 - 可點擊收合 */}
                  <button
                    onClick={() => toggleGroupCollapse(key)}
                    className={`flex items-center gap-2 w-full px-4 py-2.5 bg-gray-50 border-b border-gray-100 hover:bg-gray-100 transition-colors text-left ${config.className || ''}`}
                  >
                    <ChevronRight className={`h-4 w-4 text-gray-400 transition-transform ${isCollapsed ? '' : 'rotate-90'}`} />
                    {config.emoji && <span className="text-sm">{config.emoji}</span>}
                    <span className="text-sm font-medium text-gray-700">{config.label}</span>
                    <span className="text-xs text-gray-400 bg-gray-200 px-1.5 py-0.5 rounded">{groupTasks.length}</span>
                  </button>
                  {/* 任務列表 - 收合時隱藏 */}
                  {!isCollapsed && (
                    <div>
                      {groupTasks.map((task: Task) => (
                        <SortableTaskItem key={task.id} task={task} />
                      ))}
                      {/* 新增任務列 - ClickUp 風格 */}
                      {addingInGroup === key ? (
                        <AddTaskRow
                          groupKey={key}
                          teamMembers={teamMembers}
                          priorityConfig={priorityConfig}
                          columnWidths={columnWidths}
                          columnOrder={columnOrder}
                          projects={projects}
                          onSubmit={(data) => handleAddTaskInGroup(key, data)}
                          onCancel={() => setAddingInGroup(null)}
                        />
                      ) : (
                        <button
                          onClick={() => setAddingInGroup(key)}
                          className="flex items-center w-full h-10 text-sm text-gray-400 hover:text-gray-600 hover:bg-gray-50/80 border-t border-gray-100 transition-colors"
                        >
                          {/* 與表格欄位對齊 */}
                          <div className="w-10 shrink-0" />
                          <div className="w-8 shrink-0" />
                          <div className="w-8 shrink-0" />
                          <div className="flex-1 flex items-center gap-1.5 px-2">
                            <Plus className="h-3.5 w-3.5" />
                            <span>新增任務</span>
                          </div>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </SortableContext>
        </DndContext>
      </div>
    )
  }

  // Droppable 專案分組標題組件
  const DroppableProjectHeader = ({ projectId, label, taskCount, isCollapsed, onToggle }: {
    projectId: string
    label: string
    taskCount: number
    isCollapsed: boolean
    onToggle: () => void
  }) => {
    const { setNodeRef, isOver } = useDroppable({
      id: `project-${projectId}`,
    })

    return (
      <div
        ref={setNodeRef}
        data-droppable-id={`project-${projectId}`}
        className={`relative flex items-center gap-2 w-full px-4 py-3 bg-gray-50 border-b border-gray-100 transition-all duration-200 ${
          isOver
            ? 'bg-blue-100 border-blue-400 border-2 shadow-md'
            : 'hover:bg-gray-100'
        }`}
      >
        <button
          onClick={onToggle}
          className="flex items-center gap-2 flex-1 text-left"
        >
          <ChevronRight className={`h-4 w-4 text-gray-400 transition-transform ${isCollapsed ? '' : 'rotate-90'}`} />
          <span className="text-sm">📁</span>
          <span className="text-sm font-medium text-gray-700">{label}</span>
          <span className="text-xs text-gray-400 bg-gray-200 px-1.5 py-0.5 rounded">{taskCount}</span>
        </button>
        {isOver && (
          <span className="text-xs text-blue-600 font-medium animate-pulse">放開以移動到此專案</span>
        )}
      </div>
    )
  }

  // 渲染專案分組任務（支援跨專案拖曳）
  const renderProjectGroupedTasks = () => {
    // 排序 keys：專案按字母順序，未分類放最後
    const sortedKeys = Object.keys(groupedByProject).sort((a, b) => {
      if (a === 'uncategorized') return 1
      if (b === 'uncategorized') return -1
      const nameA = getProjectDisplayName(a)
      const nameB = getProjectDisplayName(b)
      return nameA.localeCompare(nameB)
    })

    // 合併所有可見任務 ID 用於 SortableContext
    const allTaskIds = sortedKeys.flatMap(key => {
      if (collapsedGroups.has(key)) return []
      return (groupedByProject[key] || []).map(t => t.id)
    })

    // 所有專案的 droppable ID
    const droppableIds = sortedKeys.map(key => `project-${key}`)

    // 取得目前拖曳中的任務
    const activeTask = activeTaskId ? tasks.find(t => t.id === activeTaskId) : null

    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        {/* 表格標題列 */}
        <TableHeader />

        <DndContext
          sensors={sensors}
          collisionDetection={customCollisionDetection}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={[...allTaskIds, ...droppableIds]} strategy={verticalListSortingStrategy}>
            {sortedKeys.map(key => {
              const groupTasks = sortTasksByOrder(groupedByProject[key] || [])
              if (!groupTasks || groupTasks.length === 0) return null
              const label = getProjectDisplayName(key)
              const isCollapsed = collapsedGroups.has(key)

              return (
                <div key={key}>
                  {/* 專案分組標題 - 可接收拖曳 */}
                  <DroppableProjectHeader
                    projectId={key}
                    label={label}
                    taskCount={groupTasks.length}
                    isCollapsed={isCollapsed}
                    onToggle={() => toggleGroupCollapse(key)}
                  />
                  {/* 任務列表 - 收合時隱藏 */}
                  {!isCollapsed && (
                    <div>
                      {groupTasks.map((task: Task) => (
                        <SortableTaskItem key={task.id} task={task} />
                      ))}
                      {/* 新增任務列 */}
                      {addingInGroup === key ? (
                        <AddTaskRow
                          groupKey={key}
                          teamMembers={teamMembers}
                          priorityConfig={priorityConfig}
                          columnWidths={columnWidths}
                          columnOrder={columnOrder}
                          projects={projects}
                          onSubmit={(data) => handleAddTaskInGroup(key, data)}
                          onCancel={() => setAddingInGroup(null)}
                        />
                      ) : (
                        <button
                          onClick={() => setAddingInGroup(key)}
                          className="flex items-center w-full h-10 text-sm text-gray-400 hover:text-gray-600 hover:bg-gray-50/80 border-t border-gray-100 transition-colors"
                        >
                          <div className="w-10 shrink-0" />
                          <div className="w-8 shrink-0" />
                          <div className="w-8 shrink-0" />
                          <div className="flex-1 flex items-center gap-1.5 px-2">
                            <Plus className="h-3.5 w-3.5" />
                            <span>新增任務</span>
                          </div>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </SortableContext>
          {/* 拖曳中的任務預覽 */}
          <DragOverlay>
            {activeTask ? (
              <div className="bg-white border border-blue-300 rounded-lg shadow-lg px-4 py-2 opacity-90">
                <span className="text-sm font-medium">{activeTask.title}</span>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/50">
      <div className="p-6 space-y-5">
        {/* 標題區 - Acctual 風格 */}
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">任務列表</h1>
          <button
            onClick={refresh}
            disabled={isLoading}
            className="p-1.5 rounded-md hover:bg-gray-100 text-muted-foreground hover:text-foreground transition-colors"
            title="重新整理"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </button>
        </div>

        {/* 搜尋和新增任務區 */}
        <div className="flex gap-3 items-center">
          {/* 搜尋框 */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜尋任務..."
              className="pl-9 border-gray-200 focus:border-gray-400 focus:ring-gray-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* 批次選取按鈕 */}
          <button
            onClick={toggleSelectionMode}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md transition-colors shrink-0 ${
              isSelectionMode
                ? 'bg-primary text-primary-foreground'
                : 'border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {isSelectionMode ? (
              <>
                <X className="h-4 w-4" />
                取消
              </>
            ) : (
              <CheckSquare className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* 搜尋結果提示 */}
        {searchQuery && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Search className="h-4 w-4" />
            <span>搜尋「{searchQuery}」找到 {filteredTasks.length} 筆結果</span>
            <button
              onClick={() => setSearchQuery('')}
              className="text-xs px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              清除搜尋
            </button>
          </div>
        )}

        {/* Tab 和工具列 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                filter === 'all'
                  ? 'bg-gray-900 text-white'
                  : 'text-muted-foreground hover:text-foreground hover:bg-gray-100'
              }`}
            >
              全部
              <span className={`ml-1.5 px-1.5 py-0.5 rounded text-xs ${
                filter === 'all' ? 'bg-gray-700' : 'bg-gray-200'
              }`}>{filteredTasks.length + completedTasks.length}</span>
            </button>
            <button
              onClick={() => setFilter('pending')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                filter === 'pending'
                  ? 'bg-gray-900 text-white'
                  : 'text-muted-foreground hover:text-foreground hover:bg-gray-100'
              }`}
            >
              待處理
              <span className={`ml-1.5 px-1.5 py-0.5 rounded text-xs ${
                filter === 'pending' ? 'bg-gray-700' : 'bg-gray-200'
              }`}>{tasks.filter(t => t.status === 'pending').length}</span>
            </button>
            <button
              onClick={() => setFilter('in_progress')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                filter === 'in_progress'
                  ? 'bg-blue-600 text-white'
                  : 'text-muted-foreground hover:text-foreground hover:bg-gray-100'
              }`}
            >
              進行中
              <span className={`ml-1.5 px-1.5 py-0.5 rounded text-xs ${
                filter === 'in_progress' ? 'bg-blue-500' : 'bg-gray-200'
              }`}>{tasks.filter(t => t.status === 'in_progress').length}</span>
            </button>
            <button
              onClick={() => setFilter('completed')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                filter === 'completed'
                  ? 'bg-gray-900 text-white'
                  : 'text-muted-foreground hover:text-foreground hover:bg-gray-100'
              }`}
            >
              已完成
              <span className={`ml-1.5 px-1.5 py-0.5 rounded text-xs ${
                filter === 'completed' ? 'bg-gray-700' : 'bg-gray-200'
              }`}>{completedTasks.length}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* 分類模式 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-md hover:bg-gray-50 transition-colors">
                  <LayoutGrid className="h-3.5 w-3.5" />
                  分類：{sortMode === 'priority' ? '優先級' : sortMode === 'dueDate' ? '截止日' : sortMode === 'assignee' ? '負責人' : sortMode === 'tag' ? '標籤' : sortMode === 'project' ? '專案' : '組別'}
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setSortMode('dueDate')}>
                  <Calendar className="h-4 w-4 mr-2" />
                  截止日
                  {sortMode === 'dueDate' && <Check className="h-4 w-4 ml-auto" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortMode('priority')}>
                  <AlertCircle className="h-4 w-4 mr-2" />
                  優先級
                  {sortMode === 'priority' && <Check className="h-4 w-4 ml-auto" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortMode('assignee')}>
                  <User className="h-4 w-4 mr-2" />
                  負責人
                  {sortMode === 'assignee' && <Check className="h-4 w-4 ml-auto" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortMode('tag')}>
                  <TagIcon className="h-4 w-4 mr-2" />
                  標籤
                  {sortMode === 'tag' && <Check className="h-4 w-4 ml-auto" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortMode('group')}>
                  <Users className="h-4 w-4 mr-2" />
                  組別
                  {sortMode === 'group' && <Check className="h-4 w-4 ml-auto" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortMode('project')}>
                  <FolderKanban className="h-4 w-4 mr-2" />
                  專案
                  {sortMode === 'project' && <Check className="h-4 w-4 ml-auto" />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* 過濾器 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={`flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-md hover:bg-gray-50 transition-colors ${tagFilter || assigneeFilter || groupFilter ? 'border-gray-900' : ''}`}>
                  <Filter className="h-3.5 w-3.5" />
                  篩選
                  {(tagFilter || assigneeFilter || groupFilter) && (
                    <span className="ml-1 px-1.5 py-0.5 rounded bg-gray-900 text-white text-xs">
                      {(tagFilter ? 1 : 0) + (assigneeFilter ? 1 : 0) + (groupFilter ? 1 : 0)}
                    </span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5 text-sm font-medium text-muted-foreground">負責人</div>
                <DropdownMenuItem onClick={() => setAssigneeFilter(null)} className={!assigneeFilter ? 'bg-muted' : ''}>
                  全部
                  {!assigneeFilter && <Check className="h-4 w-4 ml-auto" />}
                </DropdownMenuItem>
                {usedAssignees.map(assignee => (
                  <DropdownMenuItem key={assignee} onClick={() => setAssigneeFilter(assignee)} className={assigneeFilter === assignee ? 'bg-muted' : ''}>
                    {assignee}
                    {assigneeFilter === assignee && <Check className="h-4 w-4 ml-auto" />}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5 text-sm font-medium text-muted-foreground">組別</div>
                <DropdownMenuItem onClick={() => setGroupFilter(null)} className={!groupFilter ? 'bg-muted' : ''}>
                  全部
                  {!groupFilter && <Check className="h-4 w-4 ml-auto" />}
                </DropdownMenuItem>
                {usedGroups.map(group => {
                  const colors = getGroupColor(group)
                  return (
                    <DropdownMenuItem key={group} onClick={() => setGroupFilter(group)} className={groupFilter === group ? 'bg-muted' : ''}>
                      <span className={`px-1.5 py-0.5 rounded text-xs ${colors.bg} ${colors.text}`}>{group}</span>
                      {groupFilter === group && <Check className="h-4 w-4 ml-auto" />}
                    </DropdownMenuItem>
                  )
                })}
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5 text-sm font-medium text-muted-foreground">標籤</div>
                <DropdownMenuItem onClick={() => setTagFilter(null)} className={!tagFilter ? 'bg-muted' : ''}>
                  全部
                  {!tagFilter && <Check className="h-4 w-4 ml-auto" />}
                </DropdownMenuItem>
                {usedTags.map(tag => {
                  const colors = getTagColor(tag)
                  return (
                    <DropdownMenuItem key={tag} onClick={() => setTagFilter(tag)} className={tagFilter === tag ? 'bg-muted' : ''}>
                      <span className={`px-1.5 py-0.5 rounded text-xs ${colors.bg} ${colors.text}`}>{tag}</span>
                      {tagFilter === tag && <Check className="h-4 w-4 ml-auto" />}
                    </DropdownMenuItem>
                  )
                })}
                {usedProjects.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <div className="px-2 py-1.5 text-sm font-medium text-muted-foreground">專案</div>
                    <DropdownMenuItem onClick={() => setProjectFilter(null)} className={!projectFilter ? 'bg-muted' : ''}>
                      全部
                      {!projectFilter && <Check className="h-4 w-4 ml-auto" />}
                    </DropdownMenuItem>
                    {usedProjects.map(project => (
                      <DropdownMenuItem key={project.id} onClick={() => setProjectFilter(project.id)} className={projectFilter === project.id ? 'bg-muted' : ''}>
                        <FolderKanban className="h-3 w-3 mr-1.5 text-muted-foreground" />
                        {project.name}
                        {projectFilter === project.id && <Check className="h-4 w-4 ml-auto" />}
                      </DropdownMenuItem>
                    ))}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

          </div>
        </div>

        {error && (
          <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
            {error}
            <Button variant="link" className="ml-2" onClick={refresh}>重試</Button>
          </div>
        )}

        {isLoading && tasks.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p>正在載入任務...</p>
          </div>
        )}

        {/* 任務列表 */}
        <div className="space-y-6">
          {sortMode === 'dueDate' && renderGroupedTasks(groupedByDueDate, dueDateLabels)}

          {sortMode === 'priority' && renderGroupedTasks(groupedByPriority, {
            urgent: { emoji: '🔴', label: '緊急', className: 'text-destructive' },
            high: { emoji: '🟠', label: '高優先級' },
            medium: { emoji: '🟡', label: '中優先級' },
            low: { emoji: '🟢', label: '低優先級' },
          })}

          {sortMode === 'assignee' && renderGroupedTasks(groupedByAssignee,
            Object.keys(groupedByAssignee).reduce((acc, key) => {
              acc[key] = { emoji: '👤', label: key }
              return acc
            }, {} as Record<string, { emoji: string; label: string }>)
          )}

          {sortMode === 'tag' && renderGroupedTasks(groupedByTag,
            Object.keys(groupedByTag).reduce((acc, key) => {
              acc[key] = { emoji: '🏷️', label: key }
              return acc
            }, {} as Record<string, { emoji: string; label: string }>)
          )}

          {sortMode === 'group' && renderGroupedTasks(groupedByGroup,
            Object.keys(groupedByGroup).reduce((acc, key) => {
              acc[key] = { emoji: '👥', label: key }
              return acc
            }, {} as Record<string, { emoji: string; label: string }>)
          )}

          {sortMode === 'project' && renderProjectGroupedTasks()}

          {filteredTasks.length === 0 && filter !== 'completed' && (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-4xl mb-4">🎉</p>
              <p>太棒了！目前沒有待辦任務</p>
              <p className="text-sm mt-2">在對話中貼上會議記錄，我會自動幫你萃取任務</p>
            </div>
          )}

          {completedTasks.length > 0 && (
            <div className="space-y-1.5 pt-4 border-t">
              <button
                className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700 transition-colors uppercase tracking-wide"
                onClick={() => setShowCompleted(!showCompleted)}
              >
                {showCompleted ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                <span>已完成</span>
                <span className="text-gray-400 font-normal">({completedTasks.length})</span>
              </button>
              {showCompleted && (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={completedTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-1.5">
                      {sortTasksByOrder(completedTasks).map((task: Task) => (
                        <SortableTaskItem key={task.id} task={task} />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>
          )}
        </div>
      </div>

      <TaskDetailDialog
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onUpdate={handleUpdateTask}
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

      {/* 底部固定批次操作工具列 */}
      {selectedTaskIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t shadow-lg">
          <div className="max-w-6xl mx-auto px-6 py-3">
            <div className="flex items-center justify-between">
              {/* 左側：選取資訊 */}
              <div className="flex items-center gap-4">
                <button
                  onClick={deselectAllTasks}
                  className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
                  title="取消選取"
                >
                  <X className="h-5 w-5" />
                </button>
                <span className="text-sm font-medium">
                  已選取 {selectedTaskIds.size} 個任務
                </span>
              </div>

              {/* 右側：操作按鈕 */}
              <div className="flex items-center gap-2">
                {/* 負責人 */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-1.5 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors">
                      <User className="h-4 w-4" />
                      負責人
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    {teamMembers.map((member) => (
                      <DropdownMenuItem
                        key={member}
                        onClick={() => handleBatchUpdate({ assignee: member })}
                      >
                        <User className="h-3 w-3 mr-2" />
                        {member}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => handleBatchUpdate({ assignee: undefined })}
                      className="text-muted-foreground"
                    >
                      <X className="h-3 w-3 mr-2" />
                      清除負責人
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* 開始日期 */}
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="flex items-center gap-1.5 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors">
                      <Calendar className="h-4 w-4" />
                      開始日
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end" side="top">
                    <CalendarComponent
                      mode="single"
                      locale={zhTW}
                      onSelect={(date) => {
                        if (date) {
                          handleBatchUpdate({ startDate: date })
                        }
                      }}
                      footer={
                        <button
                          onClick={() => handleBatchUpdate({ startDate: undefined })}
                          className="w-full mt-2 px-3 py-1.5 text-sm text-muted-foreground hover:bg-gray-100 rounded-md transition-colors"
                        >
                          清除開始日期
                        </button>
                      }
                    />
                  </PopoverContent>
                </Popover>

                {/* 截止日期 */}
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="flex items-center gap-1.5 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors">
                      <CalendarDays className="h-4 w-4" />
                      截止日
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end" side="top">
                    <CalendarComponent
                      mode="single"
                      locale={zhTW}
                      onSelect={(date) => {
                        if (date) {
                          handleBatchUpdate({ dueDate: date })
                        }
                      }}
                      footer={
                        <button
                          onClick={() => handleBatchUpdate({ dueDate: undefined })}
                          className="w-full mt-2 px-3 py-1.5 text-sm text-muted-foreground hover:bg-gray-100 rounded-md transition-colors"
                        >
                          清除截止日期
                        </button>
                      }
                    />
                  </PopoverContent>
                </Popover>

                {/* 優先級 */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-1.5 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors">
                      <AlertCircle className="h-4 w-4" />
                      優先級
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {(Object.keys(priorityConfig) as Array<keyof typeof priorityConfig>).map((key) => (
                      <DropdownMenuItem
                        key={key}
                        onClick={() => handleBatchUpdate({ priority: key })}
                      >
                        <span className="mr-2">{priorityConfig[key].emoji}</span>
                        {priorityConfig[key].label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* 組別 */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-1.5 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors">
                      <Users className="h-4 w-4" />
                      組別
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    {availableGroups.map((group) => (
                      <DropdownMenuItem
                        key={group.name}
                        onClick={() => handleBatchUpdate({ groupName: group.name })}
                      >
                        <span className={`w-2 h-2 rounded-full mr-2 ${getGroupColor(group.name).bg}`} />
                        {group.name}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => handleBatchUpdate({ groupName: undefined })}
                      className="text-muted-foreground"
                    >
                      <X className="h-3 w-3 mr-2" />
                      清除組別
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* 狀態 */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-1.5 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors">
                      <Circle className="h-4 w-4" />
                      狀態
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleBatchUpdate({ status: 'pending' })}>
                      <span className="w-2 h-2 rounded-full bg-gray-400 mr-2" />
                      未開始
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBatchUpdate({ status: 'in_progress' })}>
                      <span className="w-2 h-2 rounded-full bg-blue-500 mr-2" />
                      進行中
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBatchUpdate({ status: 'on_hold' })}>
                      <span className="w-2 h-2 rounded-full bg-amber-500 mr-2" />
                      暫停
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBatchUpdate({ status: 'completed' })}>
                      <span className="w-2 h-2 rounded-full bg-green-500 mr-2" />
                      已完成
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <div className="w-px h-6 bg-gray-300 mx-1" />

                {/* 刪除 */}
                <button
                  onClick={handleBatchDelete}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm bg-red-100 text-red-700 hover:bg-red-200 rounded-md transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                  刪除
                </button>

                {/* 復原（只在有可復原操作時顯示） */}
                {canUndo && (
                  <>
                    <div className="w-px h-6 bg-gray-300 mx-1" />
                    <button
                      onClick={handleUndo}
                      className="flex items-center gap-1.5 px-3 py-2 text-sm bg-amber-100 text-amber-700 hover:bg-amber-200 rounded-md transition-colors"
                      title={undoHistory.length > 0 ? `復原: ${undoHistory[undoHistory.length - 1].description}` : '復原'}
                    >
                      <Undo2 className="h-4 w-4" />
                      復原
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 浮動復原按鈕（操作後短暫顯示，5秒後自動隱藏，支援 Cmd+Z） */}
      {showUndoButton && canUndo && selectedTaskIds.size === 0 && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <button
            onClick={() => {
              handleUndo()
              // 點擊後重設計時器
              showUndoButtonWithTimer()
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 text-white hover:bg-amber-600 rounded-full shadow-lg transition-all hover:scale-105"
            title={`復原: ${undoHistory[undoHistory.length - 1]?.description || ''} (⌘Z)`}
          >
            <Undo2 className="h-4 w-4" />
            <span className="text-sm font-medium">復原</span>
            {undoHistory.length > 1 && (
              <span className="bg-amber-600 text-xs px-1.5 py-0.5 rounded-full">
                {undoHistory.length}
              </span>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
