'use client'

import { useRef, useEffect } from 'react'
import { useAppStore, type AppState, type Message } from '@/lib/store'
import MessageBubble from './MessageBubble'

export default function ChatWindow() {
  const messages = useAppStore((state: AppState) => state.messages)
  const scrollRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // 自動捲動到最新訊息
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto p-4"
    >
      <div className="space-y-4 max-w-3xl mx-auto">
        {messages.length === 0 ? (
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
          messages.map((message: Message) => (
            <MessageBubble key={message.id} message={message} />
          ))
        )}
        <div ref={scrollRef} />
      </div>
    </div>
  )
}
