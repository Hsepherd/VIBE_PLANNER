import { createClient } from '@supabase/supabase-js'
import { getCalendarEvents } from '@/lib/googleCalendar'
import { refreshAccessToken } from '@/lib/google'

interface GetAvailableSlotsArgs {
  startDate: string
  endDate?: string
  workStart?: string
  workEnd?: string
}

interface TimeSlot {
  start: string
  end: string
  minutes: number
}

interface BusyEvent {
  start: string
  end: string
  title: string
}

interface AvailableSlotsResult {
  googleConnected: boolean
  warning?: string
  workingHours: { start: string; end: string }
  slots: Record<string, TimeSlot[]>
  busyEvents: Record<string, BusyEvent[]>
}

/**
 * 取得使用者的可用時段
 */
export async function getAvailableSlots(
  userId: string,
  args: GetAvailableSlotsArgs
): Promise<AvailableSlotsResult> {
  // 正規化為 HH:MM 格式（偏好設定可能帶秒數 HH:MM:SS）
  const rawWorkStart = args.workStart || '09:00'
  const rawWorkEnd = args.workEnd || '18:00'
  const workStart = rawWorkStart.length > 5 ? rawWorkStart.substring(0, 5) : rawWorkStart
  const workEnd = rawWorkEnd.length > 5 ? rawWorkEnd.substring(0, 5) : rawWorkEnd

  const startDate = new Date(args.startDate)
  const endDate = args.endDate ? new Date(args.endDate) : new Date(args.startDate)

  // 設定查詢範圍
  startDate.setHours(0, 0, 0, 0)
  endDate.setHours(23, 59, 59, 999)

  // 使用 service role 存取資料
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 取得使用者設定
  const { data: settings } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .single()

  const result: AvailableSlotsResult = {
    googleConnected: !!settings?.google_connected,
    workingHours: { start: workStart, end: workEnd },
    slots: {},
    busyEvents: {},
  }

  // 如果未連接 Google Calendar，回傳全工作時段
  if (!settings?.google_connected) {
    result.warning = 'Google Calendar 未連接，假設全天可用'

    const currentDate = new Date(startDate)
    while (currentDate <= endDate) {
      const dateKey = formatDateKey(currentDate)
      const workMinutes = calculateMinutesBetween(workStart, workEnd)
      result.slots[dateKey] = [
        { start: workStart, end: workEnd, minutes: workMinutes },
      ]
      result.busyEvents[dateKey] = []
      currentDate.setDate(currentDate.getDate() + 1)
    }

    return result
  }

  // 有連接 Google Calendar，取得行程
  let accessToken = settings.google_access_token
  const tokenExpiry = settings.google_token_expiry
    ? new Date(settings.google_token_expiry)
    : null

  // 檢查並刷新 token
  if (tokenExpiry && tokenExpiry < new Date() && settings.google_refresh_token) {
    try {
      const newCredentials = await refreshAccessToken(settings.google_refresh_token)
      accessToken = newCredentials.access_token

      // 更新 token
      await supabase
        .from('user_settings')
        .update({
          google_access_token: newCredentials.access_token,
          google_token_expiry: newCredentials.expiry_date
            ? new Date(newCredentials.expiry_date).toISOString()
            : null,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
    } catch (refreshError) {
      console.error('[AI Function] Token refresh failed:', refreshError)
      result.warning = 'Google Calendar 授權已過期，目前使用預設工作時段排程。請至設定頁面重新連接 Google Calendar。'
      result.googleConnected = false

      // 回傳全工作時段（扣除午休時間 12:00-13:00）
      const currentDate = new Date(startDate)
      while (currentDate <= endDate) {
        const dateKey = formatDateKey(currentDate)
        const lunchStart = '12:00'
        const lunchEnd = '13:00'
        const morningMinutes = calculateMinutesBetween(workStart, lunchStart)
        const afternoonMinutes = calculateMinutesBetween(lunchEnd, workEnd)
        const slots: TimeSlot[] = []

        // 上午時段（如果工作開始時間在午休前）
        if (morningMinutes > 0 && timeToMinutes(workStart) < timeToMinutes(lunchStart)) {
          slots.push({ start: workStart, end: lunchStart, minutes: morningMinutes })
        }
        // 下午時段（如果工作結束時間在午休後）
        if (afternoonMinutes > 0 && timeToMinutes(workEnd) > timeToMinutes(lunchEnd)) {
          slots.push({ start: lunchEnd, end: workEnd, minutes: afternoonMinutes })
        }
        // 如果沒有有效時段，回傳整段工作時間
        if (slots.length === 0) {
          const workMinutes = calculateMinutesBetween(workStart, workEnd)
          slots.push({ start: workStart, end: workEnd, minutes: workMinutes })
        }

        result.slots[dateKey] = slots
        result.busyEvents[dateKey] = []
        currentDate.setDate(currentDate.getDate() + 1)
      }

      return result
    }
  }

  // 取得 Google Calendar 行程
  const calendarId = settings.calendar_id || 'primary'
  let events: Array<{ id: string; summary: string; start: string; end: string }> = []

  try {
    events = await getCalendarEvents(
      accessToken,
      settings.google_refresh_token,
      calendarId,
      startDate.toISOString(),
      endDate.toISOString()
    )
  } catch (calendarError) {
    console.error('[AI Function] Calendar fetch failed:', calendarError)
    result.warning = '取得 Google Calendar 行程失敗'
  }

  // 按日期分組並計算可用時段
  const currentDate = new Date(startDate)
  while (currentDate <= endDate) {
    const dateKey = formatDateKey(currentDate)
    const dayStart = new Date(currentDate)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(currentDate)
    dayEnd.setHours(23, 59, 59, 999)

    // 找出這一天的行程
    const dayEvents = events.filter((event) => {
      const eventStart = new Date(event.start)
      const eventEnd = new Date(event.end)
      return eventStart < dayEnd && eventEnd > dayStart
    })

    // 轉換為忙碌時段
    const busySlots = dayEvents.map((event) => ({
      start: formatTime(new Date(event.start)),
      end: formatTime(new Date(event.end)),
      title: event.summary || '無標題',
    }))

    result.busyEvents[dateKey] = busySlots

    // 計算可用時段
    const availableSlots = calculateAvailableSlots(
      workStart,
      workEnd,
      busySlots.map((s) => ({ start: s.start, end: s.end }))
    )

    result.slots[dateKey] = availableSlots

    currentDate.setDate(currentDate.getDate() + 1)
  }

  return result
}

// 輔助函數
function formatDateKey(date: Date): string {
  // 使用本地日期格式，避免 UTC 時區偏移導致日期錯誤
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatTime(date: Date): string {
  return date.toTimeString().slice(0, 5)
}

function calculateMinutesBetween(start: string, end: string): number {
  const [startHour, startMin] = start.split(':').map(Number)
  const [endHour, endMin] = end.split(':').map(Number)
  return (endHour * 60 + endMin) - (startHour * 60 + startMin)
}

function timeToMinutes(time: string): number {
  const [hour, min] = time.split(':').map(Number)
  return hour * 60 + min
}

function minutesToTime(minutes: number): string {
  const hour = Math.floor(minutes / 60)
  const min = minutes % 60
  return `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`
}

function calculateAvailableSlots(
  workStart: string,
  workEnd: string,
  busySlots: Array<{ start: string; end: string }>
): TimeSlot[] {
  const workStartMin = timeToMinutes(workStart)
  const workEndMin = timeToMinutes(workEnd)

  const busyRanges = busySlots
    .map((slot) => ({
      start: Math.max(timeToMinutes(slot.start), workStartMin),
      end: Math.min(timeToMinutes(slot.end), workEndMin),
    }))
    .filter((range) => range.start < range.end)
    .sort((a, b) => a.start - b.start)

  const mergedBusy: Array<{ start: number; end: number }> = []
  for (const range of busyRanges) {
    if (mergedBusy.length === 0) {
      mergedBusy.push(range)
    } else {
      const last = mergedBusy[mergedBusy.length - 1]
      if (range.start <= last.end) {
        last.end = Math.max(last.end, range.end)
      } else {
        mergedBusy.push(range)
      }
    }
  }

  const availableSlots: TimeSlot[] = []
  let currentStart = workStartMin

  for (const busy of mergedBusy) {
    if (currentStart < busy.start) {
      availableSlots.push({
        start: minutesToTime(currentStart),
        end: minutesToTime(busy.start),
        minutes: busy.start - currentStart,
      })
    }
    currentStart = Math.max(currentStart, busy.end)
  }

  if (currentStart < workEndMin) {
    availableSlots.push({
      start: minutesToTime(currentStart),
      end: minutesToTime(workEndMin),
      minutes: workEndMin - currentStart,
    })
  }

  return availableSlots
}
