import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// GET: 取得 Google Calendar 連接狀態
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
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: '未登入' }, { status: 401 })
    }

    // 使用 service role 讀取設定
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: settings, error } = await adminSupabase
      .from('user_settings')
      .select('google_connected, google_email, calendar_sync_enabled, calendar_sync_direction, last_sync_at')
      .eq('user_id', user.id)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('取得設定錯誤:', error)
      return NextResponse.json({ error: '取得設定失敗' }, { status: 500 })
    }

    return NextResponse.json({
      connected: settings?.google_connected || false,
      email: settings?.google_email || null,
      syncEnabled: settings?.calendar_sync_enabled || false,
      syncDirection: settings?.calendar_sync_direction || 'to_google',
      lastSyncAt: settings?.last_sync_at || null,
    })
  } catch (error) {
    console.error('取得設定錯誤:', error)
    return NextResponse.json({ error: '內部伺服器錯誤' }, { status: 500 })
  }
}

// PATCH: 更新同步設定
export async function PATCH(request: NextRequest) {
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

    const body = await request.json()
    const { syncEnabled, syncDirection } = body

    // 使用 service role 更新設定
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { error } = await adminSupabase
      .from('user_settings')
      .update({
        calendar_sync_enabled: syncEnabled,
        calendar_sync_direction: syncDirection,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)

    if (error) {
      console.error('更新設定錯誤:', error)
      return NextResponse.json({ error: '更新設定失敗' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('更新設定錯誤:', error)
    return NextResponse.json({ error: '內部伺服器錯誤' }, { status: 500 })
  }
}

// DELETE: 斷開 Google Calendar 連接
export async function DELETE(request: NextRequest) {
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

    // 使用 service role 更新設定
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { error } = await adminSupabase
      .from('user_settings')
      .update({
        google_connected: false,
        google_access_token: null,
        google_refresh_token: null,
        google_token_expiry: null,
        google_email: null,
        calendar_sync_enabled: false,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)

    if (error) {
      console.error('斷開連接錯誤:', error)
      return NextResponse.json({ error: '斷開連接失敗' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('斷開連接錯誤:', error)
    return NextResponse.json({ error: '內部伺服器錯誤' }, { status: 500 })
  }
}
