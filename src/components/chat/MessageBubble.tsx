'use client'

import { useState, useMemo } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Message } from '@/lib/store'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { User, Copy, Check, ThumbsUp, ThumbsDown } from 'lucide-react'
import { recordFeedback } from '@/lib/preferences'

interface MessageBubbleProps {
  message: Message
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const [copied, setCopied] = useState(false)
  const [feedback, setFeedback] = useState<'positive' | 'negative' | null>(null)

  // 取得顯示的訊息內容（移除 JSON 部分）
  // 使用 useMemo 避免每次 render 都重新計算，並處理超長內容
  const displayContent = useMemo(() => {
    if (!message.content) return ''
    try {
      // 移除 JSON 區塊
      let content = message.content.replace(/```json[\s\S]*?```/g, '').trim()
      // 如果內容為空，返回原始內容（可能是純 JSON 回應）
      if (!content && message.content.trim()) {
        content = message.content.trim()
      }
      return content
    } catch {
      // 如果 regex 處理失敗，返回原始內容
      return message.content || ''
    }
  }, [message.content])

  // 複製訊息
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(displayContent)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  // 處理回饋
  const handleFeedback = async (type: 'positive' | 'negative') => {
    if (feedback === type) {
      setFeedback(null)
      return
    }
    setFeedback(type)
    try {
      const feedbackType = type === 'positive' ? 'thumbs_up' : 'thumbs_down'
      await recordFeedback(feedbackType, message.content, { messageId: message.id })
    } catch (err) {
      console.error('Failed to record feedback:', err)
    }
  }

  return (
    <div className={`group flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* 頭像 */}
      <Avatar className="h-8 w-8 shrink-0">
        {isUser ? (
          <AvatarFallback className="bg-primary text-primary-foreground">
            <User className="h-4 w-4" />
          </AvatarFallback>
        ) : (
          <>
            <AvatarImage src="/pingu.png" alt="Vibe Planner" />
            <AvatarFallback className="bg-secondary">VP</AvatarFallback>
          </>
        )}
      </Avatar>

      <div className={`flex flex-col gap-1 max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
        {/* 角色名稱 */}
        <span className="text-xs font-medium text-muted-foreground px-1">
          {isUser ? '你' : 'Vibe Planner'}
        </span>

        {/* 訊息卡片 */}
        <Card
          className={`px-4 py-3 ${
            isUser
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted'
          }`}
        >
          <p className="text-sm whitespace-pre-wrap break-words">{displayContent}</p>

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

        {/* 時間和操作按鈕 */}
        <div className="flex items-center gap-2 px-1">
          <span className="text-xs text-muted-foreground">
            {format(new Date(message.timestamp), 'HH:mm', { locale: zhTW })}
          </span>

          {/* 操作按鈕 - hover 時顯示 */}
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {/* 複製按鈕 */}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="h-3 w-3 text-green-500" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>

            {/* AI 訊息顯示回饋按鈕 */}
            {!isUser && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-6 w-6 p-0 ${
                    feedback === 'positive'
                      ? 'text-green-500'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  onClick={() => handleFeedback('positive')}
                >
                  <ThumbsUp className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-6 w-6 p-0 ${
                    feedback === 'negative'
                      ? 'text-red-500'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  onClick={() => handleFeedback('negative')}
                >
                  <ThumbsDown className="h-3 w-3" />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
