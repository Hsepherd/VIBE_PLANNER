'use client'

import { useRef, useEffect, useState, useMemo } from 'react'
import { useAppStore, type AppState, type Message, type ProcessedTask, type ProcessedTaskGroup, type PendingTaskGroup, type ExtractedTask } from '@/lib/store'
import { useSupabaseTasks } from '@/lib/useSupabaseTasks'
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
import { Check, X, CheckSquare, Square, Clock, Loader2, Eye, ThumbsUp, ThumbsDown, Pencil, RefreshCw } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { recordPositiveExample, recordNegativeExample } from '@/lib/preferences'
import { learnFromTaskFeedback } from '@/lib/few-shot-learning'
import { conversationLearningsApi } from '@/lib/supabase-learning'

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
  const lastInputContext = useAppStore((state: AppState) => state.lastInputContext)

  // 待確認任務群組（新版）
  const pendingTaskGroups = useAppStore((state: AppState) => state.pendingTaskGroups)
  const updatePendingTaskGroup = useAppStore((state: AppState) => state.updatePendingTaskGroup)
  const updatePendingTask = useAppStore((state: AppState) => state.updatePendingTask)
  const removePendingTaskGroup = useAppStore((state: AppState) => state.removePendingTaskGroup)
  const clearPendingTaskGroups = useAppStore((state: AppState) => state.clearPendingTaskGroups)

  // 已處理任務歷史
  const processedTaskGroups = useAppStore((state: AppState) => state.processedTaskGroups)
  const addProcessedTaskGroup = useAppStore((state: AppState) => state.addProcessedTaskGroup)
  const updateTaskFeedback = useAppStore((state: AppState) => state.updateTaskFeedback)

  // 使用 Supabase 任務 API（同步到雲端）
  const { addTask: addTaskToSupabase } = useSupabaseTasks()

  const scrollRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // 選中的任務（按群組 ID + 任務索引）
  const [selectedTasks, setSelectedTasks] = useState<Map<string, Set<number>>>(new Map())
  // 當前查看詳情的任務（群組 ID + 任務索引）
  const [viewingTask, setViewingTask] = useState<{ groupId: string; taskIndex: number } | null>(null)
  // 防止重複點擊
  const [isSubmitting, setIsSubmitting] = useState(false)
  // 編輯負責人狀態
  const [editingAssignee, setEditingAssignee] = useState<{ groupId: string; taskIndex: number } | null>(null)
  const [assigneeInputValue, setAssigneeInputValue] = useState('')
  // 重新生成狀態
  const [isRegenerating, setIsRegenerating] = useState<string | null>(null) // groupId 或 'single-{groupId}-{taskIndex}'

  // 當有新的待確認任務群組時，預設不選（讓用戶自己決定）
  useEffect(() => {
    if (pendingTaskGroups.length > 0) {
      setSelectedTasks(new Map())
      setViewingTask(null)
    }
  }, [pendingTaskGroups])

  // 自動捲動到最新訊息
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, streamingContent, processedTaskGroups, pendingTaskGroups])

  // 合併 messages、processedTaskGroups、pendingTaskGroups 成時間線
  type TimelineItem =
    | { type: 'message'; data: Message }
    | { type: 'processedGroup'; data: ProcessedTaskGroup }
    | { type: 'pendingGroup'; data: PendingTaskGroup }

  const timeline = useMemo(() => {
    const items: TimelineItem[] = []

    // 加入所有訊息
    messages.forEach(msg => {
      items.push({ type: 'message', data: msg })
    })

    // 加入所有已處理任務群組
    processedTaskGroups.forEach(group => {
      items.push({ type: 'processedGroup', data: group })
    })

    // 加入所有待確認任務群組
    pendingTaskGroups.forEach(group => {
      items.push({ type: 'pendingGroup', data: group })
    })

    // 按時間排序
    items.sort((a, b) => {
      const timeA = new Date(a.data.timestamp).getTime()
      const timeB = new Date(b.data.timestamp).getTime()
      return timeA - timeB
    })

    return items
  }, [messages, processedTaskGroups, pendingTaskGroups])

  // 切換選中狀態（群組內的任務）
  const toggleTask = (groupId: string, taskIndex: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedTasks(prev => {
      const next = new Map(prev)
      const groupSet = next.get(groupId) || new Set()
      const newGroupSet = new Set(groupSet)
      if (newGroupSet.has(taskIndex)) {
        newGroupSet.delete(taskIndex)
      } else {
        newGroupSet.add(taskIndex)
      }
      next.set(groupId, newGroupSet)
      return next
    })
  }

  // 全選/取消全選（單一群組）
  const toggleAllInGroup = (groupId: string, taskCount: number) => {
    setSelectedTasks(prev => {
      const next = new Map(prev)
      const groupSet = next.get(groupId) || new Set()
      if (groupSet.size === taskCount) {
        next.set(groupId, new Set())
      } else {
        next.set(groupId, new Set(Array.from({ length: taskCount }, (_, i) => i)))
      }
      return next
    })
  }

  // 打開任務詳情
  const openTaskDetail = (groupId: string, taskIndex: number) => {
    setViewingTask({ groupId, taskIndex })
  }

  // 確認修改負責人
  const confirmAssigneeEdit = async (groupId: string, taskIndex: number) => {
    const group = pendingTaskGroups.find(g => g.id === groupId)
    if (!group) return

    const task = group.tasks[taskIndex]
    const oldAssignee = task.assignee
    const newAssignee = assigneeInputValue.trim() || null

    // 更新任務
    updatePendingTask(groupId, taskIndex, { assignee: newAssignee || undefined })

    // 記錄用戶修正到學習系統
    if (oldAssignee !== newAssignee) {
      try {
        await recordNegativeExample(
          { ...task, correction_type: 'assignee', old_value: oldAssignee, new_value: newAssignee } as unknown as Record<string, unknown>,
          'user_corrected_assignee',
          group.sourceContext?.slice(0, 500)
        )
        console.log(`[學習] 記錄負責人修正: ${oldAssignee} → ${newAssignee}`)
      } catch (err) {
        console.error('記錄負責人修正失敗:', err)
      }
    }

    setEditingAssignee(null)
    setAssigneeInputValue('')
  }

  // 取消編輯負責人
  const cancelAssigneeEdit = () => {
    setEditingAssignee(null)
    setAssigneeInputValue('')
  }

  // 取得當前查看的任務
  const currentViewingTask = useMemo(() => {
    if (!viewingTask) return null
    const group = pendingTaskGroups.find(g => g.id === viewingTask.groupId)
    return group?.tasks[viewingTask.taskIndex] || null
  }, [viewingTask, pendingTaskGroups])

  // 從詳情中加入單一任務
  const addSingleTask = async (groupId: string, taskIndex: number) => {
    if (isSubmitting) return
    setIsSubmitting(true)

    const group = pendingTaskGroups.find(g => g.id === groupId)
    if (!group) {
      setIsSubmitting(false)
      return
    }
    const task = group.tasks[taskIndex]

    try {
      await addTaskToSupabase({
        title: task.title,
        description: task.description || '',
        status: 'pending',
        priority: task.priority || 'medium',
        dueDate: task.due_date ? new Date(task.due_date) : undefined,
        assignee: task.assignee || undefined,
      })
    } catch (err) {
      console.error('新增任務到 Supabase 失敗:', err)
    } finally {
      setIsSubmitting(false)
    }

    recordPositiveExample(
      task as unknown as Record<string, unknown>,
      undefined,
      group.sourceContext?.slice(0, 500)
    ).catch(console.error)

    // 記錄到已處理歷史
    addProcessedTaskGroup([{ ...task, status: 'added' }], group.sourceContext)

    // 從群組中移除該任務
    const remainingTasks = group.tasks.filter((_, i) => i !== taskIndex)
    updatePendingTaskGroup(groupId, remainingTasks)

    setViewingTask(null)
  }

  // 從詳情中跳過單一任務
  const skipSingleTask = (groupId: string, taskIndex: number) => {
    const group = pendingTaskGroups.find(g => g.id === groupId)
    if (!group) return

    const task = group.tasks[taskIndex]
    recordNegativeExample(
      task as unknown as Record<string, unknown>,
      'skipped',
      group.sourceContext?.slice(0, 500)
    ).catch(console.error)

    // 記錄到已處理歷史
    addProcessedTaskGroup([{ ...task, status: 'skipped' }], group.sourceContext)

    // 從群組中移除該任務
    const remainingTasks = group.tasks.filter((_, i) => i !== taskIndex)
    updatePendingTaskGroup(groupId, remainingTasks)

    setViewingTask(null)
  }

  // 確認加入選中的任務（針對單一群組）
  const handleConfirmGroupTasks = async (groupId: string) => {
    if (isSubmitting) return
    setIsSubmitting(true)

    const group = pendingTaskGroups.find(g => g.id === groupId)
    if (!group) {
      setIsSubmitting(false)
      return
    }

    const groupSelections = selectedTasks.get(groupId) || new Set()

    try {
      const processedTasks: ProcessedTask[] = []
      const confirmedTasks: Record<string, unknown>[] = []
      const remainingTasks: ExtractedTask[] = []

      for (let index = 0; index < group.tasks.length; index++) {
        const task = group.tasks[index]
        const isSelected = groupSelections.has(index)

        if (isSelected) {
          try {
            await addTaskToSupabase({
              title: task.title,
              description: task.description || '',
              status: 'pending',
              priority: task.priority || 'medium',
              dueDate: task.due_date ? new Date(task.due_date) : undefined,
              assignee: task.assignee || undefined,
            })
          } catch (err) {
            console.error('新增任務到 Supabase 失敗:', err)
          }
          recordPositiveExample(
            task as unknown as Record<string, unknown>,
            undefined,
            group.sourceContext?.slice(0, 500)
          ).catch(console.error)
          confirmedTasks.push(task as unknown as Record<string, unknown>)
          processedTasks.push({ ...task, status: 'added' })
        } else {
          remainingTasks.push(task)
        }
      }

      if (processedTasks.length > 0) {
        addProcessedTaskGroup(processedTasks, group.sourceContext)
      }

      // Few-shot Learning
      if (group.sourceContext && group.sourceContext.length > 100 && confirmedTasks.length > 0) {
        try {
          const learning = await conversationLearningsApi.create({
            input_content: group.sourceContext,
            input_type: 'transcript',
          })
          await conversationLearningsApi.updateAIResponse(learning.id, {
            ai_response: { type: 'tasks_extracted' },
            extracted_tasks: confirmedTasks,
          })
          await learnFromTaskFeedback({
            conversationLearningId: learning.id,
            extractedTasks: confirmedTasks,
            confirmedTasks,
            rejectedTasks: [],
          })
        } catch (err) {
          console.error('記錄 Few-shot 學習失敗:', err)
        }
      }

      // 更新群組中剩餘的任務
      updatePendingTaskGroup(groupId, remainingTasks)
      setSelectedTasks(prev => {
        const next = new Map(prev)
        next.delete(groupId)
        return next
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // 取消群組全部任務
  const handleCancelGroupTasks = (groupId: string) => {
    const group = pendingTaskGroups.find(g => g.id === groupId)
    if (!group) return

    const processedTasks: ProcessedTask[] = group.tasks.map((task) => {
      recordNegativeExample(
        task as unknown as Record<string, unknown>,
        'cancelled_all',
        group.sourceContext?.slice(0, 500)
      ).catch(console.error)
      return { ...task, status: 'skipped' as const }
    })

    addProcessedTaskGroup(processedTasks, group.sourceContext)
    removePendingTaskGroup(groupId)
    setSelectedTasks(prev => {
      const next = new Map(prev)
      next.delete(groupId)
      return next
    })
  }

  // 當前查看任務的解析內容
  const parsedDescription = currentViewingTask ? parseDescription(currentViewingTask.description || '') : null

  // 重新生成全部任務
  const handleRegenerateAll = async (groupId: string) => {
    const group = pendingTaskGroups.find(g => g.id === groupId)
    if (!group || !group.sourceContext) return

    setIsRegenerating(groupId)
    try {
      // 取得完整對話歷史，確保 AI 有足夠上下文
      const chatHistory = messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }))

      // 加入重新生成的指令
      const regeneratePrompt = `請根據我們之前的對話內容，重新萃取任務。

原始內容：
${group.sourceContext}

請重新生成任務，確保：
1. 保留對話中提到的所有細節（如負責人、課程名稱等）
2. 截止日期使用正確的年份（2025年）
3. 回傳 JSON 格式的任務列表`

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...chatHistory, { role: 'user', content: regeneratePrompt }],
        }),
      })
      const result = await response.json()
      // API 回傳格式: { success: true, data: { type, tasks, message } }
      if (result.success && result.data?.tasks && result.data.tasks.length > 0) {
        updatePendingTaskGroup(groupId, result.data.tasks)
      }
    } catch (err) {
      console.error('重新生成失敗:', err)
    } finally {
      setIsRegenerating(null)
    }
  }

  // 重新生成單一任務
  const handleRegenerateSingle = async (groupId: string, taskIndex: number) => {
    const group = pendingTaskGroups.find(g => g.id === groupId)
    if (!group || !group.sourceContext) return

    const task = group.tasks[taskIndex]
    const regenerateId = `single-${groupId}-${taskIndex}`
    setIsRegenerating(regenerateId)

    try {
      // 取得完整對話歷史，確保 AI 有足夠上下文
      const chatHistory = messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }))

      const prompt = `請根據我們之前的對話內容，重新生成這個任務的詳細資訊。

原始任務標題：${task.title}
原始負責人：${task.assignee || '未指定'}

原始內容：
${group.sourceContext}

請只回傳一個任務的 JSON，確保：
1. 保留對話中提到的細節（如負責人名稱、課程名稱等）
2. 截止日期使用 2025 年
3. 格式如下：
{
  "type": "tasks_extracted",
  "tasks": [{ "title": "...", "description": "...", "due_date": "2025-MM-DD", "assignee": "...", "priority": "...", "group": "..." }],
  "message": "已重新生成任務"
}`

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...chatHistory, { role: 'user', content: prompt }],
        }),
      })
      const result = await response.json()
      // API 回傳格式: { success: true, data: { type, tasks, message } }
      if (result.success && result.data?.tasks && result.data.tasks.length > 0) {
        const newTask = result.data.tasks[0]
        const updatedTasks = [...group.tasks]
        updatedTasks[taskIndex] = { ...updatedTasks[taskIndex], ...newTask }
        updatePendingTaskGroup(groupId, updatedTasks)
      }
    } catch (err) {
      console.error('重新生成單一任務失敗:', err)
    } finally {
      setIsRegenerating(null)
    }
  }

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
            {/* 按時間順序顯示訊息、已處理任務、待確認任務 */}
            {timeline.map((item) => {
              if (item.type === 'message') {
                return <MessageBubble key={item.data.id} message={item.data} />
              } else if (item.type === 'processedGroup') {
                // 已處理任務群組
                const group = item.data
                return (
                  <div key={group.id} className="py-2">
                    <Card className="p-4 border border-muted bg-muted/30 max-w-3xl mx-auto">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-muted-foreground">📋</span>
                        <h3 className="font-medium text-sm text-muted-foreground">
                          萃取了 {group.tasks.length} 個任務
                          <span className="ml-2 text-xs">
                            （{group.tasks.filter(t => t.status === 'added').length} 個已加入）
                          </span>
                        </h3>
                      </div>

                      <div className="space-y-2">
                        {group.tasks.map((task, taskIndex) => (
                          <div
                            key={taskIndex}
                            className={`flex items-start gap-3 p-2 rounded-lg border ${
                              task.status === 'added'
                                ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800'
                                : 'bg-gray-50 border-gray-200 dark:bg-gray-900/50 dark:border-gray-700 opacity-60'
                            }`}
                          >
                            <div className="mt-0.5 shrink-0">
                              {task.status === 'added' ? (
                                <Check className="h-4 w-4 text-green-600" />
                              ) : (
                                <X className="h-4 w-4 text-gray-400" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm ${task.status === 'skipped' ? 'line-through text-muted-foreground' : ''}`}>
                                {task.title}
                              </p>
                              <div className="flex gap-1.5 mt-1 flex-wrap">
                                {task.status === 'added' && (
                                  <Badge variant="outline" className="text-xs py-0 bg-green-100 text-green-700 border-green-300">已加入</Badge>
                                )}
                                {task.status === 'skipped' && (
                                  <Badge variant="outline" className="text-xs py-0 bg-gray-100 text-gray-500 border-gray-300">已略過</Badge>
                                )}
                                {task.priority && task.status === 'added' && (
                                  <Badge variant={task.priority === 'urgent' ? 'destructive' : task.priority === 'high' ? 'default' : 'secondary'} className="text-xs py-0">
                                    {task.priority}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => {
                                  updateTaskFeedback(group.id, taskIndex, 'positive')
                                  recordPositiveExample(task as unknown as Record<string, unknown>, undefined, group.sourceContext).catch(console.error)
                                }}
                                className={`p-1 rounded hover:bg-green-100 transition-colors ${task.feedback === 'positive' ? 'bg-green-100 text-green-600' : 'text-muted-foreground'}`}
                                title="這個任務萃取得好"
                              >
                                <ThumbsUp className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  updateTaskFeedback(group.id, taskIndex, 'negative')
                                  recordNegativeExample(task as unknown as Record<string, unknown>, 'user_feedback', group.sourceContext).catch(console.error)
                                }}
                                className={`p-1 rounded hover:bg-red-100 transition-colors ${task.feedback === 'negative' ? 'bg-red-100 text-red-600' : 'text-muted-foreground'}`}
                                title="這個任務萃取得不好"
                              >
                                <ThumbsDown className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  </div>
                )
              } else {
                // 待確認任務群組（pendingGroup）
                const group = item.data as PendingTaskGroup
                const groupSelections = selectedTasks.get(group.id) || new Set()
                return (
                  <div key={group.id} className="py-4 px-4">
                    <Card className="p-4 border-2 border-primary/50 bg-primary/5 max-w-3xl mx-auto">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span>📋</span>
                          <h3 className="font-medium">AI 建議的任務</h3>
                          <Badge variant="secondary" className="text-xs">
                            {group.tasks.length} 個
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRegenerateAll(group.id)}
                            disabled={isRegenerating === group.id || !group.sourceContext}
                            className="text-xs"
                            title="重新生成全部任務"
                          >
                            {isRegenerating === group.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleAllInGroup(group.id, group.tasks.length)}
                            className="text-xs"
                          >
                            {groupSelections.size === group.tasks.length ? '取消全選' : '全選'}
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                        {group.tasks.map((task, taskIndex) => {
                          const isSelected = groupSelections.has(taskIndex)
                          return (
                            <div
                              key={taskIndex}
                              onClick={() => openTaskDetail(group.id, taskIndex)}
                              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                isSelected
                                  ? 'bg-primary/10 border-primary/30'
                                  : 'bg-background hover:bg-muted/50 border-muted'
                              }`}
                            >
                              <button
                                onClick={(e) => toggleTask(group.id, taskIndex, e)}
                                className="mt-0.5 shrink-0"
                              >
                                {isSelected ? (
                                  <CheckSquare className="h-5 w-5 text-primary" />
                                ) : (
                                  <Square className="h-5 w-5 text-muted-foreground" />
                                )}
                              </button>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium">{task.title}</p>
                                <div className="flex gap-1.5 mt-1 flex-wrap items-center">
                                  {/* 負責人 Badge（可編輯） */}
                                  {editingAssignee?.groupId === group.id && editingAssignee?.taskIndex === taskIndex ? (
                                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                      <Input
                                        value={assigneeInputValue}
                                        onChange={(e) => setAssigneeInputValue(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            confirmAssigneeEdit(group.id, taskIndex)
                                          } else if (e.key === 'Escape') {
                                            cancelAssigneeEdit()
                                          }
                                        }}
                                        className="h-6 w-24 text-xs px-2"
                                        placeholder="輸入負責人"
                                        autoFocus
                                      />
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 w-6 p-0"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          confirmAssigneeEdit(group.id, taskIndex)
                                        }}
                                      >
                                        <Check className="h-3 w-3 text-green-600" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 w-6 p-0"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          cancelAssigneeEdit()
                                        }}
                                      >
                                        <X className="h-3 w-3 text-red-600" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <button
                                          onClick={(e) => e.stopPropagation()}
                                          className="inline-flex items-center gap-1 text-xs py-0.5 px-2 rounded-full border bg-background hover:bg-muted transition-colors"
                                        >
                                          👤 {task.assignee || '未指定'}
                                          <Pencil className="h-2.5 w-2.5 text-muted-foreground" />
                                        </button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-48 p-2" align="start">
                                        <div className="text-xs text-muted-foreground mb-2">修正負責人</div>
                                        <div className="flex items-center gap-1">
                                          <Input
                                            value={assigneeInputValue || task.assignee || ''}
                                            onChange={(e) => setAssigneeInputValue(e.target.value)}
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') {
                                                confirmAssigneeEdit(group.id, taskIndex)
                                              }
                                            }}
                                            className="h-7 text-xs"
                                            placeholder="輸入負責人"
                                            onFocus={() => setAssigneeInputValue(task.assignee || '')}
                                          />
                                          <Button
                                            size="sm"
                                            className="h-7 px-2"
                                            onClick={() => confirmAssigneeEdit(group.id, taskIndex)}
                                          >
                                            確認
                                          </Button>
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-2">
                                          修正後會記錄到 AI 學習系統
                                        </div>
                                      </PopoverContent>
                                    </Popover>
                                  )}
                                  {task.due_date && (
                                    <Badge variant="outline" className="text-xs py-0 bg-amber-50 text-amber-700 border-amber-200">
                                      <Clock className="h-2.5 w-2.5 mr-1" />
                                      {task.due_date}
                                    </Badge>
                                  )}
                                  {task.priority && (
                                    <Badge variant={task.priority === 'urgent' ? 'destructive' : task.priority === 'high' ? 'default' : 'secondary'} className="text-xs py-0">
                                      {task.priority}
                                    </Badge>
                                  )}
                                  {task.project && (
                                    <Badge variant="outline" className="text-xs py-0 bg-purple-50 text-purple-700 border-purple-200">
                                      📁 {task.project}
                                    </Badge>
                                  )}
                                  {task.group && (
                                    <Badge variant="outline" className="text-xs py-0 bg-blue-50 text-blue-700 border-blue-200">
                                      {task.group}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0 mt-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleRegenerateSingle(group.id, taskIndex)
                                  }}
                                  disabled={isRegenerating === `single-${group.id}-${taskIndex}` || !group.sourceContext}
                                  className="p-1 rounded hover:bg-muted transition-colors disabled:opacity-50"
                                  title="重新生成此任務"
                                >
                                  {isRegenerating === `single-${group.id}-${taskIndex}` ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                                  ) : (
                                    <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
                                  )}
                                </button>
                                <Eye className="h-4 w-4 text-muted-foreground" />
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      <div className="flex gap-2 mt-4 pt-3 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCancelGroupTasks(group.id)}
                          disabled={isSubmitting}
                          className="flex-1"
                        >
                          <X className="h-4 w-4 mr-1" />
                          全部略過
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleConfirmGroupTasks(group.id)}
                          disabled={isSubmitting || groupSelections.size === 0}
                          className="flex-1"
                        >
                          {isSubmitting ? (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          ) : (
                            <Check className="h-4 w-4 mr-1" />
                          )}
                          確認加入 ({groupSelections.size})
                        </Button>
                      </div>
                    </Card>
                  </div>
                )
              }
            })}

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

        {/* 任務詳情 Dialog */}
        <Dialog open={viewingTask !== null} onOpenChange={() => setViewingTask(null)}>
          <DialogContent className="max-w-2xl h-[85vh] overflow-hidden flex flex-col p-0">
            <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
              <DialogTitle className="text-lg pr-6">
                {currentViewingTask?.title}
              </DialogTitle>
            </DialogHeader>

            {currentViewingTask && (
              <>
                {/* 任務基本資訊 */}
                <div className="flex flex-wrap gap-2 px-6 pb-4 border-b shrink-0">
                  {currentViewingTask.priority && (
                    <Badge
                      variant={
                        currentViewingTask.priority === 'urgent'
                          ? 'destructive'
                          : currentViewingTask.priority === 'high'
                          ? 'default'
                          : 'secondary'
                      }
                    >
                      {currentViewingTask.priority === 'urgent' ? '緊急' :
                       currentViewingTask.priority === 'high' ? '高優先' :
                       currentViewingTask.priority === 'medium' ? '中優先' : '低優先'}
                    </Badge>
                  )}
                  {/* 負責人（可編輯） */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="inline-flex items-center gap-1 text-xs py-1 px-2.5 rounded-full border bg-background hover:bg-muted transition-colors">
                        負責人：{currentViewingTask.assignee || '未指定'}
                        <Pencil className="h-3 w-3 text-muted-foreground" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-52 p-3" align="start">
                      <div className="text-xs text-muted-foreground mb-2">修正負責人</div>
                      <div className="flex items-center gap-1">
                        <Input
                          value={assigneeInputValue || currentViewingTask.assignee || ''}
                          onChange={(e) => setAssigneeInputValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && viewingTask) {
                              confirmAssigneeEdit(viewingTask.groupId, viewingTask.taskIndex)
                            }
                          }}
                          className="h-8 text-sm"
                          placeholder="輸入負責人"
                          onFocus={() => setAssigneeInputValue(currentViewingTask.assignee || '')}
                        />
                        <Button
                          size="sm"
                          className="h-8 px-3"
                          onClick={() => viewingTask && confirmAssigneeEdit(viewingTask.groupId, viewingTask.taskIndex)}
                        >
                          確認
                        </Button>
                      </div>
                      <div className="text-xs text-muted-foreground mt-2">
                        修正後會記錄到 AI 學習系統
                      </div>
                    </PopoverContent>
                  </Popover>
                  {currentViewingTask.due_date && (
                    <Badge variant="outline">
                      <Clock className="h-3 w-3 mr-1" />
                      {currentViewingTask.due_date}
                    </Badge>
                  )}
                  {currentViewingTask.project && (
                    <Badge variant="outline">專案：{currentViewingTask.project}</Badge>
                  )}
                  {currentViewingTask.group && (
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                      組別：{currentViewingTask.group}
                    </Badge>
                  )}
                </div>

                {/* 詳細內容 - 可滾動區域 */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                  <div className="space-y-5">
                    {parsedDescription?.summary && (
                      <div className="bg-blue-50/50 dark:bg-blue-950/20 rounded-lg p-4 border-l-4 border-blue-400">
                        <h4 className="font-semibold text-sm mb-2 text-blue-700 dark:text-blue-400">任務摘要</h4>
                        <p className="text-sm leading-relaxed">{parsedDescription.summary}</p>
                      </div>
                    )}
                    {parsedDescription?.steps && parsedDescription.steps.length > 0 && (
                      <div className="bg-green-50/50 dark:bg-green-950/20 rounded-lg p-4 border-l-4 border-green-400">
                        <h4 className="font-semibold text-sm mb-2 text-green-700 dark:text-green-400">執行細節</h4>
                        <ul className="text-sm space-y-2">
                          {parsedDescription.steps.map((step, i) => (
                            <li key={i} className="leading-relaxed flex items-start gap-2">
                              <span className="text-green-600 shrink-0">•</span>
                              <span>{step.replace(/^\d+[\.\、]\s*/, '')}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {parsedDescription?.context && (
                      <div className="bg-purple-50/50 dark:bg-purple-950/20 rounded-lg p-4 border-l-4 border-purple-400">
                        <h4 className="font-semibold text-sm mb-2 text-purple-700 dark:text-purple-400">會議脈絡</h4>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{parsedDescription.context}</p>
                      </div>
                    )}
                    {parsedDescription?.quotes && parsedDescription.quotes.length > 0 && (
                      <div className="bg-amber-50/50 dark:bg-amber-950/20 rounded-lg p-4 border-l-4 border-amber-400">
                        <h4 className="font-semibold text-sm mb-2 text-amber-700 dark:text-amber-400">原文引用</h4>
                        <div className="space-y-3">
                          {parsedDescription.quotes.map((quote, i) => (
                            <div key={i} className="text-sm italic pl-3 border-l-2 border-amber-300 leading-relaxed">
                              「{quote.replace(/^[「」]/g, '').replace(/[」]$/g, '')}」
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {!parsedDescription?.summary && !parsedDescription?.steps?.length &&
                     !parsedDescription?.context && !parsedDescription?.quotes?.length &&
                     currentViewingTask.description && (
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {currentViewingTask.description}
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}

            <DialogFooter className="flex-row gap-2 px-6 py-4 border-t shrink-0 bg-background">
              <Button
                variant="outline"
                onClick={() => viewingTask && skipSingleTask(viewingTask.groupId, viewingTask.taskIndex)}
                className="flex-1"
                disabled={isSubmitting}
              >
                <X className="h-4 w-4 mr-1" />
                跳過
              </Button>
              <Button
                onClick={() => viewingTask && addSingleTask(viewingTask.groupId, viewingTask.taskIndex)}
                className="flex-1"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-1" />
                )}
                {isSubmitting ? '新增中...' : '加入任務'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div ref={scrollRef} className="h-4" />
      </div>
    </div>
  )
}
