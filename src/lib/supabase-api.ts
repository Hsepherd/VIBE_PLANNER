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

export interface DbTask {
  id: string
  title: string
  description: string | null
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
    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
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
