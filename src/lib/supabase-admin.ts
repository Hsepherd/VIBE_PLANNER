import { createClient } from '@supabase/supabase-js'

// 伺服器端專用的 Supabase Admin Client
// 使用 service_role key，有完整權限
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

// 管理員 email 列表
export const ADMIN_EMAILS = [
  process.env.ADMIN_EMAIL || 'xk4xk4563022@gmail.com',
]

// 檢查是否為管理員
export function isAdmin(email: string | undefined): boolean {
  if (!email) return false
  return ADMIN_EMAILS.includes(email)
}
