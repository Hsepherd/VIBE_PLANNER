import { supabase } from './supabase'

// ============ 類型定義 ============

export type InputType = 'transcript' | 'chat' | 'instruction'
export type FeedbackType = 'positive' | 'negative' | 'correction' | 'instruction'
export type InstructionType = 'style' | 'content' | 'filter' | 'priority' | 'other'

export interface ConversationLearning {
  id: string
  input_content: string
  input_type: InputType
  ai_response: Record<string, unknown> | null
  extracted_tasks: Record<string, unknown>[] | null
  user_feedback_type: FeedbackType | null
  user_feedback_content: string | null
  final_tasks: Record<string, unknown>[] | null
  learning_points: string[] | null
  quality_score: number
  is_useful_example: boolean
  session_id: string | null
  created_at: string
  updated_at: string
}

export interface UserInstruction {
  id: string
  instruction_text: string
  instruction_type: InstructionType | null
  conversation_learning_id: string | null
  learned_rule: string | null
  confidence: number
  is_active: boolean
  created_at: string
}

// ============ 對話學習 API ============

export const conversationLearningsApi = {
  // 建立新的對話學習記錄（當用戶發送逐字稿時）
  async create(data: {
    input_content: string
    input_type?: InputType
    session_id?: string
  }): Promise<ConversationLearning> {
    const { data: result, error } = await supabase
      .from('conversation_learnings')
      .insert({
        input_content: data.input_content,
        input_type: data.input_type || 'transcript',
        session_id: data.session_id,
      })
      .select()
      .single()

    if (error) throw error
    return result
  },

  // 更新 AI 回應（當 AI 萃取完成時）
  async updateAIResponse(id: string, data: {
    ai_response: Record<string, unknown>
    extracted_tasks: Record<string, unknown>[]
  }): Promise<void> {
    const { error } = await supabase
      .from('conversation_learnings')
      .update({
        ai_response: data.ai_response,
        extracted_tasks: data.extracted_tasks,
      })
      .eq('id', id)

    if (error) throw error
  },

  // 更新用戶回饋（當用戶給予回饋或指令時）
  async updateUserFeedback(id: string, data: {
    feedback_type: FeedbackType
    feedback_content?: string
    final_tasks?: Record<string, unknown>[]
    learning_points?: string[]
    quality_score?: number
  }): Promise<void> {
    const updateData: Record<string, unknown> = {
      user_feedback_type: data.feedback_type,
    }

    if (data.feedback_content) {
      updateData.user_feedback_content = data.feedback_content
    }
    if (data.final_tasks) {
      updateData.final_tasks = data.final_tasks
    }
    if (data.learning_points) {
      updateData.learning_points = data.learning_points
    }
    if (data.quality_score !== undefined) {
      updateData.quality_score = data.quality_score
    }

    const { error } = await supabase
      .from('conversation_learnings')
      .update(updateData)
      .eq('id', id)

    if (error) throw error
  },

  // 取得最佳範例（用於 Few-shot learning）
  async getBestExamples(limit = 3): Promise<ConversationLearning[]> {
    const { data, error } = await supabase
      .from('conversation_learnings')
      .select('*')
      .eq('is_useful_example', true)
      .not('final_tasks', 'is', null) // 必須有最終結果
      .gte('quality_score', 0.7) // 品質分數 >= 0.7
      .order('quality_score', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
  },

  // 取得最近的學習記錄
  async getRecent(limit = 10): Promise<ConversationLearning[]> {
    const { data, error } = await supabase
      .from('conversation_learnings')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
  },

  // 取得統計資料
  async getStats(): Promise<{
    totalLearnings: number
    positiveCount: number
    negativeCount: number
    correctionCount: number
    instructionCount: number
    avgQualityScore: number
  }> {
    const { data, error } = await supabase
      .from('conversation_learnings')
      .select('user_feedback_type, quality_score')

    if (error) throw error

    const learnings = data || []
    const totalLearnings = learnings.length
    const positiveCount = learnings.filter(l => l.user_feedback_type === 'positive').length
    const negativeCount = learnings.filter(l => l.user_feedback_type === 'negative').length
    const correctionCount = learnings.filter(l => l.user_feedback_type === 'correction').length
    const instructionCount = learnings.filter(l => l.user_feedback_type === 'instruction').length

    const avgQualityScore = totalLearnings > 0
      ? learnings.reduce((sum, l) => sum + (l.quality_score || 0.5), 0) / totalLearnings
      : 0.5

    return {
      totalLearnings,
      positiveCount,
      negativeCount,
      correctionCount,
      instructionCount,
      avgQualityScore,
    }
  },

  // 依 session_id 取得
  async getBySession(sessionId: string): Promise<ConversationLearning[]> {
    const { data, error } = await supabase
      .from('conversation_learnings')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })

    if (error) throw error
    return data || []
  },

  // 標記為不適合作為範例
  async markAsNotUseful(id: string): Promise<void> {
    const { error } = await supabase
      .from('conversation_learnings')
      .update({ is_useful_example: false })
      .eq('id', id)

    if (error) throw error
  },

  // 清除所有記錄
  async clearAll(): Promise<void> {
    const { error } = await supabase
      .from('conversation_learnings')
      .delete()
      .neq('id', '')

    if (error) throw error
  },
}

// ============ 用戶指令 API ============

export const userInstructionsApi = {
  // 建立用戶指令
  async create(data: {
    instruction_text: string
    instruction_type?: InstructionType
    conversation_learning_id?: string
    learned_rule?: string
    confidence?: number
  }): Promise<UserInstruction> {
    const { data: result, error } = await supabase
      .from('user_instructions')
      .insert({
        instruction_text: data.instruction_text,
        instruction_type: data.instruction_type || 'other',
        conversation_learning_id: data.conversation_learning_id,
        learned_rule: data.learned_rule,
        confidence: data.confidence || 0.7,
      })
      .select()
      .single()

    if (error) throw error
    return result
  },

  // 取得所有啟用的指令
  async getActive(): Promise<UserInstruction[]> {
    const { data, error } = await supabase
      .from('user_instructions')
      .select('*')
      .eq('is_active', true)
      .order('confidence', { ascending: false })

    if (error) throw error
    return data || []
  },

  // 依類型取得指令
  async getByType(type: InstructionType): Promise<UserInstruction[]> {
    const { data, error } = await supabase
      .from('user_instructions')
      .select('*')
      .eq('instruction_type', type)
      .eq('is_active', true)
      .order('confidence', { ascending: false })

    if (error) throw error
    return data || []
  },

  // 停用指令
  async deactivate(id: string): Promise<void> {
    const { error } = await supabase
      .from('user_instructions')
      .update({ is_active: false })
      .eq('id', id)

    if (error) throw error
  },

  // 更新置信度
  async updateConfidence(id: string, confidence: number): Promise<void> {
    const { error } = await supabase
      .from('user_instructions')
      .update({ confidence: Math.min(Math.max(confidence, 0), 1) })
      .eq('id', id)

    if (error) throw error
  },

  // 清除所有指令
  async clearAll(): Promise<void> {
    const { error } = await supabase
      .from('user_instructions')
      .delete()
      .neq('id', '')

    if (error) throw error
  },
}

// ============ 學習輔助函數 ============

// 分析用戶指令，提取學習規則
export function analyzeInstruction(instructionText: string): {
  type: InstructionType
  rule: string | null
} {
  const text = instructionText.toLowerCase()

  // 風格相關
  const styleKeywords = ['標題', '太長', '太短', '精簡', '詳細', '格式', '風格']
  if (styleKeywords.some(k => text.includes(k))) {
    return {
      type: 'style',
      rule: instructionText, // 直接使用原文作為規則
    }
  }

  // 內容相關
  const contentKeywords = ['不要', '不用', '要加', '要有', '包含', '省略', '描述']
  if (contentKeywords.some(k => text.includes(k))) {
    return {
      type: 'content',
      rule: instructionText,
    }
  }

  // 過濾相關
  const filterKeywords = ['跳過', '忽略', '不算', '這不是', '這類']
  if (filterKeywords.some(k => text.includes(k))) {
    return {
      type: 'filter',
      rule: instructionText,
    }
  }

  // 優先級相關
  const priorityKeywords = ['優先', '重要', '緊急', '不急']
  if (priorityKeywords.some(k => text.includes(k))) {
    return {
      type: 'priority',
      rule: instructionText,
    }
  }

  return {
    type: 'other',
    rule: instructionText,
  }
}

// 計算品質分數（根據用戶回饋）
export function calculateQualityScore(
  extractedTasksCount: number,
  confirmedTasksCount: number,
  rejectedTasksCount: number,
  hadCorrections: boolean
): number {
  if (extractedTasksCount === 0) return 0.5

  // 基礎分數：確認比例
  const confirmRatio = confirmedTasksCount / extractedTasksCount
  let score = confirmRatio

  // 如果有修正，降低分數
  if (hadCorrections) {
    score *= 0.8
  }

  // 如果全部被拒絕，分數很低
  if (confirmedTasksCount === 0 && rejectedTasksCount > 0) {
    score = 0.2
  }

  return Math.min(Math.max(score, 0), 1)
}
