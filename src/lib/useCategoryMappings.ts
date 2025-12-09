'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  categoryMappingsApi,
  taskCategoriesApi,
  DEFAULT_CATEGORIES,
  type DbCategoryMapping,
  type DbTaskCategory
} from './supabase-api'
import type { Task } from './useSupabaseTasks'

// 本地分類快取（用於即時查詢）
let cachedMappings: DbCategoryMapping[] = []

// AI 自動分類關鍵字（當知識庫找不到時使用）
const AI_CLASSIFICATION_RULES: Array<{
  category: string
  keywords: string[]
  weight: number // 權重，越高越優先
}> = [
  {
    category: '銷售業務',
    weight: 10,
    keywords: [
      '銷售', '業務', '客戶', '報價', '簽約', '成交', '訂單', '營收', '業績',
      '推銷', '拜訪', '提案', '合作', '商機', '潛在客戶', 'sales', 'deal',
      '談判', '議價', '跟進', '開發', '成單', '轉化', '漏斗'
    ]
  },
  {
    category: '內部優化',
    weight: 8,
    keywords: [
      '系統', '優化', '流程', '內部', '合約', '文件', '整理', '規劃', '架構',
      '重構', '改善', '效率', '自動化', '工具', '設定', '老師', '教材',
      '課程設計', '後台', '管理', '建置', '開發', '程式', '技術', '維護',
      '部署', '測試', 'bug', '修復'
    ]
  },
  {
    category: '自我提升',
    weight: 9,
    keywords: [
      '學習', '閱讀', '靈修', '冥想', '運動', '健身', '成長', '進修', '課程',
      '書', '培訓', '反思', '日記', '習慣', '目標', '英文', '技能', '禱告',
      '讀書', '複習', '練習', '訓練', '早起', '晨間', '覺察', '正念'
    ]
  },
  {
    category: '客戶服務',
    weight: 7,
    keywords: [
      '客服', '回覆', '支援', '問題', '處理', '溝通', '追蹤', '反饋', '售後',
      '維護', '諮詢', '答覆', '協助', '服務', '投訴', '解決'
    ]
  },
  {
    category: '行政庶務',
    weight: 5,
    keywords: [
      '會議', '行政', '報表', '記錄', '歸檔', '請款', '報銷', '採購', '庶務',
      '雜事', '繳費', '帳單', '發票', '文書', '郵件', '信件', '打掃', '整理'
    ]
  }
]

// AI 智能分類函數
function aiClassify(text: string): { category: string; confidence: number } {
  const lowerText = text.toLowerCase()
  let bestMatch = { category: '其他', confidence: 0 }

  for (const rule of AI_CLASSIFICATION_RULES) {
    let matchCount = 0
    for (const keyword of rule.keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        matchCount++
      }
    }

    if (matchCount > 0) {
      // 計算信心度：匹配數量 * 權重
      const confidence = matchCount * rule.weight
      if (confidence > bestMatch.confidence) {
        bestMatch = { category: rule.category, confidence }
      }
    }
  }

  return bestMatch
}

export function useCategoryMappings() {
  const [mappings, setMappings] = useState<DbCategoryMapping[]>([])
  const [categories, setCategories] = useState<DbTaskCategory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 載入分類對應和分類定義
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const [mappingsData, categoriesData] = await Promise.all([
        categoryMappingsApi.getAll().catch(() => []),
        taskCategoriesApi.getAll().catch(() => []),
      ])

      setMappings(mappingsData)
      cachedMappings = mappingsData
      setCategories(categoriesData)
    } catch (err) {
      console.error('載入分類資料失敗:', err)
      setError(err instanceof Error ? err.message : '載入失敗')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 初始載入
  useEffect(() => {
    loadData()
  }, [loadData])

  // 取得分類列表（有自訂就用自訂，沒有就用預設）
  const categoryList = useMemo(() => {
    if (categories.length > 0) {
      return categories.map(c => ({
        name: c.name,
        color: c.color,
        icon: c.icon,
      }))
    }
    return DEFAULT_CATEGORIES.map(c => ({
      name: c.name,
      color: c.color,
      icon: c.icon,
    }))
  }, [categories])

  // 根據任務標題分類（同步版本，使用快取）
  const classifyTask = useCallback((task: Task): string => {
    const title = task.title.toLowerCase()
    const description = (task.description || '').toLowerCase()
    const tags = (task.tags || []).join(' ').toLowerCase()
    const text = `${title} ${description} ${tags}`

    // 先查知識庫（按優先級排序）
    for (const mapping of cachedMappings) {
      const pattern = mapping.pattern.toLowerCase()

      switch (mapping.match_type) {
        case 'exact':
          if (title === pattern) return mapping.category
          break
        case 'starts_with':
          if (title.startsWith(pattern)) return mapping.category
          break
        case 'contains':
          if (text.includes(pattern)) return mapping.category
          break
      }
    }

    // 知識庫找不到，使用 AI 智能分類
    const aiResult = aiClassify(text)
    return aiResult.category
  }, [])

  // 學習新的分類（手動修正時呼叫）
  const learnCategory = useCallback(async (
    taskTitle: string,
    category: string,
    matchType: 'exact' | 'contains' | 'starts_with' = 'exact'
  ) => {
    try {
      const newMapping = await categoryMappingsApi.upsert(taskTitle, category, matchType, 10)
      setMappings(prev => {
        const updated = prev.filter(m => m.pattern !== taskTitle)
        return [newMapping, ...updated]
      })
      cachedMappings = [newMapping, ...cachedMappings.filter(m => m.pattern !== taskTitle)]
      return newMapping
    } catch (err) {
      console.error('學習分類失敗:', err)
      throw err
    }
  }, [])

  // 批次學習（用於初始化知識庫）
  const bulkLearn = useCallback(async (
    items: Array<{ pattern: string; category: string; matchType?: 'exact' | 'contains' | 'starts_with' }>
  ) => {
    try {
      const newMappings = await categoryMappingsApi.bulkInsert(items)
      await loadData() // 重新載入
      return newMappings
    } catch (err) {
      console.error('批次學習失敗:', err)
      throw err
    }
  }, [loadData])

  // 刪除分類對應
  const deleteMapping = useCallback(async (id: string) => {
    try {
      await categoryMappingsApi.delete(id)
      setMappings(prev => prev.filter(m => m.id !== id))
      cachedMappings = cachedMappings.filter(m => m.id !== id)
    } catch (err) {
      console.error('刪除分類對應失敗:', err)
      throw err
    }
  }, [])

  // 重新載入
  const refresh = useCallback(async () => {
    await loadData()
  }, [loadData])

  return {
    mappings,
    categories: categoryList,
    isLoading,
    error,
    classifyTask,
    learnCategory,
    bulkLearn,
    deleteMapping,
    refresh,
  }
}

// 取得分類顏色（靜態函數）
export function getCategoryColor(categoryName: string): string {
  const cat = DEFAULT_CATEGORIES.find(c => c.name === categoryName)
  return cat?.color || '#9CA3AF'
}
