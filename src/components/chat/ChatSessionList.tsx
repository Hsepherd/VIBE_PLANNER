'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { useChatSessionContext, type ChatSession } from '@/lib/ChatSessionContext'
import { usePathname, useRouter } from 'next/navigation'
import {
  MessageSquare,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Pin,
  PinOff,
  Loader2,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { zhTW } from 'date-fns/locale'

interface ChatSessionListProps {
  collapsed?: boolean
  onSessionClick?: () => void
}

export function ChatSessionList({ collapsed = false, onSessionClick }: ChatSessionListProps) {
  const pathname = usePathname()
  const router = useRouter()
  const {
    sessions,
    currentSessionId,
    isLoading,
    switchSession,
    createNewSession,
    updateSessionTitle,
    deleteSession,
    togglePin,
  } = useChatSessionContext()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)  // 防止重複點擊

  // 處理新對話 - 加入防重複點擊
  const handleNewChat = useCallback(async () => {
    if (isCreating) return  // 防止重複點擊
    setIsCreating(true)

    try {
      // 先跳轉（樂觀 UI）
      if (pathname !== '/') {
        router.push('/')
      }
      await createNewSession()
      onSessionClick?.()
    } finally {
      setIsCreating(false)
    }
  }, [isCreating, pathname, router, createNewSession, onSessionClick])

  // 處理切換對話
  const handleSwitchSession = async (sessionId: string) => {
    await switchSession(sessionId)
    if (pathname !== '/') {
      router.push('/')
    }
    onSessionClick?.()
  }

  // 開始編輯標題
  const handleStartEdit = (session: ChatSession) => {
    setEditingId(session.id)
    setEditTitle(session.title)
  }

  // 儲存標題
  const handleSaveTitle = async () => {
    if (editingId && editTitle.trim()) {
      await updateSessionTitle(editingId, editTitle.trim())
    }
    setEditingId(null)
    setEditTitle('')
  }

  // 取消編輯
  const handleCancelEdit = () => {
    setEditingId(null)
    setEditTitle('')
  }

  // 格式化時間
  const formatTime = (date: Date) => {
    return formatDistanceToNow(date, { addSuffix: true, locale: zhTW })
  }

  // 收合狀態下只顯示新對話按鈕
  if (collapsed) {
    return (
      <div className="flex justify-center py-2">
        <button
          onClick={handleNewChat}
          disabled={isCreating}
          className={`w-10 h-10 flex items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors ${
            isCreating ? 'opacity-50 cursor-not-allowed' : 'hover:bg-primary/90'
          }`}
          title="新對話"
        >
          {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {/* 新對話按鈕 */}
      <div className="px-3 py-2">
        <button
          onClick={handleNewChat}
          disabled={isCreating}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed text-sm transition-all ${
            isCreating
              ? 'border-muted-foreground/20 text-muted-foreground/50 cursor-not-allowed'
              : 'border-muted-foreground/30 text-muted-foreground hover:text-foreground hover:border-foreground/50 hover:bg-muted/30'
          }`}
        >
          {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          <span>{isCreating ? '建立中...' : '新對話'}</span>
        </button>
      </div>

      {/* 對話列表 */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
        {isLoading ? (
          <div className="px-3 py-4 text-center text-sm text-muted-foreground">
            載入中...
          </div>
        ) : sessions.length === 0 ? (
          <div className="px-3 py-4 text-center text-sm text-muted-foreground">
            還沒有對話
          </div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              className={`
                group relative flex items-start gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all
                ${currentSessionId === session.id
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }
              `}
              onClick={() => editingId !== session.id && handleSwitchSession(session.id)}
              onMouseEnter={() => setHoveredId(session.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              {/* 圖示 */}
              <div className="shrink-0 mt-0.5">
                {session.isPinned ? (
                  <Pin className="h-4 w-4 text-primary" />
                ) : (
                  <MessageSquare className="h-4 w-4" />
                )}
              </div>

              {editingId === session.id ? (
                // 編輯模式
                <div className="flex-1 flex items-center gap-1">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="flex-1 bg-background border rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveTitle()
                      if (e.key === 'Escape') handleCancelEdit()
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleSaveTitle()
                    }}
                    className="p-1 hover:bg-muted rounded"
                  >
                    <Check className="h-3 w-3 text-green-600" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleCancelEdit()
                    }}
                    className="p-1 hover:bg-muted rounded"
                  >
                    <X className="h-3 w-3 text-red-600" />
                  </button>
                </div>
              ) : (
                // 顯示模式
                <div className="flex-1 min-w-0 pr-6">
                  <div
                    className="text-sm leading-snug line-clamp-2"
                    title={session.title}
                  >
                    {session.title}
                  </div>
                  <div className="text-xs text-muted-foreground/60 mt-1">
                    {formatTime(session.updatedAt)}
                  </div>
                </div>
              )}

              {/* 操作按鈕 - 絕對定位在右上角，hover 時顯示 */}
              {editingId !== session.id && (hoveredId === session.id || currentSessionId === session.id) && (
                <div className="absolute right-1 top-1 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-inherit rounded">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      togglePin(session.id)
                    }}
                    className="p-1.5 hover:bg-background/80 rounded"
                    title={session.isPinned ? '取消置頂' : '置頂'}
                  >
                    {session.isPinned ? (
                      <PinOff className="h-3.5 w-3.5 text-primary" />
                    ) : (
                      <Pin className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleStartEdit(session)
                    }}
                    className="p-1.5 hover:bg-background/80 rounded"
                    title="重新命名"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (confirm('確定要刪除此對話？')) {
                        deleteSession(session.id)
                      }
                    }}
                    className="p-1.5 hover:bg-background/80 rounded text-red-500"
                    title="刪除"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
