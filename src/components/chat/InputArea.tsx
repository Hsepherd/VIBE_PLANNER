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
  const { tasks: supabaseTasks, refresh: refreshTasks } = useSupabaseTasks()

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

    // 在送出前刷新任務列表，確保去重邏輯使用最新資料
    await refreshTasks()

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
      let buffer = '' // 緩衝區用於處理跨 chunk 的行

      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          console.log('[InputArea] Stream 結束，fullContent 長度:', fullContent.length)
          break
        }

        const chunk = decoder.decode(value, { stream: true })
        buffer += chunk
        const lines = buffer.split('\n')

        // 保留最後一個不完整的行（如果有的話）
        buffer = lines.pop() || ''

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
                console.log('[InputArea] 完整回應長度:', fullContent.length)
                console.log('[InputArea] 解析結果 type:', parsed.type)
                console.log('[InputArea] 解析結果 tasks 數量:', parsed.tasks?.length || 0)
                console.log('[InputArea] 解析結果 message 長度:', parsed.message?.length || 0)

                // 如果有任務，顯示更多資訊（用於 debug）
                if (parsed.tasks && parsed.tasks.length > 0) {
                  console.log('[InputArea] 任務列表:', parsed.tasks.map(t => t.title))
                }

                // 如果有任務萃取，顯示完整的 Markdown 回應（包含表格）
                // 而不是只顯示 JSON 內的 message 欄位
                let messageContent = fullContent

                // 如果完整內容包含 JSON 區塊，移除它以便顯示更乾淨的訊息
                // 但如果 JSON 內的 message 足夠詳細，也可以使用它
                if (parsed.type === 'tasks_extracted' && fullContent.includes('```json')) {
                  // 保留 JSON 區塊前的 Markdown 內容作為訊息
                  const jsonStart = fullContent.indexOf('```json')
                  if (jsonStart > 50) {
                    // 有足夠的 Markdown 內容在 JSON 前面
                    messageContent = fullContent.slice(0, jsonStart).trim()
                  } else if (parsed.message && parsed.message.length > 50) {
                    // JSON 內的 message 夠詳細
                    messageContent = parsed.message
                  }
                  // 否則保留完整內容
                }

                console.log('[InputArea] 最終訊息長度:', messageContent.length)

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
                  console.log('[InputArea] 開始處理萃取的任務...')

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
                  console.log('[InputArea] 已存在的任務標題數量:', allAddedTitles.length)

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
                    if (allAddedTitles.includes(normalizedTitle)) {
                      console.log('[InputArea] 過濾掉重複任務:', task.title)
                      return false
                    }
                    // 檢查是否與已加入的任務相似
                    const hasSimilar = allAddedTitles.some(existing => isSimilar(normalizedTitle, existing))
                    if (hasSimilar) {
                      console.log('[InputArea] 過濾掉相似任務:', task.title)
                    }
                    return !hasSimilar
                  })

                  console.log('[InputArea] 過濾後的新任務數量:', newTasks.length)

                  // 新萃取的任務作為獨立群組加入（帶時間戳）
                  if (newTasks.length > 0) {
                    console.log('[InputArea] 加入待確認任務群組...')
                    addPendingTaskGroup(newTasks, userMessage.slice(0, 500))
                  } else {
                    console.log('[InputArea] 沒有新任務可加入（全被過濾）')
                  }
                } else {
                  console.log('[InputArea] 不是 tasks_extracted 類型或沒有任務')
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
            } catch (parseError) {
              console.log('[InputArea] 解析錯誤，行內容:', line.slice(0, 100))
            }
          }
        }
      }

      // 處理 buffer 中剩餘的內容（如果有 done 事件在最後）
      if (buffer.trim() && buffer.startsWith('data: ')) {
        try {
          const data = JSON.parse(buffer.slice(6))
          if (data.type === 'done') {
            console.log('[InputArea] 處理 buffer 中的 done 事件')
            // done 事件的處理邏輯已在上面的迴圈中，這裡主要是確保不會漏掉
          }
        } catch {
          console.log('[InputArea] Buffer 剩餘內容無法解析')
        }
      }

      // Stream 結束後的 fallback 處理
      // 如果 fullContent 有內容但 streamingContent 還在顯示，表示 done 事件可能沒被正確處理
      if (fullContent.length > 0) {
        const currentStreamingContent = useAppStore.getState().streamingContent
        if (currentStreamingContent && currentStreamingContent.length > 0) {
          console.log('[InputArea] Fallback 處理：Stream 結束但 done 事件似乎沒處理，手動處理...')

          // 解析完整內容
          const parsed = parseAIResponse(fullContent)
          console.log('[InputArea] Fallback 解析結果 type:', parsed.type)
          console.log('[InputArea] Fallback 解析結果 tasks 數量:', parsed.tasks?.length || 0)

          // 決定訊息內容
          let messageContent = fullContent
          if (parsed.type === 'tasks_extracted' && fullContent.includes('```json')) {
            const jsonStart = fullContent.indexOf('```json')
            if (jsonStart > 50) {
              messageContent = fullContent.slice(0, jsonStart).trim()
            }
          }

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
          saveMessage(assistantMessageObj)

          // 處理任務萃取
          if (parsed.type === 'tasks_extracted' && parsed.tasks && parsed.tasks.length > 0) {
            const existingTaskTitles = supabaseTasks.map(t => t.title.trim().toLowerCase())
            const newTasks = (parsed.tasks as ExtractedTask[]).filter(task => {
              const normalizedTitle = task.title.trim().toLowerCase()
              return !existingTaskTitles.includes(normalizedTitle)
            })
            if (newTasks.length > 0) {
              console.log('[InputArea] Fallback 加入待確認任務群組...')
              addPendingTaskGroup(newTasks, userMessage.slice(0, 500))
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
