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
}

export function TaskDetailDialog({
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
            ) : (
              <DialogTitle
                className="text-xl font-bold leading-relaxed pr-8 text-gray-900 cursor-pointer hover:bg-gray-100 rounded px-2 py-1 -mx-2 -my-1 transition-colors"
                onClick={() => {
                  setEditingTitle(displayTask.title)
                  setIsEditingTitle(true)
                }}
              >
                {displayTask.title}
              </DialogTitle>
            )}
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {/* 優先級選擇 */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-gray-200 hover:bg-gray-50 transition-colors text-sm">
                    <span className={`w-2.5 h-2.5 rounded-full ${
                      displayTask.priority === 'urgent' ? 'bg-red-500' :
                      displayTask.priority === 'high' ? 'bg-orange-400' :
                      displayTask.priority === 'medium' ? 'bg-yellow-400' : 'bg-green-400'
                    }`} />
                    {priorityConfig[displayTask.priority].label}
                    <ChevronDown className="h-3 w-3 opacity-50" />
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

              {/* 負責人選擇 */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="text-sm text-gray-600 flex items-center gap-1.5 hover:text-gray-900 hover:bg-gray-50 px-2.5 py-1 rounded-md border border-gray-200 transition-colors">
                    <User className="h-3.5 w-3.5" />
                    {displayTask.assignee || '負責人'}
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

              {/* 截止日期選擇 */}
              <Popover>
                <PopoverTrigger asChild>
                  <button className="text-sm text-gray-600 flex items-center gap-1.5 hover:text-gray-900 hover:bg-gray-50 px-2.5 py-1 rounded-md border border-gray-200 transition-colors">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {displayTask.dueDate
                      ? format(new Date(displayTask.dueDate), 'yyyy/M/d', { locale: zhTW })
                      : '截止日'}
                    <ChevronDown className="h-3 w-3 opacity-50" />
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

              {/* 時間編輯 - 開始與結束時間 */}
              <Popover>
                <PopoverTrigger asChild>
                  <button className="text-sm text-gray-600 flex items-center gap-1.5 hover:text-gray-900 hover:bg-gray-50 px-2.5 py-1 rounded-md border border-gray-200 transition-colors">
                    <Clock className="h-3.5 w-3.5" />
                    {displayTask.startDate && displayTask.dueDate ? (
                      <>
                        {format(new Date(displayTask.startDate), 'HH:mm')} - {format(new Date(displayTask.dueDate), 'HH:mm')}
                      </>
                    ) : displayTask.startDate ? (
                      <>開始 {format(new Date(displayTask.startDate), 'HH:mm')}</>
                    ) : displayTask.dueDate && (new Date(displayTask.dueDate).getHours() !== 0 || new Date(displayTask.dueDate).getMinutes() !== 0) ? (
                      <>結束 {format(new Date(displayTask.dueDate), 'HH:mm')}</>
                    ) : (
                      '設定時間'
                    )}
                    <ChevronDown className="h-3 w-3 opacity-50" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-4" align="start">
                  <div className="space-y-4">
                    <h4 className="font-medium text-sm text-gray-900">時間設定</h4>

                    {/* 開始時間 */}
                    <div className="flex items-center gap-3">
                      <label className="text-sm text-gray-600 w-12">開始</label>
                      <input
                        type="time"
                        value={displayTask.startDate ? format(new Date(displayTask.startDate), 'HH:mm') : ''}
                        onChange={(e) => {
                          if (e.target.value) {
                            const [hours, minutes] = e.target.value.split(':').map(Number)
                            const baseDate = displayTask.startDate ? new Date(displayTask.startDate) : (displayTask.dueDate ? new Date(displayTask.dueDate) : new Date())
                            const newDate = setMinutes(setHours(baseDate, hours), minutes)
                            handleUpdate({ startDate: newDate })
                          }
                        }}
                        className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                      {displayTask.startDate && (
                        <button
                          onClick={() => handleUpdate({ startDate: undefined })}
                          className="p-1 text-gray-400 hover:text-gray-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    {/* 結束時間 */}
                    <div className="flex items-center gap-3">
                      <label className="text-sm text-gray-600 w-12">結束</label>
                      <input
                        type="time"
                        value={displayTask.dueDate ? format(new Date(displayTask.dueDate), 'HH:mm') : ''}
                        onChange={(e) => {
                          if (e.target.value) {
                            const [hours, minutes] = e.target.value.split(':').map(Number)
                            const baseDate = displayTask.dueDate ? new Date(displayTask.dueDate) : (displayTask.startDate ? new Date(displayTask.startDate) : new Date())
                            const newDate = setMinutes(setHours(baseDate, hours), minutes)
                            handleUpdate({ dueDate: newDate })
                          }
                        }}
                        className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                      {displayTask.dueDate && (
                        <button
                          onClick={() => handleUpdate({ dueDate: undefined })}
                          className="p-1 text-gray-400 hover:text-gray-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    {/* 快速時長選擇 */}
                    <div className="pt-2 border-t border-gray-100">
                      <label className="text-xs text-gray-500 mb-2 block">快速設定時長</label>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { label: '15分', mins: 15 },
                          { label: '30分', mins: 30 },
                          { label: '1小時', mins: 60 },
                          { label: '1.5小時', mins: 90 },
                          { label: '2小時', mins: 120 },
                        ].map(({ label, mins }) => (
                          <button
                            key={mins}
                            onClick={() => {
                              const start = displayTask.startDate ? new Date(displayTask.startDate) : new Date()
                              const end = addMinutes(start, mins)
                              handleUpdate({
                                startDate: displayTask.startDate || start,
                                dueDate: end
                              })
                            }}
                            className="px-2.5 py-1 text-xs font-medium border border-gray-200 rounded-md hover:bg-gray-50 hover:border-gray-300 transition-colors"
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 清除所有時間 */}
                    {(displayTask.startDate || displayTask.dueDate) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-destructive hover:text-destructive mt-2"
                        onClick={() => handleUpdate({ startDate: undefined, dueDate: undefined })}
                      >
                        清除所有時間
                      </Button>
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              {/* 重複設定 */}
              <RecurrenceSelector
                value={displayTask.recurrenceType}
                config={displayTask.recurrenceConfig}
                onChange={(type, config) => handleUpdate({ recurrenceType: type, recurrenceConfig: config })}
              />

              {/* 專案 */}
              {displayTask.project && (
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <FolderOpen className="h-4 w-4" />
                  {displayTask.project}
                </span>
              )}
            </div>

            {/* 標籤和組別區域 - 同一列 */}
            <div className="flex items-center gap-1.5 mt-3 flex-wrap">
              {/* 智慧推薦組別提示 */}
              {suggestedGroup && !displayTask.groupName && (
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
              {displayTask.groupName && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getGroupColor(displayTask.groupName).bg} ${getGroupColor(displayTask.groupName).text}`}>
                  <Users className="h-3 w-3" />
                  {displayTask.groupName}
                  <button
                    onClick={() => handleUpdate({ groupName: undefined })}
                    className="hover:opacity-70"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}

              {/* 專案 */}
              {displayTask.projectId && (() => {
                const project = projects.find(p => p.id === displayTask.projectId)
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
              {(displayTask.tags || []).map((tagName) => {
                const colors = getTagColor(tagName)
                return (
                  <span
                    key={tagName}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}
                  >
                    {tagName}
                    <button
                      onClick={() => handleUpdate({ tags: (displayTask.tags || []).filter(t => t !== tagName) })}
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
                    {displayTask.groupName ? '更換組別' : '組別'}
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
                            className={displayTask.groupName === group.name ? 'bg-muted' : ''}
                          >
                            <span className={`px-2 py-0.5 rounded text-xs ${colors.bg} ${colors.text}`}>{group.name}</span>
                            {displayTask.groupName === group.name && <Check className="h-4 w-4 ml-auto" />}
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
                    {displayTask.projectId ? '更換專案' : '專案'}
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
                      {availableTags.filter(tag => !(displayTask.tags || []).includes(tag.name)).length === 0 && (
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

              {/* 執行細節 - Checklist 形式 (支援 CRUD) */}
              {(sections.steps.length > 0 || isAddingStep) && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold flex items-center gap-2 text-gray-900">
                      <div className="w-1 h-5 bg-green-500 rounded-full" />
                      執行細節
                      <span className="text-xs font-normal text-gray-500 ml-2">
                        {stepChecks.filter(Boolean).length}/{sections.steps.length} 完成
                      </span>
                    </h3>
                    {/* 新增步驟按鈕 */}
                    <button
                      onClick={() => {
                        setIsAddingStep(true)
                        setNewStepText('')
                      }}
                      className="text-sm text-green-600 hover:text-green-700 flex items-center gap-1 transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                      新增步驟
                    </button>
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
                                onKeyDown={async (e) => {
                                  if (e.key === 'Enter' && editingStepText.trim()) {
                                    // 儲存編輯到 description
                                    const newSteps = [...sections.steps]
                                    newSteps[i] = editingStepText.trim()
                                    const newDescription = buildDescription({
                                      ...sections,
                                      steps: newSteps
                                    })
                                    await handleUpdate({ description: newDescription })
                                    setEditingStepIndex(null)
                                  } else if (e.key === 'Escape') {
                                    setEditingStepIndex(null)
                                  }
                                }}
                              />
                              <button
                                onClick={async () => {
                                  if (editingStepText.trim()) {
                                    const newSteps = [...sections.steps]
                                    newSteps[i] = editingStepText.trim()
                                    const newDescription = buildDescription({
                                      ...sections,
                                      steps: newSteps
                                    })
                                    await handleUpdate({ description: newDescription })
                                  }
                                  setEditingStepIndex(null)
                                }}
                                className="text-xs px-2 py-1 text-green-600 hover:text-green-700"
                              >
                                儲存
                              </button>
                              <button
                                onClick={() => setEditingStepIndex(null)}
                                className="text-xs px-2 py-1 text-gray-500 hover:text-gray-700"
                              >
                                取消
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
                              <div className="opacity-0 group-hover:opacity-100 ml-auto shrink-0 flex items-center gap-1 transition-opacity">
                                <button
                                  onClick={() => {
                                    setEditingStepIndex(i)
                                    setEditingStepText(step)
                                  }}
                                  className="p-1 text-gray-400 hover:text-gray-600"
                                  title="編輯"
                                >
                                  <Edit3 className="h-3 w-3" />
                                </button>
                                <button
                                  onClick={async () => {
                                    // 刪除步驟
                                    const newSteps = sections.steps.filter((_, idx) => idx !== i)
                                    const newDescription = buildDescription({
                                      ...sections,
                                      steps: newSteps
                                    })
                                    await handleUpdate({ description: newDescription })
                                    // 更新勾選狀態
                                    const newChecks = stepChecks.filter((_, idx) => idx !== i)
                                    setStepChecks(newChecks)
                                  }}
                                  className="p-1 text-gray-400 hover:text-red-500"
                                  title="刪除"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {/* 新增步驟輸入框 */}
                    {isAddingStep && (
                      <div className="flex items-start gap-3 p-3 bg-green-50/50">
                        <div className="mt-0.5 h-5 w-5 rounded border-2 border-dashed border-green-300 shrink-0" />
                        <div className="flex-1">
                          <div className="flex gap-2">
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
                                  const newDescription = buildDescription({
                                    ...sections,
                                    steps: newSteps
                                  })
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
                            <button
                              onClick={async () => {
                                if (newStepText.trim()) {
                                  const newSteps = [...sections.steps, newStepText.trim()]
                                  const newDescription = buildDescription({
                                    ...sections,
                                    steps: newSteps
                                  })
                                  await handleUpdate({ description: newDescription })
                                  setStepChecks([...stepChecks, false])
                                  setNewStepText('')
                                  setIsAddingStep(false)
                                }
                              }}
                              className="text-xs px-2 py-1 text-green-600 hover:text-green-700"
                            >
                              新增
                            </button>
                            <button
                              onClick={() => {
                                setIsAddingStep(false)
                                setNewStepText('')
                              }}
                              className="text-xs px-2 py-1 text-gray-500 hover:text-gray-700"
                            >
                              取消
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {/* 無執行細節時顯示新增按鈕 */}
              {sections.steps.length === 0 && !isAddingStep && (
                <div className="space-y-3">
                  <h3 className="text-base font-semibold flex items-center gap-2 text-gray-900">
                    <div className="w-1 h-5 bg-green-500 rounded-full" />
                    執行細節
                  </h3>
                  <button
                    onClick={() => {
                      setIsAddingStep(true)
                      setNewStepText('')
                    }}
                    className="w-full p-3 border-2 border-dashed border-gray-200 rounded-lg text-gray-500 hover:border-green-300 hover:text-green-600 transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    新增執行步驟
                  </button>
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
                  {displayTask.description || '無詳細描述'}
                </p>
              </div>
            </div>
          )}

          {/* 備註欄位 - 始終顯示 */}
          <div className="space-y-3">
            <h3 className="text-base font-semibold flex items-center gap-2 text-gray-900">
              <div className="w-1 h-5 bg-gray-500 rounded-full" />
              備註
            </h3>
            {isEditingNotes ? (
              <div className="space-y-2">
                <textarea
                  value={editingNotes}
                  onChange={(e) => setEditingNotes(e.target.value)}
                  placeholder="輸入備註..."
                  className="w-full min-h-[100px] text-sm px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 resize-y"
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setIsEditingNotes(false)
                      setEditingNotes(displayTask.notes || '')
                    }}
                    className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={async () => {
                      await handleUpdate({ notes: editingNotes.trim() || undefined })
                      setIsEditingNotes(false)
                    }}
                    className="px-3 py-1.5 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
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
                className="bg-gray-50 rounded-lg p-4 border border-gray-100 cursor-pointer hover:bg-gray-100 transition-colors min-h-[60px]"
              >
                {displayTask.notes ? (
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {displayTask.notes}
                  </p>
                ) : (
                  <p className="text-sm text-gray-400 italic">
                    點擊新增備註...
                  </p>
                )}
              </div>
            )}
          </div>
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
              if (displayTask.status === 'completed') {
                await handleUpdate({ status: 'pending', completedAt: undefined })
              } else {
                await onComplete(displayTask.id)
              }
              onClose()
            }}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
              displayTask.status === 'completed'
                ? 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                : 'text-white bg-green-600 hover:bg-green-700'
            }`}
          >
            <Check className="h-4 w-4" />
            {displayTask.status === 'completed' ? '標記為未完成' : '標記為完成'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
