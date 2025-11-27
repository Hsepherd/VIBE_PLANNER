// 將所有無 user_id 的任務指派給指定使用者
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://krhjaacfuajuzkcvwsjc.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyaGphYWNmdWFqdXprY3Z3c2pjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxMjg3OTgsImV4cCI6MjA3OTcwNDc5OH0.VZqCojebrFSIxAS8tuq7PEJOZf_trxmpV9pGO0N_5sM'

const supabase = createClient(supabaseUrl, supabaseKey)

const userId = process.argv[2]

if (!userId) {
  console.log('❌ 請提供 user_id')
  console.log('用法: node assign-tasks-to-user.mjs <user-id>')
  console.log('')
  console.log('取得你的 user_id：')
  console.log('1. 登入網站')
  console.log('2. 開啟瀏覽器 DevTools (F12)')
  console.log('3. 在 Console 貼上：')
  console.log('')
  console.log('   (async () => {')
  console.log("     const { createClient } = await import('@supabase/supabase-js')")
  console.log("     const sb = createClient('https://krhjaacfuajuzkcvwsjc.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyaGphYWNmdWFqdXprY3Z3c2pjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxMjg3OTgsImV4cCI6MjA3OTcwNDc5OH0.VZqCojebrFSIxAS8tuq7PEJOZf_trxmpV9pGO0N_5sM')")
  console.log('     const { data } = await sb.auth.getUser()')
  console.log('     console.log("User ID:", data.user?.id)')
  console.log('   })()')
  console.log('')
  process.exit(1)
}

console.log(`🔧 將所有無 user_id 的任務指派給: ${userId}\n`)

// 更新 tasks
const { data: tasks, error: tasksError } = await supabase
  .from('tasks')
  .update({ user_id: userId })
  .is('user_id', null)
  .select('id')

if (tasksError) {
  console.log('❌ 更新 tasks 失敗:', tasksError.message)
} else {
  console.log(`✅ 已更新 ${tasks?.length || 0} 筆 tasks`)
}

// 更新 meetings
const { data: meetings, error: meetingsError } = await supabase
  .from('meetings')
  .update({ user_id: userId })
  .is('user_id', null)
  .select('id')

if (meetingsError) {
  console.log('❌ 更新 meetings 失敗:', meetingsError.message)
} else {
  console.log(`✅ 已更新 ${meetings?.length || 0} 筆 meetings`)
}

// 更新 tags
const { data: tags, error: tagsError } = await supabase
  .from('tags')
  .update({ user_id: userId })
  .is('user_id', null)
  .select('id')

if (tagsError) {
  console.log('❌ 更新 tags 失敗:', tagsError.message)
} else {
  console.log(`✅ 已更新 ${tags?.length || 0} 筆 tags`)
}

// 更新 team_members
const { data: members, error: membersError } = await supabase
  .from('team_members')
  .update({ user_id: userId })
  .is('user_id', null)
  .select('id')

if (membersError) {
  console.log('❌ 更新 team_members 失敗:', membersError.message)
} else {
  console.log(`✅ 已更新 ${members?.length || 0} 筆 team_members`)
}

// 更新 ai_preferences
const { data: prefs, error: prefsError } = await supabase
  .from('ai_preferences')
  .update({ user_id: userId })
  .is('user_id', null)
  .select('id')

if (prefsError) {
  console.log('❌ 更新 ai_preferences 失敗:', prefsError.message)
} else {
  console.log(`✅ 已更新 ${prefs?.length || 0} 筆 ai_preferences`)
}

console.log('\n🎉 完成！現在重新整理網頁應該只會看到自己的任務了')
