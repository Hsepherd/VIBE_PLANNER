/**
 * AI Function Executor
 * 負責執行 AI 呼叫的 functions 並回傳結果
 */

import { getUnscheduledTasks } from './handlers/getUnscheduledTasks'
import { getAvailableSlots } from './handlers/getAvailableSlots'
import { estimateTaskTime, estimateMultipleTasksTime } from './handlers/estimateTaskTime'
import { createSchedulePreview } from './handlers/schedulePreview'
import { updateTaskEstimate } from './handlers/updateTaskEstimate'
import { generateSmartSchedule } from './handlers/scheduleAlgorithm'
import { organizeMeetingNotes } from './handlers/organizeMeetingNotes'
import type { AIFunctionName } from './definitions'

// Function 執行上下文
export interface FunctionContext {
  userId: string
}

// Function 執行結果
export interface FunctionResult {
  success: boolean
  data?: unknown
  error?: string
}

/**
 * 執行 AI 呼叫的 function
 */
export async function executeFunctionCall(
  functionName: string,
  args: Record<string, unknown>,
  context: FunctionContext
): Promise<FunctionResult> {
  console.log(`[AI Function] 執行 ${functionName}`, { args, userId: context.userId })

  try {
    let result: unknown

    switch (functionName as AIFunctionName) {
      case 'getUnscheduledTasks':
        result = await getUnscheduledTasks(context.userId, args as {
          priority?: 'low' | 'medium' | 'high' | 'urgent'
          dueBefore?: string
          projectId?: string
        })
        break

      case 'getAvailableSlots':
        result = await getAvailableSlots(context.userId, args as {
          startDate: string
          endDate?: string
          workStart?: string
          workEnd?: string
        })
        break

      case 'estimateTaskTime':
        result = await estimateTaskTime(args as {
          taskId: string
          taskTitle: string
          taskDescription?: string
        })
        break

      case 'estimateMultipleTasksTime':
        result = await estimateMultipleTasksTime(args as {
          tasks: Array<{
            taskId: string
            taskTitle: string
            taskDescription?: string
          }>
        })
        break

      case 'createSchedulePreview':
        result = await createSchedulePreview(context.userId, args as {
          schedules: Array<{
            taskId: string
            taskTitle: string
            startTime: string
            endTime: string
            estimatedMinutes?: number
          }>
        })
        break

      case 'updateTaskEstimate':
        result = await updateTaskEstimate(context.userId, args as {
          taskId: string
          estimatedMinutes: number
          taskType?: 'focus' | 'background'
        })
        break

      case 'generateSmartSchedule':
        result = await generateSmartSchedule(context.userId, args as {
          startDate?: string
          endDate?: string
          workStart?: string
          workEnd?: string
          respectDeadlines?: boolean
          maxTasksPerDay?: number
        })
        break

      case 'organizeMeetingNotes':
        result = await organizeMeetingNotes(args as {
          rawContent: string
          meetingTitle?: string
        })
        break

      default:
        throw new Error(`未知的 function: ${functionName}`)
    }

    console.log(`[AI Function] ${functionName} 執行成功`)
    return {
      success: true,
      data: result,
    }
  } catch (error) {
    console.error(`[AI Function] ${functionName} 執行失敗:`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '執行失敗',
    }
  }
}

/**
 * 批次執行多個 function calls
 */
export async function executeFunctionCalls(
  calls: Array<{
    name: string
    arguments: Record<string, unknown>
  }>,
  context: FunctionContext
): Promise<FunctionResult[]> {
  const results: FunctionResult[] = []

  for (const call of calls) {
    const result = await executeFunctionCall(call.name, call.arguments, context)
    results.push(result)
  }

  return results
}
