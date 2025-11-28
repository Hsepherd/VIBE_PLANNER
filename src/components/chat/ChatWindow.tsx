'use client'

import { useRef, useEffect, useState } from 'react'
import { useAppStore, type AppState, type Message, type ExtractedTask } from '@/lib/store'
import MessageBubble from './MessageBubble'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Check, X, CheckSquare, Square, Clock, Loader2, Eye } from 'lucide-react'
import { RejectReasonSelector } from '@/components/feedback'
import { recordPositiveExample, recordNegativeExample } from '@/lib/preferences'

// 解析 description 內容的函數
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

  if (!description) return sections

  // 解析【任務摘要】
  const summaryMatch = description.match(/【任務摘要】([\s\S]*?)(?=【|$)/)
  if (summaryMatch) {
    sections.summary = summaryMatch[1].trim()
  }

  // 解析【執行細節】
  const stepsMatch = description.match(/【執行細節】([\s\S]*?)(?=【|$)/)
  if (stepsMatch) {
    const stepsText = stepsMatch[1].trim()
    sections.steps = stepsText
      .split(/\n/)
      .map(s => s.trim())
      .filter(s => s && /^\d+[\.\、]/.test(s))
  }

  // 解析【會議脈絡】
  const contextMatch = description.match(/【會議脈絡】([\s\S]*?)(?=【|$)/)
  if (contextMatch) {
    sections.context = contextMatch[1].trim()
  }

  // 解析【原文引用】- 特殊處理，因為引用內容本身可能包含【時間】格式
  // 由於【原文引用】通常是最後一個區塊，直接取到結尾
  const quotesMatch = description.match(/【原文引用】([\s\S]*)$/)
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

  return sections
}

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
  // 當前查看詳情的任務索引
  const [viewingTaskIndex, setViewingTaskIndex] = useState<number | null>(null)

  // 當有新的待確認任務時，預設不選（讓用戶自己決定）
  useEffect(() => {
    if (pendingTasks.length > 0) {
      setSelectedTasks(new Set())
      setViewingTaskIndex(null)
    }
  }, [pendingTasks])

  // 自動捲動到最新訊息
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, streamingContent])

  // 切換選中狀態（只在勾選框點擊時觸發）
  const toggleTask = (index: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedTasks(prev => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
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

  // 打開任務詳情
  const openTaskDetail = (index: number) => {
    setViewingTaskIndex(index)
  }

  // 從詳情中加入單一任務
  const addSingleTask = (index: number) => {
    const task = pendingTasks[index]
    addTask({
      title: task.title,
      description: task.description || '',
      status: 'pending',
      priority: task.priority || 'medium',
      dueDate: task.due_date ? new Date(task.due_date) : undefined,
      assignee: task.assignee || undefined,
      project: task.project || undefined,
    })
    recordPositiveExample(
      task as unknown as Record<string, unknown>,
      undefined,
      lastInputContext.slice(0, 500)
    ).catch(console.error)

    // 從選中列表移除（如果有的話）
    setSelectedTasks(prev => {
      const next = new Set(prev)
      next.delete(index)
      return next
    })
    setViewingTaskIndex(null)
  }

  // 從詳情中跳過單一任務
  const skipSingleTask = (index: number) => {
    const task = pendingTasks[index]
    recordNegativeExample(
      task as unknown as Record<string, unknown>,
      'skipped',
      lastInputContext.slice(0, 500)
    ).catch(console.error)

    // 從選中列表移除
    setSelectedTasks(prev => {
      const next = new Set(prev)
      next.delete(index)
      return next
    })
    setViewingTaskIndex(null)
  }

  // 確認加入選中的任務
  const handleConfirmTasks = async () => {
    for (let index = 0; index < pendingTasks.length; index++) {
      const task = pendingTasks[index]
      if (selectedTasks.has(index)) {
        addTask({
          title: task.title,
          description: task.description || '',
          status: 'pending',
          priority: task.priority || 'medium',
          dueDate: task.due_date ? new Date(task.due_date) : undefined,
          assignee: task.assignee || undefined,
          project: task.project || undefined,
        })
        recordPositiveExample(
          task as unknown as Record<string, unknown>,
          undefined,
          lastInputContext.slice(0, 500)
        ).catch(console.error)
      }
    }
    clearPendingTasks()
    setSelectedTasks(new Set())
    setViewingTaskIndex(null)
  }

  // 取消全部
  const handleCancelTasks = () => {
    pendingTasks.forEach((task) => {
      recordNegativeExample(
        task as unknown as Record<string, unknown>,
        'cancelled_all',
        lastInputContext.slice(0, 500)
      ).catch(console.error)
    })
    clearPendingTasks()
    setSelectedTasks(new Set())
    setViewingTaskIndex(null)
  }

  // 當前查看的任務
  const viewingTask = viewingTaskIndex !== null ? pendingTasks[viewingTaskIndex] : null
  const parsedDescription = viewingTask ? parseDescription(viewingTask.description || '') : null

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto"
    >
      <div className="space-y-4 p-4">
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
                  <AvatarImage src="/pingu.png" alt="Vibe Planner" />
                  <AvatarFallback className="bg-secondary">VP</AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-1 max-w-[80%] items-start">
                  <span className="text-xs font-medium text-muted-foreground px-1">
                    Vibe Planner
                  </span>
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
                  <AvatarImage src="/pingu.png" alt="Vibe Planner" />
                  <AvatarFallback className="bg-secondary">VP</AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-1 items-start">
                  <span className="text-xs font-medium text-muted-foreground px-1">
                    Vibe Planner
                  </span>
                  <Card className="px-4 py-3 bg-muted">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">正在思考中...</span>
                    </div>
                  </Card>
                </div>
              </div>
            )}
          </>
        )}

        {/* 任務確認卡片 */}
        {pendingTasks.length > 0 && (
          <div className="py-4 px-4">
          <Card className="p-4 border-2 border-primary/50 bg-primary/5 max-w-3xl mx-auto">
            <div className="flex items-center justify-between mb-3">
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

            <p className="text-sm text-muted-foreground mb-3">
              點擊任務查看詳情，或勾選後批次加入
            </p>

            <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
              {pendingTasks.map((task, index) => (
                <div
                  key={index}
                  onClick={() => openTaskDetail(index)}
                  className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors border ${
                    selectedTasks.has(index)
                      ? 'bg-primary/10 border-primary/30'
                      : 'bg-background hover:bg-muted/50 border-border'
                  }`}
                >
                  {/* 勾選框 */}
                  <div
                    className="mt-0.5 shrink-0"
                    onClick={(e) => toggleTask(index, e)}
                  >
                    {selectedTasks.has(index) ? (
                      <CheckSquare className="h-5 w-5 text-primary" />
                    ) : (
                      <Square className="h-5 w-5 text-muted-foreground hover:text-primary" />
                    )}
                  </div>

                  {/* 任務內容 */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{task.title}</p>
                    <div className="flex gap-1.5 mt-1.5 flex-wrap">
                      {task.due_date && (
                        <Badge variant="outline" className="text-xs py-0">
                          <Clock className="h-3 w-3 mr-1" />
                          {task.due_date}
                        </Badge>
                      )}
                      {task.assignee && (
                        <Badge variant="outline" className="text-xs py-0">
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
                          className="text-xs py-0"
                        >
                          {task.priority}
                        </Badge>
                      )}
                      {task.project && (
                        <Badge variant="outline" className="text-xs py-0">
                          {task.project}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* 查看詳情按鈕 */}
                  <Eye className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                </div>
              ))}
            </div>

            {/* 底部按鈕 */}
            <div className="flex justify-between items-center gap-2 mt-4 pt-3 border-t">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancelTasks}
                className="text-muted-foreground"
              >
                全部略過
              </Button>
              <Button
                onClick={handleConfirmTasks}
                disabled={selectedTasks.size === 0}
                size="sm"
              >
                <Check className="h-4 w-4 mr-1" />
                加入 {selectedTasks.size} 個任務
              </Button>
            </div>
          </Card>
          </div>
        )}

        {/* 任務詳情 Dialog */}
        <Dialog open={viewingTaskIndex !== null} onOpenChange={() => setViewingTaskIndex(null)}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-lg pr-6">
                {viewingTask?.title}
              </DialogTitle>
            </DialogHeader>

            {viewingTask && (
              <>
                {/* 任務基本資訊 */}
                <div className="flex flex-wrap gap-2 pb-3 border-b">
                  {viewingTask.priority && (
                    <Badge
                      variant={
                        viewingTask.priority === 'urgent'
                          ? 'destructive'
                          : viewingTask.priority === 'high'
                          ? 'default'
                          : 'secondary'
                      }
                    >
                      {viewingTask.priority === 'urgent' ? '緊急' :
                       viewingTask.priority === 'high' ? '高優先' :
                       viewingTask.priority === 'medium' ? '中優先' : '低優先'}
                    </Badge>
                  )}
                  {viewingTask.assignee && (
                    <Badge variant="outline">負責人：{viewingTask.assignee}</Badge>
                  )}
                  {viewingTask.due_date && (
                    <Badge variant="outline">
                      <Clock className="h-3 w-3 mr-1" />
                      {viewingTask.due_date}
                    </Badge>
                  )}
                  {viewingTask.project && (
                    <Badge variant="outline">專案：{viewingTask.project}</Badge>
                  )}
                </div>

                {/* 詳細內容 */}
                <ScrollArea className="flex-1 pr-4">
                  <div className="space-y-4 py-2">
                    {/* 任務摘要 */}
                    {parsedDescription?.summary && (
                      <div>
                        <h4 className="font-semibold text-sm mb-1 text-primary">任務摘要</h4>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {parsedDescription.summary}
                        </p>
                      </div>
                    )}

                    {/* 執行細節 */}
                    {parsedDescription?.steps && parsedDescription.steps.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-sm mb-1 text-primary">執行細節</h4>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          {parsedDescription.steps.map((step, i) => (
                            <li key={i} className="leading-relaxed">{step}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* 會議脈絡 */}
                    {parsedDescription?.context && (
                      <div>
                        <h4 className="font-semibold text-sm mb-1 text-primary">會議脈絡</h4>
                        <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                          {parsedDescription.context}
                        </p>
                      </div>
                    )}

                    {/* 原文引用 */}
                    {parsedDescription?.quotes && parsedDescription.quotes.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-sm mb-1 text-primary">原文引用</h4>
                        <div className="space-y-2">
                          {parsedDescription.quotes.map((quote, i) => (
                            <div
                              key={i}
                              className="text-sm text-muted-foreground pl-3 border-l-2 border-primary/30 leading-relaxed"
                            >
                              {quote}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 如果沒有結構化內容，顯示原始 description */}
                    {!parsedDescription?.summary && !parsedDescription?.steps?.length &&
                     !parsedDescription?.context && !parsedDescription?.quotes?.length &&
                     viewingTask.description && (
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {viewingTask.description}
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </>
            )}

            <DialogFooter className="flex-row gap-2 pt-3 border-t">
              <Button
                variant="outline"
                onClick={() => viewingTaskIndex !== null && skipSingleTask(viewingTaskIndex)}
                className="flex-1"
              >
                <X className="h-4 w-4 mr-1" />
                跳過
              </Button>
              <Button
                onClick={() => viewingTaskIndex !== null && addSingleTask(viewingTaskIndex)}
                className="flex-1"
              >
                <Check className="h-4 w-4 mr-1" />
                加入任務
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div ref={scrollRef} className="h-4" />
      </div>
    </div>
  )
}
