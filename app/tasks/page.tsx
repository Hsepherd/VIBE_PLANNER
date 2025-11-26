'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useAppStore, type AppState, type Task } from '@/lib/store'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import {
  Check,
  Trash2,
  Plus,
  Calendar,
  Filter,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'

export default function TasksPage() {
  const tasks = useAppStore((state: AppState) => state.tasks)
  const addTask = useAppStore((state: AppState) => state.addTask)
  const updateTask = useAppStore((state: AppState) => state.updateTask)
  const deleteTask = useAppStore((state: AppState) => state.deleteTask)
  const completeTask = useAppStore((state: AppState) => state.completeTask)

  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all')
  const [showCompleted, setShowCompleted] = useState(false)

  // 過濾任務
  const filteredTasks = tasks.filter((task: Task) => {
    if (filter === 'all') return task.status !== 'completed'
    if (filter === 'pending') return task.status === 'pending'
    if (filter === 'completed') return task.status === 'completed'
    return true
  })

  const completedTasks = tasks.filter((t: Task) => t.status === 'completed')

  // 按優先級分組
  const groupedTasks = {
    urgent: filteredTasks.filter((t: Task) => t.priority === 'urgent'),
    high: filteredTasks.filter((t: Task) => t.priority === 'high'),
    medium: filteredTasks.filter((t: Task) => t.priority === 'medium'),
    low: filteredTasks.filter((t: Task) => t.priority === 'low'),
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

  const TaskItem = ({ task }: { task: Task }) => (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
        task.status === 'completed' ? 'opacity-60 bg-muted/30' : 'bg-card hover:bg-muted/50'
      }`}
    >
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
      <div className="flex-1 min-w-0">
        <p className={`font-medium truncate ${task.status === 'completed' ? 'line-through' : ''}`}>
          {task.title}
        </p>
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
  )

  return (
    <ScrollArea className="flex-1">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">📋 任務列表</h1>
          <div className="flex items-center gap-2">
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
          {/* 緊急 */}
          {groupedTasks.urgent.length > 0 && (
            <div className="space-y-2">
              <h2 className="font-semibold text-destructive flex items-center gap-2">
                🔴 緊急 ({groupedTasks.urgent.length})
              </h2>
              <div className="space-y-2">
                {groupedTasks.urgent.map((task: Task) => (
                  <TaskItem key={task.id} task={task} />
                ))}
              </div>
            </div>
          )}

          {/* 高優先級 */}
          {groupedTasks.high.length > 0 && (
            <div className="space-y-2">
              <h2 className="font-semibold flex items-center gap-2">
                🟠 高優先級 ({groupedTasks.high.length})
              </h2>
              <div className="space-y-2">
                {groupedTasks.high.map((task: Task) => (
                  <TaskItem key={task.id} task={task} />
                ))}
              </div>
            </div>
          )}

          {/* 中優先級 */}
          {groupedTasks.medium.length > 0 && (
            <div className="space-y-2">
              <h2 className="font-semibold flex items-center gap-2">
                🟡 中優先級 ({groupedTasks.medium.length})
              </h2>
              <div className="space-y-2">
                {groupedTasks.medium.map((task: Task) => (
                  <TaskItem key={task.id} task={task} />
                ))}
              </div>
            </div>
          )}

          {/* 低優先級 */}
          {groupedTasks.low.length > 0 && (
            <div className="space-y-2">
              <h2 className="font-semibold flex items-center gap-2">
                🟢 低優先級 ({groupedTasks.low.length})
              </h2>
              <div className="space-y-2">
                {groupedTasks.low.map((task: Task) => (
                  <TaskItem key={task.id} task={task} />
                ))}
              </div>
            </div>
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
    </ScrollArea>
  )
}
