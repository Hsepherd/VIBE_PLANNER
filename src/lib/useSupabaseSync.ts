'use client'

import { useState, useCallback } from 'react'
import { useAppStore, type AppState } from './store'
import { syncToSupabase, projectsApi, tasksApi, conversationsApi, apiUsageApi } from './supabase-api'

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error'

export function useSupabaseSync() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)

  // 上傳本地資料到 Supabase
  const uploadToSupabase = useCallback(async () => {
    setSyncStatus('syncing')
    setError(null)

    try {
      const state = useAppStore.getState()

      await syncToSupabase({
        projects: state.projects,
        tasks: state.tasks,
        messages: state.messages,
        apiUsage: state.apiUsage,
      })

      setSyncStatus('success')
      setLastSyncTime(new Date())
    } catch (err) {
      console.error('Sync error:', err)
      setError(err instanceof Error ? err.message : '同步失敗')
      setSyncStatus('error')
    }
  }, [])

  // 從 Supabase 下載資料到本地
  const downloadFromSupabase = useCallback(async () => {
    setSyncStatus('syncing')
    setError(null)

    try {
      // 取得所有資料
      const [projects, tasks, conversations, apiUsage] = await Promise.all([
        projectsApi.getAll(),
        tasksApi.getAll(),
        conversationsApi.getRecent(100),
        apiUsageApi.getAll(),
      ])

      // 更新本地 store
      const store = useAppStore.getState()

      // 清除並重新設定（簡單方式）
      // 注意：這會覆蓋本地資料
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
          assignee: t.assignee || undefined,
          projectId: t.project_id || undefined,
          createdAt: new Date(t.created_at),
          updatedAt: new Date(t.updated_at),
          completedAt: t.completed_at ? new Date(t.completed_at) : undefined,
        })),
        messages: conversations.map((c) => ({
          id: c.id,
          role: c.role,
          content: c.content,
          timestamp: new Date(c.created_at),
          metadata: c.metadata as { tasksExtracted?: string[]; imageUrl?: string } | undefined,
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

      setSyncStatus('success')
      setLastSyncTime(new Date())
    } catch (err) {
      console.error('Download error:', err)
      setError(err instanceof Error ? err.message : '下載失敗')
      setSyncStatus('error')
    }
  }, [])

  // 檢查 Supabase 連線
  const checkConnection = useCallback(async (): Promise<boolean> => {
    try {
      await projectsApi.getAll()
      return true
    } catch {
      return false
    }
  }, [])

  return {
    syncStatus,
    lastSyncTime,
    error,
    uploadToSupabase,
    downloadFromSupabase,
    checkConnection,
  }
}
