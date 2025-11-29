// AI 學習偏好系統 - 核心邏輯
import {
  preferencesApi,
  learningExamplesApi,
  feedbackLogsApi,
  type DbUserPreference,
  type PreferenceCategory,
  type ExampleType,
  type SourceAction,
  type FeedbackType,
} from './supabase-preferences'

// ============ 類型定義 ============

export interface UserPreference {
  id: string
  category: PreferenceCategory
  pattern: string
  action: string
  confidence: number
  positiveCount: number
  negativeCount: number
  isActive: boolean
}

export interface LearningStats {
  totalExamples: number
  positiveExamples: number
  negativeExamples: number
  totalFeedback: number
  thumbsUp: number
  thumbsDown: number
  totalLearningCount: number // 總學習次數（回饋 + 範例）
  lastLearningTime: Date | null // 最近一次學習時間
  recentLearnings: RecentLearning[] // 最近學習的內容
}

export interface RecentLearning {
  type: 'preference' | 'example'
  category?: string
  pattern?: string
  action?: string
  time: Date
}

// ============ 偏好管理 ============

// 從 DB 格式轉換為前端格式
function toUserPreference(db: DbUserPreference): UserPreference {
  return {
    id: db.id,
    category: db.category,
    pattern: db.pattern,
    action: db.action,
    confidence: db.confidence,
    positiveCount: db.positive_count,
    negativeCount: db.negative_count,
    isActive: db.is_active,
  }
}

// 取得所有啟用的偏好
export async function getActivePreferences(): Promise<UserPreference[]> {
  const dbPrefs = await preferencesApi.getActive()
  return dbPrefs.map(toUserPreference)
}

// 取得所有偏好
export async function getAllPreferences(): Promise<UserPreference[]> {
  const dbPrefs = await preferencesApi.getAll()
  return dbPrefs.map(toUserPreference)
}

// 取得高置信度偏好（用於 Prompt 注入）
export async function getHighConfidencePreferences(
  minConfidence = 0.6
): Promise<UserPreference[]> {
  const prefs = await getActivePreferences()
  return prefs.filter(p => p.confidence >= minConfidence)
}

// ============ 偏好 Prompt 生成 ============

// 生成偏好注入的 Prompt 片段
export async function generatePreferencePrompt(): Promise<string> {
  const prefs = await getHighConfidencePreferences(0.5)

  if (prefs.length === 0) {
    return ''
  }

  // 按類別分組
  const byCategory: Record<string, UserPreference[]> = {}
  for (const pref of prefs) {
    if (!byCategory[pref.category]) {
      byCategory[pref.category] = []
    }
    byCategory[pref.category].push(pref)
  }

  // 生成壓縮格式的偏好字串
  const rules: string[] = []

  // 優先級規則
  if (byCategory.priority) {
    const priorityRules = byCategory.priority
      .slice(0, 5)
      .map(p => `${p.pattern}→${p.action}`)
      .join(',')
    rules.push(`優先級:${priorityRules}`)
  }

  // 負責人規則
  if (byCategory.assignee) {
    const assigneeRules = byCategory.assignee
      .slice(0, 5)
      .map(p => `${p.pattern}→${p.action}`)
      .join(',')
    rules.push(`人名:${assigneeRules}`)
  }

  // 專案規則
  if (byCategory.project) {
    const projectRules = byCategory.project
      .slice(0, 5)
      .map(p => `${p.pattern}→${p.action}`)
      .join(',')
    rules.push(`專案:${projectRules}`)
  }

  // 過濾規則
  if (byCategory.filter) {
    const filterPatterns = byCategory.filter
      .slice(0, 5)
      .map(p => p.pattern)
      .join(',')
    rules.push(`跳過:${filterPatterns}`)
  }

  if (rules.length === 0) {
    return ''
  }

  return `
## 使用者偏好（根據過往互動學習，請遵守）
[規則] ${rules.join(' | ')}

如果應用了上述偏好，請在回應的 message 中加入 ✨ 標記說明。
`
}

// 判斷是否應該注入偏好
export function shouldInjectPreferences(inputText: string): boolean {
  // 短文本不注入（節省 Token）
  if (inputText.length < 300) {
    return false
  }

  // 檢查是否包含會議相關關鍵字
  const meetingKeywords = [
    '會議', '討論', '報告', '決議', '行動項目',
    '負責人', '專案', '截止', '進度', '任務',
    '逐字稿', '紀錄', '摘要'
  ]

  return meetingKeywords.some(keyword => inputText.includes(keyword))
}

// ============ 學習邏輯 ============

// 記錄正面範例（使用者確認任務）
export async function recordPositiveExample(
  originalTask: Record<string, unknown>,
  finalTask?: Record<string, unknown>,
  contextSnippet?: string
): Promise<void> {
  await learningExamplesApi.create({
    example_type: 'positive',
    source_action: finalTask ? 'edit' : 'confirm',
    original_content: originalTask,
    final_content: finalTask,
    context_snippet: contextSnippet,
  })

  // 嘗試從這個範例學習規則
  await learnFromExample('positive', originalTask, finalTask)
}

// 記錄負面範例（使用者拒絕任務）
export async function recordNegativeExample(
  rejectedTask: Record<string, unknown>,
  reason?: string,
  contextSnippet?: string
): Promise<void> {
  await learningExamplesApi.create({
    example_type: 'negative',
    source_action: 'reject',
    original_content: rejectedTask,
    context_snippet: contextSnippet,
  })

  // 記錄拒絕回饋
  if (reason) {
    await feedbackLogsApi.create({
      feedback_type: 'task_reject',
      reason,
      context: rejectedTask,
    })
  }

  // 嘗試從這個範例學習過濾規則
  await learnFilterRule(rejectedTask, reason)
}

// 記錄 👍👎 回饋
export async function recordFeedback(
  type: 'thumbs_up' | 'thumbs_down',
  messageContent: string,
  context?: Record<string, unknown>
): Promise<void> {
  await feedbackLogsApi.create({
    feedback_type: type,
    message_content: messageContent,
    context,
  })
}

// 從範例學習規則
async function learnFromExample(
  type: ExampleType,
  original: Record<string, unknown>,
  edited?: Record<string, unknown>
): Promise<void> {
  if (!edited || type !== 'positive') return

  // 檢查優先級是否被修改
  if (original.priority !== edited.priority && edited.priority) {
    // 嘗試找出觸發關鍵字
    const title = (original.title as string) || ''
    const description = (original.description as string) || ''
    const text = `${title} ${description}`.toLowerCase()

    // 常見優先級關鍵字
    const priorityKeywords: Record<string, string[]> = {
      urgent: ['緊急', '馬上', '立刻', 'asap', '今天'],
      high: ['重要', '優先', '趕快', '盡快'],
      low: ['有空', '之後', '不急', '慢慢'],
    }

    for (const [priority, keywords] of Object.entries(priorityKeywords)) {
      if (edited.priority === priority) {
        for (const keyword of keywords) {
          if (text.includes(keyword)) {
            await preferencesApi.upsert({
              category: 'priority',
              pattern: keyword,
              action: priority,
              confidence: 0.6,
            })
            break
          }
        }
      }
    }
  }

  // 檢查負責人是否被修改
  if (original.assignee !== edited.assignee && edited.assignee) {
    const originalAssignee = (original.assignee as string) || ''
    const newAssignee = edited.assignee as string

    if (originalAssignee && originalAssignee !== newAssignee) {
      await preferencesApi.upsert({
        category: 'assignee',
        pattern: originalAssignee,
        action: newAssignee,
        confidence: 0.6,
      })
    }
  }

  // 檢查專案是否被修改
  if (original.project !== edited.project && edited.project) {
    const title = (original.title as string) || ''
    const newProject = edited.project as string

    // 嘗試從標題中找出關鍵字
    const words = title.split(/\s+/)
    for (const word of words) {
      if (word.length >= 2) {
        // 檢查這個詞是否在其他任務中也對應到同一專案
        const recentExamples = await learningExamplesApi.getByType('positive', 20)
        const matchingExamples = recentExamples.filter(ex => {
          const exTitle = (ex.final_content?.title as string) || ''
          const exProject = (ex.final_content?.project as string) || ''
          return exTitle.includes(word) && exProject === newProject
        })

        if (matchingExamples.length >= 2) {
          await preferencesApi.upsert({
            category: 'project',
            pattern: word,
            action: newProject,
            confidence: 0.5 + matchingExamples.length * 0.1,
          })
          break
        }
      }
    }
  }
}

// 學習過濾規則
async function learnFilterRule(
  rejectedTask: Record<string, unknown>,
  reason?: string
): Promise<void> {
  const title = (rejectedTask.title as string) || ''

  // 常見應該過濾的任務類型
  const filterPatterns = [
    { pattern: '追蹤', keywords: ['追蹤', '跟進', '關注'] },
    { pattern: '等待', keywords: ['等待', '待回覆', '等回應'] },
    { pattern: '下次', keywords: ['下次', '之後', '以後再'] },
    { pattern: '討論', keywords: ['再討論', '待討論', '繼續討論'] },
  ]

  for (const { pattern, keywords } of filterPatterns) {
    for (const keyword of keywords) {
      if (title.includes(keyword)) {
        // 檢查是否已經有足夠的負面範例
        const recentExamples = await learningExamplesApi.getByType('negative', 20)
        const matchingCount = recentExamples.filter(ex => {
          const exTitle = (ex.original_content?.title as string) || ''
          return keywords.some(kw => exTitle.includes(kw))
        }).length

        if (matchingCount >= 2) {
          await preferencesApi.upsert({
            category: 'filter',
            pattern: pattern,
            action: 'skip',
            confidence: 0.5 + matchingCount * 0.1,
          })
        }
        break
      }
    }
  }
}

// ============ 統計 ============

// 取得學習統計
export async function getLearningStats(): Promise<LearningStats> {
  const [exampleStats, feedbackStats, prefs, recentExamples, dbPrefs] = await Promise.all([
    learningExamplesApi.getStats(),
    feedbackLogsApi.getStats(),
    getActivePreferences(),
    learningExamplesApi.getRecent(5),
    preferencesApi.getAll(),
  ])

  // 總學習次數
  const totalLearningCount = exampleStats.total + feedbackStats.total

  // 最近學習的內容：結合最近的範例和偏好
  const recentLearnings: RecentLearning[] = []

  // 加入最近的偏好規則（按更新時間排序）
  const sortedPrefs = dbPrefs
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 5)

  for (const pref of sortedPrefs) {
    recentLearnings.push({
      type: 'preference',
      category: pref.category,
      pattern: pref.pattern,
      action: pref.action,
      time: new Date(pref.updated_at),
    })
  }

  // 加入最近的學習範例
  for (const ex of recentExamples) {
    const title = (ex.original_content?.title as string) || '未知任務'
    recentLearnings.push({
      type: 'example',
      category: ex.example_type,
      pattern: title.slice(0, 30),
      action: ex.source_action,
      time: new Date(ex.created_at),
    })
  }

  // 依時間排序，取最近 5 筆
  recentLearnings.sort((a, b) => b.time.getTime() - a.time.getTime())
  const topRecentLearnings = recentLearnings.slice(0, 5)

  // 最近一次學習時間
  const lastLearningTime = topRecentLearnings.length > 0 ? topRecentLearnings[0].time : null

  return {
    totalExamples: exampleStats.total,
    positiveExamples: exampleStats.positive,
    negativeExamples: exampleStats.negative,
    totalFeedback: feedbackStats.total,
    thumbsUp: feedbackStats.thumbsUp,
    thumbsDown: feedbackStats.thumbsDown,
    totalLearningCount,
    lastLearningTime,
    recentLearnings: topRecentLearnings,
  }
}

// 重置所有學習資料
export async function resetAllLearning(): Promise<void> {
  await Promise.all([
    preferencesApi.resetAll(),
    learningExamplesApi.clear(),
    feedbackLogsApi.clear(),
  ])
}

// ============ 導出類型 ============
export type {
  PreferenceCategory,
  ExampleType,
  SourceAction,
  FeedbackType,
}
