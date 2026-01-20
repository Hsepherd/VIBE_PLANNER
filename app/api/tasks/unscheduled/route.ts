import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

/**
 * GET /api/tasks/unscheduled
 * 取得未排程任務清單
 *
 * Query Parameters:
 * - priority: 'low' | 'medium' | 'high' | 'urgent' (optional)
 * - dueBefore: ISO date string (optional)
 * - projectId: UUID (optional)
 *
 * 「未排程」定義:
 * - start_date IS NULL
 * - 或 start_date 為今天之前且 status != 'completed'
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 驗證使用者身份
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { success: false, error: '未授權' },
        { status: 401 }
      )
    }

    // 取得查詢參數
    const { searchParams } = new URL(request.url)
    const priority = searchParams.get('priority')
    const dueBefore = searchParams.get('dueBefore')
    const projectId = searchParams.get('projectId')

    // 今天的日期（用於判斷過期任務）
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayISO = today.toISOString()

    // 建立查詢
    let query = supabase
      .from('tasks')
      .select(
        `
        id,
        title,
        description,
        priority,
        status,
        start_date,
        due_date,
        estimated_minutes,
        task_type,
        project_id,
        created_at,
        projects:project_id (
          id,
          name
        )
      `
      )
      .neq('status', 'completed') // 排除已完成任務

    // 未排程條件：start_date IS NULL 或 start_date < today
    // Supabase 不支援 OR 條件的直接語法，所以我們先取得所有符合基本條件的任務
    // 然後在應用層過濾

    // 套用篩選條件
    if (priority) {
      query = query.eq('priority', priority)
    }

    if (dueBefore) {
      query = query.lte('due_date', dueBefore)
    }

    if (projectId) {
      query = query.eq('project_id', projectId)
    }

    // 依截止日排序（近的在前），NULL 排最後
    query = query.order('due_date', { ascending: true, nullsFirst: false })

    const { data: tasks, error } = await query

    if (error) {
      console.error('[API] 查詢未排程任務失敗:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    // 在應用層過濾未排程任務
    // 未排程 = start_date IS NULL 或 (start_date < today 且未完成)
    const unscheduledTasks = (tasks || []).filter((task) => {
      if (!task.start_date) {
        return true // 沒有 start_date 的任務
      }
      // 有 start_date 但在今天之前（過期但未完成）
      const startDate = new Date(task.start_date)
      return startDate < today
    })

    // 格式化回傳資料
    const formattedTasks = unscheduledTasks.map((task) => {
      // Supabase join 可能回傳 object 或 array，統一處理
      const projectData = task.projects as unknown
      let projectName: string | null = null
      if (projectData && typeof projectData === 'object') {
        if (Array.isArray(projectData) && projectData.length > 0) {
          projectName = projectData[0]?.name || null
        } else if ('name' in projectData) {
          projectName = (projectData as { name: string }).name
        }
      }
      return {
        id: task.id,
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: task.status,
        startDate: task.start_date,
        dueDate: task.due_date,
        estimatedMinutes: task.estimated_minutes || 60, // 預設 60 分鐘
        taskType: task.task_type || 'focus', // 預設為專注型任務
        projectId: task.project_id,
        projectName,
        createdAt: task.created_at,
      }
    })

    return NextResponse.json({
      success: true,
      tasks: formattedTasks,
      total: formattedTasks.length,
    })
  } catch (error) {
    console.error('[API] 未預期錯誤:', error)
    return NextResponse.json(
      { success: false, error: '伺服器內部錯誤' },
      { status: 500 }
    )
  }
}
