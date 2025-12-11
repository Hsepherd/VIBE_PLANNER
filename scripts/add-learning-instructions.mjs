// 手動新增學習指令到知識庫
// 執行方式: node scripts/add-learning-instructions.mjs

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// 手動載入 .env.local
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const envPath = join(__dirname, '..', '.env.local')
const envContent = readFileSync(envPath, 'utf-8')
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=')
  if (key && valueParts.length) {
    process.env[key.trim()] = valueParts.join('=').trim()
  }
})

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('缺少 Supabase 環境變數')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// 根據用戶對話學習到的指令
const newInstructions = [
  {
    instruction_text: '任務標題要易懂、精簡，仿照用戶提供的 GPT 任務摘要風格',
    instruction_type: 'style',
    learned_rule: '標題格式：動詞 + 明確產出物，例如「建立流程SOP」「完成專案簡報」',
    confidence: 0.9,
  },
  {
    instruction_text: '更強調「流程、SOP、專案簡報、明確的執行文件產出」',
    instruction_type: 'content',
    learned_rule: '任務萃取時，優先識別需要產出的文件類型（SOP、簡報、報表等）',
    confidence: 0.85,
  },
  {
    instruction_text: '任務拆解要更細，例如「體驗課GPT同步」「老闆語氣信件模板」',
    instruction_type: 'style',
    learned_rule: '將大任務拆解成具體可執行的小任務，每個任務有明確的產出物',
    confidence: 0.85,
  },
  {
    instruction_text: '偏向策略方向、產品組合與宏觀規劃的任務也要萃取',
    instruction_type: 'content',
    learned_rule: '不只萃取執行層面的任務，也要包含策略規劃、方向性的任務',
    confidence: 0.8,
  },
  {
    instruction_text: '使用清楚易懂、帶有可執行文件與明確產出物的標題與描述',
    instruction_type: 'style',
    learned_rule: '標題和描述要讓人一看就知道要做什麼、產出什麼',
    confidence: 0.9,
  },
]

async function addInstructions() {
  console.log('開始新增學習指令...\n')

  for (const instruction of newInstructions) {
    try {
      const { data, error } = await supabase
        .from('user_instructions')
        .insert(instruction)
        .select()
        .single()

      if (error) {
        console.error(`新增失敗: ${instruction.learned_rule}`)
        console.error(error.message)
      } else {
        console.log(`✓ 新增成功: ${instruction.learned_rule}`)
      }
    } catch (err) {
      console.error(`錯誤: ${err.message}`)
    }
  }

  // 查詢目前所有指令
  console.log('\n--- 目前知識庫中的指令 ---\n')
  const { data: allInstructions, error } = await supabase
    .from('user_instructions')
    .select('*')
    .eq('is_active', true)
    .order('confidence', { ascending: false })

  if (error) {
    console.error('查詢失敗:', error.message)
  } else {
    console.log(`共 ${allInstructions.length} 條學習指令:\n`)
    allInstructions.forEach((inst, i) => {
      console.log(`${i + 1}. [${inst.instruction_type}] ${inst.learned_rule}`)
      console.log(`   置信度: ${inst.confidence}`)
      console.log('')
    })
  }
}

addInstructions()
