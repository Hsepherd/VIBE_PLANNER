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
import { useSupabaseTasks, type Task } from '@/lib/useSupabaseTasks'
import { getTeamMembers, addTeamMember, removeTeamMember } from '@/lib/team-members'
import { getTags, addTag, removeTag, getTagColor, TAG_COLORS, type Tag } from '@/lib/tags'
import { getGroups, addGroup, removeGroup, getGroupColor, GROUP_COLORS, type Group } from '@/lib/groups'
import { format, isToday, isTomorrow, isThisWeek, isPast, addDays, startOfDay } from 'date-fns'
import { zhTW } from 'date-fns/locale'
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

export default function TasksPage() {
  const { tasks, isLoading, error, addTask, updateTask, deleteTask, completeTask, refresh } = useSupabaseTasks()

  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all')
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

  // 任務更新處理
  const handleUpdateTask = useCallback(async (id: string, updates: Partial<Task>) => {
    await updateTask(id, updates)
  }, [updateTask])

  // 批次選取功能
  const toggleTaskSelection = useCallback((taskId: string) => {
    setSelectedTaskIds(prev => {
      const next = new Set(prev)
      if (next.has(taskId)) {
        next.delete(taskId)
      } else {
        next.add(taskId)
      }
      return next
    })
  }, [])

  const selectAllTasks = useCallback(() => {
    setSelectedTaskIds(new Set(filteredTasks.map(t => t.id)))
  }, [filteredTasks])

  const deselectAllTasks = useCallback(() => {
    setSelectedTaskIds(new Set())
  }, [])

  const toggleSelectionMode = useCallback(() => {
    setIsSelectionMode(prev => !prev)
    if (isSelectionMode) {
      setSelectedTaskIds(new Set())
    }
  }, [isSelectionMode])

  // 批次刪除
  const handleBatchDelete = useCallback(async () => {
    if (selectedTaskIds.size === 0) return
    if (!confirm(`確定要刪除 ${selectedTaskIds.size} 個任務嗎？`)) return

    for (const taskId of selectedTaskIds) {
      await deleteTask(taskId)
    }
    setSelectedTaskIds(new Set())
    setIsSelectionMode(false)
  }, [selectedTaskIds, deleteTask])

  // 批次更新
  const handleBatchUpdate = useCallback(async (updates: Partial<Task>) => {
    if (selectedTaskIds.size === 0) return

    for (const taskId of selectedTaskIds) {
      await updateTask(taskId, updates)
    }
    setShowBatchEditDialog(false)
  }, [selectedTaskIds, updateTask])

  // 批次完成
  const handleBatchComplete = useCallback(async () => {
    if (selectedTaskIds.size === 0) return

    for (const taskId of selectedTaskIds) {
      await completeTask(taskId)
    }
    setSelectedTaskIds(new Set())
  }, [selectedTaskIds, completeTask])

  // 任務項目組件 - 卡片式設計，支援直接編輯
  const TaskItem = ({ task }: { task: Task }) => {
    const hasDescription = task.description && task.description.trim().length > 0
    const [datePickerOpen, setDatePickerOpen] = useState(false)
    const [assigneeOpen, setAssigneeOpen] = useState(false)
    const [groupOpen, setGroupOpen] = useState(false)
    const [tagOpen, setTagOpen] = useState(false)
    const [priorityOpen, setPriorityOpen] = useState(false)
    const isSelected = selectedTaskIds.has(task.id)

    return (
      <div
        className={`bg-white rounded-lg border transition-all hover:shadow-sm ${
          task.status === 'completed' ? 'opacity-60' : ''
        } ${isSelected ? 'ring-2 ring-primary ring-offset-1' : ''}`}
      >
        {/* 第一行：選取框/完成框 + 標題 + 詳情按鈕 + 刪除 */}
        <div className="flex items-center gap-3 px-4 pt-3 pb-2">
          {/* 選取模式：顯示選取框 */}
          {isSelectionMode ? (
            <button
              className="h-5 w-5 shrink-0 flex items-center justify-center"
              onClick={(e) => {
                e.stopPropagation()
                toggleTaskSelection(task.id)
              }}
            >
              {isSelected ? (
                <CheckSquare className="h-5 w-5 text-primary" />
              ) : (
                <Square className="h-5 w-5 text-muted-foreground hover:text-primary" />
              )}
            </button>
          ) : (
            /* 正常模式：顯示完成框 */
            <button
              className={`h-5 w-5 shrink-0 flex items-center justify-center rounded-full border-2 transition-colors ${
                task.status === 'completed'
                  ? 'bg-green-500 border-green-500 text-white'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onClick={async (e) => {
                e.stopPropagation()
                if (task.status === 'completed') {
                  await updateTask(task.id, { status: 'pending', completedAt: undefined })
                } else {
                  await completeTask(task.id)
                }
              }}
            >
              {task.status === 'completed' && (
                <Check className="h-3 w-3" />
              )}
            </button>
          )}

          {/* 標題 */}
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <span className={`text-sm font-medium truncate ${task.status === 'completed' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
              {task.title}
            </span>
            {hasDescription && (
              <button
                onClick={() => setSelectedTask(task)}
                className="shrink-0 text-muted-foreground hover:text-foreground"
                title="查看詳情"
              >
                <FileText className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* 刪除按鈕 */}
          <button
            className="p-1.5 rounded-md text-muted-foreground/50 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
            onClick={async (e) => {
              e.stopPropagation()
              await deleteTask(task.id)
            }}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        {/* 第二行：可編輯的欄位 */}
        <div className="flex items-center gap-2 px-4 pb-3 flex-wrap">
          {/* 日期選擇器 */}
          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <PopoverTrigger asChild>
              <button
                className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border transition-colors hover:bg-gray-50 ${
                  task.dueDate ? 'border-gray-200 text-foreground' : 'border-dashed border-gray-300 text-muted-foreground'
                }`}
              >
                <Calendar className="h-3 w-3" />
                {task.dueDate ? format(new Date(task.dueDate), 'M/d', { locale: zhTW }) : '日期'}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={task.dueDate ? new Date(task.dueDate) : undefined}
                onSelect={async (date) => {
                  await updateTask(task.id, { dueDate: date || undefined })
                  setDatePickerOpen(false)
                }}
                locale={zhTW}
              />
              {task.dueDate && (
                <div className="p-2 border-t">
                  <button
                    className="w-full text-xs text-muted-foreground hover:text-red-500"
                    onClick={async () => {
                      await updateTask(task.id, { dueDate: undefined })
                      setDatePickerOpen(false)
                    }}
                  >
                    清除日期
                  </button>
                </div>
              )}
            </PopoverContent>
          </Popover>

          {/* 負責人選擇器 */}
          <DropdownMenu open={assigneeOpen} onOpenChange={setAssigneeOpen}>
            <DropdownMenuTrigger asChild>
              <button
                className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border transition-colors hover:bg-gray-50 ${
                  task.assignee ? 'border-gray-200 text-foreground' : 'border-dashed border-gray-300 text-muted-foreground'
                }`}
              >
                <User className="h-3 w-3" />
                {task.assignee || '負責人'}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {teamMembers.map((member) => (
                <DropdownMenuItem
                  key={member}
                  onClick={async () => {
                    await updateTask(task.id, { assignee: member })
                  }}
                >
                  <User className="h-3 w-3 mr-2" />
                  {member}
                  {task.assignee === member && <Check className="h-3 w-3 ml-auto" />}
                </DropdownMenuItem>
              ))}
              {task.assignee && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-muted-foreground"
                    onClick={async () => {
                      await updateTask(task.id, { assignee: undefined })
                    }}
                  >
                    <X className="h-3 w-3 mr-2" />
                    清除負責人
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 組別選擇器 */}
          <DropdownMenu open={groupOpen} onOpenChange={setGroupOpen}>
            <DropdownMenuTrigger asChild>
              <button
                className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors hover:opacity-80 ${
                  task.groupName
                    ? `${getGroupColor(task.groupName).bg} ${getGroupColor(task.groupName).text}`
                    : 'border border-dashed border-gray-300 text-muted-foreground hover:bg-gray-50'
                }`}
              >
                <FolderOpen className="h-3 w-3" />
                {task.groupName || '組別'}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {availableGroups.map((group) => (
                <DropdownMenuItem
                  key={group.name}
                  onClick={async () => {
                    await updateTask(task.id, { groupName: group.name })
                  }}
                >
                  <span className={`w-2 h-2 rounded-full mr-2 ${getGroupColor(group.name).bg}`} />
                  {group.name}
                  {task.groupName === group.name && <Check className="h-3 w-3 ml-auto" />}
                </DropdownMenuItem>
              ))}
              {task.groupName && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-muted-foreground"
                    onClick={async () => {
                      await updateTask(task.id, { groupName: undefined })
                    }}
                  >
                    <X className="h-3 w-3 mr-2" />
                    清除組別
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 標籤選擇器 */}
          <DropdownMenu open={tagOpen} onOpenChange={setTagOpen}>
            <DropdownMenuTrigger asChild>
              <button
                className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors hover:opacity-80 ${
                  task.tags && task.tags.length > 0
                    ? `${getTagColor(task.tags[0]).bg} ${getTagColor(task.tags[0]).text}`
                    : 'border border-dashed border-gray-300 text-muted-foreground hover:bg-gray-50'
                }`}
              >
                <TagIcon className="h-3 w-3" />
                {task.tags && task.tags.length > 0 ? task.tags.join(', ') : '標籤'}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {availableTags.map((tag) => {
                const isSelected = (task.tags || []).includes(tag.name)
                return (
                  <DropdownMenuItem
                    key={tag.name}
                    onClick={async () => {
                      const currentTags = task.tags || []
                      const newTags = isSelected
                        ? currentTags.filter(t => t !== tag.name)
                        : [...currentTags, tag.name]
                      await updateTask(task.id, { tags: newTags })
                    }}
                  >
                    <span className={`w-2 h-2 rounded-full mr-2 ${getTagColor(tag.name).bg}`} />
                    {tag.name}
                    {isSelected && <Check className="h-3 w-3 ml-auto" />}
                  </DropdownMenuItem>
                )
              })}
              {task.tags && task.tags.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-muted-foreground"
                    onClick={async () => {
                      await updateTask(task.id, { tags: [] })
                    }}
                  >
                    <X className="h-3 w-3 mr-2" />
                    清除所有標籤
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 優先級選擇器 */}
          <DropdownMenu open={priorityOpen} onOpenChange={setPriorityOpen}>
            <DropdownMenuTrigger asChild>
              <button
                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-gray-200 transition-colors hover:bg-gray-50"
              >
                <div className={`w-2.5 h-2.5 rounded-full ${
                  task.priority === 'urgent' ? 'bg-red-500' :
                  task.priority === 'high' ? 'bg-orange-400' :
                  task.priority === 'medium' ? 'bg-yellow-400' : 'bg-green-400'
                }`} />
                {priorityConfig[task.priority].label}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {(Object.keys(priorityConfig) as Array<keyof typeof priorityConfig>).map((key) => (
                <DropdownMenuItem
                  key={key}
                  onClick={async () => {
                    await updateTask(task.id, { priority: key })
                  }}
                >
                  <span className="mr-2">{priorityConfig[key].emoji}</span>
                  {priorityConfig[key].label}
                  {task.priority === key && <Check className="h-3 w-3 ml-auto" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    )
  }

  // 渲染分組任務
  const renderGroupedTasks = (groups: Record<string, Task[]>, labels: Record<string, { emoji?: string; label: string; className?: string }>) => {
    // 排序 keys：overdue > today > tomorrow > date_xxx（按日期） > noDueDate
    const sortedKeys = Object.keys(groups).sort((a, b) => {
      const order: Record<string, number> = { overdue: 0, today: 1, tomorrow: 2, noDueDate: 999 }
      const aOrder = order[a] ?? (a.startsWith('date_') ? 3 : 998)
      const bOrder = order[b] ?? (b.startsWith('date_') ? 3 : 998)

      if (aOrder !== bOrder) return aOrder - bOrder
      // 如果都是 date_xxx，按日期排序
      if (a.startsWith('date_') && b.startsWith('date_')) {
        return a.localeCompare(b)
      }
      return 0
    })

    return sortedKeys.map(key => {
      const groupTasks = groups[key]
      if (!groupTasks || groupTasks.length === 0) return null
      const config = labels[key] || { label: key }
      return (
        <div key={key} className="space-y-2">
          <h2 className={`font-semibold flex items-center gap-2 ${config.className || ''}`}>
            {config.emoji} {config.label} ({groupTasks.length})
          </h2>
          <div className="space-y-2">
            {groupTasks.map((task: Task) => (
              <TaskItem key={task.id} task={task} />
            ))}
          </div>
        </div>
      )
    })
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

        {/* 批次操作工具列 */}
        {isSelectionMode && (
          <div className="flex items-center justify-between bg-gray-100 rounded-lg p-3">
            <div className="flex items-center gap-3">
              <button
                onClick={selectedTaskIds.size === filteredTasks.length ? deselectAllTasks : selectAllTasks}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {selectedTaskIds.size === filteredTasks.length ? (
                  <CheckSquare className="h-4 w-4" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
                {selectedTaskIds.size === filteredTasks.length ? '取消全選' : '全選'}
              </button>
              <span className="text-sm text-muted-foreground">
                已選取 {selectedTaskIds.size} / {filteredTasks.length} 個任務
              </span>
            </div>

            {selectedTaskIds.size > 0 && (
              <div className="flex items-center gap-2">
                {/* 批次編輯 */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-md hover:bg-white transition-colors">
                      <Edit3 className="h-4 w-4" />
                      批次編輯
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">設定優先級</div>
                    {(Object.keys(priorityConfig) as Array<keyof typeof priorityConfig>).map((key) => (
                      <DropdownMenuItem
                        key={key}
                        onClick={() => handleBatchUpdate({ priority: key })}
                      >
                        <span className="mr-2">{priorityConfig[key].emoji}</span>
                        {priorityConfig[key].label}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">設定負責人</div>
                    {teamMembers.map((member) => (
                      <DropdownMenuItem
                        key={member}
                        onClick={() => handleBatchUpdate({ assignee: member })}
                      >
                        <User className="h-3 w-3 mr-2" />
                        {member}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuItem
                      onClick={() => handleBatchUpdate({ assignee: undefined })}
                      className="text-muted-foreground"
                    >
                      <X className="h-3 w-3 mr-2" />
                      清除負責人
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">設定組別</div>
                    {availableGroups.map((group) => (
                      <DropdownMenuItem
                        key={group.name}
                        onClick={() => handleBatchUpdate({ groupName: group.name })}
                      >
                        <span className={`w-2 h-2 rounded-full mr-2 ${getGroupColor(group.name).bg}`} />
                        {group.name}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuItem
                      onClick={() => handleBatchUpdate({ groupName: undefined })}
                      className="text-muted-foreground"
                    >
                      <X className="h-3 w-3 mr-2" />
                      清除組別
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* 批次完成 */}
                <button
                  onClick={handleBatchComplete}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-md hover:bg-green-50 hover:border-green-300 hover:text-green-600 transition-colors"
                >
                  <Check className="h-4 w-4" />
                  標記完成
                </button>

                {/* 批次刪除 */}
                <button
                  onClick={handleBatchDelete}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-red-200 text-red-600 rounded-md hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                  刪除
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab 和工具列 - Acctual 風格 */}
        <div className="flex items-center justify-between border-b pb-3">
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
              }`}>{tasks.filter(t => t.status !== 'completed').length}</span>
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

        {/* 搜尋和新增任務區 - Acctual 風格 */}
        <div className="bg-white rounded-lg border p-4 space-y-3">
          {/* 搜尋框 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜尋任務（標題、內容、負責人、組別、日期...）"
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
          <div className="flex gap-3">
            <Input
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="輸入新任務..."
              onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
              className="flex-1 border-gray-200 focus:border-gray-400 focus:ring-gray-400"
            />
            <button
              onClick={handleAddTask}
              className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800 transition-colors"
            >
              <Plus className="h-4 w-4" />
              新增
            </button>
            {/* 批次選取按鈕 */}
            <button
              onClick={toggleSelectionMode}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                isSelectionMode
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {isSelectionMode ? (
                <>
                  <X className="h-4 w-4" />
                  取消選取
                </>
              ) : (
                <>
                  <CheckSquare className="h-4 w-4" />
                  批次選取
                </>
              )}
            </button>
          </div>
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
            <>
              <Separator />
              <div className="space-y-2">
                <Button variant="ghost" className="w-full justify-start" onClick={() => setShowCompleted(!showCompleted)}>
                  {showCompleted ? <ChevronDown className="h-4 w-4 mr-2" /> : <ChevronRight className="h-4 w-4 mr-2" />}
                  已完成 ({completedTasks.length})
                </Button>
                {showCompleted && (
                  <div className="space-y-2">
                    {completedTasks.map((task: Task) => (
                      <TaskItem key={task.id} task={task} />
                    ))}
                  </div>
                )}
              </div>
            </>
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
    </div>
  )
}
