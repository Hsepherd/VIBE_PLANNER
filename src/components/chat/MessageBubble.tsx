'use client'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Message, useAppStore, type AppState, type Task } from '@/lib/store'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { Check, Clock, User, Bot } from 'lucide-react'
import { FeedbackButtons } from '@/components/feedback'

interface MessageBubbleProps {
  message: Message
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const addTask = useAppStore((state: AppState) => state.addTask)
  const tasks = useAppStore((state: AppState) => state.tasks)

  // 解析訊息內容，看是否有任務
  const parseTasksFromMessage = () => {
    try {
      // 嘗試解析 JSON 格式的任務
      const jsonMatch = message.content.match(/```json\n?([\s\S]*?)\n?```/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1])
        if (parsed.type === 'tasks_extracted' && parsed.tasks) {
          return parsed.tasks
        }
      }
    } catch {
      // 忽略解析錯誤
    }
    return null
  }

  const extractedTasks = !isUser ? parseTasksFromMessage() : null

  // 取得顯示的訊息內容（移除 JSON 部分）
  const getDisplayContent = () => {
    if (extractedTasks) {
      try {
        const jsonMatch = message.content.match(/```json\n?([\s\S]*?)\n?```/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[1])
          return parsed.message || message.content.replace(/```json[\s\S]*?```/g, '').trim()
        }
      } catch {
        // 忽略
      }
    }
    return message.content
  }

  const handleAddTask = (task: {
    title: string
    description?: string
    due_date?: string
    assignee?: string
    priority?: string
    project?: string
  }) => {
    addTask({
      title: task.title,
      description: task.description,
      status: 'pending',
      priority: (task.priority as 'low' | 'medium' | 'high' | 'urgent') || 'medium',
      dueDate: task.due_date ? new Date(task.due_date) : undefined,
      assignee: task.assignee,
    })
  }

  const isTaskAlreadyAdded = (taskTitle: string) => {
    return tasks.some((t: Task) => t.title === taskTitle)
  }

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className={isUser ? 'bg-primary text-primary-foreground' : 'bg-secondary'}>
          {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>

      <div className={`flex flex-col gap-1 max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
        <Card
          className={`px-4 py-3 ${
            isUser
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted'
          }`}
        >
          <p className="text-sm whitespace-pre-wrap">{getDisplayContent()}</p>

          {/* 顯示萃取的任務 */}
          {extractedTasks && extractedTasks.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
              <p className="text-xs font-medium opacity-70">萃取的任務：</p>
              {extractedTasks.map((task: {
                title: string
                description?: string
                due_date?: string
                assignee?: string
                priority?: string
                project?: string
              }, index: number) => (
                <div
                  key={index}
                  className="flex items-center justify-between gap-2 p-2 rounded bg-background/50"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{task.title}</p>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      {task.due_date && (
                        <Badge variant="outline" className="text-xs">
                          <Clock className="h-3 w-3 mr-1" />
                          {task.due_date}
                        </Badge>
                      )}
                      {task.assignee && (
                        <Badge variant="outline" className="text-xs">
                          @{task.assignee}
                        </Badge>
                      )}
                      {task.priority && (
                        <Badge
                          variant={
                            task.priority === 'urgent'
                              ? 'destructive'
                              : task.priority === 'high'
                              ? 'default'
                              : 'secondary'
                          }
                          className="text-xs"
                        >
                          {task.priority}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={isTaskAlreadyAdded(task.title) ? 'ghost' : 'secondary'}
                    onClick={() => handleAddTask(task)}
                    disabled={isTaskAlreadyAdded(task.title)}
                    className="shrink-0"
                  >
                    {isTaskAlreadyAdded(task.title) ? (
                      <>
                        <Check className="h-4 w-4 mr-1" />
                        已加入
                      </>
                    ) : (
                      '加入'
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* 顯示圖片 */}
          {message.metadata?.imageUrl && (
            <div className="mt-2">
              <img
                src={message.metadata.imageUrl}
                alt="Uploaded"
                className="max-w-full rounded"
              />
            </div>
          )}
        </Card>

        <div className="flex items-center gap-2 px-1">
          <span className="text-xs text-muted-foreground">
            {format(new Date(message.timestamp), 'HH:mm', { locale: zhTW })}
          </span>
          {/* AI 訊息顯示回饋按鈕 */}
          {!isUser && (
            <FeedbackButtons
              messageContent={message.content}
              context={{ messageId: message.id }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
