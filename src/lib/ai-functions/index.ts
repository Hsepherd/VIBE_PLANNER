/**
 * AI Function Calling 模組
 * 讓 AI 能夠執行實際動作（查詢任務、排程等）
 */

export { AI_FUNCTIONS, isSchedulingRelated } from './definitions'
export type { AIFunctionName } from './definitions'

export { executeFunctionCall, executeFunctionCalls } from './executor'
export type { FunctionContext, FunctionResult } from './executor'

// Handlers（通常不需要直接使用）
export { getUnscheduledTasks } from './handlers/getUnscheduledTasks'
export { getAvailableSlots } from './handlers/getAvailableSlots'
export { estimateTaskTime, estimateMultipleTasksTime } from './handlers/estimateTaskTime'
export { createSchedulePreview } from './handlers/schedulePreview'
export { updateTaskEstimate } from './handlers/updateTaskEstimate'
export { generateSmartSchedule, validateSchedule } from './handlers/scheduleAlgorithm'
export type { ScheduledTask, ScheduleResult, ScheduleOptions } from './handlers/scheduleAlgorithm'
