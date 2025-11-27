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
    const quoteLines = quotesText.split('\n').filter(line => {
      const trimmed = line.trim()
      return trimmed.startsWith('「') ||
             trimmed.startsWith('【') ||
             /^\d{1,2}:\d{2}/.test(trimmed) ||
             /^[A-Za-z\u4e00-\u9fff]+[:：]/.test(trimmed)
    })
    sections.quotes = quoteLines.map(line => {
      let trimmed = line.trim()
      const timeMatch = trimmed.match(/^(\d{1,2}:\d{2})\s+(.+)/)
      if (timeMatch) {
        trimmed = `【${timeMatch[1]}】${timeMatch[2]}`
      }
      return trimmed
    })
  }

  if (!sections.summary && !sections.steps.length && !sections.context && !sections.quotes.length) {
    sections.summary = description
  }

  return sections
}

// 任務詳情彈窗組件（獨立出來避免重新渲染）
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
  onComplete: (id: string) => Promise<void>
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

  // 當 task 變化時更新本地狀態
  useEffect(() => {
    setLocalTask(task)
    setShowMemberManager(false)
    setShowTagManager(false)
    setShowGroupManager(false)
  }, [task])

  if (!localTask) return null

  const sections = localTask.description ? parseDescription(localTask.description) : null
  const hasStructuredContent = sections && (sections.summary || sections.steps.length > 0 || sections.context || sections.quotes.length > 0)

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
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-white rounded-xl shadow-xl border-0">
        <DialogHeader className="pb-4 border-b border-gray-100">
          <div className="flex-1">
            <DialogTitle className="text-lg font-semibold leading-relaxed pr-8 text-gray-900">
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

        <div className="space-y-5 pt-4">
          {hasStructuredContent ? (
            <>
              {sections.summary && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium flex items-center gap-2 text-gray-900">
                    <Info className="h-4 w-4 text-gray-500" />
                    任務摘要
                  </h3>
                  <p className="text-sm text-gray-600 leading-relaxed pl-6">
                    {sections.summary}
                  </p>
                </div>
              )}

              {sections.steps.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium flex items-center gap-2 text-gray-900">
                    <ListChecks className="h-4 w-4 text-gray-500" />
                    執行細節
                  </h3>
                  <ol className="space-y-1.5 pl-6">
                    {sections.steps.map((step, i) => (
                      <li key={i} className="text-sm text-gray-600 flex gap-2">
                        <span className="font-medium text-gray-900 shrink-0">{i + 1}.</span>
                        <span className="leading-relaxed">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {sections.context && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium flex items-center gap-2 text-gray-900">
                    <FileText className="h-4 w-4 text-gray-500" />
                    會議脈絡
                  </h3>
                  <div className="text-sm text-gray-600 leading-relaxed pl-6 whitespace-pre-wrap">
                    {sections.context}
                  </div>
                </div>
              )}

              {sections.quotes.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium flex items-center gap-2 text-gray-900">
                    <MessageSquareQuote className="h-4 w-4 text-gray-500" />
                    原文引用
                  </h3>
                  <div className="space-y-2 pl-6">
                    {sections.quotes.map((quote, i) => {
                      const timestampMatch = quote.match(/^「?【(\d{1,2}:\d{2})】(.*)」?$/)
                      if (timestampMatch) {
                        const [, timestamp, content] = timestampMatch
                        return (
                          <div key={i} className="text-sm bg-gray-50 rounded-lg p-3 border-l-3 border-gray-300 flex gap-2">
                            <span className="shrink-0 font-mono text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded">
                              {timestamp}
                            </span>
                            <span className="text-gray-600">{content}</span>
                          </div>
                        )
                      }
                      return (
                        <div key={i} className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 border-l-3 border-gray-300">
                          {quote}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-2">
              <h3 className="text-sm font-medium flex items-center gap-2 text-gray-900">
                <FileText className="h-4 w-4 text-gray-500" />
                任務摘要
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap pl-6">
                {localTask.description}
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 mt-4">
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
                : 'text-white bg-gray-900 hover:bg-gray-800'
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

  // 按截止日期分組
  const today = startOfDay(new Date())
  const groupedByDueDate = useMemo(() => ({
    overdue: filteredTasks.filter((t: Task) => {
      if (!t.dueDate) return false
      const due = startOfDay(new Date(t.dueDate))
      return isPast(due) && !isToday(due)
    }),
    today: filteredTasks.filter((t: Task) => t.dueDate && isToday(new Date(t.dueDate))),
    tomorrow: filteredTasks.filter((t: Task) => t.dueDate && isTomorrow(new Date(t.dueDate))),
    thisWeek: filteredTasks.filter((t: Task) => {
      if (!t.dueDate) return false
      const due = new Date(t.dueDate)
      return !isToday(due) && !isTomorrow(due) && isThisWeek(due, { weekStartsOn: 1 }) && !isPast(startOfDay(due))
    }),
    later: filteredTasks.filter((t: Task) => t.dueDate && new Date(t.dueDate) > addDays(today, 7)),
    noDueDate: filteredTasks.filter((t: Task) => !t.dueDate),
  }), [filteredTasks, today])

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

  // 任務項目組件 - Acctual 風格
  const TaskItem = ({ task }: { task: Task }) => {
    const hasDescription = task.description && task.description.trim().length > 0

    return (
      <div
        className={`bg-white rounded-lg border transition-all cursor-pointer hover:shadow-sm ${
          task.status === 'completed' ? 'opacity-60' : ''
        }`}
        onClick={() => setSelectedTask(task)}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          {/* Checkbox */}
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

          {/* 任務內容 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`text-sm font-medium ${task.status === 'completed' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                {task.title}
              </span>
              {hasDescription && <FileText className="h-3.5 w-3.5 text-muted-foreground" />}
            </div>
            <div className="flex items-center gap-3 mt-1">
              {task.dueDate && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(task.dueDate), 'M/d', { locale: zhTW })}
                </span>
              )}
              {task.assignee && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {task.assignee}
                </span>
              )}
            </div>
          </div>

          {/* 標籤區域 */}
          <div className="flex items-center gap-1.5 shrink-0">
            {task.groupName && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${getGroupColor(task.groupName).bg} ${getGroupColor(task.groupName).text}`}>
                {task.groupName}
              </span>
            )}
            {(task.tags || []).slice(0, 1).map((tagName) => {
              const colors = getTagColor(tagName)
              return (
                <span
                  key={tagName}
                  className={`text-xs px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}
                >
                  {tagName}
                </span>
              )
            })}
          </div>

          {/* 優先級 */}
          <div className={`w-3 h-3 rounded-full shrink-0 ${
            task.priority === 'urgent' ? 'bg-red-500' :
            task.priority === 'high' ? 'bg-orange-400' :
            task.priority === 'medium' ? 'bg-yellow-400' : 'bg-green-400'
          }`} title={priorityConfig[task.priority].label} />

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
      </div>
    )
  }

  // 渲染分組任務
  const renderGroupedTasks = (groups: Record<string, Task[]>, labels: Record<string, { emoji?: string; label: string; className?: string }>) => {
    return Object.entries(groups).map(([key, groupTasks]) => {
      if (groupTasks.length === 0) return null
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
        <div className="flex items-center justify-between">
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
        </div>

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
          {sortMode === 'dueDate' && renderGroupedTasks(groupedByDueDate, {
            overdue: { emoji: '⚠️', label: '已過期', className: 'text-destructive' },
            today: { emoji: '📅', label: '今天', className: 'text-orange-600 dark:text-orange-400' },
            tomorrow: { emoji: '📆', label: '明天', className: 'text-yellow-600 dark:text-yellow-400' },
            thisWeek: { emoji: '🗓️', label: '本週' },
            later: { emoji: '📋', label: '稍後', className: 'text-muted-foreground' },
            noDueDate: { emoji: '📝', label: '無截止日', className: 'text-muted-foreground' },
          })}

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
