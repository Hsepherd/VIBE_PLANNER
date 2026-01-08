'use client'

import { useEffect, useRef } from 'react'
import { useAuth } from '@/lib/useAuth'
import { useAppStore } from '@/lib/store'
import { projectsApi, tasksApi, conversationsApi, apiUsageApi } from '@/lib/supabase-api'

// 自動同步元件：登入後自動從 Supabase 下載資料
export function AutoSync() {
  const { user, isLoading: loading } = useAuth()
  const hasSynced = useRef(false)

  useEffect(() => {
    // 只在登入後執行一次
    if (loading || !user || hasSynced.current) return

    const syncFromSupabase = async () => {
      try {
        console.log('[AutoSync] 開始從 Supabase 同步資料...')

        const [projects, tasks, apiUsage] = await Promise.all([
          projectsApi.getAll(),
          tasksApi.getAll(),
          apiUsageApi.getAll(),
        ])

        console.log(`[AutoSync] 取得 ${projects.length} 個專案, ${tasks.length} 個任務`)

        // 更新本地 store
        useAppStore.setState({
          projects: projects.map((p) => ({
            id: p.id,
            name: p.name,
            description: p.description || undefined,
            status: p.status,
            progress: p.progress,
            createdAt: new Date(p.created_at),
            updatedAt: new Date(p.updated_at),
          })),
          tasks: tasks.map((t) => ({
            id: t.id,
            title: t.title,
            description: t.description || undefined,
            status: t.status,
            priority: t.priority,
            dueDate: t.due_date ? new Date(t.due_date) : undefined,
            startDate: t.start_date ? new Date(t.start_date) : undefined,
            assignee: t.assignee || undefined,
            projectId: t.project_id || undefined,
            group: t.group_name || undefined,
            tags: t.tags || [],
            recurrenceType: t.recurrence_type || 'none',
            recurrenceConfig: t.recurrence_config || undefined,
            parentTaskId: t.parent_task_id || undefined,
            isRecurringInstance: t.is_recurring_instance || false,
            createdAt: new Date(t.created_at),
            updatedAt: new Date(t.updated_at),
            completedAt: t.completed_at ? new Date(t.completed_at) : undefined,
          })),
          apiUsage: apiUsage.map((u) => ({
            id: u.id,
            model: u.model,
            promptTokens: u.prompt_tokens,
            completionTokens: u.completion_tokens,
            totalTokens: u.total_tokens,
            cost: Number(u.cost),
            timestamp: new Date(u.created_at),
          })),
        })

        console.log('[AutoSync] 同步完成！')
        hasSynced.current = true
      } catch (err) {
        console.error('[AutoSync] 同步失敗:', err)
      }
    }

    syncFromSupabase()
  }, [user, loading])

  // 這個元件不渲染任何內容
  return null
}
