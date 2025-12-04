// 客戶端工具函數

// ============ 任務去重相關函數 ============

/**
 * 提取任務標題中的關鍵字
 * 過濾掉常見的動詞和助詞，保留實質內容
 */
export function extractKeywords(title: string): string[] {
  // 常見的動詞和助詞（不計入相似度）
  const stopWords = [
    '的', '了', '和', '與', '及', '等', '在', '到', '給', '向',
    '建立', '製作', '完成', '處理', '分析', '優化', '調整', '確認', '整理', '準備',
    '設定', '設計', '規劃', '安排', '追蹤', '檢查', '更新', '修改', '新增', '刪除',
    '一下', '一些', '相關', '進行', '執行', '開始', '結束',
  ]

  // 分割標題為詞彙（中文按字分割，保留連續的詞組）
  const words = title
    .toLowerCase()
    .replace(/[，。、：；！？""''（）【】《》\s]/g, ' ')
    .split(' ')
    .filter(w => w.length > 0)

  // 過濾停用詞
  return words.filter(word => !stopWords.includes(word) && word.length > 0)
}

/**
 * 計算兩個任務標題的相似度 (0-1)
 */
export function calculateSimilarity(title1: string, title2: string): number {
  const t1 = title1.trim().toLowerCase()
  const t2 = title2.trim().toLowerCase()

  // 完全相同
  if (t1 === t2) return 1

  // 提取關鍵字
  const keywords1 = extractKeywords(t1)
  const keywords2 = extractKeywords(t2)

  if (keywords1.length === 0 || keywords2.length === 0) return 0

  // 計算共同關鍵字（包含部分匹配）
  let commonCount = 0
  for (const k1 of keywords1) {
    for (const k2 of keywords2) {
      // 完全匹配或包含關係
      if (k1 === k2 || k1.includes(k2) || k2.includes(k1)) {
        commonCount++
        break
      }
    }
  }

  // 計算 Jaccard 相似度的變體
  const maxLen = Math.max(keywords1.length, keywords2.length)
  return commonCount / maxLen
}

/**
 * 檢查新任務是否與現有任務重複
 * @returns 重複的任務標題，如果沒有重複則返回 null
 */
export function findDuplicateTask(
  newTitle: string,
  existingTitles: string[],
  threshold: number = 0.5
): { isDuplicate: boolean; matchedTitle: string | null; similarity: number } {
  const normalized = newTitle.trim().toLowerCase()

  for (const existing of existingTitles) {
    const existingNorm = existing.trim().toLowerCase()

    // 完全重複
    if (normalized === existingNorm) {
      return { isDuplicate: true, matchedTitle: existing, similarity: 1 }
    }

    // 計算相似度
    const similarity = calculateSimilarity(normalized, existingNorm)
    if (similarity >= threshold) {
      return { isDuplicate: true, matchedTitle: existing, similarity }
    }
  }

  return { isDuplicate: false, matchedTitle: null, similarity: 0 }
}

/**
 * 批次檢測任務列表中的重複項
 */
export function detectDuplicatesInBatch(
  newTasks: Array<{ title: string }>,
  existingTitles: string[],
  threshold: number = 0.5
): Array<{
  task: { title: string }
  isDuplicate: boolean
  matchedTitle: string | null
  similarity: number
}> {
  return newTasks.map(task => {
    const result = findDuplicateTask(task.title, existingTitles, threshold)
    return {
      task,
      ...result,
    }
  })
}

// ============ 任務分類建議的類型 ============
export interface TaskCategorization {
  task_id: string
  task_title: string
  current_project: string | null
  suggested_project: string
  reason: string
}

// 解析 AI 回應
export function parseAIResponse(response: string): {
  type: 'tasks_extracted' | 'task_categorization' | 'chat'
  tasks?: Array<{
    title: string
    description?: string
    due_date?: string
    assignee?: string
    priority: 'low' | 'medium' | 'high' | 'urgent'
    project?: string
  }>
  suggested_projects?: Array<{
    name: string
    description?: string
  }>
  categorizations?: TaskCategorization[]
  message: string
} {
  try {
    // 嘗試從回應中提取 JSON
    const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1])
    }

    // 嘗試直接解析
    const parsed = JSON.parse(response)
    return parsed
  } catch {
    // 如果無法解析，當作一般對話
    return {
      type: 'chat',
      message: response,
    }
  }
}
