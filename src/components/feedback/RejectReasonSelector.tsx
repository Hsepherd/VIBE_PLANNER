'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { recordNegativeExample } from '@/lib/preferences'

interface RejectReasonSelectorProps {
  task: Record<string, unknown>
  contextSnippet?: string
  onReasonSelected?: () => void
  className?: string
}

const REJECT_REASONS = [
  { id: 'trivial', label: '太瑣碎' },
  { id: 'completed', label: '已完成' },
  { id: 'not_mine', label: '非我負責' },
  { id: 'vague', label: '太模糊' },
]

export default function RejectReasonSelector({
  task,
  contextSnippet,
  onReasonSelected,
  className = '',
}: RejectReasonSelectorProps) {
  const [selectedReason, setSelectedReason] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSelectReason = async (reasonId: string) => {
    if (isSubmitting) return

    setIsSubmitting(true)
    try {
      setSelectedReason(reasonId)
      await recordNegativeExample(task, reasonId, contextSnippet)
      onReasonSelected?.()
    } catch (error) {
      console.error('記錄拒絕原因失敗:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSkip = async () => {
    if (isSubmitting) return

    setIsSubmitting(true)
    try {
      // 不提供原因也記錄負面範例
      await recordNegativeExample(task, undefined, contextSnippet)
      onReasonSelected?.()
    } catch (error) {
      console.error('記錄負面範例失敗:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (selectedReason) {
    return (
      <div className={`text-xs text-muted-foreground ${className}`}>
        已記錄，謝謝回饋！
      </div>
    )
  }

  return (
    <div className={className}>
      <p className="text-xs text-muted-foreground mb-2">
        💡 為什麼不需要？（可跳過）
      </p>
      <div className="flex flex-wrap gap-1">
        {REJECT_REASONS.map((reason) => (
          <Button
            key={reason.id}
            variant="outline"
            size="sm"
            className="h-6 text-xs px-2"
            onClick={() => handleSelectReason(reason.id)}
            disabled={isSubmitting}
          >
            {reason.label}
          </Button>
        ))}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs px-2 text-muted-foreground"
          onClick={handleSkip}
          disabled={isSubmitting}
        >
          跳過
        </Button>
      </div>
    </div>
  )
}
