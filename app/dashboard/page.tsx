'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAppStore, type AppState, type Task, type Project } from '@/lib/store'
import { format, isToday, isTomorrow, isThisWeek, isPast, addDays } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  TrendingUp,
  Calendar,
  Check,
} from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
  const tasks = useAppStore((state: AppState) => state.tasks)
  const projects = useAppStore((state: AppState) => state.projects)
  const completeTask = useAppStore((state: AppState) => state.completeTask)

  // 統計資料
  const stats = {
    pending: tasks.filter((t: Task) => t.status === 'pending').length,
    inProgress: tasks.filter((t: Task) => t.status === 'in_progress').length,
    completed: tasks.filter((t: Task) => t.status === 'completed').length,
    urgent: tasks.filter((t: Task) => t.priority === 'urgent' && t.status !== 'completed').length,
  }

  // 今日任務
  const todayTasks = tasks.filter((t: Task) => {
    if (t.status === 'completed') return false
    if (!t.dueDate) return false
    return isToday(new Date(t.dueDate))
  })

  // 即將到期（7天內）
  const upcomingTasks = tasks
    .filter((t: Task) => {
      if (t.status === 'completed') return false
      if (!t.dueDate) return false
      const due = new Date(t.dueDate)
      return !isPast(due) && due <= addDays(new Date(), 7)
    })
    .sort((a: Task, b: Task) => {
      if (!a.dueDate || !b.dueDate) return 0
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    })
    .slice(0, 5)

  // 過期任務
  const overdueTasks = tasks.filter((t: Task) => {
    if (t.status === 'completed') return false
    if (!t.dueDate) return false
    return isPast(new Date(t.dueDate)) && !isToday(new Date(t.dueDate))
  })

  // 格式化日期
  const formatDueDate = (date: Date) => {
    const d = new Date(date)
    if (isToday(d)) return '今天'
    if (isTomorrow(d)) return '明天'
    if (isThisWeek(d)) return format(d, 'EEEE', { locale: zhTW })
    return format(d, 'M/d', { locale: zhTW })
  }

  // 優先級顏色
  const priorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'destructive'
      case 'high':
        return 'default'
      case 'medium':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  return (
    <ScrollArea className="flex-1">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">📊 Dashboard</h1>
          <p className="text-muted-foreground">
            {format(new Date(), 'yyyy年M月d日 EEEE', { locale: zhTW })}
          </p>
        </div>

        {/* 統計卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">待處理</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pending}</div>
              <p className="text-xs text-muted-foreground">個任務等待處理</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">進行中</CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.inProgress}</div>
              <p className="text-xs text-muted-foreground">個任務正在進行</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">已完成</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completed}</div>
              <p className="text-xs text-muted-foreground">個任務已完成</p>
            </CardContent>
          </Card>

          <Card className={stats.urgent > 0 ? 'border-destructive' : ''}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">緊急</CardTitle>
              <AlertCircle className={`h-4 w-4 ${stats.urgent > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${stats.urgent > 0 ? 'text-destructive' : ''}`}>
                {stats.urgent}
              </div>
              <p className="text-xs text-muted-foreground">個緊急任務</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 過期任務警告 */}
          {overdueTasks.length > 0 && (
            <Card className="border-destructive lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-destructive flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  過期任務 ({overdueTasks.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {overdueTasks.map((task: Task) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-destructive/10"
                    >
                      <div>
                        <p className="font-medium">{task.title}</p>
                        <p className="text-sm text-muted-foreground">
                          截止日：{task.dueDate && format(new Date(task.dueDate), 'M/d')}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => completeTask(task.id)}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        完成
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 今日任務 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                今日任務 ({todayTasks.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {todayTasks.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  今天沒有待辦任務 🎉
                </p>
              ) : (
                <div className="space-y-2">
                  {todayTasks.map((task: Task) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant={priorityColor(task.priority) as "default" | "secondary" | "destructive" | "outline"}>
                          {task.priority}
                        </Badge>
                        <span>{task.title}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => completeTask(task.id)}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 即將到期 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                即將到期
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingTasks.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  7 天內沒有任務到期
                </p>
              ) : (
                <div className="space-y-2">
                  {upcomingTasks.map((task: Task) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div>
                        <p className="font-medium">{task.title}</p>
                        {task.assignee && (
                          <p className="text-sm text-muted-foreground">
                            @{task.assignee}
                          </p>
                        )}
                      </div>
                      <Badge variant="outline">
                        {task.dueDate && formatDueDate(new Date(task.dueDate))}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
              <Link href="/tasks">
                <Button variant="ghost" className="w-full mt-4">
                  查看所有任務
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* 專案進度 */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                專案進度
              </CardTitle>
            </CardHeader>
            <CardContent>
              {projects.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  尚未建立任何專案
                </p>
              ) : (
                <div className="space-y-4">
                  {projects.map((project: Project) => (
                    <div key={project.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{project.name}</span>
                        <span className="text-sm text-muted-foreground">
                          {project.progress}%
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${project.progress}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <Link href="/projects">
                <Button variant="ghost" className="w-full mt-4">
                  管理專案
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </ScrollArea>
  )
}
