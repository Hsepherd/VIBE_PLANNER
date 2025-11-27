// 修復任務 user_id - 將所有無 user_id 的任務指派給指定使用者
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://krhjaacfuajuzkcvwsjc.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyaGphYWNmdWFqdXprY3Z3c2pjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxMjg3OTgsImV4cCI6MjA3OTcwNDc5OH0.VZqCojebrFSIxAS8tuq7PEJOZf_trxmpV9pGO0N_5sM'

const supabase = createClient(supabaseUrl, supabaseKey)

console.log('🔧 修復任務 user_id...\n')

// 先列出所有使用者
const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers()

if (usersError) {
  console.log('無法取得使用者列表（需要 service_role key）')
  console.log('請提供你的 user_id，或在瀏覽器 console 執行以下程式碼取得：')
  console.log('')
  console.log('  const { data } = await supabase.auth.getUser()')
  console.log('  console.log(data.user.id)')
  console.log('')

  // 嘗試直接查詢 auth.users（通常不被允許）
  console.log('嘗試透過其他方式取得使用者...')

  // 查詢 tasks 表格中有 user_id 的任務來找使用者
  const { data: tasksWithUser } = await supabase
    .from('tasks')
    .select('user_id')
    .not('user_id', 'is', null)
    .limit(1)

  if (tasksWithUser && tasksWithUser.length > 0) {
    console.log('找到已有 user_id 的任務:', tasksWithUser[0].user_id)
  } else {
    console.log('目前沒有任何任務有 user_id')
  }
}

// 取得無 user_id 的任務數量
const { count } = await supabase
  .from('tasks')
  .select('*', { count: 'exact', head: true })
  .is('user_id', null)

console.log(`\n目前有 ${count} 筆任務沒有 user_id`)
console.log('\n要修復，請執行：')
console.log('  node assign-tasks-to-user.mjs <your-user-id>')
