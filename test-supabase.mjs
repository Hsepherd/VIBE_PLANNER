// 測試 Supabase AI 學習資料表
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

// 讀取 .env.local
const envContent = readFileSync('.env.local', 'utf-8')
const envVars = {}
envContent.split('\n').forEach(line => {
  if (line && !line.startsWith('#')) {
    const [key, ...valueParts] = line.split('=')
    if (key) envVars[key.trim()] = valueParts.join('=').trim()
  }
})

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.log('❌ 缺少環境變數：NEXT_PUBLIC_SUPABASE_URL 或 NEXT_PUBLIC_SUPABASE_ANON_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function testTables() {
  console.log('🔍 檢查 Supabase AI 學習資料表...\n')

  // 測試 user_preferences
  console.log('1️⃣ user_preferences 表：')
  const { data: prefs, error: prefsErr } = await supabase
    .from('user_preferences')
    .select('*')
    .limit(5)

  if (prefsErr) {
    console.log(`   ❌ 錯誤: ${prefsErr.message}`)
  } else {
    console.log(`   ✅ 連線成功！目前有 ${prefs.length} 筆規則`)
  }

  // 測試 learning_examples
  console.log('\n2️⃣ learning_examples 表：')
  const { data: examples, error: examplesErr } = await supabase
    .from('learning_examples')
    .select('*')
    .limit(5)

  if (examplesErr) {
    console.log(`   ❌ 錯誤: ${examplesErr.message}`)
  } else {
    console.log(`   ✅ 連線成功！目前有 ${examples.length} 筆範例`)
  }

  // 測試 feedback_logs
  console.log('\n3️⃣ feedback_logs 表：')
  const { data: feedbacks, error: feedbacksErr } = await supabase
    .from('feedback_logs')
    .select('*')
    .limit(5)

  if (feedbacksErr) {
    console.log(`   ❌ 錯誤: ${feedbacksErr.message}`)
  } else {
    console.log(`   ✅ 連線成功！目前有 ${feedbacks.length} 筆回饋`)
  }

  // 總結
  console.log('\n' + '='.repeat(40))
  if (!prefsErr && !examplesErr && !feedbacksErr) {
    console.log('✅ 所有 AI 學習資料表都已正確建立！')
  } else {
    console.log('⚠️ 部分資料表有問題，請檢查 Supabase Dashboard')
  }
}

testTables()
