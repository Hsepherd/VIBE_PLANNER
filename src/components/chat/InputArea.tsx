'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useAppStore, type Message, type ExtractedTask } from '@/lib/store'
import { useChatSessionContext } from '@/lib/ChatSessionContext'
import { useConversationSummary } from '@/lib/useConversationSummary'
import { useSupabaseTasks } from '@/lib/useSupabaseTasks'
import { useAuth } from '@/lib/useAuth'
import { Send, Paperclip, X, Loader2, Image as ImageIcon, Brain } from 'lucide-react'
import { parseAIResponse } from '@/lib/utils-client'
import { learnFromUserReply } from '@/lib/few-shot-learning'

export default function InputArea() {
  const [input, setInput] = useState('')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isFirstMessageRef = useRef(true)

  const {
    addMessage,
    messages,
    isLoading,
    setIsLoading,
    addApiUsage,
    appendStreamingContent,
    clearStreamingContent,
    addPendingTaskGroup,
    processedTaskGroups,
    setLastInputContext,
  } = useAppStore()

  const {
    saveMessage,
    generateTitleFromFirstMessage,
    currentSessionId,
  } = useChatSessionContext()

  // 從 Supabase 取得真實的任務資料（用於 AI 上下文）
  const { tasks: supabaseTasks } = useSupabaseTasks()

  // 取得目前登入使用者資料
  const { user } = useAuth()

  // 使用摘要功能
  const {
    isSummarizing,
    prepareMessagesForAPI,
    clearCache,
    getStats,
  } = useConversationSummary()

  // 當 session 切換時，清除摘要快取
  useEffect(() => {
    clearCache()
  }, [currentSessionId, clearCache])

  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }, [])

  const handleRemoveImage = useCallback(() => {
    setImagePreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  const handleSubmit = async () => {
    if ((!input.trim() && !imagePreview) || isLoading || isSummarizing) return

    const userMessage = input.trim() || '請分析這張圖片'

    // 檢查是否為第一則訊息（用於自動產生標題）
    const isFirstMessage = messages.length === 0

    // 建立使用者訊息物件
    const userMessageObj: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
      metadata: imagePreview ? { imageUrl: imagePreview } : undefined,
    }

    // 加入使用者訊息到本地（UI 層保留完整歷史）
    addMessage(userMessageObj)

    // 同步儲存到雲端（必須等待完成，確保 session 已建立）
    await saveMessage(userMessageObj)

    // 如果是第一則訊息，自動產生標題
    if (isFirstMessage) {
      generateTitleFromFirstMessage(userMessage)
    }

    // 記錄輸入上下文（用於 AI 學習）
    setLastInputContext(userMessage)

    // 嘗試從用戶回覆中學習指令和偏好
    // 如果用戶的訊息包含指令性語句（例如「標題太長」、「不要萃取這類」）
    if (messages.length > 0) {
      // 只有在已有對話的情況下才嘗試學習（避免學習第一則訊息）
      learnFromUserReply(userMessage, {}).catch(err => {
        console.error('從用戶回覆學習失敗:', err)
      })
    }

    const currentImage = imagePreview
    setInput('')
    setImagePreview(null)
    setIsLoading(true)
    clearStreamingContent()

    try {
      // 準備所有歷史訊息（包含當前訊息）
      const allMessages = [...messages, userMessageObj].map((msg: Message) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }))

      // 智慧截斷 + 摘要處理
      const { messages: preparedMessages, summary } = await prepareMessagesForAPI(
        allMessages,
        currentSessionId || 'default'
      )

      // 構建要送給 API 的訊息
      let apiMessages = preparedMessages

      // 如果有摘要，加在最前面作為系統記憶
      if (summary) {
        apiMessages = [
          {
            role: 'user' as const,
            content: `【系統記憶 - 之前的對話摘要】\n${summary}\n\n---\n\n以上是之前對話的摘要，請記住這些內容。接下來是最近的對話：`,
          },
          {
            role: 'assistant' as const,
            content: '好的，我已經記住之前的對話內容了。請繼續。',
          },
          ...preparedMessages,
        ]
      }

      // 準備任務列表資料（用於 AI 上下文）
      const calendarTasks = supabaseTasks.map(t => ({
        id: t.id,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate,
        startDate: t.startDate,
        assignee: t.assignee,
        project: t.project,
        groupName: t.groupName,
        tags: t.tags,
      }))

      // 準備使用者資料（用於 AI 上下文）
      const userInfo = user ? {
        name: user.user_metadata?.name || user.email?.split('@')[0] || '使用者',
        email: user.email,
      } : null

      // 呼叫 Streaming API
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: apiMessages,
          image: currentImage,
          calendarTasks, // 傳送任務資料給 AI
          userInfo, // 傳送使用者資料給 AI
        }),
      })

      if (!response.ok) {
        throw new Error('API 請求失敗')
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('無法讀取回應')
      }

      const decoder = new TextDecoder()
      let fullContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))

              if (data.type === 'content') {
                fullContent += data.content
                appendStreamingContent(data.content)
              } else if (data.type === 'done') {
                // 解析完整內容
                const parsed = parseAIResponse(fullContent)
                const messageContent = parsed.message || fullContent

                // 建立 AI 回覆訊息物件
                const assistantMessageObj: Message = {
                  id: crypto.randomUUID(),
                  role: 'assistant',
                  content: messageContent,
                  timestamp: new Date(),
                }

                // 清除 streaming，加入完整訊息
                clearStreamingContent()
                addMessage(assistantMessageObj)

                // 同步儲存到雲端
                saveMessage(assistantMessageObj)

                // 如果有萃取出的任務，設定為待確認
                // 只過濾「已經加入任務列表」的，不過濾「還在待確認中」的
                if (parsed.type === 'tasks_extracted' && parsed.tasks && parsed.tasks.length > 0) {
                  // 只收集「已加入」（status: 'added'）的任務標題
                  // 不收集待確認的任務，這樣每次 AI 產生的任務都會完整顯示
                  const addedTitles: string[] = []
                  processedTaskGroups.forEach(group => {
                    group.tasks.forEach(task => {
                      if (task.status === 'added') {
                        addedTitles.push(task.title.trim().toLowerCase())
                      }
                    })
                  })

                  // 也檢查 Supabase 中現有的任務（從 calendarTasks 取得）
                  const existingTaskTitles = supabaseTasks.map(t => t.title.trim().toLowerCase())
                  const allAddedTitles = [...new Set([...addedTitles, ...existingTaskTitles])]

                  // 相似度檢測函數（簡單版：共同關鍵字比例）
                  const isSimilar = (title1: string, title2: string): boolean => {
                    const words1 = title1.replace(/[，。、]/g, ' ').split(/\s+/).filter(w => w.length > 1)
                    const words2 = title2.replace(/[，。、]/g, ' ').split(/\s+/).filter(w => w.length > 1)
                    const commonWords = words1.filter(w => words2.some(w2 => w2.includes(w) || w.includes(w2)))
                    return commonWords.length >= Math.min(words1.length, words2.length) * 0.5
                  }

                  // 只過濾掉「已加入任務列表」的任務
                  const newTasks = (parsed.tasks as ExtractedTask[]).filter(task => {
                    const normalizedTitle = task.title.trim().toLowerCase()
                    // 檢查是否已在任務列表中（完全重複）
                    if (allAddedTitles.includes(normalizedTitle)) return false
                    // 檢查是否與已加入的任務相似
                    const hasSimilar = allAddedTitles.some(existing => isSimilar(normalizedTitle, existing))
                    return !hasSimilar
                  })

                  // 新萃取的任務作為獨立群組加入（帶時間戳）
                  if (newTasks.length > 0) {
                    addPendingTaskGroup(newTasks, userMessage.slice(0, 500))
                  }
                }

                // 記錄 API 使用量
                if (data.usage) {
                  addApiUsage({
                    model: data.usage.model,
                    promptTokens: data.usage.promptTokens,
                    completionTokens: data.usage.completionTokens,
                  })
                }
              } else if (data.type === 'error') {
                clearStreamingContent()
                const errorMessageObj: Message = {
                  id: crypto.randomUUID(),
                  role: 'assistant',
                  content: `❌ 發生錯誤：${data.error}`,
                  timestamp: new Date(),
                }
                addMessage(errorMessageObj)
              }
            } catch {
              // 忽略解析錯誤
            }
          }
        }
      }
    } catch (error) {
      console.error('Error:', error)
      clearStreamingContent()
      const errorMessageObj: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '❌ 連線發生錯誤，請稍後再試。',
        timestamp: new Date(),
      }
      addMessage(errorMessageObj)
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Cmd/Ctrl + Enter 送出
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
    }
    // 單獨 Enter 就是換行（預設行為，不需處理）
  }

  // 取得目前對話統計
  const stats = getStats(messages.map(m => ({ role: m.role, content: m.content })))

  return (
    <div className="border-t bg-background p-3 md:p-4 pb-6 md:pb-5 safe-area-bottom">
      <div className="max-w-3xl mx-auto">
        {/* 圖片預覽 */}
        {imagePreview && (
          <div className="mb-3 relative inline-block">
            <img
              src={imagePreview}
              alt="Preview"
              className="h-16 md:h-20 rounded border object-cover"
            />
            <Button
              size="icon"
              variant="destructive"
              className="absolute -top-2 -right-2 h-6 w-6"
              onClick={handleRemoveImage}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}

        <div className="flex gap-2 items-end">
          {/* 上傳按鈕 */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageSelect}
            accept="image/*"
            className="hidden"
          />
          <Button
            variant="outline"
            size="icon"
            className="shrink-0 h-10 w-10 md:h-9 md:w-9"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading || isSummarizing}
            title="上傳圖片"
          >
            {imagePreview ? (
              <ImageIcon className="h-5 w-5 md:h-4 md:w-4 text-primary" />
            ) : (
              <Paperclip className="h-5 w-5 md:h-4 md:w-4" />
            )}
          </Button>

          {/* 輸入框 */}
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="輸入訊息或貼上會議記錄..."
            className="min-h-[44px] max-h-[150px] md:max-h-[200px] resize-none text-base"
            disabled={isLoading || isSummarizing}
          />

          {/* 送出按鈕 */}
          <Button
            onClick={handleSubmit}
            disabled={(!input.trim() && !imagePreview) || isLoading || isSummarizing}
            size="icon"
            className="shrink-0 h-10 w-10 md:h-9 md:w-9"
          >
            {isSummarizing ? (
              <Brain className="h-5 w-5 md:h-4 md:w-4 animate-pulse" />
            ) : isLoading ? (
              <Loader2 className="h-5 w-5 md:h-4 md:w-4 animate-spin" />
            ) : (
              <Send className="h-5 w-5 md:h-4 md:w-4" />
            )}
          </Button>
        </div>

        <div className="flex justify-between items-center mt-2 mb-4">
          <p className="text-xs text-muted-foreground truncate">
            <span className="hidden md:inline">Enter 換行，⌘/Ctrl + Enter 送出</span>
            <span className="md:hidden">⌘/Ctrl + Enter 送出</span>
          </p>
          {/* 記憶體使用量指示（超過 70% 時顯示） */}
          {stats.percentageUsed > 70 && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Brain className="h-3 w-3" />
              <span className={stats.percentageUsed > 90 ? 'text-orange-500' : ''}>
                記憶 {stats.percentageUsed}%
              </span>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
