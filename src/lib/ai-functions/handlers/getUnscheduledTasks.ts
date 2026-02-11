import { createClient } from '@supabase/supabase-js'

interface GetUnscheduledTasksArgs {
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  dueBefore?: string
  projectId?: string
}

interface UnscheduledTask {
  id: string
  title: string
  description: string | null
  priority: string
  status: string
  startDate: string | null
  dueDate: string | null
  estimatedMinutes: number
  taskType: string
  projectId: string | null
  projectName: string | null
}

/**
 * 取得使用者的未排程任務
 */
export async function getUnscheduledTasks(
  userId: string,
  args: GetUnscheduledTasksArgs
): Promise<{ tasks: UnscheduledTask[]; total: number }> {
  // 使用 service role 存取資料
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 今天的日期
  const today = new Date()
  today.setHours(0, 0, 0, 0)

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
      projects:project_id (
        id,
        name
      )
    `
    )
    .eq('user_id', userId)
    .neq('status', 'completed')

  // 套用篩選條件
  if (args.priority) {
    query = query.eq('priority', args.priority)
  }

  if (args.dueBefore) {
    query = query.lte('due_date', args.dueBefore)
  }

  if (args.projectId) {
    query = query.eq('project_id', args.projectId)
  }

  // 依截止日排序
  query = query.order('due_date', { ascending: true, nullsFirst: false })

  const { data: tasks, error } = await query

  if (error) {
    console.error('[AI Function] getUnscheduledTasks error:', error)
    throw new Error(`取得任務失敗: ${error.message}`)
  }

  // 過濾未排程任務（排除已有今天或未來 start_date 的任務）
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const unscheduledTasks = (tasks || []).filter((task) => {
    if (!task.start_date) return true
    // 取日期部分比較，避免時區問題
    const taskDateStr = task.start_date.substring(0, 10)
    return taskDateStr < todayStr
  })

  // 格式化結果
  const formattedTasks: UnscheduledTask[] = unscheduledTasks.map((task) => {
    const projectData = task.projects as unknown
    let projectName: string | null = null
    if (projectData && typeof projectData === 'object' && 'name' in projectData) {
      projectName = (projectData as { name: string }).name
    }

    return {
      id: task.id,
      title: task.title,
      description: task.description,
      priority: task.priority,
      status: task.status,
      startDate: task.start_date,
      dueDate: task.due_date,
      estimatedMinutes: task.estimated_minutes || 60,
      taskType: task.task_type || 'focus',
      projectId: task.project_id,
      projectName,
    }
  })

  return {
    tasks: formattedTasks,
    total: formattedTasks.length,
  }
}
