import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// 資料庫類型定義
export interface Project {
  id: string
  name: string
  description: string | null
  status: 'active' | 'completed' | 'archived'
  progress: number
  created_at: string
  updated_at: string
}

export interface Task {
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

export interface Conversation {
  id: string
  role: 'user' | 'assistant'
  content: string
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface Knowledge {
  id: string
  title: string
  content: string
  type: 'document' | 'course' | 'note'
  tags: string[] | null
  created_at: string
}
