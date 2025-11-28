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
1. 標題長度：5-15 個中文字
2. 要能概括對話主題
3. 如果是會議記錄，標題格式：「[類型] 主題」，例如「會議紀錄：產品規劃」
4. 如果是問問題，用動詞開頭，例如「詢問 API 使用方式」
5. 只輸出標題本身，不要加任何標點符號或解釋
6. 不要使用引號包圍標題`,
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
