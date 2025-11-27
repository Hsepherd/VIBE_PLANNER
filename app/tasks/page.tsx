'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useAppStore, type AppState, type Task } from '@/lib/store'
import { format, isToday, isTomorrow, isThisWeek, isPast, addDays, startOfDay } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import {
  Check,
  Trash2,
  Plus,
  Calendar,
  Filter,
  ChevronDown,
  ChevronRight,
  ArrowUpDown,
} from 'lucide-react'

type SortMode = 'priority' | 'dueDate'

export default function TasksPage() {
  const tasks = useAppStore((state: AppState) => state.tasks)
  const addTask = useAppStore((state: AppState) => state.addTask)
  const updateTask = useAppStore((state: AppState) => state.updateTask)
  const deleteTask = useAppStore((state: AppState) => state.deleteTask)
  const completeTask = useAppStore((state: AppState) => state.completeTask)

  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all')
  const [showCompleted, setShowCompleted] = useState(false)
  const [sortMode, setSortMode] = useState<SortMode>('priority')

  // 過濾任務
  const filteredTasks = tasks.filter((task: Task) => {
    if (filter === 'all') return task.status !== 'completed'
    if (filter === 'pending') return task.status === 'pending'
    if (filter === 'completed') return task.status === 'completed'
    return true
  })

  const completedTasks = tasks.filter((t: Task) => t.status === 'completed')

  // 按優先級分組
  const groupedByPriority = {
    urgent: filteredTasks.filter((t: Task) => t.priority === 'urgent'),
    high: filteredTasks.filter((t: Task) => t.priority === 'high'),
    medium: filteredTasks.filter((t: Task) => t.priority === 'medium'),
    low: filteredTasks.filter((t: Task) => t.priority === 'low'),
  }

  // 按截止日期分組
  const today = startOfDay(new Date())
  const groupedByDueDate = {
    overdue: filteredTasks.filter((t: Task) => {
      if (!t.dueDate) return false
      const due = startOfDay(new Date(t.dueDate))
      return isPast(due) && !isToday(due)
    }),
    today: filteredTasks.filter((t: Task) => {
      if (!t.dueDate) return false
      return isToday(new Date(t.dueDate))
    }),
    tomorrow: filteredTasks.filter((t: Task) => {
      if (!t.dueDate) return false
      return isTomorrow(new Date(t.dueDate))
    }),
    thisWeek: filteredTasks.filter((t: Task) => {
      if (!t.dueDate) return false
      const due = new Date(t.dueDate)
      return !isToday(due) && !isTomorrow(due) && isThisWeek(due, { weekStartsOn: 1 }) && !isPast(startOfDay(due))
    }),
    later: filteredTasks.filter((t: Task) => {
      if (!t.dueDate) return false
      const due = new Date(t.dueDate)
      return due > addDays(today, 7)
    }),
    noDueDate: filteredTasks.filter((t: Task) => !t.dueDate),
  }

  // 新增任務
  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return
    addTask({
      title: newTaskTitle.trim(),
      status: 'pending',
      priority: 'medium',
    })
    setNewTaskTitle('')
  }

  // 優先級顏色
  const priorityConfig = {
    urgent: { label: '🔴 緊急', color: 'destructive' as const },
    high: { label: '🟠 高', color: 'default' as const },
    medium: { label: '🟡 中', color: 'secondary' as const },
    low: { label: '🟢 低', color: 'outline' as const },
  }

  // 展開狀態管理
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set())

  const toggleExpand = (taskId: string) => {
    setExpandedTasks(prev => {
      const next = new Set(prev)
      if (next.has(taskId)) {
        next.delete(taskId)
      } else {
        next.add(taskId)
      }
      return next
    })
  }

  const TaskItem = ({ task }: { task: Task }) => {
    const isExpanded = expandedTasks.has(task.id)
    const hasDescription = task.description && task.description.trim().length > 0

    return (
      <div
        className={`rounded-lg border transition-all ${
          task.status === 'completed' ? 'opacity-60 bg-muted/30' : 'bg-card hover:bg-muted/50'
        }`}
      >
        <div className="flex items-center gap-3 p-3">
          {/* 完成按鈕 */}
          <Button
            variant={task.status === 'completed' ? 'default' : 'outline'}
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={() => {
              if (task.status === 'completed') {
                updateTask(task.id, { status: 'pending', completedAt: undefined })
              } else {
                completeTask(task.id)
              }
            }}
          >
            <Check className="h-3 w-3" />
          </Button>

          {/* 任務內容 */}
          <div
            className="flex-1 min-w-0 cursor-pointer"
            onClick={() => hasDescription && toggleExpand(task.id)}
          >
            <div className="flex items-center gap-2">
              <p className={`font-medium ${task.status === 'completed' ? 'line-through' : ''}`}>
                {task.title}
              </p>
              {hasDescription && (
                <span className="text-muted-foreground">
                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {task.dueDate && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(task.dueDate), 'M/d', { locale: zhTW })}
                </span>
              )}
              {task.assignee && (
                <span className="text-xs text-muted-foreground">
                  @{task.assignee}
                </span>
              )}
              {task.project && (
                <Badge variant="outline" className="text-xs">
                  {task.project}
                </Badge>
              )}
            </div>
          </div>

          {/* 優先級 */}
          <Badge variant={priorityConfig[task.priority].color} className="shrink-0">
            {task.priority}
          </Badge>

          {/* 刪除 */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
            onClick={() => deleteTask(task.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        {/* 展開的描述區域 */}
        {isExpanded && hasDescription && (
          <div className="px-3 pb-3 pt-0 ml-9 border-t mt-2">
            <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-2">
              {task.description}
            </p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-2xl font-bold">📋 任務列表</h1>
          <div className="flex items-center gap-2 flex-wrap">
            {/* 排序模式 */}
            <div className="flex items-center border rounded-lg overflow-hidden">
              <Button
                variant={sortMode === 'priority' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-none"
                onClick={() => setSortMode('priority')}
              >
                <ArrowUpDown className="h-3 w-3 mr-1" />
                優先級
              </Button>
              <Button
                variant={sortMode === 'dueDate' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-none"
                onClick={() => setSortMode('dueDate')}
              >
                <Calendar className="h-3 w-3 mr-1" />
                截止日
              </Button>
            </div>
            {/* 過濾 */}
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
            >
              全部
            </Button>
            <Button
              variant={filter === 'pending' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('pending')}
            >
              待處理
            </Button>
          </div>
        </div>

        {/* 新增任務 */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex gap-2">
              <Input
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="輸入新任務..."
                onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
              />
              <Button onClick={handleAddTask}>
                <Plus className="h-4 w-4 mr-1" />
                新增
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 任務列表 */}
        <div className="space-y-6">
          {sortMode === 'priority' ? (
            <>
              {/* 按優先級分組 */}
              {groupedByPriority.urgent.length > 0 && (
                <div className="space-y-2">
                  <h2 className="font-semibold text-destructive flex items-center gap-2">
                    🔴 緊急 ({groupedByPriority.urgent.length})
                  </h2>
                  <div className="space-y-2">
                    {groupedByPriority.urgent.map((task: Task) => (
                      <TaskItem key={task.id} task={task} />
                    ))}
                  </div>
                </div>
              )}

              {groupedByPriority.high.length > 0 && (
                <div className="space-y-2">
                  <h2 className="font-semibold flex items-center gap-2">
                    🟠 高優先級 ({groupedByPriority.high.length})
                  </h2>
                  <div className="space-y-2">
                    {groupedByPriority.high.map((task: Task) => (
                      <TaskItem key={task.id} task={task} />
                    ))}
                  </div>
                </div>
              )}

              {groupedByPriority.medium.length > 0 && (
                <div className="space-y-2">
                  <h2 className="font-semibold flex items-center gap-2">
                    🟡 中優先級 ({groupedByPriority.medium.length})
                  </h2>
                  <div className="space-y-2">
                    {groupedByPriority.medium.map((task: Task) => (
                      <TaskItem key={task.id} task={task} />
                    ))}
                  </div>
                </div>
              )}

              {groupedByPriority.low.length > 0 && (
                <div className="space-y-2">
                  <h2 className="font-semibold flex items-center gap-2">
                    🟢 低優先級 ({groupedByPriority.low.length})
                  </h2>
                  <div className="space-y-2">
                    {groupedByPriority.low.map((task: Task) => (
                      <TaskItem key={task.id} task={task} />
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* 按截止日期分組 */}
              {groupedByDueDate.overdue.length > 0 && (
                <div className="space-y-2">
                  <h2 className="font-semibold text-destructive flex items-center gap-2">
                    ⚠️ 已過期 ({groupedByDueDate.overdue.length})
                  </h2>
                  <div className="space-y-2">
                    {groupedByDueDate.overdue.map((task: Task) => (
                      <TaskItem key={task.id} task={task} />
                    ))}
                  </div>
                </div>
              )}

              {groupedByDueDate.today.length > 0 && (
                <div className="space-y-2">
                  <h2 className="font-semibold text-orange-600 dark:text-orange-400 flex items-center gap-2">
                    📅 今天 ({groupedByDueDate.today.length})
                  </h2>
                  <div className="space-y-2">
                    {groupedByDueDate.today.map((task: Task) => (
                      <TaskItem key={task.id} task={task} />
                    ))}
                  </div>
                </div>
              )}

              {groupedByDueDate.tomorrow.length > 0 && (
                <div className="space-y-2">
                  <h2 className="font-semibold text-yellow-600 dark:text-yellow-400 flex items-center gap-2">
                    📆 明天 ({groupedByDueDate.tomorrow.length})
                  </h2>
                  <div className="space-y-2">
                    {groupedByDueDate.tomorrow.map((task: Task) => (
                      <TaskItem key={task.id} task={task} />
                    ))}
                  </div>
                </div>
              )}

              {groupedByDueDate.thisWeek.length > 0 && (
                <div className="space-y-2">
                  <h2 className="font-semibold flex items-center gap-2">
                    🗓️ 本週 ({groupedByDueDate.thisWeek.length})
                  </h2>
                  <div className="space-y-2">
                    {groupedByDueDate.thisWeek.map((task: Task) => (
                      <TaskItem key={task.id} task={task} />
                    ))}
                  </div>
                </div>
              )}

              {groupedByDueDate.later.length > 0 && (
                <div className="space-y-2">
                  <h2 className="font-semibold text-muted-foreground flex items-center gap-2">
                    📋 稍後 ({groupedByDueDate.later.length})
                  </h2>
                  <div className="space-y-2">
                    {groupedByDueDate.later.map((task: Task) => (
                      <TaskItem key={task.id} task={task} />
                    ))}
                  </div>
                </div>
              )}

              {groupedByDueDate.noDueDate.length > 0 && (
                <div className="space-y-2">
                  <h2 className="font-semibold text-muted-foreground flex items-center gap-2">
                    📝 無截止日 ({groupedByDueDate.noDueDate.length})
                  </h2>
                  <div className="space-y-2">
                    {groupedByDueDate.noDueDate.map((task: Task) => (
                      <TaskItem key={task.id} task={task} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {filteredTasks.length === 0 && filter !== 'completed' && (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-4xl mb-4">🎉</p>
              <p>太棒了！目前沒有待辦任務</p>
              <p className="text-sm mt-2">
                在對話中貼上會議記錄，我會自動幫你萃取任務
              </p>
            </div>
          )}

          {/* 已完成 */}
          {completedTasks.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => setShowCompleted(!showCompleted)}
                >
                  {showCompleted ? (
                    <ChevronDown className="h-4 w-4 mr-2" />
                  ) : (
                    <ChevronRight className="h-4 w-4 mr-2" />
                  )}
                  ✅ 已完成 ({completedTasks.length})
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
    </div>
  )
}
