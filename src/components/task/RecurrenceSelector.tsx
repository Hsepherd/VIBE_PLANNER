'use client'

import { useState } from 'react'
import { Repeat, ChevronDown, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import type { RecurrenceType } from '@/lib/useSupabaseTasks'
import type { RecurrenceConfig } from '@/lib/supabase-api'
import { cn } from '@/lib/utils'

interface RecurrenceSelectorProps {
  value?: RecurrenceType
  config?: RecurrenceConfig
  onChange: (type: RecurrenceType, config?: RecurrenceConfig) => void
  className?: string
}

const recurrenceOptions: { value: RecurrenceType; label: string; description: string }[] = [
  { value: 'none', label: '不重複', description: '單次任務' },
  { value: 'daily', label: '每天', description: '每天重複' },
  { value: 'weekly', label: '每週', description: '每週重複' },
  { value: 'monthly', label: '每月', description: '每月重複' },
  { value: 'yearly', label: '每年', description: '每年重複' },
]

const weekdayOptions = [
  { value: 1, label: '一' },
  { value: 2, label: '二' },
  { value: 3, label: '三' },
  { value: 4, label: '四' },
  { value: 5, label: '五' },
  { value: 6, label: '六' },
  { value: 7, label: '日' },
]

export function RecurrenceSelector({
  value = 'none',
  config,
  onChange,
  className,
}: RecurrenceSelectorProps) {
  const [open, setOpen] = useState(false)
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>(
    config?.weekdays || []
  )

  const selectedOption = recurrenceOptions.find(opt => opt.value === value)

  const handleSelect = (type: RecurrenceType) => {
    if (type === 'weekly' && selectedWeekdays.length > 0) {
      onChange(type, { weekdays: selectedWeekdays })
    } else {
      onChange(type, undefined)
    }
    setOpen(false)
  }

  const toggleWeekday = (day: number) => {
    const newWeekdays = selectedWeekdays.includes(day)
      ? selectedWeekdays.filter(d => d !== day)
      : [...selectedWeekdays, day].sort((a, b) => a - b)
    setSelectedWeekdays(newWeekdays)
    if (value === 'weekly') {
      onChange('weekly', { weekdays: newWeekdays })
    }
  }

  // 顯示文字
  const displayText = value === 'none'
    ? '不重複'
    : value === 'weekly' && selectedWeekdays.length > 0
      ? `每週 ${selectedWeekdays.map(d => weekdayOptions.find(w => w.value === d)?.label).join('、')}`
      : selectedOption?.label || '不重複'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'h-7 px-2 text-xs gap-1',
            value !== 'none' && 'text-blue-600 bg-blue-50 hover:bg-blue-100',
            className
          )}
        >
          <Repeat className="w-3 h-3" />
          <span className="max-w-[100px] truncate">{displayText}</span>
          <ChevronDown className="w-3 h-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div className="space-y-1">
          {recurrenceOptions.map(option => (
            <button
              key={option.value}
              onClick={() => handleSelect(option.value)}
              className={cn(
                'w-full flex items-center justify-between px-3 py-2 rounded-md text-sm hover:bg-gray-100 transition-colors',
                value === option.value && 'bg-blue-50 text-blue-600'
              )}
            >
              <div className="flex flex-col items-start">
                <span className="font-medium">{option.label}</span>
                <span className="text-xs text-gray-500">{option.description}</span>
              </div>
              {value === option.value && (
                <Check className="w-4 h-4 text-blue-600" />
              )}
            </button>
          ))}
        </div>

        {/* 每週特殊設定：選擇週幾 */}
        {value === 'weekly' && (
          <div className="mt-3 pt-3 border-t">
            <div className="text-xs text-gray-500 mb-2">選擇週幾重複</div>
            <div className="flex gap-1">
              {weekdayOptions.map(day => (
                <button
                  key={day.value}
                  onClick={() => toggleWeekday(day.value)}
                  className={cn(
                    'w-8 h-8 rounded-full text-xs font-medium transition-colors',
                    selectedWeekdays.includes(day.value)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

// 顯示重複標籤的元件（用於任務卡片）
export function RecurrenceBadge({
  type,
  config,
  className,
}: {
  type?: RecurrenceType
  config?: RecurrenceConfig
  className?: string
}) {
  if (!type || type === 'none') return null

  const option = recurrenceOptions.find(opt => opt.value === type)
  const weekdaysText = type === 'weekly' && config?.weekdays && config.weekdays.length > 0
    ? ` (${config.weekdays.map(d => weekdayOptions.find(w => w.value === d)?.label).join('、')})`
    : ''

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-blue-50 text-blue-600',
        className
      )}
    >
      <Repeat className="w-3 h-3" />
      {option?.label}{weekdaysText}
    </span>
  )
}
