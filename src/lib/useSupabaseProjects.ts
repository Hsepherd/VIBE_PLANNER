'use client'

import { useState, useEffect, useCallback } from 'react'
import { projectsApi, type DbProject } from './supabase-api'

// 前端使用的 Project 類型
export interface Project {
  id: string
  name: string
  description?: string
  status: 'active' | 'completed' | 'archived'
  progress: number
  createdAt: Date
  updatedAt: Date
}

// 將 Supabase 資料轉換為前端格式
function dbProjectToProject(dbProject: DbProject): Project {
  return {
    id: dbProject.id,
    name: dbProject.name,
    description: dbProject.description || undefined,
    status: dbProject.status,
    progress: dbProject.progress,
    createdAt: new Date(dbProject.created_at),
    updatedAt: new Date(dbProject.updated_at),
  }
}

// 將前端格式轉換為 Supabase 格式
function projectToDbProject(project: Partial<Project>): Partial<DbProject> {
  const dbProject: Partial<DbProject> = {}

  if (project.name !== undefined) dbProject.name = project.name
  if (project.description !== undefined) dbProject.description = project.description || null
  if (project.status !== undefined) dbProject.status = project.status
  if (project.progress !== undefined) dbProject.progress = project.progress

  return dbProject
}

export function useSupabaseProjects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 載入專案
  const loadProjects = useCallback(async () => {
    try {
      setLoading(true)
      const dbProjects = await projectsApi.getAll()
      setProjects(dbProjects.map(dbProjectToProject))
      setError(null)
    } catch (err) {
      console.error('載入專案失敗:', err)
      setError(err instanceof Error ? err.message : '載入專案失敗')
    } finally {
      setLoading(false)
    }
  }, [])

  // 初始載入
  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  // 新增專案
  const addProject = useCallback(async (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const dbProject = await projectsApi.create({
        name: project.name,
        description: project.description || null,
        status: project.status,
        progress: project.progress,
      })
      const newProject = dbProjectToProject(dbProject)
      setProjects(prev => [newProject, ...prev])
      return newProject
    } catch (err) {
      console.error('新增專案失敗:', err)
      throw err
    }
  }, [])

  // 更新專案
  const updateProject = useCallback(async (id: string, updates: Partial<Project>) => {
    try {
      const dbUpdates = projectToDbProject(updates)
      const dbProject = await projectsApi.update(id, dbUpdates)
      const updatedProject = dbProjectToProject(dbProject)
      setProjects(prev => prev.map(p => p.id === id ? updatedProject : p))
      return updatedProject
    } catch (err) {
      console.error('更新專案失敗:', err)
      throw err
    }
  }, [])

  // 刪除專案
  const deleteProject = useCallback(async (id: string) => {
    try {
      await projectsApi.delete(id)
      setProjects(prev => prev.filter(p => p.id !== id))
    } catch (err) {
      console.error('刪除專案失敗:', err)
      throw err
    }
  }, [])

  // 重新載入（回傳 Promise 以便等待完成）
  const refresh = useCallback(async () => {
    return loadProjects()
  }, [loadProjects])

  return {
    projects,
    loading,
    error,
    addProject,
    updateProject,
    deleteProject,
    refresh,
  }
}
