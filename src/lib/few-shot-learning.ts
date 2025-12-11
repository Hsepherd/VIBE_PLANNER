// Few-shot Learning 系統
// 從過往對話中學習，注入到 AI Prompt 中

import {
  conversationLearningsApi,
  userInstructionsApi,
  type ConversationLearning,
  type UserInstruction,
} from './supabase-learning'

// ============ Few-shot Prompt 生成 ============

/**
 * 生成 Few-shot Learning 的 Prompt 片段
 * 包含：
 * 1. 過往成功案例（逐字稿 → 任務）
 * 2. 用戶的明確指令和偏好
 * 3. 從錯誤中學到的教訓
 */
export async function generateFewShotPrompt(): Promise<string> {
  try {
    const [bestExamples, instructions] = await Promise.all([
      conversationLearningsApi.getBestExamples(2), // 取 2 個最佳範例
      userInstructionsApi.getActive(),
    ])

    const parts: string[] = []

    // 1. 用戶指令和偏好
    const instructionPrompt = generateInstructionPrompt(instructions)
    if (instructionPrompt) {
      parts.push(instructionPrompt)
    }

    // 2. 成功案例範例
    const examplesPrompt = generateExamplesPrompt(bestExamples)
    if (examplesPrompt) {
      parts.push(examplesPrompt)
    }

    if (parts.length === 0) {
      return ''
    }

    return `
## 🧠 AI 學習記憶（根據過往互動學習，請參考）

${parts.join('\n\n')}

---
`
  } catch (error) {
    console.error('生成 Few-shot Prompt 失敗:', error)
    return ''
  }
}

/**
 * 生成用戶指令的 Prompt
 */
function generateInstructionPrompt(instructions: UserInstruction[]): string {
  if (instructions.length === 0) return ''

  // 按類型分組
  const byType: Record<string, string[]> = {}
  for (const inst of instructions) {
    const type = inst.instruction_type || 'other'
    if (!byType[type]) byType[type] = []
    byType[type].push(inst.learned_rule || inst.instruction_text)
  }

  const lines: string[] = []
  lines.push('### 用戶偏好（必須遵守）')

  // 風格偏好
  if (byType.style?.length) {
    lines.push(`**萃取風格：**`)
    byType.style.slice(0, 3).forEach(rule => {
      lines.push(`- ${rule}`)
    })
  }

  // 內容偏好
  if (byType.content?.length) {
    lines.push(`**內容要求：**`)
    byType.content.slice(0, 3).forEach(rule => {
      lines.push(`- ${rule}`)
    })
  }

  // 過濾規則
  if (byType.filter?.length) {
    lines.push(`**過濾規則（不要萃取）：**`)
    byType.filter.slice(0, 3).forEach(rule => {
      lines.push(`- ${rule}`)
    })
  }

  // 優先級判斷
  if (byType.priority?.length) {
    lines.push(`**優先級判斷：**`)
    byType.priority.slice(0, 3).forEach(rule => {
      lines.push(`- ${rule}`)
    })
  }

  // 其他
  if (byType.other?.length) {
    lines.push(`**其他：**`)
    byType.other.slice(0, 2).forEach(rule => {
      lines.push(`- ${rule}`)
    })
  }

  return lines.join('\n')
}

/**
 * 生成成功案例的 Prompt
 */
function generateExamplesPrompt(examples: ConversationLearning[]): string {
  if (examples.length === 0) return ''

  const lines: string[] = []
  lines.push('### 成功案例參考（用戶滿意的萃取結果）')

  for (let i = 0; i < examples.length; i++) {
    const example = examples[i]

    // 取輸入的摘要（前 300 字）
    const inputSummary = example.input_content.slice(0, 300) +
      (example.input_content.length > 300 ? '...' : '')

    // 取最終任務
    const finalTasks = example.final_tasks || []
    if (finalTasks.length === 0) continue

    lines.push(`\n**案例 ${i + 1}：**`)
    lines.push(`輸入摘要：「${inputSummary}」`)
    lines.push(`萃取結果（${finalTasks.length} 項，用戶已確認）：`)

    // 列出任務標題
    finalTasks.slice(0, 5).forEach((task: Record<string, unknown>, idx: number) => {
      const title = task.title as string || '未知任務'
      const priority = task.priority as string || 'medium'
      lines.push(`  ${idx + 1}. [${priority}] ${title}`)
    })

    // 如果有學習重點
    if (example.learning_points?.length) {
      lines.push(`學習重點：${example.learning_points.join('、')}`)
    }
  }

  return lines.join('\n')
}

// ============ 智慧學習 ============

/**
 * 從用戶的文字回覆中學習
 * 分析用戶說的話，提取可能的指令和偏好
 */
export async function learnFromUserReply(
  userMessage: string,
  context: {
    conversationLearningId?: string
    previousAIResponse?: Record<string, unknown>
    currentTasks?: Record<string, unknown>[]
  }
): Promise<{
  hasInstruction: boolean
  instructionType?: string
  learnedRule?: string
}> {
  const text = userMessage.toLowerCase()

  // 檢測是否包含指令性語句
  const instructionPatterns = [
    // 風格相關
    { pattern: /標題.*(太長|太短|要.*精簡|要.*詳細|比較.*易懂)/i, type: 'style' },
    { pattern: /(仿照|參考|學習|照著).*(方式|風格|格式|做法)/i, type: 'style' },
    { pattern: /(產生|萃取|建立).*(都|要|應該).*(仿照|參考|學習)/i, type: 'style' },
    // 過濾相關
    { pattern: /(不要|不用).*(萃取|加入|包含)/i, type: 'filter' },
    { pattern: /(這類|這種|這樣的).*(不算|不是|跳過)/i, type: 'filter' },
    // 內容相關
    { pattern: /(要|應該|記得).*(加入|包含|寫出|新增)/i, type: 'content' },
    { pattern: /(沒有|缺少|漏掉).*(產出|萃取|加入)/i, type: 'content' },
    { pattern: /(差異|不同|區別).*(在|是)/i, type: 'content' },
    // 優先級相關
    { pattern: /(比較|更).*(重要|緊急|優先)/i, type: 'priority' },
    // 學習/知識庫相關
    { pattern: /(補強|更新|優化|改進).*(知識庫|學習|記憶)/i, type: 'other' },
    { pattern: /(學習|記住|記得).*(這個|這種|這類)/i, type: 'other' },
    { pattern: /(下次|以後|之後).*(記得|要|不要)/i, type: 'other' },
  ]

  for (const { pattern, type } of instructionPatterns) {
    if (pattern.test(text)) {
      // 儲存這個指令
      try {
        await userInstructionsApi.create({
          instruction_text: userMessage,
          instruction_type: type as 'style' | 'content' | 'filter' | 'priority' | 'other',
          conversation_learning_id: context.conversationLearningId,
          learned_rule: userMessage,
          confidence: 0.7,
        })

        return {
          hasInstruction: true,
          instructionType: type,
          learnedRule: userMessage,
        }
      } catch (error) {
        console.error('儲存用戶指令失敗:', error)
      }
    }
  }

  return { hasInstruction: false }
}

/**
 * 從任務確認/拒絕中學習
 */
export async function learnFromTaskFeedback(data: {
  conversationLearningId: string
  extractedTasks: Record<string, unknown>[]
  confirmedTasks: Record<string, unknown>[]
  rejectedTasks: Record<string, unknown>[]
  userCorrections?: string
}): Promise<void> {
  const { conversationLearningId, extractedTasks, confirmedTasks, rejectedTasks, userCorrections } = data

  // 計算品質分數
  const hadCorrections = !!userCorrections && userCorrections.length > 0
  const qualityScore = calculateQualityScore(
    extractedTasks.length,
    confirmedTasks.length,
    rejectedTasks.length,
    hadCorrections
  )

  // 提取學習重點
  const learningPoints: string[] = []

  // 分析被拒絕的任務
  if (rejectedTasks.length > 0) {
    const rejectedTitles = rejectedTasks.map(t => t.title as string).join('、')
    learningPoints.push(`被拒絕的任務：${rejectedTitles}`)
  }

  // 分析確認率
  const confirmRate = extractedTasks.length > 0
    ? Math.round((confirmedTasks.length / extractedTasks.length) * 100)
    : 0
  learningPoints.push(`確認率：${confirmRate}%`)

  // 更新對話學習記錄
  await conversationLearningsApi.updateUserFeedback(conversationLearningId, {
    feedback_type: confirmRate >= 70 ? 'positive' : confirmRate >= 30 ? 'correction' : 'negative',
    feedback_content: userCorrections,
    final_tasks: confirmedTasks,
    learning_points: learningPoints,
    quality_score: qualityScore,
  })

  // 如果用戶有修正，儲存為指令
  if (userCorrections && userCorrections.length > 10) {
    await learnFromUserReply(userCorrections, { conversationLearningId })
  }
}

/**
 * 計算品質分數
 */
function calculateQualityScore(
  extractedCount: number,
  confirmedCount: number,
  rejectedCount: number,
  hadCorrections: boolean
): number {
  if (extractedCount === 0) return 0.5

  // 基礎分數：確認比例
  let score = confirmedCount / extractedCount

  // 如果有修正，降低分數
  if (hadCorrections) {
    score *= 0.85
  }

  // 如果全部被拒絕，分數很低
  if (confirmedCount === 0 && rejectedCount > 0) {
    score = 0.2
  }

  return Math.min(Math.max(score, 0), 1)
}

// ============ 統計與分析 ============

/**
 * 取得學習系統統計
 */
export async function getLearningSystemStats(): Promise<{
  totalConversations: number
  totalInstructions: number
  averageQuality: number
  positiveRate: number
  topInstructions: string[]
  recentLearnings: Array<{
    type: 'conversation' | 'instruction'
    content: string
    time: Date
  }>
}> {
  const [convStats, instructions, recentConv] = await Promise.all([
    conversationLearningsApi.getStats(),
    userInstructionsApi.getActive(),
    conversationLearningsApi.getRecent(5),
  ])

  const totalFeedback = convStats.positiveCount + convStats.negativeCount + convStats.correctionCount
  const positiveRate = totalFeedback > 0
    ? (convStats.positiveCount / totalFeedback) * 100
    : 0

  // 整理最近學習
  const recentLearnings: Array<{ type: 'conversation' | 'instruction'; content: string; time: Date }> = []

  for (const conv of recentConv) {
    if (conv.user_feedback_content) {
      recentLearnings.push({
        type: 'conversation',
        content: conv.user_feedback_content.slice(0, 50),
        time: new Date(conv.updated_at),
      })
    }
  }

  for (const inst of instructions.slice(0, 3)) {
    recentLearnings.push({
      type: 'instruction',
      content: inst.instruction_text.slice(0, 50),
      time: new Date(inst.created_at),
    })
  }

  // 按時間排序
  recentLearnings.sort((a, b) => b.time.getTime() - a.time.getTime())

  return {
    totalConversations: convStats.totalLearnings,
    totalInstructions: instructions.length,
    averageQuality: Math.round(convStats.avgQualityScore * 100),
    positiveRate: Math.round(positiveRate),
    topInstructions: instructions.slice(0, 5).map(i => i.learned_rule || i.instruction_text),
    recentLearnings: recentLearnings.slice(0, 5),
  }
}

/**
 * 重置所有學習資料
 */
export async function resetAllLearning(): Promise<void> {
  await Promise.all([
    conversationLearningsApi.clearAll(),
    userInstructionsApi.clearAll(),
  ])
}
