import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json()

    if (!message) {
      return NextResponse.json({ error: '缺少訊息內容' }, { status: 400 })
    }

    // 使用 GPT-4.1 Mini 產生標題（較便宜）
    const response = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        {
          role: 'system',
          content: `你是一個標題產生器。根據使用者的訊息內容，產生一個簡短的對話標題。

規則：
1. 標題長度：10-20 個中文字
2. 要能概括對話主題，讓使用者日後能快速辨識這次對話內容

格式範例：
- 會議記錄格式：「[會議名稱]」，例如「產品週會討論」「行銷部門月會」
- 任務萃取格式：「[主題]（N 個任務）」，例如「電訪名單整理（5 個任務）」「專案規劃（8 個任務）」
- 一般問答格式：「[主題] 問答」，例如「API 使用方式 問答」

重要：
- 如果內容看起來像會議記錄或逐字稿，使用會議記錄格式
- 如果有萃取出任務清單，在標題中標註任務數量
- 只輸出標題本身，不要加任何額外標點符號或解釋
- 不要使用引號包圍標題`,
        },
        {
          role: 'user',
          content: `請根據以下訊息產生一個簡短標題：\n\n${message.slice(0, 500)}`,
        },
      ],
      max_tokens: 50,
      temperature: 0.7,
    })

    const title = response.choices[0].message.content?.trim() || ''

    return NextResponse.json({ title })
  } catch (error) {
    console.error('Title generation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '標題產生失敗' },
      { status: 500 }
    )
  }
}
