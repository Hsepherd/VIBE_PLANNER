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
  onConfirm: (selectedTaskIds?: Set<string>) => Promise<void>
  onCancel: () => void
  isConfirming?: boolean
  conflictCheck?: ConflictCheckResult
  conflictSummary?: string
  editable?: boolean
  onUpdateTime?: (taskId: string, startTime: string, endTime: string) => void
}

// 優先級背景色（用於時間軸色塊）
const priorityBlockColors = {
  urgent: 'bg-red-400/90 border-red-500',
  high: 'bg-orange-400/90 border-orange-500',
  medium: 'bg-blue-400/90 border-blue-500',
  low: 'bg-gray-400/80 border-gray-500',
}

// 優先級標籤
const priorityLabels = {
  urgent: '緊急',
  high: '高',
  medium: '中',
  low: '低',
}

// 格式化時間 HH:mm
function formatTimeShort(isoString: string): string {
  const date = new Date(isoString)
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
}

// 格式化日期
function formatDate(dateString: string): string {
  const date = new Date(dateString.includes('T') ? dateString : `${dateString}T00:00:00`)
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

// 取得小時的分鐘數（本地時間）
function getMinutesOfDay(isoString: string): number {
  const date = new Date(isoString)
  return date.getHours() * 60 + date.getMinutes()
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

// 時間軸常量
const HOUR_HEIGHT = 60 // 每小時的像素高度
const LUNCH_START = 12 * 60 // 12:00
const LUNCH_END = 13 * 60 // 13:00

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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(scheduledTasks.map(t => t.taskId)))
  const groupedTasks = groupByDate(scheduledTasks)
  const sortedDates = Object.keys(groupedTasks).sort()

  const selectedCount = selectedIds.size
  // 計算勾選任務的總時數
  const selectedMinutes = scheduledTasks.filter(t => selectedIds.has(t.taskId)).reduce((sum, t) => sum + t.estimatedMinutes, 0)
  const totalHours = Math.round(selectedMinutes / 60 * 10) / 10

  const toggleTaskSelection = (taskId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(taskId)) {
        next.delete(taskId)
      } else {
        next.add(taskId)
      }
      return next
    })
  }

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

  // 計算一天的時間軸範圍
  const getTimelineRange = (tasks: ScheduledTaskPreview[]) => {
    if (tasks.length === 0) return { startHour: 9, endHour: 18 }
    const startMinutes = Math.min(...tasks.map(t => getMinutesOfDay(t.startTime)))
    const endMinutes = Math.max(...tasks.map(t => getMinutesOfDay(t.endTime)))
    const startHour = Math.floor(startMinutes / 60)
    const endHour = Math.ceil(endMinutes / 60)
    return { startHour, endHour }
  }

  return (
    <Card className="w-full max-w-2xl border-blue-200 bg-white">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Calendar className="h-5 w-5 text-blue-600" />
          排程預覽
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
            已選 {selectedCount}/{summary.successfullyScheduled} 項
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
          {selectedCount < summary.successfullyScheduled && (
            <button
              className="text-xs text-blue-600 hover:underline"
              onClick={() => setSelectedIds(new Set(scheduledTasks.map(t => t.taskId)))}
            >
              全選
            </button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4 max-h-[500px] overflow-y-auto">
        {/* 按日期顯示時間軸 */}
        {sortedDates.map((date) => {
          const dayTasks = groupedTasks[date]
          const { startHour, endHour } = getTimelineRange(dayTasks)
          const totalHours = endHour - startHour
          const timelineHeight = totalHours * HOUR_HEIGHT

          return (
            <div key={date} className="space-y-2">
              <h4 className="font-semibold text-sm text-blue-700">
                {formatDate(date)}
              </h4>

              {/* 時間軸容器 */}
              <div className="relative ml-1" style={{ height: timelineHeight }}>
                {/* 時間刻度線 + 標籤 */}
                {Array.from({ length: totalHours + 1 }, (_, i) => {
                  const hour = startHour + i
                  const y = i * HOUR_HEIGHT
                  return (
                    <div key={hour} className="absolute left-0 right-0" style={{ top: y }}>
                      <div className="flex items-center">
                        <span className="text-[11px] text-gray-400 w-10 text-right pr-2 -translate-y-1/2">
                          {hour.toString().padStart(2, '0')}:00
                        </span>
                        <div className="flex-1 border-t border-gray-200" />
                      </div>
                    </div>
                  )
                })}

                {/* 午休區塊 */}
                {startHour < 13 && endHour > 12 && (
                  <div
                    className="absolute left-10 right-0 bg-gray-50 border border-dashed border-gray-200 rounded flex items-center justify-center"
                    style={{
                      top: (Math.max(LUNCH_START, startHour * 60) - startHour * 60) / 60 * HOUR_HEIGHT,
                      height: (Math.min(LUNCH_END, endHour * 60) - Math.max(LUNCH_START, startHour * 60)) / 60 * HOUR_HEIGHT,
                    }}
                  >
                    <span className="text-[11px] text-gray-400">午休</span>
                  </div>
                )}

                {/* 任務色塊 */}
                {dayTasks.map((task) => {
                  const taskStartMin = getMinutesOfDay(task.startTime)
                  const taskEndMin = getMinutesOfDay(task.endTime)
                  const top = (taskStartMin - startHour * 60) / 60 * HOUR_HEIGHT
                  const height = Math.max((taskEndMin - taskStartMin) / 60 * HOUR_HEIGHT, 28)
                  const conflicts = taskConflicts.get(task.taskId)
                  const hasConflict = conflicts && conflicts.length > 0
                  const isSelected = selectedIds.has(task.taskId)

                  return (
                    <div
                      key={task.taskId}
                      className={cn(
                        "absolute left-10 right-0 rounded-md border-l-4 px-2.5 py-1 overflow-hidden cursor-pointer transition-all hover:shadow-md",
                        !isSelected && "opacity-30 grayscale",
                        hasConflict
                          ? "bg-orange-100 border-orange-400"
                          : priorityBlockColors[task.priority],
                      )}
                      style={{ top, height }}
                      onClick={() => toggleTaskSelection(task.taskId)}
                      title={isSelected ? '點擊取消選取' : '點擊選取此任務'}
                    >
                      {/* 編輯模式 */}
                      {editable && editingTaskId === task.taskId ? (
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="time"
                            defaultValue={extractHHMM(task.startTime)}
                            className="text-xs border rounded px-1 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 w-20"
                            onBlur={(e) => handleTimeChange(task.taskId, e.target.value, task)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleTimeChange(task.taskId, (e.target as HTMLInputElement).value, task)
                              if (e.key === 'Escape') setEditingTaskId(null)
                            }}
                            autoFocus
                          />
                          <span className="text-xs text-white/80">{task.estimatedMinutes}分</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 h-full">
                          {/* 勾選狀態指示 */}
                          <div className={cn(
                            "w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center",
                            isSelected
                              ? (hasConflict ? "bg-orange-600 border-orange-700" : "bg-white/30 border-white/60")
                              : "border-white/40 bg-transparent"
                          )}>
                            {isSelected && (
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <span
                            className={cn(
                              "text-[11px] font-mono shrink-0",
                              hasConflict ? "text-orange-700" : "text-white/90",
                              editable && "hover:underline cursor-text"
                            )}
                            onDoubleClick={(e) => {
                              if (editable) {
                                e.stopPropagation()
                                setEditingTaskId(task.taskId)
                              }
                            }}
                          >
                            {formatTimeShort(task.startTime)}
                          </span>
                          <span className={cn(
                            "text-sm font-medium truncate",
                            hasConflict ? "text-orange-900" : "text-white"
                          )}>
                            {task.taskTitle}
                          </span>
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px] py-0 shrink-0 border-white/40',
                              hasConflict ? "bg-orange-200 text-orange-800 border-orange-300" : "bg-white/20 text-white border-white/30"
                            )}
                          >
                            {priorityLabels[task.priority]}
                          </Badge>
                          {hasConflict && (
                            <Badge variant="outline" className="text-[10px] py-0 shrink-0 bg-orange-200 text-orange-700 border-orange-300">
                              ⚠ 衝突
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* 未能排程的任務 */}
        {unscheduledTasks.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-gray-200">
            <h4 className="font-medium text-sm text-yellow-700 flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              未能排進（時段不足）
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {unscheduledTasks.slice(0, 8).map((task) => (
                <Badge
                  key={task.taskId}
                  variant="outline"
                  className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200"
                >
                  {task.taskTitle}
                </Badge>
              ))}
              {unscheduledTasks.length > 8 && (
                <Badge variant="outline" className="text-xs bg-gray-50 text-gray-500 border-gray-200">
                  +{unscheduledTasks.length - 8} 項
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex gap-2 justify-end pt-4 border-t border-gray-200">
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={isConfirming}
        >
          取消
        </Button>
        <Button
          onClick={() => onConfirm(selectedIds)}
          disabled={isConfirming || selectedCount === 0}
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
              套用排程（{selectedCount} 項）
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
                  <span className="text-xs font-mono">{formatTimeShort(task.startTime)}</span>
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
