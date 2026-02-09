'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Calendar, Clock, CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// 排程任務介面
export interface ScheduledTaskPreview {
  taskId: string
  taskTitle: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  dueDate: string | null
  startTime: string
  endTime: string
  estimatedMinutes: number
  taskType: 'focus' | 'background'
  confidence: 'high' | 'medium' | 'low'
  slotDate: string
  reasoning: string
}

// 未排程任務介面
export interface UnscheduledTaskPreview {
  taskId: string
  taskTitle: string
  reason: string
}

// 排程摘要
export interface ScheduleSummary {
  totalTasksProcessed: number
  successfullyScheduled: number
  failedToSchedule: number
  totalMinutesScheduled: number
  daysSpanned: number
}

// 衝突資訊（S-010）
export interface ConflictInfo {
  taskId: string
  taskTitle: string
  taskStart: string
  taskEnd: string
  conflictingEvent: {
    title: string
    start: string
    end: string
  }
  overlapMinutes: number
}

export interface ConflictCheckResult {
  hasConflicts: boolean
  conflicts: ConflictInfo[]
  conflictCount: number
  totalOverlapMinutes: number
}

interface SchedulePreviewProps {
  scheduledTasks: ScheduledTaskPreview[]
  unscheduledTasks: UnscheduledTaskPreview[]
  summary: ScheduleSummary
  onConfirm: () => Promise<void>
  onCancel: () => void
  isConfirming?: boolean
  // S-010: 衝突資訊
  conflictCheck?: ConflictCheckResult
  conflictSummary?: string
  // 可編輯時間
  editable?: boolean
  onUpdateTime?: (taskId: string, startTime: string, endTime: string) => void
}

// 優先級顏色
const priorityColors = {
  urgent: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  low: 'bg-gray-100 text-gray-700 border-gray-200',
}

// 優先級標籤
const priorityLabels = {
  urgent: '緊急',
  high: '高',
  medium: '中',
  low: '低',
}

// 信心度顏色
const confidenceColors = {
  high: 'text-green-600',
  medium: 'text-yellow-600',
  low: 'text-red-600',
}

// 格式化時間
function formatTime(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
}

// 格式化日期
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  if (date.toDateString() === today.toDateString()) {
    return '今天'
  }
  if (date.toDateString() === tomorrow.toDateString()) {
    return '明天'
  }

  return date.toLocaleDateString('zh-TW', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })
}

// 按日期分組任務
function groupByDate(tasks: ScheduledTaskPreview[]): Record<string, ScheduledTaskPreview[]> {
  const grouped: Record<string, ScheduledTaskPreview[]> = {}

  for (const task of tasks) {
    if (!grouped[task.slotDate]) {
      grouped[task.slotDate] = []
    }
    grouped[task.slotDate].push(task)
  }

  // 按時間排序每組內的任務
  for (const date in grouped) {
    grouped[date].sort((a, b) =>
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    )
  }

  return grouped
}

// 從 ISO 時間字串提取 HH:mm
function extractHHMM(isoString: string): string {
  const date = new Date(isoString)
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
}

// 根據開始時間和預估分鐘數計算結束時間的 ISO 字串
function calculateEndTimeISO(startTimeISO: string, newStartHHMM: string, estimatedMinutes: number): string {
  const original = new Date(startTimeISO)
  const [h, m] = newStartHHMM.split(':').map(Number)
  const newStart = new Date(original)
  newStart.setHours(h, m, 0, 0)
  const newEnd = new Date(newStart.getTime() + estimatedMinutes * 60 * 1000)
  return newEnd.toISOString()
}

// 將 HH:mm 替換到 ISO 字串中
function replaceTimeInISO(isoString: string, hhmm: string): string {
  const date = new Date(isoString)
  const [h, m] = hhmm.split(':').map(Number)
  date.setHours(h, m, 0, 0)
  return date.toISOString()
}

export function SchedulePreview({
  scheduledTasks,
  unscheduledTasks,
  summary,
  onConfirm,
  onCancel,
  isConfirming = false,
  conflictCheck,
  conflictSummary,
  editable = false,
  onUpdateTime,
}: SchedulePreviewProps) {
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const groupedTasks = groupByDate(scheduledTasks)
  const sortedDates = Object.keys(groupedTasks).sort()

  // 計算總時數
  const totalHours = Math.round(summary.totalMinutesScheduled / 60 * 10) / 10

  // 建立任務衝突對照表
  const taskConflicts = new Map<string, ConflictInfo[]>()
  if (conflictCheck?.conflicts) {
    for (const conflict of conflictCheck.conflicts) {
      const existing = taskConflicts.get(conflict.taskId) || []
      existing.push(conflict)
      taskConflicts.set(conflict.taskId, existing)
    }
  }

  // 處理時間變更
  const handleTimeChange = (taskId: string, newStartHHMM: string, task: ScheduledTaskPreview) => {
    if (!onUpdateTime) return
    const newStartISO = replaceTimeInISO(task.startTime, newStartHHMM)
    const newEndISO = calculateEndTimeISO(task.startTime, newStartHHMM, task.estimatedMinutes)
    onUpdateTime(taskId, newStartISO, newEndISO)
    setEditingTaskId(null)
  }

  return (
    <Card className="w-full max-w-2xl border-blue-200 bg-blue-50/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Calendar className="h-5 w-5 text-blue-600" />
          排程預覽
          {/* S-010: 衝突狀態指示 */}
          {conflictCheck && !conflictCheck.hasConflicts && (
            <Badge variant="outline" className="ml-2 bg-green-50 text-green-600 border-green-200 text-xs">
              ✓ 無衝突
            </Badge>
          )}
          {conflictCheck?.hasConflicts && (
            <Badge variant="outline" className="ml-2 bg-orange-50 text-orange-600 border-orange-200 text-xs">
              ⚠ {conflictCheck.conflictCount} 個衝突
            </Badge>
          )}
        </CardTitle>
        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            已排程 {summary.successfullyScheduled} 項
          </span>
          {summary.failedToSchedule > 0 && (
            <span className="flex items-center gap-1">
              <AlertCircle className="h-4 w-4 text-yellow-500" />
              未能排程 {summary.failedToSchedule} 項
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="h-4 w-4 text-blue-500" />
            共 {totalHours} 小時
          </span>
          <span>・{summary.daysSpanned} 天</span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 max-h-96 overflow-y-auto">
        {/* 按日期顯示排程 */}
        {sortedDates.map((date) => (
          <div key={date} className="space-y-2">
            <h4 className="font-medium text-sm text-blue-700 sticky top-0 bg-blue-50/90 py-1">
              {formatDate(date)}
            </h4>
            <div className="space-y-2 pl-2">
              {groupedTasks[date].map((task) => {
                const conflicts = taskConflicts.get(task.taskId)
                const hasConflict = conflicts && conflicts.length > 0

                return (
                  <div
                    key={task.taskId}
                    className={cn(
                      "flex items-start gap-3 p-2 rounded-lg border shadow-sm",
                      hasConflict
                        ? "bg-orange-50 border-orange-200"
                        : "bg-white border-blue-100"
                    )}
                  >
                    {/* 時間 */}
                    <div className="flex-shrink-0 text-xs text-muted-foreground w-24">
                      {editable && editingTaskId === task.taskId ? (
                        <div>
                          <input
                            type="time"
                            defaultValue={extractHHMM(task.startTime)}
                            className="w-full text-xs border rounded px-1 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                            onBlur={(e) => handleTimeChange(task.taskId, e.target.value, task)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleTimeChange(task.taskId, (e.target as HTMLInputElement).value, task)
                              }
                              if (e.key === 'Escape') {
                                setEditingTaskId(null)
                              }
                            }}
                            autoFocus
                          />
                          <div className="text-gray-400 mt-0.5">{task.estimatedMinutes} 分鐘</div>
                        </div>
                      ) : (
                        <div
                          className={cn(
                            editable && "cursor-pointer hover:bg-blue-100 rounded px-1 -mx-1 transition-colors",
                          )}
                          onClick={() => editable && setEditingTaskId(task.taskId)}
                          title={editable ? '點擊調整時間' : undefined}
                        >
                          <div className="font-medium">{formatTime(task.startTime)}</div>
                          <div className="text-gray-400">~ {formatTime(task.endTime)}</div>
                          <div className="text-gray-400">{task.estimatedMinutes} 分鐘</div>
                          {editable && (
                            <div className="text-blue-400 text-[10px] mt-0.5">可調整</div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 任務內容 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">{task.taskTitle}</span>
                        <Badge
                          variant="outline"
                          className={cn('text-xs py-0', priorityColors[task.priority])}
                        >
                          {priorityLabels[task.priority]}
                        </Badge>
                        {task.taskType === 'background' && (
                          <Badge variant="outline" className="text-xs py-0 bg-purple-50 text-purple-600 border-purple-200">
                            背景
                          </Badge>
                        )}
                        {/* S-010: 衝突警告 */}
                        {hasConflict && (
                          <Badge variant="outline" className="text-xs py-0 bg-orange-100 text-orange-700 border-orange-300">
                            ⚠ 衝突
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        <span className={confidenceColors[task.confidence]}>
                          {task.confidence === 'high' ? '✓ 高信心' : task.confidence === 'medium' ? '○ 中信心' : '△ 低信心'}
                        </span>
                        {task.reasoning && <span className="ml-2">・{task.reasoning}</span>}
                      </div>
                      {task.dueDate && (
                        <div className="text-xs text-orange-600 mt-1">
                          截止：{formatDate(task.dueDate)}
                        </div>
                      )}
                      {/* S-010: 顯示衝突詳情 */}
                      {hasConflict && conflicts.map((conflict, idx) => (
                        <div key={idx} className="text-xs text-orange-600 mt-1 bg-orange-100 px-2 py-1 rounded">
                          ⚠ 與「{conflict.conflictingEvent.title}」({formatTime(conflict.conflictingEvent.start)} - {formatTime(conflict.conflictingEvent.end)}) 衝突 ({conflict.overlapMinutes} 分鐘)
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {/* 未能排程的任務 */}
        {unscheduledTasks.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-blue-200">
            <h4 className="font-medium text-sm text-yellow-700 flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              未能排程的任務
            </h4>
            <div className="space-y-1 pl-2">
              {unscheduledTasks.map((task) => (
                <div
                  key={task.taskId}
                  className="flex items-center gap-2 p-2 bg-yellow-50 rounded-lg border border-yellow-100 text-sm"
                >
                  <XCircle className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                  <span className="truncate">{task.taskTitle}</span>
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {task.reason}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex gap-2 justify-end pt-4 border-t border-blue-200">
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={isConfirming}
        >
          取消
        </Button>
        <Button
          onClick={onConfirm}
          disabled={isConfirming || scheduledTasks.length === 0}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {isConfirming ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              套用中...
            </>
          ) : (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              套用排程
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}

// 簡化版預覽（用於 Chat 回應中）
interface SchedulePreviewInlineProps {
  scheduledTasks: ScheduledTaskPreview[]
  summary: ScheduleSummary
}

export function SchedulePreviewInline({
  scheduledTasks,
  summary,
}: SchedulePreviewInlineProps) {
  const groupedTasks = groupByDate(scheduledTasks)
  const sortedDates = Object.keys(groupedTasks).sort()
  const totalHours = Math.round(summary.totalMinutesScheduled / 60 * 10) / 10

  return (
    <div className="space-y-3 my-2">
      <div className="flex flex-wrap gap-2 text-sm">
        <Badge variant="secondary" className="bg-green-100 text-green-700">
          ✓ {summary.successfullyScheduled} 項已排程
        </Badge>
        <Badge variant="secondary" className="bg-blue-100 text-blue-700">
          ⏱ {totalHours} 小時
        </Badge>
        <Badge variant="secondary" className="bg-gray-100 text-gray-700">
          📅 {summary.daysSpanned} 天
        </Badge>
      </div>

      <div className="space-y-2">
        {sortedDates.map((date) => (
          <div key={date} className="text-sm">
            <div className="font-medium text-blue-700">{formatDate(date)}</div>
            <div className="pl-2 space-y-1">
              {groupedTasks[date].map((task) => (
                <div key={task.taskId} className="flex items-center gap-2 text-muted-foreground">
                  <span className="text-xs font-mono">{formatTime(task.startTime)}</span>
                  <span className="truncate">{task.taskTitle}</span>
                  <span className="text-xs">({task.estimatedMinutes}分)</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
