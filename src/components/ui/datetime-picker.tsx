'use client'

import * as React from 'react'
import { Calendar as CalendarComponent } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { zhTW } from 'date-fns/locale'
import { format, setHours, setMinutes } from 'date-fns'

interface DateTimePickerProps {
  value?: Date
  onChange: (date: Date | undefined) => void
  onClose?: () => void
  showClear?: boolean
}

export function DateTimePicker({ value, onChange, onClose, showClear = true }: DateTimePickerProps) {
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(value)
  const [timeValue, setTimeValue] = React.useState(
    value ? format(value, 'HH:mm') : ''
  )

  // 當 value 改變時更新內部狀態
  React.useEffect(() => {
    setSelectedDate(value)
    setTimeValue(value ? format(value, 'HH:mm') : '')
  }, [value])

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) {
      setSelectedDate(undefined)
      return
    }

    // 保留時間
    let newDate = date
    if (timeValue) {
      const [hours, minutes] = timeValue.split(':').map(Number)
      newDate = setMinutes(setHours(date, hours || 0), minutes || 0)
    }
    setSelectedDate(newDate)
    onChange(newDate)
  }

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = e.target.value
    setTimeValue(time)

    if (selectedDate && time) {
      const [hours, minutes] = time.split(':').map(Number)
      const newDate = setMinutes(setHours(selectedDate, hours || 0), minutes || 0)
      setSelectedDate(newDate)
      onChange(newDate)
    }
  }

  const handleClear = () => {
    setSelectedDate(undefined)
    setTimeValue('')
    onChange(undefined)
    onClose?.()
  }

  return (
    <div className="p-0">
      <CalendarComponent
        mode="single"
        selected={selectedDate}
        onSelect={handleDateSelect}
        locale={zhTW}
      />
      <div className="p-3 border-t space-y-2">
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 shrink-0">時間</label>
          <Input
            type="time"
            value={timeValue}
            onChange={handleTimeChange}
            className="h-8 text-sm"
          />
        </div>
        {showClear && selectedDate && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-gray-500 hover:text-red-500"
            onClick={handleClear}
          >
            清除
          </Button>
        )}
      </div>
    </div>
  )
}
