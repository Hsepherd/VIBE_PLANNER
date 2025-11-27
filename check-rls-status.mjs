// 檢查 RLS 是否真的有效
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://krhjaacfuajuzkcvwsjc.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyaGphYWNmdWFqdXprY3Z3c2pjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxMjg3OTgsImV4cCI6MjA3OTcwNDc5OH0.VZqCojebrFSIxAS8tuq7PEJOZf_trxmpV9pGO0N_5sM'

const supabase = createClient(supabaseUrl, supabaseKey)

console.log('🔍 檢查 RLS 狀態...\n')

// 1. 匿名使用者（未登入）嘗試讀取任務
console.log('=== 測試 1: 未登入狀態 ===')
const { data: anonTasks, error: anonError } = await supabase
  .from('tasks')
  .select('id, title, user_id')
  .limit(5)

if (anonError) {
  console.log('❌ 錯誤:', anonError.message)
  console.log('✅ RLS 阻止了未登入使用者')
} else {
  console.log(`⚠️ 未登入仍可讀取 ${anonTasks?.length || 0} 筆任務`)
  if (anonTasks && anonTasks.length > 0) {
    console.log('任務範例:')
    anonTasks.forEach(t => {
      console.log(`  - ${t.title.substring(0, 30)}... | user_id: ${t.user_id || '(空)'}`)
    })
  }
}

// 2. 檢查任務的 user_id 分佈
console.log('\n=== 任務 user_id 統計 ===')
const { data: allTasks } = await supabase
  .from('tasks')
  .select('user_id')

const userIdCount = {}
allTasks?.forEach(t => {
  const key = t.user_id || '(null)'
  userIdCount[key] = (userIdCount[key] || 0) + 1
})

Object.entries(userIdCount).forEach(([userId, count]) => {
  console.log(`  ${userId}: ${count} 筆`)
})

console.log('\n💡 如果未登入仍可讀取任務，RLS 可能未正確啟用')
console.log('   請到 Supabase Dashboard → Table Editor → tasks → 確認 RLS 已開啟')
