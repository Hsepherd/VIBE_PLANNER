'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { useAuth } from './useAuth'
import { chatSessionsApi, conversationsApi, type DbChatSession, type DbConversation } from './supabase-api'
import { useAppStore, type Message } from './store'

export interface ChatSession {
  id: string
  title: string
  isPinned: boolean
  createdAt: Date
  updatedAt: Date
}

interface ChatSessionContextType {
  sessions: ChatSession[]
  currentSessionId: string | null
  isLoading: boolean
  loadSessions: () => Promise<void>
  switchSession: (sessionId: string) => Promise<void>
  createNewSession: (title?: string) => Promise<ChatSession | null>
  updateSessionTitle: (sessionId: string, title: string) => Promise<void>
  deleteSession: (sessionId: string) => Promise<void>
  saveMessage: (message: Message) => Promise<void>
  generateTitleFromFirstMessage: (firstMessage: string) => Promise<void>
  clearAllSessions: () => Promise<void>
  ensureSession: () => Promise<string | null>
  togglePin: (sessionId: string) => Promise<void>
}

const ChatSessionContext = createContext<ChatSessionContextType | null>(null)

// 將 DB 格式轉換為本地格式
const dbSessionToLocal = (db: DbChatSession): ChatSession => ({
  id: db.id,
  title: db.title,
  isPinned: db.is_pinned || false,
  createdAt: new Date(db.created_at),
  updatedAt: new Date(db.updated_at),
})

// 將 DB 對話轉換為本地訊息
const dbConversationToMessage = (db: DbConversation): Message => ({
  id: db.id,
  role: db.role,
  content: db.content,
  timestamp: new Date(db.created_at),
  metadata: db.metadata as Message['metadata'],
})

export function ChatSessionProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading } = useAuth()
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  // 防止並發建立 session 的鎖
  const pendingSessionPromiseRef = useRef<Promise<ChatSession | null> | null>(null)
  // 記錄最近建立的 session ID（用於處理 state 更新延遲）
  const recentlyCreatedSessionIdRef = useRef<string | null>(null)

  const setMessages = useAppStore((state) => state.setMessages)
  const clearMessages = useAppStore((state) => state.clearMessages)
  const clearPendingTasks = useAppStore((state) => state.clearPendingTasks)

  // 載入指定 session 的訊息
  const loadSessionMessages = useCallback(async (sessionId: string) => {
    if (!user) return

    try {
      const dbConversations = await conversationsApi.getBySessionId(sessionId)
      const localMessages = dbConversations.map(dbConversationToMessage)
      setMessages(localMessages)
    } catch (error) {
      console.error('載入對話訊息失敗:', error)
    }
  }, [user, setMessages])

  // 載入所有 sessions
  const loadSessions = useCallback(async () => {
    if (!user) return

    setIsLoading(true)
    try {
      const dbSessions = await chatSessionsApi.getAll()
      const localSessions = dbSessions.map(dbSessionToLocal)
      setSessions(localSessions)

      // 如果有 sessions 且目前沒有選中的，選中最新的
      if (localSessions.length > 0 && !currentSessionId) {
        const latestSession = localSessions[0]
        setCurrentSessionId(latestSession.id)
        await loadSessionMessages(latestSession.id)
      }
    } catch (error) {
      console.error('載入對話列表失敗:', error)
    } finally {
      setIsLoading(false)
    }
  }, [user, currentSessionId, loadSessionMessages])

  // 切換 session
  const switchSession = useCallback(async (sessionId: string) => {
    if (sessionId === currentSessionId) return

    setCurrentSessionId(sessionId)
    // 清除最近建立的 session ref，因為現在切換到其他 session
    recentlyCreatedSessionIdRef.current = null
    pendingSessionPromiseRef.current = null
    clearMessages()
    clearPendingTasks() // 切換對話時清除待確認任務
    await loadSessionMessages(sessionId)
  }, [currentSessionId, clearMessages, clearPendingTasks, loadSessionMessages])

  // 建立新 session
  const createNewSession = useCallback(async (title = '新對話'): Promise<ChatSession | null> => {
    if (!user) return null

    try {
      const dbSession = await chatSessionsApi.create(title)
      const localSession = dbSessionToLocal(dbSession)

      setSessions(prev => [localSession, ...prev])
      setCurrentSessionId(localSession.id)
      clearMessages()
      clearPendingTasks() // 建立新對話時清除待確認任務

      return localSession
    } catch (error) {
      console.error('建立新對話失敗:', error)
      return null
    }
  }, [user, clearMessages, clearPendingTasks])

  // 確保有 session（如果沒有就建立一個）
  const ensureSession = useCallback(async (): Promise<string | null> => {
    if (currentSessionId) return currentSessionId

    const newSession = await createNewSession()
    return newSession?.id || null
  }, [currentSessionId, createNewSession])

  // 更新 session 標題
  const updateSessionTitle = useCallback(async (sessionId: string, title: string) => {
    if (!user) return

    try {
      await chatSessionsApi.updateTitle(sessionId, title)
      setSessions(prev =>
        prev.map(s => s.id === sessionId ? { ...s, title } : s)
      )
    } catch (error) {
      console.error('更新對話標題失敗:', error)
    }
  }, [user])

  // 刪除 session
  const deleteSession = useCallback(async (sessionId: string) => {
    if (!user) return

    try {
      await chatSessionsApi.delete(sessionId)
      const remainingSessions = sessions.filter(s => s.id !== sessionId)
      setSessions(remainingSessions)

      // 如果刪除的是目前的 session，切換到其他 session
      if (sessionId === currentSessionId) {
        if (remainingSessions.length > 0) {
          setCurrentSessionId(remainingSessions[0].id)
          await loadSessionMessages(remainingSessions[0].id)
        } else {
          setCurrentSessionId(null)
          clearMessages()
        }
      }
    } catch (error) {
      console.error('刪除對話失敗:', error)
    }
  }, [user, currentSessionId, sessions, clearMessages, loadSessionMessages])

  // 儲存訊息到目前的 session（帶並發控制）
  const saveMessage = useCallback(async (message: Message) => {
    if (!user) return

    // 確保有 session（使用鎖防止並發建立多個 session）
    // 優先使用 currentSessionId，其次使用最近建立的 session ID
    let sessionId = currentSessionId || recentlyCreatedSessionIdRef.current

    if (!sessionId) {
      // 如果已經有正在建立的 session，等待它完成
      if (pendingSessionPromiseRef.current) {
        const existingSession = await pendingSessionPromiseRef.current
        if (existingSession) {
          sessionId = existingSession.id
        }
      }

      // 仍然沒有 sessionId，建立新的
      if (!sessionId) {
        const createPromise = createNewSession()
        pendingSessionPromiseRef.current = createPromise

        const newSession = await createPromise
        // 保持 promise ref，讓後續的呼叫可以獲取結果
        // pendingSessionPromiseRef.current = null  // 不要清除

        if (!newSession) return
        sessionId = newSession.id
        // 記錄最近建立的 session ID
        recentlyCreatedSessionIdRef.current = sessionId
      }
    }

    try {
      await conversationsApi.create({
        role: message.role,
        content: message.content,
        metadata: message.metadata || null,
        session_id: sessionId,
      })

      // 更新 session 的 updated_at
      setSessions(prev =>
        prev.map(s => s.id === sessionId
          ? { ...s, updatedAt: new Date() }
          : s
        ).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      )
    } catch (error) {
      console.error('儲存訊息失敗:', error)
    }
  }, [user, currentSessionId, createNewSession])

  // 根據第一則訊息自動產生標題（使用 AI）
  const generateTitleFromFirstMessage = useCallback(async (firstMessage: string) => {
    // 優先使用 currentSessionId，其次使用最近建立的 session ID
    const sessionId = currentSessionId || recentlyCreatedSessionIdRef.current
    if (!sessionId) {
      console.log('generateTitleFromFirstMessage: 沒有 sessionId，跳過')
      return
    }

    // 格式化日期：MM/DD
    const now = new Date()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const datePrefix = `${month}/${day}`

    try {
      // 呼叫 AI API 產生標題
      const response = await fetch('/api/chat/title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: firstMessage }),
      })

      if (response.ok) {
        const data = await response.json()
        if (data.title) {
          const fullTitle = `${datePrefix} ${data.title}`
          await updateSessionTitle(sessionId, fullTitle)
          return
        }
      }
    } catch (error) {
      console.error('AI 標題產生失敗:', error)
    }

    // 如果 AI 失敗，使用簡單的截斷方式
    const simpleTitle = firstMessage.slice(0, 20) + (firstMessage.length > 20 ? '...' : '')
    await updateSessionTitle(sessionId, `${datePrefix} ${simpleTitle}`)
  }, [currentSessionId, updateSessionTitle])

  // 切換置頂狀態
  const togglePin = useCallback(async (sessionId: string) => {
    if (!user) return

    try {
      const session = sessions.find(s => s.id === sessionId)
      if (!session) return

      const newPinned = !session.isPinned
      await chatSessionsApi.togglePin(sessionId, newPinned)

      // 更新本地狀態並重新排序（置頂的在前面）
      setSessions(prev => {
        const updated = prev.map(s =>
          s.id === sessionId ? { ...s, isPinned: newPinned } : s
        )
        // 排序：置頂的在前面，然後按更新時間
        return updated.sort((a, b) => {
          if (a.isPinned !== b.isPinned) {
            return a.isPinned ? -1 : 1
          }
          return b.updatedAt.getTime() - a.updatedAt.getTime()
        })
      })
    } catch (error) {
      console.error('切換置頂失敗:', error)
    }
  }, [user, sessions])

  // 清除所有 sessions
  const clearAllSessions = useCallback(async () => {
    if (!user) return

    try {
      await chatSessionsApi.clearAll()
      setSessions([])
      setCurrentSessionId(null)
      clearMessages()
    } catch (error) {
      console.error('清除所有對話失敗:', error)
    }
  }, [user, clearMessages])

  // 登入後自動載入 sessions
  useEffect(() => {
    if (user && !authLoading) {
      loadSessions()
    }
  }, [user, authLoading, loadSessions])

  return (
    <ChatSessionContext.Provider
      value={{
        sessions,
        currentSessionId,
        isLoading,
        loadSessions,
        switchSession,
        createNewSession,
        updateSessionTitle,
        deleteSession,
        saveMessage,
        generateTitleFromFirstMessage,
        clearAllSessions,
        ensureSession,
        togglePin,
      }}
    >
      {children}
    </ChatSessionContext.Provider>
  )
}

export function useChatSessionContext() {
  const context = useContext(ChatSessionContext)
  if (!context) {
    throw new Error('useChatSessionContext must be used within a ChatSessionProvider')
  }
  return context
}
