import { supabase } from './supabase'

// ============ 類型定義 ============

export type PreferenceCategory = 'priority' | 'assignee' | 'project' | 'filter' | 'style'
export type ExampleType = 'positive' | 'negative'
export type SourceAction = 'confirm' | 'reject' | 'edit' | 'delete'
export type FeedbackType = 'thumbs_up' | 'thumbs_down' | 'task_reject'

export interface DbUserPreference {
  id: string
  category: PreferenceCategory
  pattern: string
  action: string
  confidence: number
  positive_count: number
  negative_count: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface DbLearningExample {
  id: string
  example_type: ExampleType
  source_action: SourceAction
  original_content: Record<string, unknown>
  final_content: Record<string, unknown> | null
  context_snippet: string | null
  created_at: string
}

export interface DbFeedbackLog {
  id: string
  feedback_type: FeedbackType
  reason: string | null
  message_content: string | null
  context: Record<string, unknown> | null
  created_at: string
}

// ============ 偏好 API ============

export const preferencesApi = {
  // 取得所有啟用的偏好
  async getActive(): Promise<DbUserPreference[]> {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('is_active', true)
      .order('confidence', { ascending: false })

    if (error) throw error
    return data || []
  },

  // 取得所有偏好（包含停用的）
  async getAll(): Promise<DbUserPreference[]> {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .order('confidence', { ascending: false })

    if (error) throw error
    return data || []
  },

  // 依類別取得偏好
  async getByCategory(category: PreferenceCategory): Promise<DbUserPreference[]> {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('category', category)
      .eq('is_active', true)
      .order('confidence', { ascending: false })

    if (error) throw error
    return data || []
  },

  // 建立或更新偏好（upsert by pattern）
  async upsert(preference: {
    category: PreferenceCategory
    pattern: string
    action: string
    confidence?: number
  }): Promise<DbUserPreference> {
    // 先查找是否已存在相同 pattern 的偏好
    const { data: existing } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('category', preference.category)
      .eq('pattern', preference.pattern)
      .single()

    if (existing) {
      // 更新現有偏好
      const { data, error } = await supabase
        .from('user_preferences')
        .update({
          action: preference.action,
          confidence: preference.confidence ?? existing.confidence,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single()

      if (error) throw error
      return data
    } else {
      // 建立新偏好
      const { data, error } = await supabase
        .from('user_preferences')
        .insert({
          category: preference.category,
          pattern: preference.pattern,
          action: preference.action,
          confidence: preference.confidence ?? 0.5,
        })
        .select()
        .single()

      if (error) throw error
      return data
    }
  },

  // 增加正向計數
  async incrementPositive(id: string): Promise<void> {
    const { data: current } = await supabase
      .from('user_preferences')
      .select('positive_count, negative_count')
      .eq('id', id)
      .single()

    if (current) {
      const newPositive = current.positive_count + 1
      const total = newPositive + current.negative_count
      const newConfidence = total > 0 ? newPositive / total : 0.5

      await supabase
        .from('user_preferences')
        .update({
          positive_count: newPositive,
          confidence: Math.min(newConfidence, 0.99),
        })
        .eq('id', id)
    }
  },

  // 增加負向計數
  async incrementNegative(id: string): Promise<void> {
    const { data: current } = await supabase
      .from('user_preferences')
      .select('positive_count, negative_count')
      .eq('id', id)
      .single()

    if (current) {
      const newNegative = current.negative_count + 1
      const total = current.positive_count + newNegative
      const newConfidence = total > 0 ? current.positive_count / total : 0.5

      await supabase
        .from('user_preferences')
        .update({
          negative_count: newNegative,
          confidence: Math.max(newConfidence, 0.01),
        })
        .eq('id', id)
    }
  },

  // 停用偏好
  async deactivate(id: string): Promise<void> {
    const { error } = await supabase
      .from('user_preferences')
      .update({ is_active: false })
      .eq('id', id)

    if (error) throw error
  },

  // 刪除偏好
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('user_preferences')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  // 重置所有偏好
  async resetAll(): Promise<void> {
    const { error } = await supabase
      .from('user_preferences')
      .delete()
      .neq('id', '')

    if (error) throw error
  },
}

// ============ 學習範例 API ============

export const learningExamplesApi = {
  // 建立學習範例
  async create(example: {
    example_type: ExampleType
    source_action: SourceAction
    original_content: Record<string, unknown>
    final_content?: Record<string, unknown>
    context_snippet?: string
  }): Promise<DbLearningExample> {
    const { data, error } = await supabase
      .from('learning_examples')
      .insert({
        example_type: example.example_type,
        source_action: example.source_action,
        original_content: example.original_content,
        final_content: example.final_content || null,
        context_snippet: example.context_snippet || null,
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  // 取得最近的範例
  async getRecent(limit = 20): Promise<DbLearningExample[]> {
    const { data, error } = await supabase
      .from('learning_examples')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
  },

  // 依類型取得範例
  async getByType(type: ExampleType, limit = 10): Promise<DbLearningExample[]> {
    const { data, error } = await supabase
      .from('learning_examples')
      .select('*')
      .eq('example_type', type)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
  },

  // 取得範例統計
  async getStats(): Promise<{ positive: number; negative: number; total: number }> {
    const { data, error } = await supabase
      .from('learning_examples')
      .select('example_type')

    if (error) throw error

    const examples = data || []
    const positive = examples.filter(e => e.example_type === 'positive').length
    const negative = examples.filter(e => e.example_type === 'negative').length

    return {
      positive,
      negative,
      total: examples.length,
    }
  },

  // 清除所有範例
  async clear(): Promise<void> {
    const { error } = await supabase
      .from('learning_examples')
      .delete()
      .neq('id', '')

    if (error) throw error
  },
}

// ============ 回饋記錄 API ============

export const feedbackLogsApi = {
  // 建立回饋記錄
  async create(feedback: {
    feedback_type: FeedbackType
    reason?: string
    message_content?: string
    context?: Record<string, unknown>
  }): Promise<DbFeedbackLog> {
    const { data, error } = await supabase
      .from('feedback_logs')
      .insert({
        feedback_type: feedback.feedback_type,
        reason: feedback.reason || null,
        message_content: feedback.message_content || null,
        context: feedback.context || null,
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  // 取得最近的回饋
  async getRecent(limit = 50): Promise<DbFeedbackLog[]> {
    const { data, error } = await supabase
      .from('feedback_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
  },

  // 取得回饋統計
  async getStats(): Promise<{
    thumbsUp: number
    thumbsDown: number
    taskReject: number
    total: number
  }> {
    const { data, error } = await supabase
      .from('feedback_logs')
      .select('feedback_type')

    if (error) throw error

    const logs = data || []
    return {
      thumbsUp: logs.filter(l => l.feedback_type === 'thumbs_up').length,
      thumbsDown: logs.filter(l => l.feedback_type === 'thumbs_down').length,
      taskReject: logs.filter(l => l.feedback_type === 'task_reject').length,
      total: logs.length,
    }
  },

  // 清除所有回饋
  async clear(): Promise<void> {
    const { error } = await supabase
      .from('feedback_logs')
      .delete()
      .neq('id', '')

    if (error) throw error
  },
}
