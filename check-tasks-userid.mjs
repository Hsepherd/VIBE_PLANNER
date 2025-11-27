// 檢查任務的 user_id 狀態
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://krhjaacfuajuzkcvwsjc.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyaGphYWNmdWFqdXprY3Z3c2pjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxMjg3OTgsImV4cCI6MjA3OTcwNDc5OH0.VZqCojebrFSIxAS8tuq7PEJOZf_trxmpV9pGO0N_5sM'

const supabase = createClient(supabaseUrl, supabaseKey)

console.log('🔍 檢查任務 user_id 狀態...\n')

const { data: tasks, error } = await supabase
  .from('tasks')
  .select('id, title, user_id')
  .limit(5)

if (error) {
  console.log('❌ 錯誤:', error.message)
} else {
  console.log('任務範例:')
  tasks.forEach(t => {
    console.log(`- ${t.title.substring(0, 30)}... | user_id: ${t.user_id || '(空)'}`)
  })

  const withoutUserId = tasks.filter(t => !t.user_id).length
  console.log(`\n共 ${tasks.length} 筆中有 ${withoutUserId} 筆沒有 user_id`)
}
