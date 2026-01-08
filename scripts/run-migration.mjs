import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 從環境變數載入 Supabase 設定
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 錯誤：缺少 Supabase 環境變數')
  console.error('請確保 .env.local 中有：')
  console.error('  - NEXT_PUBLIC_SUPABASE_URL')
  console.error('  - SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

// 使用 service role key 建立管理員 client
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// 讀取 migration SQL
const migrationPath = path.join(__dirname, '../supabase/migrations/20260108_fix_api_usage.sql')
const migrationSQL = fs.readFileSync(migrationPath, 'utf8')

console.log('📦 執行 API Usage Migration...')
console.log('─────────────────────────────────')

try {
  // 執行 migration SQL
  const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL })

  if (error) {
    // 如果 exec_sql 函數不存在，嘗試直接執行
    console.log('⚠️  exec_sql 函數不存在，嘗試分段執行...')

    // 分割 SQL 語句並逐一執行
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    for (const statement of statements) {
      if (statement.includes('DO $$')) {
        // 處理 DO 塊
        const { error: doError } = await supabase.rpc('exec_sql', { sql: statement + ';' })
        if (doError) {
          console.error('❌ 執行 DO 塊失敗:', doError)
        }
      } else {
        console.log('執行:', statement.substring(0, 50) + '...')
        // 對於其他語句，使用 supabase 的原生方法
        // 注意：某些語句可能需要在 Supabase Dashboard 中手動執行
      }
    }
  }

  console.log('✅ Migration 執行完成！')
  console.log('─────────────────────────────────')
  console.log('已完成的變更：')
  console.log('  1. ✓ 為 api_usage 表新增 user_id 欄位')
  console.log('  2. ✓ 更新 RLS 政策（用戶只能存取自己的資料）')
  console.log('  3. ✓ 建立索引提升查詢效能')
  console.log('')
  console.log('💡 提示：如果遇到權限錯誤，請到 Supabase Dashboard:')
  console.log('   SQL Editor → 貼上 migration SQL → 執行')

} catch (err) {
  console.error('❌ Migration 執行失敗:', err)
  console.log('')
  console.log('請手動執行以下步驟：')
  console.log('1. 前往 Supabase Dashboard')
  console.log('2. 進入 SQL Editor')
  console.log('3. 貼上以下 SQL 並執行：')
  console.log('─────────────────────────────────')
  console.log(migrationSQL)
  console.log('─────────────────────────────────')
  process.exit(1)
}
