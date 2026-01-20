'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
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
import type { Task } from '@/lib/useSupabaseTasks'
import type { Project } from '@/lib/useSupabaseProjects'
import { RecurrenceSelector } from '@/components/task/RecurrenceSelector'
import { getTagColor, TAG_COLORS, type Tag } from '@/lib/tags'
import { getGroupColor, GROUP_COLORS, type Group } from '@/lib/groups'
import { format, setHours, setMinutes, addMinutes } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import {
  Check,
  Trash2,
  Plus,
  ChevronDown,
  User,
  FolderOpen,
  FolderKanban,
  X,
  CalendarDays,
  Clock,
  Settings,
  Edit3,
  Users,
  Loader2,
} from 'lucide-react'

// 優先級設定
export type PriorityConfig = {
  [key in 'urgent' | 'high' | 'medium' | 'low']: {
    label: string
    emoji: string
    color: 'destructive' | 'default' | 'secondary' | 'outline'
  }
}

export const priorityConfig: PriorityConfig = {
  urgent: { label: '緊急', emoji: '🔴', color: 'destructive' },
  high: { label: '高', emoji: '🟠', color: 'default' },
  medium: { label: '中', emoji: '🟡', color: 'secondary' },
  low: { label: '低', emoji: '🟢', color: 'outline' },
}

// 解析 description 的各個區塊
export function parseDescription(description: string) {
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
    if (quotesText.length > 0) {
      const quoteLines = quotesText.split('\n').filter(line => {
        const trimmed = line.trim()
        if (!trimmed || trimmed === '「' || trimmed === '」') return false
        return trimmed.startsWith('「') ||
               trimmed.startsWith('【') ||
               /^\d{1,2}:\d{2}/.test(trimmed) ||
               /^[A-Za-z\u4e00-\u9fff]+[:：]/.test(trimmed) ||
               trimmed.length > 10
      })
      sections.quotes = quoteLines.map(line => {
        let trimmed = line.trim()
        const timeMatch = trimmed.match(/^(\d{1,2}:\d{2})\s+(.+)/)
        if (timeMatch) {
          trimmed = `【${timeMatch[1]}】${timeMatch[2]}`
        }
        return trimmed
      })
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

// 將 sections 重新組合回 description 字串
export function buildDescription(sections: {
  summary: string
  steps: string[]
  context: string
  quotes: string[]
}): string {
  const parts: string[] = []

  if (sections.summary) {
    parts.push(`【任務摘要】\n${sections.summary}`)
  }

  if (sections.steps.length > 0) {
    const stepsText = sections.steps.map((step, i) => `${i + 1}. ${step}`).join('\n')
    parts.push(`【執行細節】\n${stepsText}`)
  }

  if (sections.context) {
    parts.push(`【會議脈絡】\n${sections.context}`)
  }

  if (sections.quotes.length > 0) {
    parts.push(`【原文引用】\n${sections.quotes.join('\n')}`)
  }

  return parts.join('\n\n')
}

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

interface TaskDetailDialogProps {
  task: Task | null
  onClose: () => void
  onUpdate: (id: string, updates: Partial<Task>) => Promise<void>
  onComplete?: (id: string) => Promise<unknown>
  teamMembers?: string[]
  onAddMember?: (name: string) => void
  onRemoveMember?: (name: string) => void
  availableTags?: Tag[]
  onAddTag?: (name: string, color: string) => void
  onRemoveTag?: (name: string) => void
  availableGroups?: Group[]
  onAddGroup?: (name: string, color: string) => void
  onRemoveGroup?: (name: string) => void
  projects?: Project[]
  onAddProject?: (name: string) => Promise<Project | null>
}

export function TaskDetailDialog({
  task,
  onClose,
  onUpdate,
  onComplete,
  teamMembers = [],
  onAddMember,
  onRemoveMember,
  availableTags = [],
  onAddTag,
  onRemoveTag,
  availableGroups = [],
  onAddGroup,
  onRemoveGroup,
  projects = [],
  onAddProject,
}: TaskDetailDialogProps) {
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
  // 新增步驟
  const [isAddingStep, setIsAddingStep] = useState(false)
  const [newStepText, setNewStepText] = useState('')
  // 編輯任務名稱
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editingTitle, setEditingTitle] = useState('')
  // 備註欄位
  const [isEditingNotes, setIsEditingNotes] = useState(false)
  const [editingNotes, setEditingNotes] = useState('')

  // 當 task 變化時更新本地狀態
  useEffect(() => {
    if (task) {
      setLocalTask(task)
      setShowMemberManager(false)
      setShowTagManager(false)
      setShowGroupManager(false)
      setEditingStepIndex(null)
      setIsAddingStep(false)
      setNewStepText('')
      setIsEditingNotes(false)
      setEditingNotes(task.notes || '')
      // 初始化步驟勾選狀態
      if (task.description) {
        const sections = parseDescription(task.description)
        setStepChecks(new Array(sections.steps.length).fill(false))
      }
    }
  }, [task])

  // 如果沒有 task，不渲染 Dialog
  if (!task) return null

  // 使用 task 作為渲染的資料來源（避免 localTask 延遲問題）
  const displayTask = localTask || task

  const sections = displayTask.description ? parseDescription(displayTask.description) : null
  const hasStructuredContent = sections && (sections.summary || sections.steps.length > 0 || sections.context || sections.quotes.length > 0)

  // 智慧推薦組別
  const suggestedGroup = !displayTask.groupName ? suggestGroupFromContent(displayTask.title, displayTask.description) : null

  // 更新處理函數
  const handleUpdate = async (updates: Partial<Task>) => {
    try {
      await onUpdate(displayTask.id, updates)
      setLocalTask(prev => prev ? { ...prev, ...updates } : null)
    } catch (err) {
      console.error('更新失敗:', err)
    }
  }

  return (
    <Dialog open={!!task} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-full max-w-5xl sm:max-w-5xl max-h-[90vh] overflow-hidden flex flex-col bg-white rounded-2xl shadow-2xl border-0 p-0" showCloseButton={false}>
        {/* Header - 標題區 */}
        <DialogHeader className="px-8 pt-6 pb-4 border-b bg-gradient-to-r from-gray-50 to-white shrink-0">
          {isEditingTitle ? (
            <>
              <DialogTitle className="sr-only">{displayTask.title}</DialogTitle>
              <div className="flex items-center gap-3">
                <span className="text-2xl">📌</span>
                <Input
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  className="text-xl font-bold h-auto py-1 px-2 flex-1"
                  autoFocus
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter' && editingTitle.trim()) {
                      e.preventDefault()
                      await handleUpdate({ title: editingTitle.trim() })
                      setIsEditingTitle(false)
                    } else if (e.key === 'Escape') {
                      e.preventDefault()
                      setIsEditingTitle(false)
                      setEditingTitle(displayTask.title)
                    }
                  }}
                  onBlur={async () => {
                    if (editingTitle.trim() && editingTitle.trim() !== displayTask.title) {
                      await handleUpdate({ title: editingTitle.trim() })
                    }
                    setIsEditingTitle(false)
                  }}
                />
              </div>
            </>
          ) : (
            <DialogTitle
              className="text-xl font-bold leading-relaxed text-gray-900 cursor-pointer hover:bg-gray-100 rounded px-2 py-1 -mx-2 -my-1 transition-colors flex items-center gap-3"
              onClick={() => {
                setEditingTitle(displayTask.title)
                setIsEditingTitle(true)
              }}
            >
              <span className="text-2xl">📌</span>
              {displayTask.title}
            </DialogTitle>
          )}
        </DialogHeader>

        {/* Body - 左右兩欄 */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* 左側：屬性表格 (Notion Style) */}
          <div className="w-72 border-r bg-gray-50/50 p-5 overflow-y-auto shrink-0">
            <div className="space-y-0.5">
              {/* 狀態 */}
              <div className="flex items-center h-9 hover:bg-gray-100 rounded-md px-2 -mx-2 cursor-pointer group">
                <span className="text-[13px] text-gray-500 w-[72px] shrink-0">狀態</span>
                <div className="flex-1 flex items-center">
                  <span className={`inline-flex items-center gap-1.5 text-[13px] ${
                    displayTask.status === 'completed' ? 'text-green-600' :
                    displayTask.status === 'in_progress' ? 'text-blue-600' :
                    'text-gray-600'
                  }`}>
                    <Clock className="h-4 w-4" />
                    {displayTask.status === 'completed' ? '已完成' : displayTask.status === 'in_progress' ? '進行中' : '待處理'}
                  </span>
                </div>
              </div>

              {/* 優先級 */}
              <div className="flex items-center h-9 hover:bg-gray-100 rounded-md px-2 -mx-2">
                <span className="text-[13px] text-gray-500 w-[72px] shrink-0">優先級</span>
                <div className="flex-1">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="flex items-center w-full group">
                        <span className="inline-flex items-center gap-1.5 text-[13px] text-gray-900">
                          <div className={`w-2.5 h-2.5 rounded-full ${
                            displayTask.priority === 'urgent' ? 'bg-red-500' :
                            displayTask.priority === 'high' ? 'bg-orange-500' :
                            displayTask.priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                          }`} />
                          {priorityConfig[displayTask.priority].label}
                        </span>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      {(Object.keys(priorityConfig) as Array<keyof typeof priorityConfig>).map((key) => (
                        <DropdownMenuItem
                          key={key}
                          onClick={() => handleUpdate({ priority: key })}
                          className={displayTask.priority === key ? 'bg-gray-100' : ''}
                        >
                          <span className={`w-2.5 h-2.5 rounded-full mr-2 ${
                            key === 'urgent' ? 'bg-red-500' :
                            key === 'high' ? 'bg-orange-400' :
                            key === 'medium' ? 'bg-yellow-400' : 'bg-green-400'
                          }`} />
                          {priorityConfig[key].label}
                          {displayTask.priority === key && <Check className="h-4 w-4 ml-auto" />}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* 負責人 */}
              <div className="flex items-center h-9 hover:bg-gray-100 rounded-md px-2 -mx-2">
                <span className="text-[13px] text-gray-500 w-[72px] shrink-0">負責人</span>
                <div className="flex-1">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="flex items-center w-full group">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                            <span className="text-[10px] text-white font-medium">
                              {(displayTask.assignee || '?')[0].toUpperCase()}
                            </span>
                          </div>
                          <span className="text-[13px] text-gray-900">{displayTask.assignee ? `@${displayTask.assignee}` : '未指定'}</span>
                        </div>
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
                                  onAddMember?.(newMemberName)
                                  setNewMemberName('')
                                }
                              }}
                            />
                            <Button size="sm" className="h-8 px-2" onClick={() => {
                              if (newMemberName.trim()) {
                                onAddMember?.(newMemberName)
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
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive" onClick={() => onRemoveMember?.(member)}>
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
                              className={displayTask.assignee === member ? 'bg-muted' : ''}
                            >
                              <User className="h-4 w-4 mr-2" />
                              {member}
                              {displayTask.assignee === member && <Check className="h-4 w-4 ml-auto" />}
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
                </div>
              </div>

              {/* 開始日期 */}
              <div className="flex items-center h-9 hover:bg-gray-100 rounded-md px-2 -mx-2">
                <span className="text-[13px] text-gray-500 w-[72px] shrink-0">開始日期</span>
                <div className="flex-1">
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="flex items-center w-full group">
                        <span className="flex items-center gap-1.5 text-[13px] text-gray-900">
                          <CalendarDays className="h-4 w-4 text-green-500" />
                          {displayTask.startDate
                            ? format(new Date(displayTask.startDate), 'yyyy/M/d', { locale: zhTW })
                            : '未設定'}
                        </span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={displayTask.startDate ? new Date(displayTask.startDate) : undefined}
                        onSelect={(date) => handleUpdate({ startDate: date })}
                        locale={zhTW}
                        defaultMonth={displayTask.startDate ? new Date(displayTask.startDate) : new Date()}
                      />
                      {displayTask.startDate && (
                        <div className="p-2 border-t">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full text-destructive hover:text-destructive"
                            onClick={() => handleUpdate({ startDate: undefined })}
                          >
                            清除日期
                          </Button>
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* 截止日期 */}
              <div className="flex items-center h-9 hover:bg-gray-100 rounded-md px-2 -mx-2">
                <span className="text-[13px] text-gray-500 w-[72px] shrink-0">截止日期</span>
                <div className="flex-1">
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="flex items-center w-full group">
                        <span className="flex items-center gap-1.5 text-[13px] text-gray-900">
                          <CalendarDays className="h-4 w-4 text-red-400" />
                          {displayTask.dueDate
                            ? format(new Date(displayTask.dueDate), 'yyyy/M/d', { locale: zhTW })
                            : '未設定'}
                        </span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={displayTask.dueDate ? new Date(displayTask.dueDate) : undefined}
                        onSelect={(date) => handleUpdate({ dueDate: date })}
                        locale={zhTW}
                        defaultMonth={displayTask.dueDate ? new Date(displayTask.dueDate) : new Date()}
                      />
                      {displayTask.dueDate && (
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
                </div>
              </div>

              {/* 專案 */}
              <div className="flex items-center h-9 hover:bg-gray-100 rounded-md px-2 -mx-2">
                <span className="text-[13px] text-gray-500 w-[72px] shrink-0">專案</span>
                <div className="flex-1">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="flex items-center w-full group">
                        <span className="flex items-center gap-1.5 text-[13px] text-gray-900">
                          <FolderKanban className="h-4 w-4 text-purple-500" />
                          {displayTask.projectId ? projects.find(p => p.id === displayTask.projectId)?.name || '未知專案' : '未設定'}
                        </span>
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
                                if (e.key === 'Enter' && newProjectName.trim() && onAddProject) {
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
                              disabled={!newProjectName.trim() || isAddingProject || !onAddProject}
                              onClick={async () => {
                                if (newProjectName.trim() && onAddProject) {
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
                              className={displayTask.projectId === project.id ? 'bg-muted' : ''}
                            >
                              <FolderKanban className="h-4 w-4 mr-2 text-violet-500" />
                              {project.name}
                              {displayTask.projectId === project.id && <Check className="h-4 w-4 ml-auto" />}
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
                </div>
              </div>

              {/* 重複 */}
              <div className="flex items-center h-9 hover:bg-gray-100 rounded-md px-2 -mx-2">
                <span className="text-[13px] text-gray-500 w-[72px] shrink-0">重複</span>
                <div className="flex-1">
                  <RecurrenceSelector
                    value={displayTask.recurrenceType}
                    config={displayTask.recurrenceConfig}
                    onChange={(type, config) => handleUpdate({ recurrenceType: type, recurrenceConfig: config })}
                  />
                </div>
              </div>

              {/* 分隔線 */}
              <div className="border-t my-4" />

              {/* 標籤 */}
              <div className="flex items-center min-h-[36px] hover:bg-gray-100 rounded-md px-2 -mx-2 py-1.5">
                <span className="text-[13px] text-gray-500 w-[72px] shrink-0">標籤</span>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(displayTask.tags || []).map((tagName) => {
                      const colors = getTagColor(tagName)
                      return (
                        <span
                          key={tagName}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${colors.bg} ${colors.text}`}
                        >
                          {tagName}
                          <button onClick={() => handleUpdate({ tags: (displayTask.tags || []).filter(t => t !== tagName) })} className="hover:opacity-70">
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      )
                    })}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="text-[13px] text-gray-400 hover:text-gray-600">
                          + 新增
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
                                  onAddTag?.(newTagName, newTagColor)
                                  setNewTagName('')
                                }
                              }}>
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {availableTags.filter(tag => !(displayTask.tags || []).includes(tag.name)).map((tag) => {
                              const colors = getTagColor(tag.name)
                              return (
                                <DropdownMenuItem
                                  key={tag.name}
                                  onClick={() => handleUpdate({ tags: [...(displayTask.tags || []), tag.name] })}
                                >
                                  <span className={`px-2 py-0.5 rounded text-xs ${colors.bg} ${colors.text}`}>{tag.name}</span>
                                </DropdownMenuItem>
                              )
                            })}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setShowTagManager(true) }} className="text-muted-foreground">
                              <Settings className="h-4 w-4 mr-2" />
                              管理標籤...
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>

              {/* 組別 */}
              <div className="flex items-center min-h-[36px] hover:bg-gray-100 rounded-md px-2 -mx-2 py-1.5">
                <span className="text-[13px] text-gray-500 w-[72px] shrink-0">組別</span>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {displayTask.groupName && (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${getGroupColor(displayTask.groupName).bg} ${getGroupColor(displayTask.groupName).text}`}>
                        {displayTask.groupName}
                        <button onClick={() => handleUpdate({ groupName: undefined })} className="hover:opacity-70">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="text-[13px] text-gray-400 hover:text-gray-600">
                          {displayTask.groupName ? '更換' : '+ 新增'}
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
                                  onAddGroup?.(newGroupName, newGroupColor)
                                  setNewGroupName('')
                                }
                              }}>
                                <Plus className="h-4 w-4" />
                              </Button>
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
                                  className={displayTask.groupName === group.name ? 'bg-muted' : ''}
                                >
                                  <span className={`px-2 py-0.5 rounded text-xs ${colors.bg} ${colors.text}`}>{group.name}</span>
                                  {displayTask.groupName === group.name && <Check className="h-4 w-4 ml-auto" />}
                                </DropdownMenuItem>
                              )
                            })}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setShowGroupManager(true) }} className="text-muted-foreground">
                              <Settings className="h-4 w-4 mr-2" />
                              管理組別...
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>

              {/* 分隔線 */}
              <div className="border-t my-4" />

              {/* 備注 - 選項 B：左側屬性區 */}
              <div className="flex items-start min-h-[36px] hover:bg-gray-100 rounded-md px-2 -mx-2 py-1.5">
                <span className="text-[13px] text-gray-500 w-[72px] shrink-0 pt-0.5">備注</span>
                <div className="flex-1">
                  {isEditingNotes ? (
                    <div className="space-y-2">
                      <textarea
                        value={editingNotes}
                        onChange={(e) => setEditingNotes(e.target.value)}
                        placeholder="輸入備注..."
                        className="w-full min-h-[60px] text-[13px] px-2.5 py-2 border border-amber-200 bg-amber-50 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-400 resize-y"
                        autoFocus
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setIsEditingNotes(false)
                            setEditingNotes(displayTask.notes || '')
                          }}
                          className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800"
                        >
                          取消
                        </button>
                        <button
                          onClick={async () => {
                            await handleUpdate({ notes: editingNotes.trim() || undefined })
                            setIsEditingNotes(false)
                          }}
                          className="px-2 py-1 text-xs bg-amber-500 text-white rounded hover:bg-amber-600"
                        >
                          儲存
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => {
                        setEditingNotes(displayTask.notes || '')
                        setIsEditingNotes(true)
                      }}
                      className={`text-[13px] cursor-pointer transition-colors ${
                        displayTask.notes
                          ? 'text-gray-900'
                          : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      {displayTask.notes || '點擊新增備注...'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 右側：內容區 */}
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="space-y-5 max-w-2xl">
              {hasStructuredContent ? (
                <>
                  {/* 任務摘要 */}
                  {sections.summary && (
                    <section>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                        <div className="w-1 h-4 bg-blue-500 rounded-full" />
                        任務摘要
                      </h3>
                      <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 rounded-lg p-4">
                        {sections.summary}
                      </p>
                    </section>
                  )}

                  {/* 執行細節 */}
                  {(sections.steps.length > 0 || isAddingStep) && (
                    <section>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                          <div className="w-1 h-4 bg-green-500 rounded-full" />
                          執行細節
                        </h3>
                        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                          {stepChecks.filter(Boolean).length}/{sections.steps.length} 完成
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {sections.steps.map((step, idx) => (
                          <div
                            key={idx}
                            className={`flex items-start gap-3 p-2.5 rounded-lg transition-colors hover:bg-gray-50 ${
                              stepChecks[idx] ? 'opacity-60' : ''
                            }`}
                          >
                            <button
                              onClick={() => {
                                const newChecks = [...stepChecks]
                                newChecks[idx] = !newChecks[idx]
                                setStepChecks(newChecks)
                              }}
                              className={`mt-0.5 h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                                stepChecks[idx]
                                  ? 'bg-green-500 border-green-500 text-white'
                                  : 'border-gray-300 hover:border-green-400'
                              }`}
                            >
                              {stepChecks[idx] && <Check className="h-3 w-3" />}
                            </button>
                            {editingStepIndex === idx ? (
                              <div className="flex-1 flex gap-2">
                                <input
                                  type="text"
                                  value={editingStepText}
                                  onChange={(e) => setEditingStepText(e.target.value)}
                                  className="flex-1 text-sm px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                                  autoFocus
                                  onKeyDown={async (e) => {
                                    if (e.key === 'Enter' && editingStepText.trim()) {
                                      const newSteps = [...sections.steps]
                                      newSteps[idx] = editingStepText.trim()
                                      const newDescription = buildDescription({ ...sections, steps: newSteps })
                                      await handleUpdate({ description: newDescription })
                                      setEditingStepIndex(null)
                                    } else if (e.key === 'Escape') {
                                      setEditingStepIndex(null)
                                    }
                                  }}
                                />
                                <button onClick={() => setEditingStepIndex(null)} className="text-xs text-gray-500">取消</button>
                              </div>
                            ) : (
                              <div className="flex-1 flex items-start gap-2 group">
                                <span className={`flex-1 text-sm ${stepChecks[idx] ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                                  <span className="text-gray-400 mr-1">{idx + 1}.</span>
                                  {step}
                                </span>
                                <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                                  <button onClick={() => { setEditingStepIndex(idx); setEditingStepText(step) }} className="p-1 text-gray-400 hover:text-gray-600">
                                    <Edit3 className="h-3 w-3" />
                                  </button>
                                  <button
                                    onClick={async () => {
                                      const newSteps = sections.steps.filter((_, i) => i !== idx)
                                      const newDescription = buildDescription({ ...sections, steps: newSteps })
                                      await handleUpdate({ description: newDescription })
                                      const newChecks = stepChecks.filter((_, i) => i !== idx)
                                      setStepChecks(newChecks)
                                    }}
                                    className="p-1 text-gray-400 hover:text-red-500"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                        {isAddingStep && (
                          <div className="flex items-start gap-3 p-2.5 bg-green-50/50 rounded-lg">
                            <div className="mt-0.5 h-5 w-5 rounded border-2 border-dashed border-green-300 shrink-0" />
                            <div className="flex-1 flex gap-2">
                              <input
                                type="text"
                                value={newStepText}
                                onChange={(e) => setNewStepText(e.target.value)}
                                placeholder="輸入新步驟..."
                                className="flex-1 text-sm px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                                autoFocus
                                onKeyDown={async (e) => {
                                  if (e.key === 'Enter' && newStepText.trim()) {
                                    const newSteps = [...sections.steps, newStepText.trim()]
                                    const newDescription = buildDescription({ ...sections, steps: newSteps })
                                    await handleUpdate({ description: newDescription })
                                    setStepChecks([...stepChecks, false])
                                    setNewStepText('')
                                    setIsAddingStep(false)
                                  } else if (e.key === 'Escape') {
                                    setIsAddingStep(false)
                                    setNewStepText('')
                                  }
                                }}
                              />
                              <button onClick={() => { setIsAddingStep(false); setNewStepText('') }} className="text-xs text-gray-500">取消</button>
                            </div>
                          </div>
                        )}
                        {!isAddingStep && (
                          <button
                            onClick={() => { setIsAddingStep(true); setNewStepText('') }}
                            className="w-full p-2 text-sm text-green-600 hover:bg-green-50 rounded-lg transition-colors flex items-center justify-center gap-1"
                          >
                            <Plus className="h-4 w-4" />
                            新增步驟
                          </button>
                        )}
                      </div>
                    </section>
                  )}

                  {/* 會議脈絡 */}
                  {sections.context && (
                    <section>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                        <div className="w-1 h-4 bg-purple-500 rounded-full" />
                        會議脈絡
                      </h3>
                      <div className="pl-4 border-l-2 border-purple-300 bg-purple-50/50 rounded-r-lg p-4">
                        <p className="text-sm text-gray-600 leading-relaxed">{sections.context}</p>
                      </div>
                    </section>
                  )}

                  {/* 原文引用 */}
                  {sections.quotes.length > 0 && (
                    <section>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                        <div className="w-1 h-4 bg-amber-500 rounded-full" />
                        原文引用
                      </h3>
                      <div className="pl-4 border-l-2 border-gray-300 bg-gray-50 rounded-r-lg p-4">
                        {sections.quotes.map((quote, i) => (
                          <p key={i} className="text-sm text-gray-500 italic leading-relaxed">{quote}</p>
                        ))}
                      </div>
                    </section>
                  )}
                </>
              ) : (
                <section>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <div className="w-1 h-4 bg-blue-500 rounded-full" />
                    任務內容
                  </h3>
                  <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 rounded-lg p-4">
                    {displayTask.description || '無詳細描述'}
                  </p>
                </section>
              )}
            </div>
          </div>
        </div>

        {/* Footer - 操作按鈕 */}
        <div className="flex items-center justify-end gap-3 px-8 py-4 border-t bg-gray-50 shrink-0">
          <Button variant="outline" className="px-6" onClick={onClose}>
            關閉
          </Button>
          <Button
            className={displayTask.status === 'completed' ? 'bg-gray-600 hover:bg-gray-700 px-6' : 'bg-green-600 hover:bg-green-700 px-6'}
            onClick={async () => {
              if (displayTask.status === 'completed') {
                await handleUpdate({ status: 'pending', completedAt: undefined })
              } else if (onComplete) {
                await onComplete(displayTask.id)
              } else {
                await handleUpdate({ status: 'completed', completedAt: new Date() })
              }
              onClose()
            }}
          >
            <Check className="h-4 w-4 mr-2" />
            {displayTask.status === 'completed' ? '標記為未完成' : '標記為完成'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

