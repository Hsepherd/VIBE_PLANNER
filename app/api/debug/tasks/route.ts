import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET() {
  try {
    const supabase = await createClient()

    // 取得任務和專案
    const [tasksResult, projectsResult] = await Promise.all([
      supabase.from('tasks').select('id, title, project_id').order('created_at', { ascending: false }),
      supabase.from('projects').select('id, name'),
    ])

    if (tasksResult.error) throw tasksResult.error
    if (projectsResult.error) throw projectsResult.error

    // 建立專案 ID 到名稱的映射
    const projectMap = new Map(projectsResult.data?.map(p => [p.id, p.name]) || [])

    // 統計有 project_id 的任務數量
    const tasksWithProject = tasksResult.data?.filter(t => t.project_id) || []
    const tasksWithoutProject = tasksResult.data?.filter(t => !t.project_id) || []

    return NextResponse.json({
      total: tasksResult.data?.length || 0,
      withProject: tasksWithProject.length,
      withoutProject: tasksWithoutProject.length,
      projects: projectsResult.data,
      // 顯示前 10 個有專案的任務
      sampleTasksWithProject: tasksWithProject.slice(0, 10).map(t => ({
        id: t.id,
        title: t.title,
        projectId: t.project_id,
        projectName: projectMap.get(t.project_id) || 'Unknown',
      })),
      // 顯示前 10 個沒有專案的任務
      sampleTasksWithoutProject: tasksWithoutProject.slice(0, 10).map(t => ({
        id: t.id,
        title: t.title,
      })),
    })
  } catch (error) {
    console.error('Debug API error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
