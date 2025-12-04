'use client'

import { useState, useEffect, useCallback } from 'react'
import { tasksApi, type DbTask, type RecurrenceConfig } from './supabase-api'

// 例行性任務類型
export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'

// 前端使用的 Task 類型
export interface Task {
  id: string
  title: string
  description?: string
  status: 'pending' | 'in_progress' | 'completed' | 'on_hold'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  startDate?: Date  // 開始日期
  dueDate?: Date    // 截止日期
  assignee?: string
  projectId?: string
  project?: string
  tags?: string[]  // 標籤功能
  groupName?: string  // 組別功能
  createdAt: Date
  updatedAt: Date
  completedAt?: Date
  // 例行性任務欄位
  recurrenceType?: RecurrenceType
  recurrenceConfig?: RecurrenceConfig
  parentTaskId?: string
  isRecurringInstance?: boolean
}

// 將 Supabase 資料轉換為前端格式
function dbTaskToTask(dbTask: DbTask): Task {
  return {
    id: dbTask.id,
    title: dbTask.title,
    description: dbTask.description || undefined,
    status: dbTask.status,
    priority: dbTask.priority,
    startDate: dbTask.start_date ? new Date(dbTask.start_date) : undefined,
    dueDate: dbTask.due_date ? new Date(dbTask.due_date) : undefined,
    assignee: dbTask.assignee || undefined,
    projectId: dbTask.project_id || undefined,
    tags: dbTask.tags || undefined,
    groupName: dbTask.group_name || undefined,
    createdAt: new Date(dbTask.created_at),
    updatedAt: new Date(dbTask.updated_at),
    completedAt: dbTask.completed_at ? new Date(dbTask.completed_at) : undefined,
    // 例行性任務欄位
    recurrenceType: (dbTask.recurrence_type as RecurrenceType) || undefined,
    recurrenceConfig: dbTask.recurrence_config || undefined,
    parentTaskId: dbTask.parent_task_id || undefined,
    isRecurringInstance: dbTask.is_recurring_instance || false,
  }
}

export function useSupabaseTasks() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 載入任務
  const loadTasks = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      console.log('[useSupabaseTasks] 開始載入任務...')
      const dbTasks = await tasksApi.getAll()
      console.log('[useSupabaseTasks] 載入完成，共', dbTasks.length, '筆任務')
      setTasks(dbTasks.map(dbTaskToTask))
    } catch (err) {
      console.error('[useSupabaseTasks] 載入任務失敗:', err)
      setError(err instanceof Error ? err.message : '載入失敗')
    } finally {
      console.log('[useSupabaseTasks] 設定 isLoading = false')
      setIsLoading(false)
    }
  }, [])

  // 初始載入
  useEffect(() => {
    loadTasks()
  }, [loadTasks])

  // 新增任務
  const addTask = useCallback(async (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const dbTask = await tasksApi.create({
        title: task.title,
        description: task.description || null,
        status: task.status,
        priority: task.priority,
        start_date: task.startDate ? task.startDate.toISOString() : null,
        due_date: task.dueDate ? task.dueDate.toISOString() : null,
        assignee: task.assignee || null,
        project_id: task.projectId || null,
        tags: task.tags || null,
        group_name: task.groupName || null,
        // 例行性任務欄位
        recurrence_type: task.recurrenceType || 'none',
        recurrence_config: task.recurrenceConfig || null,
        parent_task_id: task.parentTaskId || null,
        is_recurring_instance: task.isRecurringInstance || false,
      })
      setTasks(prev => [dbTaskToTask(dbTask), ...prev])
      return dbTask
    } catch (err) {
      console.error('新增任務失敗:', err)
      throw err
    }
  }, [])

  // 更新任務
  const updateTask = useCallback(async (id: string, updates: Partial<Task>) => {
    try {
      const dbUpdates: Partial<DbTask> = {}
      // 使用 'key' in object 來檢測是否有傳入該欄位（即使值是 undefined）
      if ('title' in updates) dbUpdates.title = updates.title!
      if ('description' in updates) dbUpdates.description = updates.description || null
      if ('status' in updates) dbUpdates.status = updates.status!
      if ('priority' in updates) dbUpdates.priority = updates.priority!
      if ('startDate' in updates) dbUpdates.start_date = updates.startDate ? updates.startDate.toISOString() : null
      if ('dueDate' in updates) dbUpdates.due_date = updates.dueDate ? updates.dueDate.toISOString() : null
      if ('assignee' in updates) dbUpdates.assignee = updates.assignee || null
      if ('projectId' in updates) dbUpdates.project_id = updates.projectId || null
      if ('tags' in updates) dbUpdates.tags = updates.tags || null
      if ('groupName' in updates) dbUpdates.group_name = updates.groupName || null
      if ('completedAt' in updates) dbUpdates.completed_at = updates.completedAt ? updates.completedAt.toISOString() : null
      // 例行性任務欄位
      if ('recurrenceType' in updates) dbUpdates.recurrence_type = updates.recurrenceType || 'none'
      if ('recurrenceConfig' in updates) dbUpdates.recurrence_config = updates.recurrenceConfig || null
      if ('parentTaskId' in updates) dbUpdates.parent_task_id = updates.parentTaskId || null
      if ('isRecurringInstance' in updates) dbUpdates.is_recurring_instance = updates.isRecurringInstance || false

      const dbTask = await tasksApi.update(id, dbUpdates)
      setTasks(prev => prev.map(t => t.id === id ? dbTaskToTask(dbTask) : t))
      return dbTask
    } catch (err) {
      // 顯示更詳細的錯誤訊息
      const error = err as { message?: string; code?: string; details?: string }
      console.error('更新任務失敗:', error?.message || error?.code || JSON.stringify(err))
      throw err
    }
  }, [])

  // 刪除任務
  const deleteTask = useCallback(async (id: string) => {
    try {
      await tasksApi.delete(id)
      setTasks(prev => prev.filter(t => t.id !== id))
    } catch (err) {
      console.error('刪除任務失敗:', err)
      throw err
    }
  }, [])

  // 完成任務
  const completeTask = useCallback(async (id: string) => {
    try {
      // 檢查是否為例行任務
      const task = tasks.find(t => t.id === id)
      if (task?.recurrenceType && task.recurrenceType !== 'none') {
        // 例行任務：完成後自動建立下一個
        const { completedTask, nextTask } = await tasksApi.completeRecurring(id)
        setTasks(prev => {
          const updated = prev.map(t => t.id === id ? dbTaskToTask(completedTask) : t)
          if (nextTask) {
            return [dbTaskToTask(nextTask), ...updated]
          }
          return updated
        })
        return completedTask
      } else {
        // 一般任務
        const dbTask = await tasksApi.complete(id)
        setTasks(prev => prev.map(t => t.id === id ? dbTaskToTask(dbTask) : t))
        return dbTask
      }
    } catch (err) {
      console.error('完成任務失敗:', err)
      throw err
    }
  }, [tasks])

  // 重新載入
  const refresh = useCallback(async () => {
    await loadTasks()
  }, [loadTasks])

  return {
    tasks,
    isLoading,
    error,
    addTask,
    updateTask,
    deleteTask,
    completeTask,
    refresh,
  }
}
