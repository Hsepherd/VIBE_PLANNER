'use client'

import { createClient } from './supabase-client'

// 取得 Supabase client
const getSupabase = () => createClient()

// 取得目前使用者 ID（允許匿名使用者）
const getCurrentUserId = async (): Promise<string | null> => {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id || null
}

// ============ 類型定義 ============

export interface DbProject {
  id: string
  name: string
  description: string | null
  status: 'active' | 'completed' | 'archived'
  progress: number
  user_id?: string
  created_at: string
  updated_at: string
}

// 例行性任務設定
export interface RecurrenceConfig {
  interval?: number         // 間隔數量（例如每 1 天、每 2 週）
  weekdays?: number[]       // 週幾執行（1=週一, 7=週日），僅 weekly 使用
  monthDay?: number         // 每月幾號，僅 monthly 使用
  endDate?: string          // 結束日期（可選）
  maxOccurrences?: number   // 最大次數（可選）
}

export interface DbTask {
  id: string
  title: string
  description: string | null
  notes: string | null  // 備註欄位
  status: 'pending' | 'in_progress' | 'completed' | 'on_hold'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  start_date: string | null
  due_date: string | null
  assignee: string | null
  project_id: string | null
  tags: string[] | null
  group_name: string | null
  user_id?: string
  created_at: string
  updated_at: string
  completed_at: string | null
  // 例行性任務欄位
  recurrence_type: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | null
  recurrence_config: RecurrenceConfig | null
  parent_task_id: string | null
  is_recurring_instance: boolean
}

export interface DbConversation {
  id: string
  role: 'user' | 'assistant'
  content: string
  metadata: Record<string, unknown> | null
  user_id?: string
  session_id?: string
  created_at: string
}

export interface DbChatSession {
  id: string
  user_id: string
  title: string
  is_pinned: boolean
  created_at: string
  updated_at: string
}

export interface DbApiUsage {
  id: string
  model: string
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  cost: number
  user_id?: string
  created_at: string
}

// ============ 專案 API ============

export const projectsApi = {
  // 取得所有專案
  async getAll(): Promise<DbProject[]> {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  // 取得單一專案
  async getById(id: string): Promise<DbProject | null> {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  },

  // 建立專案
  async create(project: Omit<DbProject, 'id' | 'created_at' | 'updated_at' | 'user_id'>): Promise<DbProject> {
    const supabase = getSupabase()
    const userId = await getCurrentUserId()
    const { data, error } = await supabase
      .from('projects')
      .insert({ ...project, user_id: userId })
      .select()
      .single()

    if (error) throw error
    return data
  },

  // 更新專案
  async update(id: string, updates: Partial<DbProject>): Promise<DbProject> {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  // 刪除專案
  async delete(id: string): Promise<void> {
    const supabase = getSupabase()
    const { error } = await supabase.from('projects').delete().eq('id', id)
    if (error) throw error
  },
}

// ============ 任務 API ============

export const tasksApi = {
  // 取得所有任務
  async getAll(): Promise<DbTask[]> {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  // 取得單一任務
  async getById(id: string): Promise<DbTask | null> {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  },

  // 取得專案的任務
  async getByProjectId(projectId: string): Promise<DbTask[]> {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  // 建立任務
  async create(
    task: Omit<DbTask, 'id' | 'created_at' | 'updated_at' | 'completed_at' | 'user_id'>
  ): Promise<DbTask> {
    const supabase = getSupabase()
    const userId = await getCurrentUserId()
    // 如果有 userId 則帶入，否則不帶（讓資料庫用預設值）
    const insertData = userId ? { ...task, user_id: userId } : task
    const { data, error } = await supabase
      .from('tasks')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      console.error('[tasksApi.create] 錯誤:', error)
      throw error
    }
    console.log('[tasksApi.create] 成功建立任務:', data)
    return data
  },

  // 更新任務
  async update(id: string, updates: Partial<DbTask>): Promise<DbTask> {
    const supabase = getSupabase()
    console.log('[tasksApi.update] 更新任務:', id, updates)
    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[tasksApi.update] 錯誤:', error.message, error.code, error.details)
      throw error
    }
    return data
  },

  // 完成任務
  async complete(id: string): Promise<DbTask> {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('tasks')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  // 刪除任務
  async delete(id: string): Promise<void> {
    const supabase = getSupabase()
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (error) throw error
  },

  // 完成例行任務並自動建立下一個
  async completeRecurring(id: string): Promise<{ completedTask: DbTask; nextTask?: DbTask }> {
    const supabase = getSupabase()
    const userId = await getCurrentUserId()

    // 1. 取得原任務資料
    const { data: task, error: getError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', id)
      .single()

    if (getError) throw getError

    // 2. 完成原任務
    const { data: completedTask, error: completeError } = await supabase
      .from('tasks')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (completeError) throw completeError

    // 3. 如果是例行任務，建立下一個任務
    if (task.recurrence_type && task.recurrence_type !== 'none') {
      const nextDueDate = calculateNextDueDate(
        task.due_date || task.start_date || new Date().toISOString(),
        task.recurrence_type,
        task.recurrence_config as RecurrenceConfig | null
      )
      const nextStartDate = calculateNextDueDate(
        task.start_date || task.due_date || new Date().toISOString(),
        task.recurrence_type,
        task.recurrence_config as RecurrenceConfig | null
      )

      // 檢查是否超過結束日期或最大次數
      const config = task.recurrence_config as RecurrenceConfig | null
      if (config?.endDate && new Date(nextDueDate) > new Date(config.endDate)) {
        return { completedTask }
      }

      // 建立下一個例行任務
      const nextTaskData = {
        title: task.title,
        description: task.description,
        status: 'pending' as const,
        priority: task.priority,
        start_date: nextStartDate,
        due_date: nextDueDate,
        assignee: task.assignee,
        project_id: task.project_id,
        tags: task.tags,
        group_name: task.group_name,
        recurrence_type: task.recurrence_type,
        recurrence_config: task.recurrence_config,
        parent_task_id: task.parent_task_id || task.id, // 保留原始任務作為 parent
        is_recurring_instance: true,
      }

      const insertData = userId ? { ...nextTaskData, user_id: userId } : nextTaskData
      const { data: nextTask, error: createError } = await supabase
        .from('tasks')
        .insert(insertData)
        .select()
        .single()

      if (createError) throw createError
      return { completedTask, nextTask }
    }

    return { completedTask }
  },
}

// 計算下一個執行日期
function calculateNextDueDate(
  currentDate: string,
  recurrenceType: string,
  config: RecurrenceConfig | null
): string {
  const date = new Date(currentDate)
  const interval = config?.interval || 1

  switch (recurrenceType) {
    case 'daily':
      date.setDate(date.getDate() + interval)
      break
    case 'weekly':
      if (config?.weekdays && config.weekdays.length > 0) {
        // 找到下一個指定的週幾
        const currentDay = date.getDay() || 7 // 週日 = 7
        const sortedWeekdays = [...config.weekdays].sort((a, b) => a - b)
        let nextDay = sortedWeekdays.find(d => d > currentDay)
        if (!nextDay) {
          // 到下週
          nextDay = sortedWeekdays[0]
          date.setDate(date.getDate() + (7 - currentDay + nextDay))
        } else {
          date.setDate(date.getDate() + (nextDay - currentDay))
        }
      } else {
        date.setDate(date.getDate() + 7 * interval)
      }
      break
    case 'monthly':
      if (config?.monthDay) {
        date.setMonth(date.getMonth() + interval)
        date.setDate(config.monthDay)
      } else {
        date.setMonth(date.getMonth() + interval)
      }
      break
    case 'yearly':
      date.setFullYear(date.getFullYear() + interval)
      break
  }

  return date.toISOString()
}

// ============ Chat Sessions API ============

export const chatSessionsApi = {
  // 取得所有對話 sessions（置頂的在最前面，然後按更新時間排序）
  async getAll(): Promise<DbChatSession[]> {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .order('is_pinned', { ascending: false })
      .order('updated_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  // 取得單一 session
  async getById(id: string): Promise<DbChatSession | null> {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  },

  // 建立新 session
  async create(title = '新對話'): Promise<DbChatSession> {
    const supabase = getSupabase()
    const userId = await getCurrentUserId()
    const { data, error } = await supabase
      .from('chat_sessions')
      .insert({ title, user_id: userId })
      .select()
      .single()

    if (error) throw error
    return data
  },

  // 更新 session 標題
  async updateTitle(id: string, title: string): Promise<DbChatSession> {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('chat_sessions')
      .update({ title })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  // 切換置頂狀態
  async togglePin(id: string, isPinned: boolean): Promise<DbChatSession> {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('chat_sessions')
      .update({ is_pinned: isPinned })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  // 刪除 session（會連同刪除該 session 的所有對話）
  async delete(id: string): Promise<void> {
    const supabase = getSupabase()
    const { error } = await supabase
      .from('chat_sessions')
      .delete()
      .eq('id', id)
    if (error) throw error
  },

  // 清除所有 sessions
  async clearAll(): Promise<void> {
    const supabase = getSupabase()
    const userId = await getCurrentUserId()
    const { error } = await supabase
      .from('chat_sessions')
      .delete()
      .eq('user_id', userId)
    if (error) throw error
  },
}

// ============ 對話 API ============

export const conversationsApi = {
  // 取得指定 session 的對話
  async getBySessionId(sessionId: string): Promise<DbConversation[]> {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })

    if (error) throw error
    return data || []
  },

  // 取得所有對話（最近 N 條）- 向後相容
  async getRecent(limit = 50): Promise<DbConversation[]> {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(limit)

    if (error) throw error
    return data || []
  },

  // 建立對話
  async create(
    conversation: Omit<DbConversation, 'id' | 'created_at' | 'user_id'>
  ): Promise<DbConversation> {
    const supabase = getSupabase()
    const userId = await getCurrentUserId()
    const { data, error } = await supabase
      .from('conversations')
      .insert({ ...conversation, user_id: userId })
      .select()
      .single()

    if (error) throw error
    return data
  },

  // 清除指定 session 的對話
  async clearBySessionId(sessionId: string): Promise<void> {
    const supabase = getSupabase()
    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('session_id', sessionId)
    if (error) throw error
  },

  // 清除所有對話（只刪除目前使用者的）
  async clear(): Promise<void> {
    const supabase = getSupabase()
    const userId = await getCurrentUserId()
    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('user_id', userId)
    if (error) throw error
  },
}

// ============ API 使用量 ============

export const apiUsageApi = {
  // 取得所有使用記錄
  async getAll(): Promise<DbApiUsage[]> {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('api_usage')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  // 建立使用記錄
  async create(
    usage: Omit<DbApiUsage, 'id' | 'created_at' | 'user_id'>
  ): Promise<DbApiUsage> {
    const supabase = getSupabase()
    const userId = await getCurrentUserId()
    const { data, error } = await supabase
      .from('api_usage')
      .insert({ ...usage, user_id: userId })
      .select()
      .single()

    if (error) throw error
    return data
  },

  // 取得總計
  async getTotals(): Promise<{
    totalCost: number
    totalTokens: number
    totalCalls: number
  }> {
    const supabase = getSupabase()
    const { data, error } = await supabase.from('api_usage').select('*')

    if (error) throw error

    const records = data || []
    return {
      totalCost: records.reduce((sum, r) => sum + Number(r.cost), 0),
      totalTokens: records.reduce((sum, r) => sum + r.total_tokens, 0),
      totalCalls: records.length,
    }
  },

  // 清除所有記錄
  async clear(): Promise<void> {
    const supabase = getSupabase()
    const userId = await getCurrentUserId()
    const { error } = await supabase
      .from('api_usage')
      .delete()
      .eq('user_id', userId)
    if (error) throw error
  },
}

// ============ 任務分類知識庫 API ============

export interface DbCategoryMapping {
  id: string
  user_id: string
  pattern: string
  category: string
  match_type: 'exact' | 'contains' | 'starts_with'
  priority: number
  created_at: string
  updated_at: string
}

export interface DbTaskCategory {
  id: string
  user_id: string
  name: string
  color: string
  icon: string
  sort_order: number
  created_at: string
}

// 預設分類（用戶沒有自訂時使用）
export const DEFAULT_CATEGORIES: Omit<DbTaskCategory, 'id' | 'user_id' | 'created_at'>[] = [
  { name: '銷售業務', color: '#10B981', icon: 'trending-up', sort_order: 0 },
  { name: '內部優化', color: '#3B82F6', icon: 'settings', sort_order: 1 },
  { name: '自我提升', color: '#8B5CF6', icon: 'sparkles', sort_order: 2 },
  { name: '客戶服務', color: '#F59E0B', icon: 'users', sort_order: 3 },
  { name: '行政庶務', color: '#6B7280', icon: 'briefcase', sort_order: 4 },
  { name: '其他', color: '#9CA3AF', icon: 'circle', sort_order: 5 },
]

export const categoryMappingsApi = {
  // 取得所有分類對應
  async getAll(): Promise<DbCategoryMapping[]> {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('task_category_mappings')
      .select('*')
      .order('priority', { ascending: false })

    if (error) {
      // 表不存在時回傳空陣列
      if (error.code === '42P01') return []
      throw error
    }
    return data || []
  },

  // 新增或更新分類對應（學習功能）
  async upsert(
    pattern: string,
    category: string,
    matchType: 'exact' | 'contains' | 'starts_with' = 'exact',
    priority: number = 0
  ): Promise<DbCategoryMapping> {
    const supabase = getSupabase()
    const userId = await getCurrentUserId()

    const { data, error } = await supabase
      .from('task_category_mappings')
      .upsert(
        {
          user_id: userId,
          pattern,
          category,
          match_type: matchType,
          priority,
        },
        { onConflict: 'user_id,pattern' }
      )
      .select()
      .single()

    if (error) throw error
    return data
  },

  // 批次新增（用於初始化）
  async bulkInsert(
    mappings: Array<{ pattern: string; category: string; matchType?: 'exact' | 'contains' | 'starts_with'; priority?: number }>
  ): Promise<DbCategoryMapping[]> {
    const supabase = getSupabase()
    const userId = await getCurrentUserId()

    const { data, error } = await supabase
      .from('task_category_mappings')
      .upsert(
        mappings.map(m => ({
          user_id: userId,
          pattern: m.pattern,
          category: m.category,
          match_type: m.matchType || 'contains',
          priority: m.priority || 0,
        })),
        { onConflict: 'user_id,pattern' }
      )
      .select()

    if (error) throw error
    return data || []
  },

  // 刪除分類對應
  async delete(id: string): Promise<void> {
    const supabase = getSupabase()
    const { error } = await supabase
      .from('task_category_mappings')
      .delete()
      .eq('id', id)
    if (error) throw error
  },

  // 根據任務標題查找分類
  async findCategory(taskTitle: string): Promise<string | null> {
    const mappings = await this.getAll()
    const lowerTitle = taskTitle.toLowerCase()

    // 按優先級排序後遍歷
    for (const mapping of mappings) {
      const pattern = mapping.pattern.toLowerCase()

      switch (mapping.match_type) {
        case 'exact':
          if (lowerTitle === pattern) return mapping.category
          break
        case 'starts_with':
          if (lowerTitle.startsWith(pattern)) return mapping.category
          break
        case 'contains':
          if (lowerTitle.includes(pattern)) return mapping.category
          break
      }
    }

    return null
  },
}

export const taskCategoriesApi = {
  // 取得所有分類
  async getAll(): Promise<DbTaskCategory[]> {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('task_categories')
      .select('*')
      .order('sort_order', { ascending: true })

    if (error) {
      // 表不存在時回傳空陣列
      if (error.code === '42P01') return []
      throw error
    }
    return data || []
  },

  // 初始化預設分類
  async initializeDefaults(): Promise<DbTaskCategory[]> {
    const supabase = getSupabase()
    const userId = await getCurrentUserId()

    // 檢查是否已有分類
    const existing = await this.getAll()
    if (existing.length > 0) return existing

    // 建立預設分類
    const { data, error } = await supabase
      .from('task_categories')
      .insert(
        DEFAULT_CATEGORIES.map(c => ({
          ...c,
          user_id: userId,
        }))
      )
      .select()

    if (error) throw error
    return data || []
  },

  // 新增分類
  async create(
    name: string,
    color: string = '#9CA3AF',
    icon: string = 'circle'
  ): Promise<DbTaskCategory> {
    const supabase = getSupabase()
    const userId = await getCurrentUserId()

    // 取得最大排序
    const existing = await this.getAll()
    const maxOrder = existing.reduce((max, c) => Math.max(max, c.sort_order), -1)

    const { data, error } = await supabase
      .from('task_categories')
      .insert({
        user_id: userId,
        name,
        color,
        icon,
        sort_order: maxOrder + 1,
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  // 更新分類
  async update(
    id: string,
    updates: Partial<Pick<DbTaskCategory, 'name' | 'color' | 'icon' | 'sort_order'>>
  ): Promise<DbTaskCategory> {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('task_categories')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  // 刪除分類
  async delete(id: string): Promise<void> {
    const supabase = getSupabase()
    const { error } = await supabase
      .from('task_categories')
      .delete()
      .eq('id', id)
    if (error) throw error
  },
}
