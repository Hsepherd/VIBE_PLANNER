import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

interface NewTaskWithSchedule {
  title: string
  description?: string
  priority: string
  startTime: string
  endTime: string
  estimatedMinutes: number
}

interface CreateAndScheduleRequest {
  userId: string
  tasks: NewTaskWithSchedule[]
}

/**
 * POST /api/tasks/create-and-schedule
 * 建立新任務並設定排程時間
 */
export async function POST(request: NextRequest) {
  try {
    const body: CreateAndScheduleRequest = await request.json()
    const { userId, tasks } = body

    if (!userId) {
      return NextResponse.json({ success: false, error: '缺少 userId' }, { status: 400 })
    }

    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
      return NextResponse.json({ success: false, error: '缺少 tasks' }, { status: 400 })
    }

    // 使用 service role 存取資料
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 逐一建立任務
    const results: Array<{ title: string; success: boolean; taskId?: string; error?: string }> = []

    for (const task of tasks) {
      try {
        const { data, error } = await supabase
          .from('tasks')
          .insert({
            user_id: userId,
            title: task.title,
            description: task.description || null,
            status: 'pending',
            priority: task.priority || 'medium',
            start_date: task.startTime,
            estimated_minutes: task.estimatedMinutes,
            task_type: 'focus',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select('id')
          .single()

        if (error) {
          results.push({ title: task.title, success: false, error: error.message })
        } else {
          results.push({ title: task.title, success: true, taskId: data.id })
        }
      } catch (err) {
        results.push({
          title: task.title,
          success: false,
          error: err instanceof Error ? err.message : '未知錯誤',
        })
      }
    }

    const successCount = results.filter(r => r.success).length
    const failedCount = results.filter(r => !r.success).length

    return NextResponse.json({
      success: true,
      message: `成功建立並排程 ${successCount} 個任務${failedCount > 0 ? `，${failedCount} 個失敗` : ''}`,
      results,
      summary: {
        total: tasks.length,
        success: successCount,
        failed: failedCount,
      },
    })
  } catch (error) {
    console.error('[Create and Schedule] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '建立任務失敗',
      },
      { status: 500 }
    )
  }
}
