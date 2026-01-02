import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import {
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from '@/lib/googleCalendar'
import { refreshAccessToken } from '@/lib/google'

// POST: 執行同步
export async function POST(request: NextRequest) {
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
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: '未登入' }, { status: 401 })
    }

    // 使用 service role 讀取設定和任務
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 取得使用者設定
    const { data: settings, error: settingsError } = await adminSupabase
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (settingsError || !settings?.google_connected) {
      return NextResponse.json({ error: 'Google Calendar 未連接' }, { status: 400 })
    }

    // 檢查 token 是否過期，需要時刷新
    let accessToken = settings.google_access_token
    const tokenExpiry = settings.google_token_expiry ? new Date(settings.google_token_expiry) : null

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
        return NextResponse.json({ error: 'Token 已過期，請重新連接 Google Calendar' }, { status: 401 })
      }
    }

    // 取得需要同步的任務（有到期日或開始日期的）
    const { data: tasks, error: tasksError } = await adminSupabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .or('due_date.not.is.null,start_date.not.is.null')

    if (tasksError) {
      console.error('取得任務錯誤:', tasksError)
      return NextResponse.json({ error: '取得任務失敗' }, { status: 500 })
    }

    let syncedCount = 0
    const calendarId = settings.calendar_id || 'primary'

    // 同步每個任務
    for (const task of tasks || []) {
      try {
        const taskData = {
          id: task.id,
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          dueDate: task.due_date,
          startDate: task.start_date,
          google_event_id: task.google_event_id,
        }

        if (task.google_event_id) {
          // 更新現有事件
          const success = await updateCalendarEvent(
            accessToken!,
            settings.google_refresh_token,
            task.google_event_id,
            taskData,
            calendarId
          )
          if (success) syncedCount++
        } else {
          // 建立新事件
          const eventId = await createCalendarEvent(
            accessToken!,
            settings.google_refresh_token,
            taskData,
            calendarId
          )
          if (eventId) {
            // 更新任務的 google_event_id
            await adminSupabase
              .from('tasks')
              .update({
                google_event_id: eventId,
                synced_to_google: true,
                last_google_sync_at: new Date().toISOString(),
              })
              .eq('id', task.id)
            syncedCount++
          }
        }
      } catch (syncError) {
        console.error(`同步任務 ${task.id} 失敗:`, syncError)
      }
    }

    // 更新最後同步時間
    await adminSupabase
      .from('user_settings')
      .update({
        last_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)

    return NextResponse.json({
      success: true,
      synced: syncedCount,
      total: tasks?.length || 0,
    })
  } catch (error) {
    console.error('同步錯誤:', error)
    return NextResponse.json({ error: '同步失敗' }, { status: 500 })
  }
}
