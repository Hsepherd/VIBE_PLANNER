'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useAppStore, type Message, type ExtractedTask, type TaskCategorizationItem } from '@/lib/store'
import { useChatSessionContext } from '@/lib/ChatSessionContext'
import { useConversationSummary } from '@/lib/useConversationSummary'
import { useSupabaseTasks } from '@/lib/useSupabaseTasks'
import { useSupabaseProjects } from '@/lib/useSupabaseProjects'
import { useAuth } from '@/lib/useAuth'
import { Send, Paperclip, X, Loader2, Image as ImageIcon, Brain } from 'lucide-react'
import { parseAIResponse, findDuplicateTask, type TaskSearchResult } from '@/lib/utils-client'
import { learnFromUserReply } from '@/lib/few-shot-learning'
import { estimateTokens, estimateMessageTokens } from '@/lib/token-utils'

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
    setPendingCategorizations,
    setPendingTaskUpdate,
    setPendingTaskSearch,
  } = useAppStore()

  const {
    saveMessage,
    generateTitleFromFirstMessage,
    currentSessionId,
  } = useChatSessionContext()

  // 從 Supabase 取得真實的任務資料（用於 AI 上下文）
  const { tasks: supabaseTasks, refresh: refreshTasks } = useSupabaseTasks()

  // 從 Supabase 取得專案資料（用於轉換 projectId 為專案名稱，以及自動建立新專案）
  const { projects, addProject, refresh: refreshProjects } = useSupabaseProjects()

  // 取得目前登入使用者資料
  const { user } = useAuth()

  // 使用摘要功能
  const {
    isSummarizing,
    prepareMessagesForAPI,
    clearCache,
    getStats,
    summaryCount,
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
      // 將 projectId 轉換為專案名稱
      const getProjectName = (projectId?: string) => {
        if (!projectId) return undefined
        const project = projects.find(p => p.id === projectId)
        return project?.name
      }

      const calendarTasks = supabaseTasks.map(t => ({
        id: t.id,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate,
        startDate: t.startDate,
        assignee: t.assignee,
        project: getProjectName(t.projectId) || t.project, // 優先使用 projectId 對應的名稱
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
          projects: projects.filter(p => p.status === 'active').map(p => ({
            id: p.id,
            name: p.name,
            description: p.description,
            status: p.status,
          })), // 傳送專案資料給 AI
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

                // 處理 JSON 回應：可能是 ```json...``` 格式，也可能是純 JSON
                if (parsed.type === 'tasks_extracted' || parsed.type === 'task_search' || parsed.type === 'task_categorization' || parsed.type === 'task_update') {
                  if (fullContent.includes('```json')) {
                    // 有 code block 的情況：保留 JSON 區塊前的 Markdown 內容
                    const jsonStart = fullContent.indexOf('```json')
                    if (jsonStart > 50) {
                      messageContent = fullContent.slice(0, jsonStart).trim()
                    } else if (parsed.message && parsed.message.length > 50) {
                      messageContent = parsed.message
                    }
                  } else {
                    // 純 JSON 回應（沒有 code block）：使用 message 欄位
                    // 如果 message 太短或不存在，生成友善的提示訊息
                    if (parsed.message && parsed.message.length > 20) {
                      messageContent = parsed.message
                    } else if (parsed.type === 'tasks_extracted' && parsed.tasks && parsed.tasks.length > 0) {
                      messageContent = `📋 我從內容中萃取了 ${parsed.tasks.length} 個任務，請確認是否要加入：`
                    } else if (parsed.type === 'task_search' && parsed.matched_tasks && parsed.matched_tasks.length > 0) {
                      messageContent = `🔍 找到 ${parsed.matched_tasks.length} 個匹配的任務，請選擇要更新哪一個：`
                    } else if (parsed.type === 'task_categorization') {
                      messageContent = `📂 以下是任務分類建議：`
                    } else if (parsed.type === 'task_update') {
                      messageContent = `✏️ 準備更新任務，請確認：`
                    } else {
                      messageContent = parsed.message || '處理完成'
                    }
                  }
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

                // 如果有建議的新專案，自動建立
                if (parsed.type === 'tasks_extracted' && parsed.suggested_projects && parsed.suggested_projects.length > 0) {
                  console.log('[InputArea] AI 建議建立新專案:', parsed.suggested_projects.map(p => p.name))

                  // 檢查哪些專案是真正新的（不與現有專案重複）
                  const existingProjectNames = projects.map(p => p.name.toLowerCase())
                  const newProjects = parsed.suggested_projects.filter(
                    p => !existingProjectNames.includes(p.name.toLowerCase())
                  )

                  // 建立新專案
                  for (const project of newProjects) {
                    try {
                      console.log('[InputArea] 正在建立專案:', project.name)
                      await addProject({
                        name: project.name,
                        description: project.description,
                        status: 'active',
                        progress: 0,
                      })
                      console.log('[InputArea] 專案建立成功:', project.name)
                    } catch (err) {
                      console.error('[InputArea] 建立專案失敗:', project.name, err)
                    }
                  }

                  // 如果有建立新專案，重新載入專案列表
                  if (newProjects.length > 0) {
                    refreshProjects()
                  }
                }

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

                  // 使用改進的相似度檢測函數
                  const duplicateWarnings: string[] = []

                  // 過濾掉「已加入任務列表」的任務，並記錄重複警告
                  const newTasks = (parsed.tasks as ExtractedTask[]).filter(task => {
                    const result = findDuplicateTask(task.title, allAddedTitles, 0.5)

                    if (result.isDuplicate) {
                      const warningMsg = result.similarity === 1
                        ? `「${task.title}」與現有任務完全重複`
                        : `「${task.title}」與「${result.matchedTitle}」相似度 ${Math.round(result.similarity * 100)}%`
                      duplicateWarnings.push(warningMsg)
                      console.log('[InputArea] 過濾掉重複/相似任務:', task.title, '→', result.matchedTitle)
                      return false
                    }
                    return true
                  })

                  // 如果有重複警告，在 console 顯示
                  if (duplicateWarnings.length > 0) {
                    console.log('[InputArea] 重複任務警告:', duplicateWarnings)
                  }

                  console.log('[InputArea] 過濾後的新任務數量:', newTasks.length)

                  // 新萃取的任務作為獨立群組加入（帶時間戳和重複警告）
                  if (newTasks.length > 0 || duplicateWarnings.length > 0) {
                    console.log('[InputArea] 加入待確認任務群組...')
                    // 即使沒有新任務，如果有重複警告也要加入群組（用於顯示警告）
                    if (newTasks.length > 0) {
                      addPendingTaskGroup(newTasks, userMessage.slice(0, 500), duplicateWarnings.length > 0 ? duplicateWarnings : undefined)
                    } else if (duplicateWarnings.length > 0) {
                      // 只有警告沒有新任務時，仍然顯示警告訊息
                      console.log('[InputArea] 所有任務都被過濾，顯示重複警告')
                    }
                  } else {
                    console.log('[InputArea] 沒有新任務可加入（全被過濾）')
                  }
                } else if (parsed.type === 'task_categorization' && parsed.categorizations && parsed.categorizations.length > 0) {
                  // 處理任務分類建議
                  console.log('[InputArea] 收到任務分類建議:', parsed.categorizations.length, '個')

                  // 將分類建議轉換為 store 需要的格式（預設全選）
                  const categorizationItems: TaskCategorizationItem[] = parsed.categorizations.map(cat => ({
                    task_id: cat.task_id,
                    task_title: cat.task_title,
                    current_project: cat.current_project,
                    suggested_project: cat.suggested_project,
                    reason: cat.reason,
                    selected: true, // 預設選中
                  }))

                  // 設定待確認分類
                  setPendingCategorizations({
                    id: crypto.randomUUID(),
                    timestamp: new Date(),
                    categorizations: categorizationItems,
                    suggested_projects: parsed.suggested_projects || [],
                  })
                } else if (parsed.type === 'task_search' && parsed.matched_tasks && parsed.matched_tasks.length > 0) {
                  // 處理任務搜尋結果 - 讓用戶選擇要更新哪個任務
                  console.log('[InputArea] 收到任務搜尋結果:', parsed.matched_tasks.length, '個匹配')

                  // 設定待確認搜尋（讓用戶選擇）
                  setPendingTaskSearch({
                    id: crypto.randomUUID(),
                    timestamp: new Date(),
                    search_query: parsed.search_query || userMessage,
                    matched_tasks: parsed.matched_tasks as TaskSearchResult[],
                    intended_updates: parsed.intended_updates || {},
                    update_reason: parsed.update_reason || '根據您的要求更新任務',
                  })
                } else if (parsed.type === 'task_update' && parsed.task_id && parsed.updates) {
                  // 處理任務更新請求（舊版流程，保留向下相容）
                  console.log('[InputArea] 收到任務更新請求:', parsed.task_id, parsed.task_title)

                  // 設定待確認更新
                  setPendingTaskUpdate({
                    id: crypto.randomUUID(),
                    timestamp: new Date(),
                    task_id: parsed.task_id,
                    task_title: parsed.task_title || '未知任務',
                    updates: parsed.updates,
                    reason: parsed.reason || '根據您的要求更新任務',
                  })
                } else {
                  console.log('[InputArea] 不是 tasks_extracted、task_categorization 或 task_update 類型')
                }

                // 記錄 API 使用量
                // 優先使用 API 回傳的 usage，否則使用估算值
                // （OpenAI Streaming API 有時不會回傳 usage 資料）
                const promptTokens = data.usage?.promptTokens || estimateMessageTokens(apiMessages)
                const completionTokens = data.usage?.completionTokens || estimateTokens(fullContent)

                addApiUsage({
                  model: data.usage?.model || 'gpt-4.1-mini',
                  promptTokens,
                  completionTokens,
                })
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

          // 決定訊息內容（與主邏輯相同）
          let messageContent = fullContent
          if (parsed.type === 'tasks_extracted' || parsed.type === 'task_search' || parsed.type === 'task_categorization' || parsed.type === 'task_update') {
            if (fullContent.includes('```json')) {
              const jsonStart = fullContent.indexOf('```json')
              if (jsonStart > 50) {
                messageContent = fullContent.slice(0, jsonStart).trim()
              } else if (parsed.message && parsed.message.length > 50) {
                messageContent = parsed.message
              }
            } else {
              // 純 JSON 回應
              if (parsed.message && parsed.message.length > 20) {
                messageContent = parsed.message
              } else if (parsed.type === 'tasks_extracted' && parsed.tasks && parsed.tasks.length > 0) {
                messageContent = `📋 我從內容中萃取了 ${parsed.tasks.length} 個任務，請確認是否要加入：`
              } else {
                messageContent = parsed.message || '處理完成'
              }
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
          {/* 記憶使用量顯示 */}
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            {summaryCount > 0 && (
              <span className="text-blue-500 mr-1">
                已整理 {summaryCount} 次
              </span>
            )}
            <span className={
              stats.percentageUsed >= 100
                ? 'text-red-500 font-medium'
                : stats.percentageUsed > 90
                  ? 'text-orange-500'
                  : stats.percentageUsed > 70
                    ? 'text-yellow-600'
                    : ''
            }>
              {isSummarizing
                ? '🧠 整理記憶中...'
                : stats.percentageUsed >= 100
                  ? '🧠 下次發送將自動整理記憶'
                  : `◐ ${stats.percentageUsed}% used`
              }
            </span>
          </p>
        </div>
      </div>
    </div>
  )
}
