import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

interface ScheduledTask {
  taskId: string
  taskTitle: string
  startTime: string
  endTime: string
  estimatedMinutes: number
  taskType: 'focus' | 'background'
}

interface ApplyScheduleRequest {
  userId: string
  scheduledTasks: ScheduledTask[]
}

/**
 * POST /api/tasks/apply-schedule
 * 套用排程，更新任務的開始時間和預估時間
 */
export async function POST(request: NextRequest) {
  try {
    const body: ApplyScheduleRequest = await request.json()
    const { userId, scheduledTasks } = body

    if (!userId) {
      return NextResponse.json({ success: false, error: '缺少 userId' }, { status: 400 })
    }

    if (!scheduledTasks || !Array.isArray(scheduledTasks)) {
      return NextResponse.json({ success: false, error: '缺少 scheduledTasks' }, { status: 400 })
    }

    // 使用 service role 存取資料
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 批次更新任務
    const results: Array<{ taskId: string; success: boolean; error?: string }> = []

    for (const task of scheduledTasks) {
      try {
        // 驗證任務是否屬於該使用者
        const { data: existingTask, error: fetchError } = await supabase
          .from('tasks')
          .select('id, user_id')
          .eq('id', task.taskId)
          .single()

        if (fetchError || !existingTask) {
          results.push({ taskId: task.taskId, success: false, error: '任務不存在' })
          continue
        }

        if (existingTask.user_id !== userId) {
          results.push({ taskId: task.taskId, success: false, error: '無權限更新此任務' })
          continue
        }

        // 更新任務
        const { error: updateError } = await supabase
          .from('tasks')
          .update({
            start_date: task.startTime,
            estimated_minutes: task.estimatedMinutes,
            task_type: task.taskType,
            updated_at: new Date().toISOString(),
          })
          .eq('id', task.taskId)

        if (updateError) {
          results.push({ taskId: task.taskId, success: false, error: updateError.message })
        } else {
          results.push({ taskId: task.taskId, success: true })
        }
      } catch (err) {
        results.push({
          taskId: task.taskId,
          success: false,
          error: err instanceof Error ? err.message : '未知錯誤',
        })
      }
    }

    const successCount = results.filter((r) => r.success).length
    const failedCount = results.filter((r) => !r.success).length

    return NextResponse.json({
      success: true,
      message: `成功更新 ${successCount} 個任務${failedCount > 0 ? `，${failedCount} 個失敗` : ''}`,
      results,
      summary: {
        total: scheduledTasks.length,
        success: successCount,
        failed: failedCount,
      },
    })
  } catch (error) {
    console.error('[Apply Schedule] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '套用排程失敗',
      },
      { status: 500 }
    )
  }
}
