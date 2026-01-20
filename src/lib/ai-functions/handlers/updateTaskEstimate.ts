import { createClient } from '@supabase/supabase-js'

interface UpdateTaskEstimateArgs {
  taskId: string
  estimatedMinutes: number
  taskType?: 'focus' | 'background'
}

interface UpdateTaskEstimateResult {
  success: boolean
  taskId: string
  estimatedMinutes: number
  taskType: string
}

/**
 * 更新任務的預估時間和類型
 */
export async function updateTaskEstimate(
  userId: string,
  args: UpdateTaskEstimateArgs
): Promise<UpdateTaskEstimateResult> {
  const { taskId, estimatedMinutes, taskType } = args

  // 使用 service role 存取資料
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 驗證任務是否屬於該使用者
  const { data: task, error: fetchError } = await supabase
    .from('tasks')
    .select('id, user_id')
    .eq('id', taskId)
    .single()

  if (fetchError || !task) {
    throw new Error(`任務不存在: ${taskId}`)
  }

  if (task.user_id !== userId) {
    throw new Error('無權限更新此任務')
  }

  // 更新任務
  const updateData: Record<string, unknown> = {
    estimated_minutes: estimatedMinutes,
    updated_at: new Date().toISOString(),
  }

  if (taskType) {
    updateData.task_type = taskType
  }

  const { error: updateError } = await supabase
    .from('tasks')
    .update(updateData)
    .eq('id', taskId)

  if (updateError) {
    throw new Error(`更新任務失敗: ${updateError.message}`)
  }

  return {
    success: true,
    taskId,
    estimatedMinutes,
    taskType: taskType || 'focus',
  }
}
