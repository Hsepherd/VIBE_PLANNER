'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useSupabaseProjects, type Project } from '@/lib/useSupabaseProjects'
import { useSupabaseTasks, type Task } from '@/lib/useSupabaseTasks'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { Plus, Trash2, FolderKanban, Edit2, Check, X, Loader2, RefreshCw } from 'lucide-react'

export default function ProjectsPage() {
  const {
    projects,
    loading,
    error,
    addProject,
    updateProject,
    deleteProject,
    refresh,
  } = useSupabaseProjects()

  const { tasks } = useSupabaseTasks()

  const [newProjectName, setNewProjectName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  const handleAddProject = async () => {
    if (!newProjectName.trim()) return
    try {
      setIsAdding(true)
      await addProject({
        name: newProjectName.trim(),
        status: 'active',
        progress: 0,
      })
      setNewProjectName('')
    } catch (err) {
      console.error('新增專案失敗:', err)
    } finally {
      setIsAdding(false)
    }
  }

  const handleStartEdit = (id: string, name: string) => {
    setEditingId(id)
    setEditingName(name)
  }

  const handleSaveEdit = async (id: string) => {
    if (editingName.trim()) {
      try {
        await updateProject(id, { name: editingName.trim() })
      } catch (err) {
        console.error('更新專案失敗:', err)
      }
    }
    setEditingId(null)
    setEditingName('')
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditingName('')
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteProject(id)
    } catch (err) {
      console.error('刪除專案失敗:', err)
    }
  }

  // 計算專案的任務統計
  const getProjectStats = (projectId: string) => {
    const projectTasks = tasks.filter((t: Task) => t.projectId === projectId)
    const completed = projectTasks.filter((t: Task) => t.status === 'completed').length
    const total = projectTasks.length
    return { completed, total, progress: total > 0 ? Math.round((completed / total) * 100) : 0 }
  }

  const statusConfig = {
    active: { label: '進行中', color: 'default' as const },
    completed: { label: '已完成', color: 'secondary' as const },
    archived: { label: '已封存', color: 'outline' as const },
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">📁 專案管理</h1>
            <button
              onClick={refresh}
              disabled={loading}
              className="p-1.5 rounded-md hover:bg-gray-100 text-muted-foreground hover:text-foreground transition-colors"
              title="重新整理"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
            {error}
            <Button variant="link" className="ml-2" onClick={refresh}>重試</Button>
          </div>
        )}

        {/* 新增專案 */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex gap-2">
              <Input
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="輸入專案名稱..."
                onKeyDown={(e) => e.key === 'Enter' && handleAddProject()}
                disabled={isAdding}
              />
              <Button onClick={handleAddProject} disabled={isAdding || !newProjectName.trim()}>
                {isAdding ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-1" />
                )}
                新增專案
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 載入中 */}
        {loading && projects.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p>正在載入專案...</p>
          </div>
        )}

        {/* 專案列表 */}
        {!loading && projects.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FolderKanban className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>尚未建立任何專案</p>
            <p className="text-sm mt-2">
              專案可以幫助你分類和追蹤相關的任務
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project: Project) => {
              const stats = getProjectStats(project.id)
              const isEditing = editingId === project.id

              return (
                <Card key={project.id} className="relative">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      {isEditing ? (
                        <div className="flex items-center gap-2 flex-1">
                          <Input
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            className="h-8"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit(project.id)
                              if (e.key === 'Escape') handleCancelEdit()
                            }}
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => handleSaveEdit(project.id)}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={handleCancelEdit}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <CardTitle className="text-lg">{project.name}</CardTitle>
                          <div className="flex items-center gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => handleStartEdit(project.id, project.name)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => handleDelete(project.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Badge variant={statusConfig[project.status].color}>
                        {statusConfig[project.status].label}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {stats.completed}/{stats.total} 任務
                      </span>
                    </div>

                    {/* 進度條 */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">進度</span>
                        <span className="font-medium">{stats.progress}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${stats.progress}%` }}
                        />
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      建立於 {format(new Date(project.createdAt), 'yyyy/M/d', { locale: zhTW })}
                    </p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
