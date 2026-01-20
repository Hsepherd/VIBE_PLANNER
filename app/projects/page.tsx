'use client'

import { useState, useRef, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { useSupabaseProjects, type Project } from '@/lib/useSupabaseProjects'
import { useSupabaseTasks, type Task } from '@/lib/useSupabaseTasks'
import { TaskDetailDialog } from '@/components/task/TaskDetailDialog'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import {
  Plus,
  Trash2,
  FolderKanban,
  Edit2,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Calendar,
  Flag,
  Circle,
  CheckCircle2,
  Clock,
  XCircle,
  GripVertical,
} from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// 優先級配置
const priorityConfig = {
  low: { label: '低', color: 'bg-gray-100 text-gray-600', icon: Flag },
  medium: { label: '中', color: 'bg-blue-100 text-blue-600', icon: Flag },
  high: { label: '高', color: 'bg-orange-100 text-orange-600', icon: Flag },
  urgent: { label: '緊急', color: 'bg-red-100 text-red-600', icon: Flag },
}

// 狀態配置
const statusConfig: Record<string, { label: string; color: string; icon: typeof Circle }> = {
  pending: { label: '待處理', color: 'text-gray-500', icon: Circle },
  in_progress: { label: '進行中', color: 'text-blue-500', icon: Clock },
  completed: { label: '已完成', color: 'text-green-500', icon: CheckCircle2 },
  cancelled: { label: '已取消', color: 'text-gray-400', icon: XCircle },
  on_hold: { label: '暫停', color: 'text-yellow-500', icon: Clock },
}

// 專案狀態配置
const projectStatusConfig = {
  active: { label: '進行中', color: 'default' as const },
  completed: { label: '已完成', color: 'secondary' as const },
  archived: { label: '已封存', color: 'outline' as const },
}

// 可拖曳的專案項目
function SortableProjectItem({
  project,
  children,
  isExpanded,
}: {
  project: Project
  children: React.ReactNode
  isExpanded: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: project.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 'auto',
  }

  return (
    <div ref={setNodeRef} style={style as React.CSSProperties}>
      <Card className={`overflow-hidden ${isDragging ? 'shadow-lg' : ''}`}>
        <div className="flex items-center">
          {/* 拖曳把手 */}
          <div
            {...attributes}
            {...listeners}
            className="px-2 py-4 cursor-grab active:cursor-grabbing hover:bg-gray-100 transition-colors"
          >
            <GripVertical className="h-5 w-5 text-gray-400" />
          </div>
          {/* 專案內容 */}
          <div className="flex-1">{children}</div>
        </div>
      </Card>
    </div>
  )
}

export default function ProjectsPage() {
  const {
    projects: rawProjects,
    loading,
    error,
    addProject,
    updateProject,
    deleteProject,
    refresh,
  } = useSupabaseProjects()

  const { tasks, updateTask, refresh: refreshTasks } = useSupabaseTasks()

  const [newProjectName, setNewProjectName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set())
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 專案排序（從 localStorage 載入）
  const [projectOrder, setProjectOrder] = useState<string[]>([])

  // 初始化專案順序
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('project-order')
      if (saved) {
        try {
          setProjectOrder(JSON.parse(saved))
        } catch {
          // ignore
        }
      }
    }
  }, [])

  // 當專案列表變化時，更新排序（確保新專案有順序）
  useEffect(() => {
    if (rawProjects.length > 0) {
      setProjectOrder(prev => {
        const existingIds = new Set(prev)
        const newIds = rawProjects
          .filter(p => !existingIds.has(p.id))
          .map(p => p.id)
        if (newIds.length > 0) {
          const updated = [...newIds, ...prev]
          localStorage.setItem('project-order', JSON.stringify(updated))
          return updated
        }
        // 清理已刪除的專案
        const validIds = new Set(rawProjects.map(p => p.id))
        const cleaned = prev.filter(id => validIds.has(id))
        if (cleaned.length !== prev.length) {
          localStorage.setItem('project-order', JSON.stringify(cleaned))
          return cleaned
        }
        return prev
      })
    }
  }, [rawProjects])

  // 根據排序順序排列專案
  const projects = [...rawProjects].sort((a, b) => {
    const aIndex = projectOrder.indexOf(a.id)
    const bIndex = projectOrder.indexOf(b.id)
    if (aIndex === -1 && bIndex === -1) return 0
    if (aIndex === -1) return 1
    if (bIndex === -1) return -1
    return aIndex - bIndex
  })

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setProjectOrder((items) => {
        const oldIndex = items.indexOf(active.id as string)
        const newIndex = items.indexOf(over.id as string)
        const newOrder = arrayMove(items, oldIndex, newIndex)
        localStorage.setItem('project-order', JSON.stringify(newOrder))
        return newOrder
      })
    }
  }

  // 切換專案展開/收合
  const toggleExpand = (projectId: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev)
      if (next.has(projectId)) {
        next.delete(projectId)
      } else {
        next.add(projectId)
      }
      return next
    })
  }

  // 展開全部
  const expandAll = () => {
    setExpandedProjects(new Set(projects.map(p => p.id)))
  }

  // 收合全部
  const collapseAll = () => {
    setExpandedProjects(new Set())
  }

  const handleAddProject = async () => {
    if (!newProjectName.trim()) return
    try {
      setIsAdding(true)
      await addProject({
        name: newProjectName.trim(),
        status: 'active',
        progress: 0,
      })
      setNewProjectName('')
    } catch (err) {
      console.error('新增專案失敗:', err)
    } finally {
      setIsAdding(false)
    }
  }

  const handleStartEdit = (id: string, name: string) => {
    setEditingId(id)
    setEditingName(name)
  }

  const handleSaveEdit = async (id: string) => {
    if (editingName.trim()) {
      try {
        await updateProject(id, { name: editingName.trim() })
      } catch (err) {
        console.error('更新專案失敗:', err)
      }
    }
    setEditingId(null)
    setEditingName('')
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditingName('')
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteProject(id)
    } catch (err) {
      console.error('刪除專案失敗:', err)
    }
  }

  // 快速完成/取消完成任務
  const handleToggleComplete = async (task: Task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed'
    try {
      await updateTask(task.id, {
        status: newStatus,
        completedAt: newStatus === 'completed' ? new Date() : undefined,
      })
      refreshTasks()
    } catch (err) {
      console.error('更新任務狀態失敗:', err)
    }
  }

  // 計算專案的任務統計
  const getProjectStats = (projectId: string) => {
    const projectTasks = tasks.filter((t: Task) => t.projectId === projectId)
    const completed = projectTasks.filter((t: Task) => t.status === 'completed').length
    const inProgress = projectTasks.filter((t: Task) => t.status === 'in_progress').length
    const pending = projectTasks.filter((t: Task) => t.status === 'pending').length
    const total = projectTasks.length
    return {
      completed,
      inProgress,
      pending,
      total,
      progress: total > 0 ? Math.round((completed / total) * 100) : 0,
    }
  }

  // 取得專案的任務列表
  const getProjectTasks = (projectId: string) => {
    return tasks
      .filter((t: Task) => t.projectId === projectId)
      .sort((a, b) => {
        // 排序：未完成優先，再按優先級
        const statusOrder: Record<string, number> = { pending: 0, in_progress: 1, on_hold: 2, completed: 3, cancelled: 4 }
        const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 }
        const statusDiff = (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99)
        if (statusDiff !== 0) return statusDiff
        return (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99)
      })
  }

  // 處理任務更新（從 TaskDetailDialog）
  const handleTaskUpdate = async (taskId: string, updates: Partial<Task>) => {
    try {
      await updateTask(taskId, updates)
      refreshTasks()
    } catch (err) {
      console.error('更新任務失敗:', err)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        {/* 標題列 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">📁 專案管理</h1>
            <button
              onClick={() => { refresh(); refreshTasks() }}
              disabled={loading}
              className="p-1.5 rounded-md hover:bg-gray-100 text-muted-foreground hover:text-foreground transition-colors"
              title="重新整理"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={expandAll}>
              全部展開
            </Button>
            <Button variant="ghost" size="sm" onClick={collapseAll}>
              全部收合
            </Button>
          </div>
        </div>

        {error && (
          <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
            {error}
            <Button variant="link" className="ml-2" onClick={refresh}>重試</Button>
          </div>
        )}

        {/* 新增專案 */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex gap-2">
              <Input
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="輸入新專案名稱..."
                onKeyDown={(e) => e.key === 'Enter' && handleAddProject()}
                disabled={isAdding}
              />
              <Button onClick={handleAddProject} disabled={isAdding || !newProjectName.trim()}>
                {isAdding ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-1" />
                )}
                新增
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 載入中 */}
        {loading && projects.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p>正在載入專案...</p>
          </div>
        )}

        {/* 空狀態 */}
        {!loading && projects.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FolderKanban className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>尚未建立任何專案</p>
            <p className="text-sm mt-2">
              專案可以幫助你分類和追蹤相關的任務
            </p>
          </div>
        ) : (
          /* 專案清單（可拖曳排序） */
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={projects.map(p => p.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-4">
                {projects.map((project: Project) => {
                  const stats = getProjectStats(project.id)
                  const projectTasks = getProjectTasks(project.id)
                  const isExpanded = expandedProjects.has(project.id)
                  const isEditing = editingId === project.id

                  return (
                    <SortableProjectItem
                      key={project.id}
                      project={project}
                      isExpanded={isExpanded}
                    >
                      {/* 專案標題列 */}
                      <div
                        className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => !isEditing && toggleExpand(project.id)}
                      >
                        <div className="flex items-center gap-3">
                          {/* 展開/收合箭頭 */}
                          <button
                            className="p-1 hover:bg-gray-200 rounded transition-colors"
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleExpand(project.id)
                            }}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-5 w-5 text-gray-500" />
                            ) : (
                              <ChevronRight className="h-5 w-5 text-gray-500" />
                            )}
                          </button>

                          {/* 專案名稱 */}
                          <div className="flex-1 min-w-0">
                            {isEditing ? (
                              <textarea
                                ref={textareaRef}
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                className="w-full min-h-[32px] max-h-[120px] px-3 py-1.5 text-lg font-semibold rounded-md border border-input bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                                autoFocus
                                rows={1}
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                    e.preventDefault()
                                    handleSaveEdit(project.id)
                                  }
                                  if (e.key === 'Escape') handleCancelEdit()
                                }}
                                onBlur={() => {
                                  if (editingName.trim() && editingName.trim() !== project.name) {
                                    handleSaveEdit(project.id)
                                  } else {
                                    handleCancelEdit()
                                  }
                                }}
                              />
                            ) : (
                              <div className="flex items-center gap-2">
                                <h3 className="text-lg font-semibold truncate">{project.name}</h3>
                                <Badge variant={projectStatusConfig[project.status].color} className="shrink-0">
                                  {projectStatusConfig[project.status].label}
                                </Badge>
                              </div>
                            )}

                            {/* 任務統計摘要 */}
                            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                                {stats.completed} 完成
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5 text-blue-500" />
                                {stats.inProgress} 進行中
                              </span>
                              <span className="flex items-center gap-1">
                                <Circle className="h-3.5 w-3.5 text-gray-400" />
                                {stats.pending} 待處理
                              </span>
                              <span className="text-xs">
                                共 {stats.total} 個任務
                              </span>
                            </div>
                          </div>

                          {/* 進度指示 */}
                          <div className="flex items-center gap-3 shrink-0">
                            <div className="w-24">
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-muted-foreground">進度</span>
                                <span className="font-medium">{stats.progress}%</span>
                              </div>
                              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                                <div
                                  className="h-full bg-green-500 transition-all"
                                  style={{ width: `${stats.progress}%` }}
                                />
                              </div>
                            </div>

                            {/* 操作選單 */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={(e) => {
                                  e.stopPropagation()
                                  handleStartEdit(project.id, project.name)
                                }}>
                                  <Edit2 className="h-4 w-4 mr-2" />
                                  編輯名稱
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleDelete(project.id)
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  刪除專案
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </div>

                      {/* 展開的任務列表 */}
                      {isExpanded && (
                        <div className="border-t bg-gray-50/50">
                          {projectTasks.length === 0 ? (
                            <div className="p-6 text-center text-muted-foreground">
                              <p>此專案尚無任務</p>
                              <p className="text-sm mt-1">在對話中萃取任務時可以指定此專案</p>
                            </div>
                          ) : (
                            <div className="divide-y">
                              {projectTasks.map((task) => {
                                const StatusIcon = statusConfig[task.status].icon

                                return (
                                  <div
                                    key={task.id}
                                    className={`p-4 hover:bg-white transition-colors cursor-pointer ${
                                      task.status === 'completed' ? 'opacity-60' : ''
                                    }`}
                                    onClick={() => setSelectedTask(task)}
                                  >
                                    <div className="flex items-start gap-3">
                                      {/* 完成勾選 */}
                                      <Checkbox
                                        checked={task.status === 'completed'}
                                        onCheckedChange={() => handleToggleComplete(task)}
                                        onClick={(e) => e.stopPropagation()}
                                        className="mt-0.5"
                                      />

                                      {/* 任務內容 */}
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          <span className={`font-medium ${
                                            task.status === 'completed' ? 'line-through text-muted-foreground' : ''
                                          }`}>
                                            {task.title}
                                          </span>
                                        </div>

                                        {/* 任務詳情 */}
                                        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                                          {/* 狀態 */}
                                          <span className={`flex items-center gap-1 ${statusConfig[task.status].color}`}>
                                            <StatusIcon className="h-3 w-3" />
                                            {statusConfig[task.status].label}
                                          </span>

                                          {/* 優先級 */}
                                          <span className={`px-2 py-0.5 rounded ${priorityConfig[task.priority].color}`}>
                                            {priorityConfig[task.priority].label}
                                          </span>

                                          {/* 截止日期 */}
                                          {task.dueDate && (
                                            <span className="flex items-center gap-1">
                                              <Calendar className="h-3 w-3" />
                                              {format(new Date(task.dueDate), 'M/d', { locale: zhTW })}
                                            </span>
                                          )}

                                          {/* 負責人 */}
                                          {task.assignee && (
                                            <span className="text-gray-500">
                                              @{task.assignee}
                                            </span>
                                          )}

                                          {/* 預估時間 */}
                                          {task.estimatedMinutes && (
                                            <span className="text-gray-500">
                                              {task.estimatedMinutes >= 60
                                                ? `${Math.floor(task.estimatedMinutes / 60)}h${task.estimatedMinutes % 60 > 0 ? ` ${task.estimatedMinutes % 60}m` : ''}`
                                                : `${task.estimatedMinutes}m`
                                              }
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </SortableProjectItem>
                  )
                })}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* 任務詳細編輯對話框 */}
      <TaskDetailDialog
        task={selectedTask}
        projects={projects}
        onClose={() => setSelectedTask(null)}
        onUpdate={handleTaskUpdate}
      />
    </div>
  )
}
