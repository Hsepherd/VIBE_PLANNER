// 批次新增會議萃取的任務到 Supabase
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { randomUUID } from 'crypto'

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
  console.log('❌ 缺少環境變數')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// 會議萃取的 17 項任務
const tasks = [
  {
    title: "優化蓋杯子簡報並補充資料",
    assignee: "Karen",
    priority: "high",
    description: "【任務摘要】重新設計蓋杯子簡報的視覺呈現與資料內容\n【執行細節】補充實際數據佐證、加入學員案例、優化視覺設計\n【會議脈絡】老闆認為現有簡報缺乏說服力，需要更多數據支持"
  },
  {
    title: "製作體驗課 SOP 文件",
    assignee: "Hsepherd",
    priority: "high",
    description: "【任務摘要】建立體驗課標準作業流程，讓教練有計劃地帶入簡報應用\n【執行細節】規劃體驗課各階段的簡報使用時機、設計話術引導、建立統一流程\n【會議脈絡】需要讓所有教練在體驗課中都能有效運用簡報工具"
  },
  {
    title: "建立電訪人員的標準話術腳本",
    assignee: "Kelly",
    priority: "high",
    description: "【任務摘要】制定電訪標準話術，提升轉換率\n【執行細節】整理成功案例話術、建立常見問題應對腳本、設計開場白範本\n【會議脈絡】電訪成效需要提升，需要統一話術標準"
  },
  {
    title: "追蹤笑笑的電訪進度與成效",
    assignee: "Kelly",
    priority: "medium",
    description: "【任務摘要】定期檢視笑笑的電訪數據與轉換情況\n【執行細節】每週回報電訪數量、接通率、預約成功率\n【會議脈絡】笑笑是電訪人員，需要密切關注表現"
  },
  {
    title: "規劃 2025 年度行銷預算",
    assignee: "Karen",
    priority: "high",
    description: "【任務摘要】制定明年度行銷資源配置計畫\n【執行細節】分析今年各渠道 ROI、規劃預算分配、設定 KPI 目標\n【會議脈絡】年底需要提前規劃明年預算"
  },
  {
    title: "整理教學影片素材",
    assignee: "易叡",
    priority: "medium",
    description: "【任務摘要】剪輯教學內容製作影片\n【執行細節】挑選精華片段、加入字幕、製作封面縮圖\n【會議脈絡】需要更多教練的教學影片內容"
  },
  {
    title: "更新官網課程介紹頁面",
    assignee: "Karen",
    priority: "medium",
    description: "【任務摘要】優化官網上的課程說明與視覺呈現\n【執行細節】更新課程內容描述、加入學員見證、優化 CTA 按鈕\n【會議脈絡】官網轉換率需要提升"
  },
  {
    title: "設計諮詢師的客戶跟進流程",
    assignee: "Vicky",
    priority: "high",
    description: "【任務摘要】建立諮詢後的客戶追蹤標準流程\n【執行細節】設定跟進時間點、準備跟進話術、建立提醒機制\n【會議脈絡】諮詢後的轉換需要更系統化的跟進"
  },
  {
    title: "統計本月體驗課轉換數據",
    assignee: "Vicky",
    priority: "medium",
    description: "【任務摘要】彙整體驗課到正式報名的轉換率\n【執行細節】統計各教練的轉換率、分析影響因素、提出改善建議\n【會議脈絡】需要數據來評估體驗課成效"
  },
  {
    title: "製作 Instagram Reels 短影音內容",
    assignee: "易叡",
    priority: "medium",
    description: "【任務摘要】產出適合 IG Reels 的短影音\n【執行細節】15-30秒短影音、配合流行音樂、加入字幕\n【會議脈絡】社群需要更多短影音內容"
  },
  {
    title: "安排諮詢師排班",
    assignee: "Hsepherd",
    priority: "medium",
    description: "【任務摘要】協調諮詢師的時段安排\n【執行細節】平衡工作量、避免時段衝突、預留彈性時間\n【會議脈絡】諮詢需求增加，需要妥善排班"
  },
  {
    title: "準備年終學員成果發表會企劃",
    assignee: "Karen",
    priority: "medium",
    description: "【任務摘要】規劃年終學員成果展示活動\n【執行細節】場地安排、節目流程、邀請名單、宣傳素材\n【會議脈絡】年底活動需要提前準備"
  },
  {
    title: "檢視廣告投放成效並調整",
    assignee: "Karen",
    priority: "high",
    description: "【任務摘要】分析目前廣告數據並優化投放策略\n【執行細節】檢視 CPC、CPA、ROAS 等指標，調整受眾與素材\n【會議脈絡】廣告成本需要控制"
  },
  {
    title: "更新學員見證影片庫",
    assignee: "易叡",
    priority: "low",
    description: "【任務摘要】收集並製作新的學員見證影片\n【執行細節】聯繫願意分享的學員、拍攝剪輯、上傳歸檔\n【會議脈絡】需要更多新鮮的見證內容"
  },
  {
    title: "建立電訪數據追蹤表",
    assignee: "Kelly",
    priority: "medium",
    description: "【任務摘要】建立系統化的電訪成效追蹤機制\n【執行細節】設計追蹤欄位、建立日報表格式、設定自動統計\n【會議脈絡】電訪數據需要更清楚的追蹤"
  },
  {
    title: "研究競品的行銷策略",
    assignee: "Karen",
    priority: "low",
    description: "【任務摘要】分析競爭對手的行銷方式與定位\n【執行細節】整理競品廣告素材、分析定價策略、觀察社群經營\n【會議脈絡】需要了解市場動態"
  },
  {
    title: "優化 LINE 官方帳號自動回覆",
    assignee: "Karen",
    priority: "low",
    description: "【任務摘要】改善 LINE OA 的自動回覆訊息\n【執行細節】更新歡迎訊息、設計常見問題自動回覆、優化選單\n【會議脈絡】LINE 的回覆率需要提升"
  }
]

async function insertTasks() {
  console.log('📝 開始新增 17 項會議萃取任務...\n')

  let successCount = 0
  let failCount = 0

  for (const task of tasks) {
    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        id: randomUUID(),
        title: task.title,
        description: task.description,
        status: 'pending',
        priority: task.priority,
        due_date: null,
        assignee: task.assignee,
        project_id: null,
        created_at: now,
        updated_at: now,
        completed_at: null
      })
      .select()
      .single()

    if (error) {
      console.log(`❌ ${task.title} - 失敗: ${error.message}`)
      failCount++
    } else {
      console.log(`✅ ${task.title} (${task.assignee})`)
      successCount++
    }
  }

  console.log('\n' + '='.repeat(50))
  console.log(`📊 結果：成功 ${successCount} 項，失敗 ${failCount} 項`)

  if (successCount === tasks.length) {
    console.log('🎉 所有任務已成功新增到 Supabase！')
  }
}

insertTasks()
