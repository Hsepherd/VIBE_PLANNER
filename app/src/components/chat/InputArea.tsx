'use client'

import { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useAppStore, type Message } from '@/lib/store'
import { Send, Paperclip, X, Loader2, Image as ImageIcon } from 'lucide-react'

export default function InputArea() {
  const [input, setInput] = useState('')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { addMessage, messages, isLoading, setIsLoading, addApiUsage } = useAppStore()

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

      // 呼叫 API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: historyMessages,
          image: currentImage,
        }),
      })

      const data = await response.json()

      if (data.success) {
        addMessage({
          role: 'assistant',
          content: data.raw || data.data?.message || '抱歉，我無法處理這個請求。',
        })

        // 記錄 API 使用量
        if (data.usage) {
          addApiUsage({
            model: data.usage.model,
            promptTokens: data.usage.promptTokens,
            completionTokens: data.usage.completionTokens,
          })
        }
      } else {
        addMessage({
          role: 'assistant',
          content: `❌ 發生錯誤：${data.error || '未知錯誤'}`,
        })
      }
    } catch (error) {
      console.error('Error:', error)
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
    <div className="border-t bg-background p-4">
      <div className="max-w-3xl mx-auto">
        {/* 圖片預覽 */}
        {imagePreview && (
          <div className="mb-3 relative inline-block">
            <img
              src={imagePreview}
              alt="Preview"
              className="h-20 rounded border object-cover"
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
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            title="上傳圖片"
          >
            {imagePreview ? (
              <ImageIcon className="h-4 w-4 text-primary" />
            ) : (
              <Paperclip className="h-4 w-4" />
            )}
          </Button>

          {/* 輸入框 */}
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="輸入訊息、貼上逐字稿，或上傳截圖..."
            className="min-h-[44px] max-h-[200px] resize-none"
            disabled={isLoading}
          />

          {/* 送出按鈕 */}
          <Button
            onClick={handleSubmit}
            disabled={(!input.trim() && !imagePreview) || isLoading}
            size="icon"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground mt-2 text-center">
          Enter 換行，⌘/Ctrl + Enter 送出
        </p>
      </div>
    </div>
  )
}
