// 測試 Supabase Auth 設定
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://krhjaacfuajuzkcvwsjc.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyaGphYWNmdWFqdXprY3Z3c2pjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxMjg3OTgsImV4cCI6MjA3OTcwNDc5OH0.VZqCojebrFSIxAS8tuq7PEJOZf_trxmpV9pGO0N_5sM'

const supabase = createClient(supabaseUrl, supabaseKey)

// 測試註冊（用隨機信箱）
const testEmail = `test${Date.now()}@gmail.com`
const testPassword = 'test123456'

console.log('🔍 測試 Supabase Auth 設定...\n')
console.log('測試信箱:', testEmail)

try {
  const { data, error } = await supabase.auth.signUp({
    email: testEmail,
    password: testPassword,
  })

  if (error) {
    console.log('\n❌ 註冊失敗:', error.message)

    if (error.message.includes('Signups not allowed')) {
      console.log('\n⚠️  Email Auth 尚未啟用！')
      console.log('請到 Supabase Dashboard → Authentication → Providers → Email 啟用')
    }
  } else {
    console.log('\n✅ Auth 已正確設定！')

    if (data.user && !data.session) {
      console.log('📧 需要信箱驗證（Confirm email 已開啟）')
      console.log('   如果想跳過驗證，請到 Supabase Dashboard → Authentication → Providers → Email')
      console.log('   關閉 "Confirm email" 選項')
    } else if (data.session) {
      console.log('🎉 註冊成功且已自動登入（Confirm email 已關閉）')
      console.log('   這是最適合開發測試的設定')
    }

    console.log('\nUser ID:', data.user?.id)
  }
} catch (err) {
  console.log('\n❌ 發生錯誤:', err.message)
}
