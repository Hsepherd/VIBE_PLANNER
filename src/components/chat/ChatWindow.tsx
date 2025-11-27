'use client'

import { useRef, useEffect, useState } from 'react'
import { useAppStore, type AppState, type Message, type ExtractedTask } from '@/lib/store'
import MessageBubble from './MessageBubble'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Bot, Check, X, CheckSquare, Square, Clock, Loader2 } from 'lucide-react'
import { RejectReasonSelector } from '@/components/feedback'
import { recordPositiveExample, recordNegativeExample } from '@/lib/preferences'

export default function ChatWindow() {
  const messages = useAppStore((state: AppState) => state.messages)
  const streamingContent = useAppStore((state: AppState) => state.streamingContent)
  const isLoading = useAppStore((state: AppState) => state.isLoading)
  const pendingTasks = useAppStore((state: AppState) => state.pendingTasks)
  const clearPendingTasks = useAppStore((state: AppState) => state.clearPendingTasks)
  const addTask = useAppStore((state: AppState) => state.addTask)

  const lastInputContext = useAppStore((state: AppState) => state.lastInputContext)

  const scrollRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // 選中的任務
  const [selectedTasks, setSelectedTasks] = useState<Set<number>>(new Set())
  // 顯示拒絕原因選擇器的任務索引
  const [showRejectReason, setShowRejectReason] = useState<number | null>(null)
  // 上一次選中狀態（用於檢測取消勾選）
  const [prevSelected, setPrevSelected] = useState<Set<number>>(new Set())

  // 當有新的待確認任務時，預設全選
  useEffect(() => {
    if (pendingTasks.length > 0) {
      const allSelected = new Set(pendingTasks.map((_, index) => index))
      setSelectedTasks(allSelected)
      setPrevSelected(allSelected)
      setShowRejectReason(null)
    }
  }, [pendingTasks])

  // 自動捲動到最新訊息
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, streamingContent])

  // 切換選中狀態
  const toggleTask = (index: number) => {
    setSelectedTasks(prev => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
        // 取消勾選時顯示拒絕原因選擇器
        setShowRejectReason(index)
      } else {
        next.add(index)
        // 重新勾選時隱藏拒絕原因選擇器
        if (showRejectReason === index) {
          setShowRejectReason(null)
        }
      }
      setPrevSelected(prev)
      return next
    })
  }

  // 全選/取消全選
  const toggleAll = () => {
    if (selectedTasks.size === pendingTasks.length) {
      setSelectedTasks(new Set())
    } else {
      setSelectedTasks(new Set(pendingTasks.map((_, index) => index)))
    }
  }

  // 確認加入選中的任務
  const handleConfirmTasks = async () => {
    // 記錄正面範例（被選中的任務）
    for (let index = 0; index < pendingTasks.length; index++) {
      const task = pendingTasks[index]
      if (selectedTasks.has(index)) {
        // 加入任務
        addTask({
          title: task.title,
          description: task.description || '',
          status: 'pending',
          priority: task.priority || 'medium',
          dueDate: task.due_date ? new Date(task.due_date) : undefined,
          assignee: task.assignee || undefined,
          project: task.project || undefined,
        })
        // 記錄正面範例（背景執行，不阻塞 UI）
        recordPositiveExample(
          task as unknown as Record<string, unknown>,
          undefined,
          lastInputContext.slice(0, 500) // 只取前 500 字
        ).catch(console.error)
      } else {
        // 未選中的任務記錄為負面範例
        recordNegativeExample(
          task as unknown as Record<string, unknown>,
          undefined,
          lastInputContext.slice(0, 500)
        ).catch(console.error)
      }
    }
    clearPendingTasks()
    setSelectedTasks(new Set())
    setShowRejectReason(null)
  }

  // 取消（所有任務都記錄為負面範例）
  const handleCancelTasks = () => {
    // 記錄所有任務為負面範例
    pendingTasks.forEach((task) => {
      recordNegativeExample(
        task as unknown as Record<string, unknown>,
        'cancelled_all',
        lastInputContext.slice(0, 500)
      ).catch(console.error)
    })
    clearPendingTasks()
    setSelectedTasks(new Set())
    setShowRejectReason(null)
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto p-4"
    >
      <div className="space-y-4 max-w-3xl mx-auto">
        {messages.length === 0 && !streamingContent ? (
          <div className="text-center text-muted-foreground py-12">
            <div className="text-4xl mb-4">👋</div>
            <h3 className="text-lg font-medium mb-2">歡迎使用 Vibe Planner</h3>
            <p className="text-sm">
              我是你的 AI 助理，可以幫你：
            </p>
            <ul className="text-sm mt-2 space-y-1">
              <li>📋 從會議逐字稿萃取任務</li>
              <li>✅ 追蹤和管理待辦事項</li>
              <li>💡 提供智慧建議</li>
              <li>📸 分析截圖內容</li>
            </ul>
            <p className="text-sm mt-4 text-muted-foreground">
              試著貼上一段會議記錄，或告訴我你想做什麼！
            </p>
          </div>
        ) : (
          <>
            {messages.map((message: Message) => (
              <MessageBubble key={message.id} message={message} />
            ))}

            {/* Streaming 內容顯示 */}
            {streamingContent && (
              <div className="flex gap-3 flex-row">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="bg-secondary">
                    <Bot className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-1 max-w-[80%] items-start">
                  <Card className="px-4 py-3 bg-muted">
                    <p className="text-sm whitespace-pre-wrap">{streamingContent}</p>
                    <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-1" />
                  </Card>
                </div>
              </div>
            )}

            {/* 等待回應 */}
            {isLoading && !streamingContent && (
              <div className="flex gap-3 flex-row">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="bg-secondary">
                    <Bot className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-1 items-start">
                  <Card className="px-4 py-3 bg-muted">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">GPT-5 正在思考中...</span>
                    </div>
                  </Card>
                </div>
              </div>
            )}
          </>
        )}

        {/* 任務確認對話框 */}
        {pendingTasks.length > 0 && (
          <Card className="p-4 border-2 border-primary/50 bg-primary/5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                📋 萃取了 {pendingTasks.length} 個任務
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleAll}
              >
                {selectedTasks.size === pendingTasks.length ? '取消全選' : '全選'}
              </Button>
            </div>

            <ScrollArea className="max-h-[300px]">
              <div className="space-y-2">
                {pendingTasks.map((task, index) => (
                  <div
                    key={index}
                    onClick={() => toggleTask(index)}
                    className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedTasks.has(index)
                        ? 'bg-primary/10 border border-primary/30'
                        : 'bg-muted/50 hover:bg-muted'
                    }`}
                  >
                    <div className="mt-0.5">
                      {selectedTasks.has(index) ? (
                        <CheckSquare className="h-5 w-5 text-primary" />
                      ) : (
                        <Square className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{task.title}</p>
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
                        {task.project && (
                          <Badge variant="outline" className="text-xs">
                            {task.project}
                          </Badge>
                        )}
                      </div>
                      {/* 取消勾選時顯示拒絕原因選擇器 */}
                      {showRejectReason === index && !selectedTasks.has(index) && (
                        <div className="mt-2 pt-2 border-t border-border/50" onClick={(e) => e.stopPropagation()}>
                          <RejectReasonSelector
                            task={task as unknown as Record<string, unknown>}
                            contextSnippet={lastInputContext.slice(0, 500)}
                            onReasonSelected={() => setShowRejectReason(null)}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
              <Button
                variant="outline"
                onClick={handleCancelTasks}
              >
                <X className="h-4 w-4 mr-1" />
                取消
              </Button>
              <Button
                onClick={handleConfirmTasks}
                disabled={selectedTasks.size === 0}
              >
                <Check className="h-4 w-4 mr-1" />
                加入 {selectedTasks.size} 個任務
              </Button>
            </div>
          </Card>
        )}

        <div ref={scrollRef} />
      </div>
    </div>
  )
}
