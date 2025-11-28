'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from './useAuth'
import { chatSessionsApi, conversationsApi, type DbChatSession, type DbConversation } from './supabase-api'
import { useAppStore, type Message } from './store'

export interface ChatSession {
  id: string
  title: string
  createdAt: Date
  updatedAt: Date
}

// 將 DB 格式轉換為本地格式
const dbSessionToLocal = (db: DbChatSession): ChatSession => ({
  id: db.id,
  title: db.title,
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

export function useChatSessions() {
  const { user, isLoading: authLoading } = useAuth()
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const messages = useAppStore((state) => state.messages)
  const setMessages = useAppStore((state) => state.setMessages)
  const clearMessages = useAppStore((state) => state.clearMessages)

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
  }, [user, currentSessionId])

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

  // 切換 session
  const switchSession = useCallback(async (sessionId: string) => {
    if (sessionId === currentSessionId) return

    setCurrentSessionId(sessionId)
    clearMessages()
    await loadSessionMessages(sessionId)
  }, [currentSessionId, clearMessages, loadSessionMessages])

  // 建立新 session
  const createNewSession = useCallback(async (title = '新對話'): Promise<ChatSession | null> => {
    if (!user) return null

    try {
      const dbSession = await chatSessionsApi.create(title)
      const localSession = dbSessionToLocal(dbSession)

      setSessions(prev => [localSession, ...prev])
      setCurrentSessionId(localSession.id)
      clearMessages()

      return localSession
    } catch (error) {
      console.error('建立新對話失敗:', error)
      return null
    }
  }, [user, clearMessages])

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
      setSessions(prev => prev.filter(s => s.id !== sessionId))

      // 如果刪除的是目前的 session，切換到其他 session
      if (sessionId === currentSessionId) {
        const remainingSessions = sessions.filter(s => s.id !== sessionId)
        if (remainingSessions.length > 0) {
          await switchSession(remainingSessions[0].id)
        } else {
          setCurrentSessionId(null)
          clearMessages()
        }
      }
    } catch (error) {
      console.error('刪除對話失敗:', error)
    }
  }, [user, currentSessionId, sessions, switchSession, clearMessages])

  // 儲存訊息到目前的 session
  const saveMessage = useCallback(async (message: Message) => {
    if (!user || !currentSessionId) return

    try {
      await conversationsApi.create({
        role: message.role,
        content: message.content,
        metadata: message.metadata || null,
        session_id: currentSessionId,
      })

      // 更新 session 的 updated_at（透過 trigger 自動更新，但這裡手動更新本地狀態）
      setSessions(prev =>
        prev.map(s => s.id === currentSessionId
          ? { ...s, updatedAt: new Date() }
          : s
        ).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      )
    } catch (error) {
      console.error('儲存訊息失敗:', error)
    }
  }, [user, currentSessionId])

  // 根據第一則訊息自動產生標題
  const generateTitleFromFirstMessage = useCallback(async (firstMessage: string) => {
    if (!currentSessionId) return

    // 取前 30 個字作為標題
    const title = firstMessage.slice(0, 30) + (firstMessage.length > 30 ? '...' : '')
    await updateSessionTitle(currentSessionId, title)
  }, [currentSessionId, updateSessionTitle])

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

  return {
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
  }
}
