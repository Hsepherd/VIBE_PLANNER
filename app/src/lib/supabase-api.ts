import { supabase } from './supabase'

// ============ 類型定義 ============

export interface DbProject {
  id: string
  name: string
  description: string | null
  status: 'active' | 'completed' | 'archived'
  progress: number
  created_at: string
  updated_at: string
}

export interface DbTask {
  id: string
  title: string
  description: string | null
  status: 'pending' | 'in_progress' | 'completed'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  due_date: string | null
  assignee: string | null
  project_id: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
}

export interface DbConversation {
  id: string
  role: 'user' | 'assistant'
  content: string
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface DbApiUsage {
  id: string
  model: string
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  cost: number
  created_at: string
}

// ============ 專案 API ============

export const projectsApi = {
  // 取得所有專案
  async getAll(): Promise<DbProject[]> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  // 取得單一專案
  async getById(id: string): Promise<DbProject | null> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  },

  // 建立專案
  async create(project: Omit<DbProject, 'id' | 'created_at' | 'updated_at'>): Promise<DbProject> {
    const { data, error } = await supabase
      .from('projects')
      .insert(project)
      .select()
      .single()

    if (error) throw error
    return data
  },

  // 更新專案
  async update(id: string, updates: Partial<DbProject>): Promise<DbProject> {
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
    const { error } = await supabase.from('projects').delete().eq('id', id)
    if (error) throw error
  },
}

// ============ 任務 API ============

export const tasksApi = {
  // 取得所有任務
  async getAll(): Promise<DbTask[]> {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  // 取得單一任務
  async getById(id: string): Promise<DbTask | null> {
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
    task: Omit<DbTask, 'id' | 'created_at' | 'updated_at' | 'completed_at'>
  ): Promise<DbTask> {
    const { data, error } = await supabase.from('tasks').insert(task).select().single()

    if (error) throw error
    return data
  },

  // 更新任務
  async update(id: string, updates: Partial<DbTask>): Promise<DbTask> {
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
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (error) throw error
  },
}

// ============ 對話 API ============

export const conversationsApi = {
  // 取得所有對話（最近 N 條）
  async getRecent(limit = 50): Promise<DbConversation[]> {
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
    conversation: Omit<DbConversation, 'id' | 'created_at'>
  ): Promise<DbConversation> {
    const { data, error } = await supabase
      .from('conversations')
      .insert(conversation)
      .select()
      .single()

    if (error) throw error
    return data
  },

  // 清除所有對話
  async clear(): Promise<void> {
    const { error } = await supabase.from('conversations').delete().neq('id', '')
    if (error) throw error
  },
}

// ============ API 使用量 ============

export const apiUsageApi = {
  // 取得所有使用記錄
  async getAll(): Promise<DbApiUsage[]> {
    const { data, error } = await supabase
      .from('api_usage')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  // 建立使用記錄
  async create(
    usage: Omit<DbApiUsage, 'id' | 'created_at'>
  ): Promise<DbApiUsage> {
    const { data, error } = await supabase
      .from('api_usage')
      .insert(usage)
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
    const { error } = await supabase.from('api_usage').delete().neq('id', '')
    if (error) throw error
  },
}

// ============ 資料同步工具 ============

// 將本地資料同步到 Supabase
export const syncToSupabase = async (localData: {
  projects: Array<{
    id: string
    name: string
    description?: string
    status: 'active' | 'completed' | 'archived'
    progress: number
    createdAt: Date
    updatedAt: Date
  }>
  tasks: Array<{
    id: string
    title: string
    description?: string
    status: 'pending' | 'in_progress' | 'completed'
    priority: 'low' | 'medium' | 'high' | 'urgent'
    dueDate?: Date
    assignee?: string
    projectId?: string
    createdAt: Date
    updatedAt: Date
    completedAt?: Date
  }>
  messages: Array<{
    id: string
    role: 'user' | 'assistant'
    content: string
    timestamp: Date
    metadata?: Record<string, unknown>
  }>
  apiUsage: Array<{
    id: string
    model: string
    promptTokens: number
    completionTokens: number
    totalTokens: number
    cost: number
    timestamp: Date
  }>
}) => {
  // 同步專案
  for (const project of localData.projects) {
    await supabase.from('projects').upsert({
      id: project.id,
      name: project.name,
      description: project.description || null,
      status: project.status,
      progress: project.progress,
      created_at: new Date(project.createdAt).toISOString(),
      updated_at: new Date(project.updatedAt).toISOString(),
    })
  }

  // 同步任務
  for (const task of localData.tasks) {
    await supabase.from('tasks').upsert({
      id: task.id,
      title: task.title,
      description: task.description || null,
      status: task.status,
      priority: task.priority,
      due_date: task.dueDate ? new Date(task.dueDate).toISOString() : null,
      assignee: task.assignee || null,
      project_id: task.projectId || null,
      created_at: new Date(task.createdAt).toISOString(),
      updated_at: new Date(task.updatedAt).toISOString(),
      completed_at: task.completedAt ? new Date(task.completedAt).toISOString() : null,
    })
  }

  // 同步對話
  for (const message of localData.messages) {
    await supabase.from('conversations').upsert({
      id: message.id,
      role: message.role,
      content: message.content,
      metadata: message.metadata || null,
      created_at: new Date(message.timestamp).toISOString(),
    })
  }

  // 同步 API 使用量
  for (const usage of localData.apiUsage) {
    await supabase.from('api_usage').upsert({
      id: usage.id,
      model: usage.model,
      prompt_tokens: usage.promptTokens,
      completion_tokens: usage.completionTokens,
      total_tokens: usage.totalTokens,
      cost: usage.cost,
      created_at: new Date(usage.timestamp).toISOString(),
    })
  }
}
