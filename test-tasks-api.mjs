import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

// 手動讀取 .env.local
const envContent = fs.readFileSync('.env.local', 'utf-8')
const envLines = envContent.split('\n')
envLines.forEach(line => {
  const [key, ...valueParts] = line.split('=')
  if (key && valueParts.length) {
    process.env[key.trim()] = valueParts.join('=').trim()
  }
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function testTasksApi() {
  console.log('🔍 測試 tasks 表連線...\n')

  try {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('❌ 錯誤:', error.message)
      console.error('詳細:', error)
      return
    }

    console.log(`✅ 連線成功！目前有 ${data?.length || 0} 筆任務`)

    if (data && data.length > 0) {
      console.log('\n前 3 筆任務:')
      data.slice(0, 3).forEach((task, i) => {
        console.log(`  ${i + 1}. ${task.title}`)
      })
    }
  } catch (err) {
    console.error('❌ 例外錯誤:', err)
  }
}

testTasksApi()
