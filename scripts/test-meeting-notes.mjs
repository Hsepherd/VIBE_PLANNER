// 測試會議記錄資料表
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

async function testMeetingNotesTable() {
  console.log('🔍 檢查會議記錄資料表...\n')

  // 測試 meeting_notes 表
  console.log('1️⃣ 檢查 meeting_notes 表是否存在：')
  const { data, error } = await supabase
    .from('meeting_notes')
    .select('*')
    .limit(1)

  if (error) {
    if (error.message.includes('does not exist') || error.code === '42P01') {
      console.log('   ⚠️  表不存在，需要執行 migration')
      console.log('\n📝 請執行以下步驟：')
      console.log('   1. 登入 Supabase Dashboard')
      console.log('   2. 進入 SQL Editor')
      console.log('   3. 執行檔案：supabase/migrations/20260129_meeting_notes.sql')
      return false
    } else {
      console.log(`   ❌ 錯誤: ${error.message}`)
      return false
    }
  } else {
    console.log('   ✅ 表已存在！')
    console.log(`   📊 目前有 ${data.length} 筆會議記錄`)
    return true
  }
}

async function testInsertMeetingNote() {
  console.log('\n2️⃣ 測試新增會議記錄：')

  const testNote = {
    title: '測試會議',
    date: '2026-01-29',
    participants: ['測試人員A', '測試人員B'],
    raw_content: '這是一段測試會議內容。我們討論了專案進度。',
    organized: {
      title: '測試會議',
      date: '2026-01-29',
      participants: ['測試人員A', '測試人員B'],
      discussionPoints: [
        { topic: '專案進度', details: '目前進度良好' }
      ],
      decisions: ['決定下週繼續'],
      actionItems: [
        { task: '完成測試', assignee: '測試人員A' }
      ],
      nextSteps: ['準備下次會議']
    },
    markdown: '# 測試會議\n\n測試內容'
  }

  const { data, error } = await supabase
    .from('meeting_notes')
    .insert(testNote)
    .select()
    .single()

  if (error) {
    console.log(`   ❌ 插入失敗: ${error.message}`)
    return null
  } else {
    console.log('   ✅ 插入成功！')
    console.log(`   📝 會議記錄 ID: ${data.id}`)
    return data.id
  }
}

async function testReadMeetingNote(id) {
  console.log('\n3️⃣ 測試讀取會議記錄：')

  const { data, error } = await supabase
    .from('meeting_notes')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.log(`   ❌ 讀取失敗: ${error.message}`)
    return false
  } else {
    console.log('   ✅ 讀取成功！')
    console.log(`   📋 標題: ${data.title}`)
    console.log(`   📅 日期: ${data.date}`)
    console.log(`   👥 參與者: ${data.participants.join('、')}`)
    return true
  }
}

async function testDeleteMeetingNote(id) {
  console.log('\n4️⃣ 測試刪除測試記錄：')

  const { error } = await supabase
    .from('meeting_notes')
    .delete()
    .eq('id', id)

  if (error) {
    console.log(`   ❌ 刪除失敗: ${error.message}`)
    return false
  } else {
    console.log('   ✅ 測試記錄已刪除')
    return true
  }
}

async function runTests() {
  const tableExists = await testMeetingNotesTable()

  if (tableExists) {
    const noteId = await testInsertMeetingNote()
    if (noteId) {
      await testReadMeetingNote(noteId)
      await testDeleteMeetingNote(noteId)
    }

    console.log('\n' + '='.repeat(50))
    console.log('✅ 會議記錄功能測試完成！')
  } else {
    console.log('\n' + '='.repeat(50))
    console.log('⚠️  請先執行 migration 創建資料表')
  }
}

runTests()
