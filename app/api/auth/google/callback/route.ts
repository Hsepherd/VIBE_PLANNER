import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getTokensFromCode, getUserInfo } from '@/lib/google'

// 建立 Supabase 客戶端（使用 service role 來寫入資料）
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET: 處理 Google OAuth 回調
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    // 處理錯誤
    if (error) {
      console.error('Google OAuth 錯誤:', error)
      return NextResponse.redirect(new URL('/settings?error=google_auth_failed', request.url))
    }

    if (!code || !state) {
      return NextResponse.redirect(new URL('/settings?error=missing_params', request.url))
    }

    // 解析 state 取得使用者 ID
    let userId: string
    try {
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString())
      userId = stateData.userId
    } catch {
      return NextResponse.redirect(new URL('/settings?error=invalid_state', request.url))
    }

    // 用授權碼交換 tokens
    const tokens = await getTokensFromCode(code)

    if (!tokens.access_token) {
      return NextResponse.redirect(new URL('/settings?error=no_access_token', request.url))
    }

    // 取得 Google 使用者資訊
    const googleUser = await getUserInfo(tokens.access_token)

    // 儲存 tokens 到 Supabase user_settings 表
    const { error: upsertError } = await supabase
      .from('user_settings')
      .upsert({
        user_id: userId,
        google_access_token: tokens.access_token,
        google_refresh_token: tokens.refresh_token,
        google_token_expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
        google_email: googleUser.email,
        google_connected: true,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      })

    if (upsertError) {
      console.error('儲存 Google tokens 錯誤:', upsertError)
      return NextResponse.redirect(new URL('/settings?error=save_failed', request.url))
    }

    // 重導向回設定頁面
    return NextResponse.redirect(new URL('/settings?success=google_connected', request.url))
  } catch (error) {
    console.error('Google OAuth 回調錯誤:', error)
    return NextResponse.redirect(new URL('/settings?error=callback_failed', request.url))
  }
}
