'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ThumbsUp, ThumbsDown } from 'lucide-react'
import { recordFeedback } from '@/lib/preferences'

interface FeedbackButtonsProps {
  messageContent: string
  context?: Record<string, unknown>
  className?: string
}

export default function FeedbackButtons({
  messageContent,
  context,
  className = '',
}: FeedbackButtonsProps) {
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleFeedback = async (type: 'up' | 'down') => {
    if (feedback || isSubmitting) return

    setIsSubmitting(true)
    try {
      await recordFeedback(
        type === 'up' ? 'thumbs_up' : 'thumbs_down',
        messageContent,
        context
      )
      setFeedback(type)
    } catch (error) {
      console.error('回饋記錄失敗:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <span className="text-xs text-muted-foreground mr-1">有幫助嗎？</span>
      <Button
        variant="ghost"
        size="sm"
        className={`h-7 w-7 p-0 ${feedback === 'up' ? 'text-green-500 bg-green-500/10' : ''}`}
        onClick={() => handleFeedback('up')}
        disabled={feedback !== null || isSubmitting}
      >
        <ThumbsUp className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={`h-7 w-7 p-0 ${feedback === 'down' ? 'text-red-500 bg-red-500/10' : ''}`}
        onClick={() => handleFeedback('down')}
        disabled={feedback !== null || isSubmitting}
      >
        <ThumbsDown className="h-3.5 w-3.5" />
      </Button>
      {feedback && (
        <span className="text-xs text-muted-foreground ml-1">
          感謝回饋！
        </span>
      )}
    </div>
  )
}
