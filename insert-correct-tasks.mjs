// 插入正確的會議萃取任務
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

const supabase = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY)

// 正確的 16 項任務（修正 assignee 為實際成員名稱）
// 員工名單：Hsepherd、Orange、Karen、Kelly、Vicky、Elena、易叡、47、笑笑
const tasks = [
  {
    title: "聽取笑笑全部999音檔並整理報告",
    assignee: "Kelly",
    priority: "high",
    description: "【任務摘要】\n需要聽取電訪人員笑笑所有的999音檔，而非只有昨天的，以獲得完整的數據分析。\n\n【執行細節】\n聽完全部音檔後，整理成報告，分析笑笑的開場方式、學生拒絕原因、接通率等數據。\n\n【會議脈絡】\n目前只聽了昨天的音檔（約2-3個），樣本數太少無法判斷整體狀況。需要全部數據才能評估電訪效果。\n\n【原文引用】\n「對要聽全部的，要全部的。」\n「對我昨天是聽昨天的音檔，我要聽全部的嗎？哦，好好好那我今天把全部聽了。」",
    due_date: "2025-11-27"
  },
  {
    title: "製作電訪數據趨勢分析報告",
    assignee: "Kelly",
    priority: "high",
    description: "【任務摘要】\n需要製作笑笑入職後（10/27-11/26）每週的電訪數據趨勢報告，與前期對比。\n\n【執行細節】\n1. 整理笑笑來之後每週的預約數、取消數、接通率\n2. 與前一個月（無電訪/Vivi時期）對比\n3. 可使用系統數據或請GPT整合分析\n\n【會議脈絡】\n老闆希望看到數據成長或下跌的趨勢，目前系統顯示諮詢數上升320%、實收金額上升160%，但需要更細項的對比。\n\n【原文引用】\n「對周跟好，那未來可不可以周匯報告這個這周跟上周的數據的相比。」\n「就是他的意思，就是說，我們要看到是成長還是下跌。」",
    due_date: "2025-11-28"
  },
  {
    title: "解決笑笑電腦效能問題",
    assignee: "Kelly",
    priority: "medium",
    description: "【任務摘要】\n笑笑的電腦開啟Remark系統非常慢，影響撥打效率，需要討論解決方案。\n\n【執行細節】\n與笑笑溝通，評估是否需要升級電腦記憶體（目前8G不夠用，至少需要16G）或購買二手Mac。可以算給他聽投資報酬率。\n\n【會議脈絡】\n笑笑的撥打效率已經很高，但電腦開啟Remark很慢是最大瓶頸。電腦記憶體8G不足以同時開啟Remark、Google表單、Email等系統。\n\n【原文引用】\n「對，這是他最大的問題，其他是沒有問題的。」\n「我覺得他的電腦問題可能要解決一下，就會有可能就有。」\n「那你就要算給他聽啊。」",
    due_date: null
  },
  {
    title: "優化強推銷信件內容",
    assignee: "Karen",
    priority: "high",
    description: "【任務摘要】\n根據Marnie AI分析結果，優化信件內容，提高開信率和點擊率。\n\n【執行細節】\n1. 確認AI分析的數據與實際數據一致\n2. 將價值類內容提升至70%，推銷內容降至30%\n3. 請AI產出具體優化後的信件範本\n4. 結合現有AI系統的指令進行優化\n\n【會議脈絡】\n目前信件開信率21.8%、點擊率0.29%，低於行業平均。AI分析指出推銷內容佔比太高、價值類內容太少。\n\n【原文引用】\n「就是針對於我們強推銷的信件，這部分。」\n「價值類佔比較少，然後推客佔比較多，對未來可能他提供建議是價值類的要在七十帕然後推銷內容佔比可能頂多三十帕。」",
    due_date: "2025-11-28"
  },
  {
    title: "設定開場菜單Manychat自動化流程",
    assignee: "Karen",
    priority: "high",
    description: "【任務摘要】\n修改開場菜單的Manychat流程，改為收集Email和姓名後自動發送，而非導向官方LINE。\n\n【執行細節】\n1. 參考之前做過的Manychat模板\n2. 流程：CTA → 詢問Email → 詢問姓名 → 自動觸發信件發送\n3. 讓學生進入自動化信件序列，後續可推體驗課\n\n【會議脈絡】\n目前開場菜單短片有18人走完流程，但官方LINE客服沒收到任何人來領取。需要改成直接收集資料並自動發送。\n\n【原文引用】\n「嗯，先留言email，跟姓名就好了，然後他們留完就直接注冊我們的，然後你就直接發發給他們。」\n「然後他在呃，提交完email跟姓名之後會自動觸發的自動化，然後就會自動寄信給他們」",
    due_date: null
  },
  {
    title: "更新自動化信件內容",
    assignee: "Karen",
    priority: "medium",
    description: "【任務摘要】\n長片上線後，更新自動化信件內容。\n\n【執行細節】\n1. 長片下週一/二上線\n2. 下週三更新自動化信件\n3. 使用現有信件模板，內容改成老師寫的腳本\n4. 在Automation裡設定第二封、第三封Email的發送時間\n\n【會議脈絡】\n開場菜單長片即將上線，需要同步更新自動化信件序列。\n\n【原文引用】\n「長片出來之後。就可以更新上去，跟下周下周三更新到自動化信件裏面。」",
    due_date: "2025-12-03"
  },
  {
    title: "大師系列影片剪輯與排程",
    assignee: "易叡",
    priority: "high",
    description: "【任務摘要】\n完成大師系列影片的剪輯並按排程發布。\n\n【執行細節】\n排程如下：\n- 12/2（週二）：大師完整版長片\n- 12/7（週日）：擱淺精華片段\n- 12/11：開場菜單長片\n- 12/16、12/23：老師Reaction影片\n\n需要完成：\n1. 完整版再剪一次\n2. 開場菜單片段單獨拉出來\n3. 擱淺精華片段（明天剪，請Arange確認）\n4. 兩支Reaction影片：音畫同步+中英字幕\n\n【會議脈絡】\n大師系列影片是重要內容，需要充分利用帶動流量。總共會有6支影片：完整版、開場精華、擱淺精華、付費版（有講解）、兩支老師Reaction。\n\n【原文引用】\n「下周是不是還是？下周，下周應該沒問題，下周再減一次應該就可以上了。」\n「對，然後只有兩個存想。」",
    due_date: "2025-12-02"
  },
  {
    title: "發送大師影片毛片給老闆確認",
    assignee: "易叡",
    priority: "urgent",
    description: "【任務摘要】\n將大師影片毛片發給老闆確認。\n\n【執行細節】\n雖然是一鏡到底不太需要剪，但老闆要先看毛片確認。\n\n【會議脈絡】\n長片已拍完還沒剪，老闆要先看毛片。\n\n【原文引用】\n「聯系毛片也給我看一下，因爲應該是一進到底，所以我加速看應該還好。」",
    due_date: "2025-11-27"
  },
  {
    title: "準備諮詢煙圈地圖",
    assignee: "Vicky",
    priority: "high",
    description: "【任務摘要】\n為明天業務組會議準備諮詢SOP流程圖。\n\n【執行細節】\n寫出諮詢的每一個步驟，例如：\n1. 開場建立信任\n2. 收集學員痛點\n3. ...（共約8-10步）\n\n【會議脈絡】\n為了建立AI諮詢輔助系統，需要先整理諮詢師的SOP流程作為基礎資料。\n\n【原文引用】\n「明天在業務組會議的時候要去準備你們目前諮詢的煙圈地圖，也就是你們現在諮詢的sop流程。」",
    due_date: "2025-11-28"
  },
  {
    title: "準備反對意見話術表",
    assignee: "Vicky",
    priority: "high",
    description: "【任務摘要】\n整理常見反對意見的應對話術，用自己的話寫。\n\n【執行細節】\n針對常見反對意見（太貴、要問老婆、再想想等），寫出：\n1. 後設解法（思考邏輯）\n2. 表層話術（實際說的話/逐字稿）\n\n不要直接貼GPT產出的內容，要用自己會說的話。\n\n【會議脈絡】\n這些資料將用於訓練AI系統，讓AI能結合學生背景提供即時話術建議。\n\n【原文引用】\n「第二個是反對意見的話術表ok那這個反對意見的話，術表呃，我記得過去我們有整理過一個資料表對但是這邊你們還是需要用你們自己會說的話，寫上去就是不要貼上來就看起來像gpt寫的一樣」",
    due_date: "2025-11-28"
  },
  {
    title: "準備後設資料庫與話術逐字庫",
    assignee: "Vicky",
    priority: "high",
    description: "【任務摘要】\n針對諮詢每個環節，整理後設目標與對應的話術逐字稿。\n\n【執行細節】\n例如：第一步「建立信任感」\n- 後設：讓學生感到被理解\n- 話術逐字稿：「我理解你現在的狀況...」\n\n【會議脈絡】\n後設是骨架（思考邏輯），表層是血肉（實際說的話）。AI系統需要這些資料才能給出精準建議。\n\n【原文引用】\n「然後再來第三項就是後設的資料庫...第四個是畫素的逐字資料庫」\n「你的後設解法就是我先我先認爲它應該是價值的問題，然後那我先解決看他的價值是否okay」",
    due_date: "2025-11-28"
  },
  {
    title: "約課流程改由客服統一處理",
    assignee: null,
    priority: "medium",
    description: "【任務摘要】\n教練與學生確認時間後，請學生自行聯繫客服約課，避免遺漏。\n\n【執行細節】\n流程調整：教練跟學生敲好時間 → 請學生聯繫客服預約 → 客服統一管理約課\n\n【會議脈絡】\n之前有發生教練忘記幫學生按預約的狀況，改由客服統一處理可避免遺漏。\n\n【原文引用】\n「那就是不是說這件事，情可以可能請請客，服那邊就先約好還是怎麼樣子」",
    due_date: null
  },
  {
    title: "體驗課/約課避開每天1點站立會議時段",
    assignee: "Kelly",
    priority: "medium",
    description: "【任務摘要】\n預約體驗課和約課時，盡量避開每天1點的站立會議時段。\n\n【執行細節】\n- 體驗課預約避開1點\n- 約課避開1點\n- 諮詢優先，如果學生只能1點就排1點\n\n【會議脈絡】\n每天1點有站立會議，需要避開這個時段。\n\n【原文引用】\n「對應該還好吧，因爲你的時段這麼多一點應該還好對，還有包含那個電訪，這邊的體驗課預約也是要也是要避開一點的時段。」",
    due_date: null
  },
  {
    title: "優化蓋被子簡報並補充資料",
    assignee: null,
    priority: "medium",
    description: "【任務摘要】\n持續優化蓋被子教學簡報，補充NLP相關說明與坊間比較。\n\n【執行細節】\n1. 補充為什麼蓋被子比坊間吹管有效（他們只能催生，無法咬字唱歌詞）\n2. 結合NLP說明為什麼有效\n3. 加入大師認證說明（瑞典葛萊美大師）\n4. 換成公司馬克杯圖片\n5. 部署後發給老闆確認\n\n【會議脈絡】\n簡報已有基礎版，demo效果不錯，需要補充差異化內容和公信力。\n\n【原文引用】\n「對啊，這個就是之後如果特別遇到因準問題的同學，可以這樣可以這樣做了。」\n「對，你要把那個一層要提升三成到四成」",
    due_date: null
  },
  {
    title: "製作音準訓練互動簡報",
    assignee: "Vicky",
    priority: "medium",
    description: "【任務摘要】\n參考蓋被子簡報，用Gemini製作音準訓練的互動簡報。\n\n【執行細節】\n1. 使用Gemini AI（已學會操作）\n2. 參考蓋被子簡報框架\n3. 補充學術研究支持（哪一年、哪個大學）\n4. 加入常見迷思（五音不全不能唱歌）\n5. 加入before/after學員案例\n6. 可加入音準模擬器互動功能\n\n【會議脈絡】\n已在會議中教學如何使用Gemini製作互動簡報，成功產出音準模擬器原型。\n\n【原文引用】\n「對你就把他想象成他是你的工程師你不用對專業的你不用會你只要把你要的需求跟他講就好。」\n「對，恭喜你今天又學會一項經濟呢？」",
    due_date: null
  },
  {
    title: "優化Vicky線上課程大綱",
    assignee: "Vicky",
    priority: "medium",
    description: "【任務摘要】\n根據備註優化線上課程大綱，調整章節順序和內容比例。\n\n【執行細節】\n1. 將「收入分配公式5-3-1-1」從第四章移到第二章（講完故事後）\n2. 調整投資自己比例從10%提升到30-40%（才能cover課程費用）\n3. 建立三種人格讓學生自我投射\n4. 詳細內容參考Slack頻道的畫板備註\n\n【會議脈絡】\n線上課程的觀看率在第三章後會大幅下降，重點內容要往前放。課程後設是引導學生報高階課。\n\n【原文引用】\n「對，因爲你去想好。假設假設買這個課的人，他薪水只有好，我們算四萬塊。四萬塊，一成四千四千。對啊。」\n「所，你對不對？所以你要把那個一層要提升三成到四成」",
    due_date: null
  },
  {
    title: "與行銷組討論AI影片分析報告",
    assignee: "Karen",
    priority: "medium",
    description: "【任務摘要】\n將AI影片分析報告與行銷組組員討論，共同優化未來拍片方向。\n\n【執行細節】\n1. 分享AI分析報告給組員\n2. 討論具體優化措施（如CTA調整、素人診斷系列等）\n3. 讓組員提供想法，看未來怎麼拍更好\n\n【會議脈絡】\nAI分析報告已產出，包含關鍵字分析、成功案例分析、具體優化建議。這些分析需要組員學習才有價值。\n\n【原文引用】\n「我覺得這個部分哦，可以跟你們你們行銷組的時候，開會的時候可以跟組員討論一下這個部分。」\n「對我知道，我知道我知道有具體措施，那那這那可能就是要請組員看完之後」",
    due_date: null
  }
]

async function insertTasks() {
  console.log('🗑️ 清除現有任務...')

  // 先刪除所有任務
  const { data: existing } = await supabase.from('tasks').select('id')
  for (const task of existing || []) {
    await supabase.from('tasks').delete().eq('id', task.id)
  }
  console.log('✅ 已清除\n')

  console.log('📝 開始新增 17 項正確任務...\n')

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
        due_date: task.due_date,
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
      console.log(`✅ ${task.title} (@${task.assignee || '未指派'})`)
      successCount++
    }
  }

  console.log('\n' + '='.repeat(50))
  console.log(`📊 結果：成功 ${successCount} 項，失敗 ${failCount} 項`)
}

insertTasks()
