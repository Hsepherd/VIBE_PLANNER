import { NextResponse } from 'next/server'

// 隱藏敏感資訊的函數
function maskApiKey(key: string | undefined) {
  if (!key) return '未設定'
  if (key.length <= 10) return '***'
  return key.substring(0, 7) + '***' + key.substring(key.length - 4)
}

function maskUrl(url: string | undefined) {
  if (!url) return '未設定'
  // 顯示 https://xxx***.supabase.co
  const match = url.match(/^(https:\/\/)([^.]+)(\.supabase\.co.*)$/)
  if (match) {
    const prefix = match[2].substring(0, 3)
    return `${match[1]}${prefix}***${match[3]}`
  }
  return url.substring(0, 15) + '***'
}

export async function GET() {
  const openaiApiKey = process.env.OPENAI_API_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  return NextResponse.json({
    openai: {
      configured: !!openaiApiKey,
      masked: maskApiKey(openaiApiKey),
      full: openaiApiKey || '',
    },
    supabase: {
      configured: !!supabaseUrl,
      masked: maskUrl(supabaseUrl),
      full: supabaseUrl || '',
    },
  })
}
