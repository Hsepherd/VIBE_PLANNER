'use client'

import { useState, useCallback, useRef } from 'react'

// 摘要快取（同 session 不重複摘要）
interface SummaryCache {
  sessionId: string
  summary: string
  messageCount: number  // 摘要時的訊息數量
  timestamp: Date
}

// 字數門檻設定
const CHAR_THRESHOLD = 50000  // 超過 5 萬字才觸發摘要
const RECENT_MESSAGES_TO_KEEP = 4  // 保留最近 4 則完整訊息

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export function useConversationSummary() {
  const [isSummarizing, setIsSummarizing] = useState(false)
  const [lastSummary, setLastSummary] = useState<string | null>(null)
  const [summaryCount, setSummaryCount] = useState(0)  // 追蹤摘要次數
  const cacheRef = useRef<SummaryCache | null>(null)

  // 計算訊息總字數
  const calculateTotalChars = useCallback((messages: Message[]) => {
    return messages.reduce((total, msg) => total + msg.content.length, 0)
  }, [])

  // 檢查是否需要摘要
  const needsSummary = useCallback((messages: Message[]) => {
    const totalChars = calculateTotalChars(messages)
    return totalChars > CHAR_THRESHOLD && messages.length > RECENT_MESSAGES_TO_KEEP
  }, [calculateTotalChars])

  // 呼叫摘要 API
  const generateSummary = useCallback(async (messages: Message[]): Promise<string | null> => {
    try {
      setIsSummarizing(true)

      const response = await fetch('/api/chat/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
      })

      if (!response.ok) {
        throw new Error('摘要 API 失敗')
      }

      const data = await response.json()

      if (data.success && data.summary) {
        setLastSummary(data.summary)
        setSummaryCount(prev => prev + 1)  // 增加摘要次數
        return data.summary
      }

      return null
    } catch (error) {
      console.error('產生摘要失敗:', error)
      return null
    } finally {
      setIsSummarizing(false)
    }
  }, [])

  // 準備要送給 API 的訊息（核心邏輯）
  const prepareMessagesForAPI = useCallback(async (
    allMessages: Message[],
    sessionId: string
  ): Promise<{
    messages: Message[]
    summary: string | null
    usedCache: boolean
  }> => {
    const totalChars = calculateTotalChars(allMessages)

    // 如果字數沒超過門檻，直接回傳原始訊息
    if (totalChars <= CHAR_THRESHOLD || allMessages.length <= RECENT_MESSAGES_TO_KEEP) {
      return {
        messages: allMessages,
        summary: null,
        usedCache: false,
      }
    }

    // 檢查快取是否可用
    const cache = cacheRef.current
    if (
      cache &&
      cache.sessionId === sessionId &&
      cache.messageCount === allMessages.length - RECENT_MESSAGES_TO_KEEP
    ) {
      // 快取可用，使用快取的摘要
      const recentMessages = allMessages.slice(-RECENT_MESSAGES_TO_KEEP)
      return {
        messages: recentMessages,
        summary: cache.summary,
        usedCache: true,
      }
    }

    // 需要產生新摘要
    const messagesToSummarize = allMessages.slice(0, -RECENT_MESSAGES_TO_KEEP)
    const recentMessages = allMessages.slice(-RECENT_MESSAGES_TO_KEEP)

    const summary = await generateSummary(messagesToSummarize)

    if (summary) {
      // 更新快取
      cacheRef.current = {
        sessionId,
        summary,
        messageCount: messagesToSummarize.length,
        timestamp: new Date(),
      }

      return {
        messages: recentMessages,
        summary,
        usedCache: false,
      }
    }

    // 摘要失敗，回傳最近的訊息（盡量不要爆）
    // 計算可以帶多少訊息
    let charCount = 0
    let safeMessages: Message[] = []

    for (let i = allMessages.length - 1; i >= 0; i--) {
      const msgChars = allMessages[i].content.length
      if (charCount + msgChars > CHAR_THRESHOLD) {
        break
      }
      charCount += msgChars
      safeMessages.unshift(allMessages[i])
    }

    return {
      messages: safeMessages,
      summary: null,
      usedCache: false,
    }
  }, [calculateTotalChars, generateSummary])

  // 清除快取（換 session 時呼叫）
  const clearCache = useCallback(() => {
    cacheRef.current = null
    setLastSummary(null)
    setSummaryCount(0)  // 重置摘要次數
  }, [])

  // 取得目前狀態資訊
  const getStats = useCallback((messages: Message[]) => {
    const totalChars = calculateTotalChars(messages)
    const rawPercentage = Math.round((totalChars / CHAR_THRESHOLD) * 100)
    // 估算 tokens（中文約 1.5 字元/token，英文約 4 字元/token，取平均約 2.5）
    const estimatedTokens = Math.round(totalChars / 2.5)
    const maxTokens = Math.round(CHAR_THRESHOLD / 2.5) // 約 20k tokens
    const remainingTokens = Math.max(0, maxTokens - estimatedTokens)
    const usedTokens = estimatedTokens

    // 格式化 tokens 顯示（例如 45k, 12.5k）
    const formatTokens = (tokens: number) => {
      if (tokens >= 1000) {
        const k = tokens / 1000
        return k >= 10 ? `${Math.round(k)}k` : `${Math.round(k * 10) / 10}k`
      }
      return `${tokens}`
    }

    return {
      totalChars,
      threshold: CHAR_THRESHOLD,
      willTriggerSummary: totalChars > CHAR_THRESHOLD,
      percentageUsed: Math.min(rawPercentage, 100), // 上限 100%
      isOverThreshold: rawPercentage > 100,
      overflowMultiple: rawPercentage > 100 ? Math.round(rawPercentage / 100 * 10) / 10 : null, // 例如 5.4 倍
      // Claude Code 風格的 token 統計
      estimatedTokens,
      maxTokens,
      remainingTokens,
      usedTokens,
      remainingTokensDisplay: formatTokens(remainingTokens),
      usedTokensDisplay: formatTokens(usedTokens),
      maxTokensDisplay: formatTokens(maxTokens),
    }
  }, [calculateTotalChars])

  return {
    isSummarizing,
    lastSummary,
    summaryCount,
    needsSummary,
    prepareMessagesForAPI,
    clearCache,
    getStats,
    CHAR_THRESHOLD,
    RECENT_MESSAGES_TO_KEEP,
  }
}
