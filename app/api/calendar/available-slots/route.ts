import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { getCalendarEvents } from '@/lib/googleCalendar'
import { refreshAccessToken } from '@/lib/google'

/**
 * GET /api/calendar/available-slots
 * 取得 Google Calendar 可用時段
 *
 * Query Parameters:
 * - startDate: ISO date string (required)
 * - endDate: ISO date string (optional, default = startDate)
 * - workStart: HH:mm (optional, default = 09:00)
 * - workEnd: HH:mm (optional, default = 18:00)
 */
export async function GET(request: NextRequest) {
  try {
    // 建立 Supabase 客戶端
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
        },
      }
    )

    // 驗證使用者
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: '未授權' },
        { status: 401 }
      )
    }

    // 取得查詢參數
    const { searchParams } = new URL(request.url)
    const startDateStr = searchParams.get('startDate')
    const endDateStr = searchParams.get('endDate')
    const workStart = searchParams.get('workStart') || '09:00'
    const workEnd = searchParams.get('workEnd') || '18:00'

    // 驗證必要參數
    if (!startDateStr) {
      return NextResponse.json(
        { success: false, error: '缺少 startDate 參數' },
        { status: 400 }
      )
    }

    const startDate = new Date(startDateStr)
    const endDate = endDateStr ? new Date(endDateStr) : new Date(startDateStr)

    // 設定查詢範圍（包含整天）
    startDate.setHours(0, 0, 0, 0)
    endDate.setHours(23, 59, 59, 999)

    // 使用 service role 讀取設定
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 取得使用者設定
    const { data: settings } = await adminSupabase
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .single()

    // 準備結果
    const result: {
      success: boolean
      googleConnected: boolean
      warning?: string
      workingHours: { start: string; end: string }
      slots: Record<string, Array<{ start: string; end: string; minutes: number }>>
      busyEvents: Record<string, Array<{ start: string; end: string; title: string }>>
    } = {
      success: true,
      googleConnected: !!settings?.google_connected,
      workingHours: { start: workStart, end: workEnd },
      slots: {},
      busyEvents: {},
    }

    // 如果未連接 Google Calendar，回傳全工作時段
    if (!settings?.google_connected) {
      result.warning = 'Google Calendar 未連接，無法檢測衝突'

      // 產生每天的全工作時段
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

      return NextResponse.json(result)
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
        await adminSupabase
          .from('user_settings')
          .update({
            google_access_token: newCredentials.access_token,
            google_token_expiry: newCredentials.expiry_date
              ? new Date(newCredentials.expiry_date).toISOString()
              : null,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id)
      } catch (refreshError) {
        console.error('刷新 token 失敗:', refreshError)
        result.warning = 'Token 已過期，請重新連接 Google Calendar'
        result.googleConnected = false

        // 回傳全工作時段
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

        return NextResponse.json(result)
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
      console.error('取得 Google Calendar 行程失敗:', calendarError)
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

    return NextResponse.json(result)
  } catch (error) {
    console.error('[API] 取得可用時段失敗:', error)
    return NextResponse.json(
      { success: false, error: '伺服器內部錯誤' },
      { status: 500 }
    )
  }
}

// 輔助函數：格式化日期為 YYYY-MM-DD
function formatDateKey(date: Date): string {
  return date.toISOString().split('T')[0]
}

// 輔助函數：格式化時間為 HH:mm
function formatTime(date: Date): string {
  return date.toTimeString().slice(0, 5)
}

// 輔助函數：計算兩個時間之間的分鐘數
function calculateMinutesBetween(start: string, end: string): number {
  const [startHour, startMin] = start.split(':').map(Number)
  const [endHour, endMin] = end.split(':').map(Number)
  return (endHour * 60 + endMin) - (startHour * 60 + startMin)
}

// 輔助函數：將時間字串轉為分鐘數
function timeToMinutes(time: string): number {
  const [hour, min] = time.split(':').map(Number)
  return hour * 60 + min
}

// 輔助函數：將分鐘數轉為時間字串
function minutesToTime(minutes: number): string {
  const hour = Math.floor(minutes / 60)
  const min = minutes % 60
  return `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`
}

// 計算可用時段
function calculateAvailableSlots(
  workStart: string,
  workEnd: string,
  busySlots: Array<{ start: string; end: string }>
): Array<{ start: string; end: string; minutes: number }> {
  const workStartMin = timeToMinutes(workStart)
  const workEndMin = timeToMinutes(workEnd)

  // 將忙碌時段轉為分鐘並限制在工作時段內
  const busyRanges = busySlots
    .map((slot) => ({
      start: Math.max(timeToMinutes(slot.start), workStartMin),
      end: Math.min(timeToMinutes(slot.end), workEndMin),
    }))
    .filter((range) => range.start < range.end) // 過濾無效區間
    .sort((a, b) => a.start - b.start) // 按開始時間排序

  // 合併重疊的忙碌區間
  const mergedBusy: Array<{ start: number; end: number }> = []
  for (const range of busyRanges) {
    if (mergedBusy.length === 0) {
      mergedBusy.push(range)
    } else {
      const last = mergedBusy[mergedBusy.length - 1]
      if (range.start <= last.end) {
        // 重疊，合併
        last.end = Math.max(last.end, range.end)
      } else {
        mergedBusy.push(range)
      }
    }
  }

  // 計算空檔
  const availableSlots: Array<{ start: string; end: string; minutes: number }> = []
  let currentStart = workStartMin

  for (const busy of mergedBusy) {
    if (currentStart < busy.start) {
      // 有空檔
      availableSlots.push({
        start: minutesToTime(currentStart),
        end: minutesToTime(busy.start),
        minutes: busy.start - currentStart,
      })
    }
    currentStart = Math.max(currentStart, busy.end)
  }

  // 最後一個空檔（到工作結束時間）
  if (currentStart < workEndMin) {
    availableSlots.push({
      start: minutesToTime(currentStart),
      end: minutesToTime(workEndMin),
      minutes: workEndMin - currentStart,
    })
  }

  return availableSlots
}
