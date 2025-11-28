'use client'

import { useEffect, useCallback, useRef } from 'react'
import { useAppStore, type Message } from './store'
import { conversationsApi, type DbConversation } from './supabase-api'
import { useAuth } from './useAuth'

// 將 DB 格式轉換為本地格式
const dbToLocal = (db: DbConversation): Message => ({
  id: db.id,
  role: db.role,
  content: db.content,
  timestamp: new Date(db.created_at),
  metadata: db.metadata as Message['metadata'],
})

// 將本地格式轉換為 DB 格式
const localToDb = (msg: Message): Omit<DbConversation, 'id' | 'created_at' | 'user_id'> => ({
  role: msg.role,
  content: msg.content,
  metadata: msg.metadata || null,
})

export function useConversationSync() {
  const { user, isLoading: authLoading } = useAuth()
  const messages = useAppStore((state) => state.messages)
  const setMessages = useAppStore((state) => state.setMessages)
  const clearMessages = useAppStore((state) => state.clearMessages)

  // 追蹤已同步的訊息 ID，避免重複
  const syncedIdsRef = useRef<Set<string>>(new Set())
  const isLoadingRef = useRef(false)
  const lastSyncedCountRef = useRef(0)

  // 從 Supabase 載入對話
  const loadConversations = useCallback(async () => {
    if (!user || isLoadingRef.current) return

    isLoadingRef.current = true
    try {
      const dbConversations = await conversationsApi.getRecent(100)

      if (dbConversations.length > 0) {
        const localMessages = dbConversations.map(dbToLocal)
        setMessages(localMessages)

        // 記錄已同步的 ID
        syncedIdsRef.current = new Set(localMessages.map(m => m.id))
        lastSyncedCountRef.current = localMessages.length
      }
    } catch (error) {
      console.error('載入對話失敗:', error)
    } finally {
      isLoadingRef.current = false
    }
  }, [user, setMessages])

  // 儲存新訊息到 Supabase
  const saveMessage = useCallback(async (message: Message) => {
    if (!user) return

    // 如果已經同步過，跳過
    if (syncedIdsRef.current.has(message.id)) return

    try {
      const dbConversation = await conversationsApi.create(localToDb(message))

      // 更新本地訊息的 ID 為 DB 的 ID（確保一致）
      syncedIdsRef.current.add(dbConversation.id)
    } catch (error) {
      console.error('儲存對話失敗:', error)
    }
  }, [user])

  // 清除雲端對話
  const clearCloudConversations = useCallback(async () => {
    if (!user) return

    try {
      await conversationsApi.clear()
      syncedIdsRef.current.clear()
      lastSyncedCountRef.current = 0
    } catch (error) {
      console.error('清除雲端對話失敗:', error)
    }
  }, [user])

  // 登入後自動載入對話
  useEffect(() => {
    if (user && !authLoading) {
      loadConversations()
    }
  }, [user, authLoading, loadConversations])

  // 監聽新訊息並同步
  useEffect(() => {
    if (!user || messages.length === 0) return

    // 只處理新增的訊息
    if (messages.length > lastSyncedCountRef.current) {
      const newMessages = messages.slice(lastSyncedCountRef.current)
      newMessages.forEach(msg => {
        if (!syncedIdsRef.current.has(msg.id)) {
          saveMessage(msg)
        }
      })
      lastSyncedCountRef.current = messages.length
    }
  }, [user, messages, saveMessage])

  // 攔截 clearMessages，同時清除雲端
  const clearAllConversations = useCallback(async () => {
    clearMessages()
    await clearCloudConversations()
  }, [clearMessages, clearCloudConversations])

  return {
    loadConversations,
    saveMessage,
    clearAllConversations,
    isLoading: isLoadingRef.current,
  }
}
