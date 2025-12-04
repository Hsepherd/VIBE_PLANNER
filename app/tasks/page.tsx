'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
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
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
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
  GripVertical,
  Undo2,
} from 'lucide-react'

type SortMode = 'priority' | 'dueDate' | 'assignee' | 'tag' | 'group'

// 優先級設定
const priorityConfig = {
  urgent: { label: '緊急', emoji: '🔴', color: 'destructive' as const },
  high: { label: '高', emoji: '🟠', color: 'default' as const },
  medium: { label: '中', emoji: '🟡', color: 'secondary' as const },
  low: { label: '低', emoji: '🟢', color: 'outline' as const },
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
}) {
  // 本地狀態用於編輯
  const [localTask, setLocalTask] = useState<Task | null>(null)
  const [showMemberManager, setShowMemberManager] = useState(false)
  const [showTagManager, setShowTagManager] = useState(false)
  const [showGroupManager, setShowGroupManager] = useState(false)
  const [newMemberName, setNewMemberName] = useState('')
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('gray')
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupColor, setNewGroupColor] = useState('gray')
  // 執行細節的勾選狀態
  const [stepChecks, setStepChecks] = useState<boolean[]>([])
  // 編輯模式狀態
  const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null)
  const [editingStepText, setEditingStepText] = useState('')

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
            <DialogTitle className="text-xl font-bold leading-relaxed pr-8 text-gray-900">
              {localTask.title}
            </DialogTitle>
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

  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [filter, setFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed'>('all')
  const [showCompleted, setShowCompleted] = useState(false)
  const [sortMode, setSortMode] = useState<SortMode>('dueDate')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null)
  const [groupFilter, setGroupFilter] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

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
  // 舊版相容
  const canUndo = undoHistory.length > 0

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
  }, [tasks, filter, tagFilter, assigneeFilter, groupFilter, searchQuery])

  const completedTasks = useMemo(() => tasks.filter((t: Task) => t.status === 'completed'), [tasks])

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

  // 任務更新處理（支援復原）
  const handleUpdateTask = useCallback(async (id: string, updates: Partial<Task>, skipUndo = false) => {
    // 備份目前狀態（除非明確跳過）
    if (!skipUndo) {
      const task = tasks.find(t => t.id === id)
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
      }
    }
    await updateTask(id, updates)
  }, [updateTask, tasks])

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

    // 執行更新
    for (const taskId of selectedTaskIds) {
      await updateTask(taskId, updates)
    }
    setShowBatchEditDialog(false)
  }, [selectedTaskIds, updateTask, tasks])

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

    // 執行完成
    for (const taskId of selectedTaskIds) {
      await completeTask(taskId)
    }
    setSelectedTaskIds(new Set())
  }, [selectedTaskIds, completeTask, tasks])

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
  }, [undoHistory, updateTask])

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
  })

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

  // 拖曳結束處理 - 實際更新順序
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setTaskOrder(prev => {
        const oldIndex = prev.indexOf(active.id as string)
        const newIndex = prev.indexOf(over.id as string)
        return arrayMove(prev, oldIndex, newIndex)
      })
    }
  }, [])

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
    const [priorityOpen, setPriorityOpen] = useState(false)
    const [statusOpen, setStatusOpen] = useState(false)
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
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`text-sm truncate cursor-pointer hover:text-blue-600 ${
                task.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-800'
              }`}
              onClick={() => setSelectedTask(task)}
            >
              {task.title}
            </span>
            {/* 例行任務標籤 */}
            <RecurrenceBadge type={task.recurrenceType} config={task.recurrenceConfig} />
          </div>
        </div>

        {/* 負責人欄位 - 動態寬度（可新增/刪除成員）*/}
        <div className="h-12 flex items-center shrink-0" style={{ width: columnWidths.assignee }}>
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

        {/* 開始日欄位 - 動態寬度 */}
        <div className="h-12 flex items-center shrink-0" style={{ width: columnWidths.startDate }}>
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

        {/* 截止日欄位 - 動態寬度 */}
        <div className="h-12 flex items-center shrink-0" style={{ width: columnWidths.dueDate }}>
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

        {/* 優先級欄位 - 動態寬度 */}
        <div className="h-12 flex items-center shrink-0" style={{ width: columnWidths.priority }}>
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

  // 依照 taskOrder 排序任務
  const sortTasksByOrder = useCallback((tasksToSort: Task[]) => {
    return [...tasksToSort].sort((a, b) => {
      const aIndex = taskOrder.indexOf(a.id)
      const bIndex = taskOrder.indexOf(b.id)
      if (aIndex === -1 && bIndex === -1) return 0
      if (aIndex === -1) return 1
      if (bIndex === -1) return -1
      return aIndex - bIndex
    })
  }, [taskOrder])

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

  // ClickUp 風格的表格標題列（含可拖曳調整寬度）
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
      {/* 任務名稱 */}
      <div className="flex-1 min-w-0 h-10 flex items-center pr-4">
        <span className="text-gray-500">任務名稱</span>
      </div>
      {/* 負責人 - 可調整寬度 */}
      <div className="h-10 flex items-center px-3 shrink-0 relative" style={{ width: columnWidths.assignee }}>
        <ResizeHandle column="assignee" />
        <User className="h-4 w-4 shrink-0 text-gray-400 mr-2" />
        <span className="text-gray-500">負責人</span>
      </div>
      {/* 開始日期 - 可調整寬度 */}
      <div className="h-10 flex items-center px-3 shrink-0 relative" style={{ width: columnWidths.startDate }}>
        <ResizeHandle column="startDate" />
        <CalendarDays className="h-4 w-4 shrink-0 text-gray-400 mr-2" />
        <span className="text-gray-500">開始日</span>
      </div>
      {/* 截止日期 - 可調整寬度 */}
      <div className="h-10 flex items-center px-3 shrink-0 relative" style={{ width: columnWidths.dueDate }}>
        <ResizeHandle column="dueDate" />
        <Calendar className="h-4 w-4 shrink-0 text-gray-400 mr-2" />
        <span className="text-gray-500">截止日</span>
      </div>
      {/* 優先級 - 可調整寬度 */}
      <div className="h-10 flex items-center px-3 shrink-0 relative" style={{ width: columnWidths.priority }}>
        <ResizeHandle column="priority" />
        <span className="text-gray-500">優先級</span>
      </div>
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

          {/* 新增任務 */}
          <Input
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            placeholder="輸入新任務..."
            onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
            className="w-64 border-gray-200 focus:border-gray-400 focus:ring-gray-400"
          />
          <button
            onClick={handleAddTask}
            className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800 transition-colors shrink-0"
          >
            <Plus className="h-4 w-4" />
            新增
          </button>
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
            {/* 排序模式 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-md hover:bg-gray-50 transition-colors">
                  <ArrowUpDown className="h-3.5 w-3.5" />
                  {sortMode === 'priority' ? '優先級' : sortMode === 'dueDate' ? '截止日' : sortMode === 'assignee' ? '負責人' : sortMode === 'tag' ? '標籤' : '組別'}
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

      {/* 浮動復原按鈕（當沒有選取任務時顯示） */}
      {canUndo && selectedTaskIds.size === 0 && (
        <div className="fixed bottom-6 right-6 z-50">
          <button
            onClick={handleUndo}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 text-white hover:bg-amber-600 rounded-full shadow-lg transition-all hover:scale-105"
            title={undoHistory.length > 0 ? `復原: ${undoHistory[undoHistory.length - 1].description}` : '復原'}
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
