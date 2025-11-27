'use client'

import { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useAppStore, type Message, type ExtractedTask } from '@/lib/store'
import { Send, Paperclip, X, Loader2, Image as ImageIcon } from 'lucide-react'
import { parseAIResponse } from '@/lib/utils-client'

export default function InputArea() {
  const [input, setInput] = useState('')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    addMessage,
    messages,
    isLoading,
    setIsLoading,
    addApiUsage,
    appendStreamingContent,
    clearStreamingContent,
    setPendingTasks
  } = useAppStore()

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
    if ((!input.trim() && !imagePreview) || isLoading) return

    const userMessage = input.trim() || '請分析這張圖片'

    // 加入使用者訊息
    addMessage({
      role: 'user',
      content: userMessage,
      metadata: imagePreview ? { imageUrl: imagePreview } : undefined,
    })

    const currentImage = imagePreview
    setInput('')
    setImagePreview(null)
    setIsLoading(true)
    clearStreamingContent()

    try {
      // 準備歷史訊息
      const historyMessages = messages.slice(-10).map((msg: Message) => ({
        role: msg.role,
        content: msg.content,
      }))

      // 加入當前訊息
      historyMessages.push({
        role: 'user' as const,
        content: userMessage,
      })

      // 呼叫 Streaming API
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: historyMessages,
          image: currentImage,
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

                // 清除 streaming，加入完整訊息
                clearStreamingContent()
                addMessage({
                  role: 'assistant',
                  content: messageContent,
                })

                // 如果有萃取出的任務，設定為待確認
                if (parsed.type === 'tasks_extracted' && parsed.tasks && parsed.tasks.length > 0) {
                  setPendingTasks(parsed.tasks as ExtractedTask[])
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
                addMessage({
                  role: 'assistant',
                  content: `❌ 發生錯誤：${data.error}`,
                })
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
      addMessage({
        role: 'assistant',
        content: '❌ 連線發生錯誤，請稍後再試。',
      })
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

  return (
    <div className="border-t bg-background p-3 md:p-4 safe-area-bottom">
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
            disabled={isLoading}
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
            disabled={isLoading}
          />

          {/* 送出按鈕 */}
          <Button
            onClick={handleSubmit}
            disabled={(!input.trim() && !imagePreview) || isLoading}
            size="icon"
            className="shrink-0 h-10 w-10 md:h-9 md:w-9"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 md:h-4 md:w-4 animate-spin" />
            ) : (
              <Send className="h-5 w-5 md:h-4 md:w-4" />
            )}
          </Button>
        </div>

        <p className="hidden md:block text-xs text-muted-foreground mt-2 text-center">
          Enter 換行，⌘/Ctrl + Enter 送出
        </p>
      </div>
    </div>
  )
}
