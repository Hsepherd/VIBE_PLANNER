import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getAuthUrl } from '@/lib/google'

// GET: 重導向到 Google OAuth 授權頁面
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
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.redirect(new URL('/login?error=not_logged_in', request.url))
    }

    // 產生授權 URL，state 包含使用者 ID
    const state = Buffer.from(JSON.stringify({ userId: user.id })).toString('base64')
    const authUrl = getAuthUrl(state)

    return NextResponse.redirect(authUrl)
  } catch (error) {
    console.error('Google OAuth 初始化錯誤:', error)
    return NextResponse.json({ error: '內部伺服器錯誤' }, { status: 500 })
  }
}
