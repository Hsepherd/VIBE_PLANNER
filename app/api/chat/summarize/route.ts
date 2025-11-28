import { NextRequest, NextResponse } from 'next/server'
import openai from '@/lib/openai'

// 摘要系統提示詞（高品質、不失真）
const SUMMARIZE_SYSTEM_PROMPT = `你是一個專業的對話摘要助手。你的任務是將長篇對話壓縮成高品質摘要，同時保留所有重要資訊。

## 摘要原則
1. **壓縮但不失真**：保留所有關鍵資訊，只刪除冗餘和重複內容
2. **結構化呈現**：使用清晰的分類讓資訊易於查找
3. **保留細節**：具體的數字、日期、人名、專案名必須完整保留
4. **維持脈絡**：讓讀者不需要看原文就能理解完整背景

## 輸出格式（請嚴格遵守，輸出 1000-1500 字）

【會議/對話資訊】
- 討論主題、時間、參與討論的人員
- 這是第幾次討論這個主題（如果有提到）

【對話主題與背景】
- 為什麼要討論這件事
- 跟之前哪些對話有關聯
- 目前的狀況是什麼

【已萃取的任務清單】
（列出所有任務，格式：任務標題 → 負責人 → 截止日 → 優先級）
1. 任務一
   └─ 為什麼要做、完成後會怎樣
2. 任務二
   └─ 依賴關係（如果有）
...依此類推，不要省略任何任務

【人物角色與立場】
- 誰是決策者、誰是執行者
- 誰在意什麼、誰的意見要特別注意
- 有沒有不同意見或爭議

【重要決議與原因】
- 決定了什麼 + 為什麼這樣決定
- 否決了什麼 + 為什麼不做
- 擱置了什麼 + 什麼時候再討論

【關鍵數字與專有名詞】
- 金額、日期、百分比、KPI 目標
- 客戶名稱、專案名稱、產品名稱
- 任何具體的數據和指標

【風險與阻礙】
- 可能會卡在哪裡
- 需要誰的支援或核准
- 時程上的風險

【待追蹤與下一步】
- 等待誰回覆什麼
- 下次會議/對話要討論什麼
- 哪些事情還沒定案

【對話情緒與急迫性】
- 整體氣氛如何
- 老闆/主管特別強調什麼
- 有沒有特別緊急的事項

## 重要提醒
- 不要省略任何任務，即使看起來很小
- 所有人名、專案名、客戶名都要保留
- 數字和日期必須精確
- 如果有「之後再說」「下次討論」的事項，一定要記錄
- 摘要長度控制在 1000-1500 字
`

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { messages } = body

    if (!messages || messages.length === 0) {
      return NextResponse.json({
        success: false,
        error: '沒有訊息可以摘要',
      }, { status: 400 })
    }

    // 將訊息格式化為文字
    const conversationText = messages.map((msg: { role: string; content: string }, index: number) => {
      const role = msg.role === 'user' ? '使用者' : 'AI 助理'
      return `[${index + 1}] ${role}：\n${msg.content}`
    }).join('\n\n---\n\n')

    // 呼叫 GPT-4.1 產生摘要
    const response = await openai.chat.completions.create({
      model: 'gpt-4.1',
      messages: [
        { role: 'system', content: SUMMARIZE_SYSTEM_PROMPT },
        { role: 'user', content: `請將以下對話摘要：\n\n${conversationText}` },
      ],
      max_tokens: 2000,
      temperature: 0.3,
    })

    const summary = response.choices[0].message.content || ''
    const usage = response.usage

    return NextResponse.json({
      success: true,
      summary,
      usage: usage ? {
        model: 'gpt-4.1',
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
      } : null,
    })
  } catch (error) {
    console.error('Summarize API Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '發生未知錯誤',
    }, { status: 500 })
  }
}
