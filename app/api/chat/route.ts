import { NextRequest, NextResponse } from 'next/server'
import openai, { getFullSystemPrompt, getMeetingTranscriptPrompt, parseAIResponse } from '@/lib/openai'

// 檢測是否為長篇會議逐字稿
function isLongMeetingTranscript(text: string): boolean {
  const meetingKeywords = [
    '會議', '討論', '報告', '決議', '行動項目', '待辦',
    '負責人', '時間', '進度', '專案', '問題', '解決',
    '同意', '確認', '下週', '明天', '截止', 'meeting',
    ':', '：',
  ]

  const hasKeywords = meetingKeywords.some(keyword =>
    text.toLowerCase().includes(keyword.toLowerCase())
  )

  return text.length > 3000 && hasKeywords
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { messages, image } = body

    // 取得最後一條使用者訊息
    const lastUserMessage = messages.filter((m: { role: string }) => m.role === 'user').pop()
    const isLongTranscript = lastUserMessage && isLongMeetingTranscript(lastUserMessage.content)

    // 根據內容類型選擇不同的 prompt 和參數
    const systemPrompt = isLongTranscript ? getMeetingTranscriptPrompt() : getFullSystemPrompt()
    const maxTokens = isLongTranscript ? 8000 : 4000
    const temperature = isLongTranscript ? 0.3 : 0.7

    // 構建訊息陣列
    const chatMessages: Array<{
      role: 'system' | 'user' | 'assistant'
      content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>
    }> = [
      { role: 'system', content: systemPrompt },
    ]

    // 加入歷史訊息
    for (const msg of messages) {
      chatMessages.push({
        role: msg.role,
        content: msg.content,
      })
    }

    // 如果有圖片，修改最後一條訊息
    if (image) {
      const lastIndex = chatMessages.length - 1
      const lastMessage = chatMessages[lastIndex]
      if (lastMessage.role === 'user') {
        chatMessages[lastIndex] = {
          role: 'user',
          content: [
            { type: 'text', text: lastMessage.content as string },
            {
              type: 'image_url',
              image_url: {
                url: image.startsWith('data:')
                  ? image
                  : `data:image/jpeg;base64,${image}`,
              },
            },
          ],
        }
      }
    }

    // 呼叫 OpenAI API (GPT-4.1)
    // GPT-4.1 特點：1M context window，適合長對話
    const response = await openai.chat.completions.create({
      model: 'gpt-4.1',
      messages: chatMessages as Parameters<typeof openai.chat.completions.create>[0]['messages'],
      max_tokens: isLongTranscript ? 16000 : 8000,
      temperature: isLongTranscript ? 0.3 : 0.7,
    })

    const aiResponse = response.choices[0].message.content || ''
    const parsed = parseAIResponse(aiResponse)

    // 取得 token 使用量
    const usage = response.usage

    return NextResponse.json({
      success: true,
      data: parsed,
      raw: aiResponse,
      usage: usage
        ? {
            model: 'gpt-4.1',
            promptTokens: usage.prompt_tokens,
            completionTokens: usage.completion_tokens,
            totalTokens: usage.total_tokens,
          }
        : null,
    })
  } catch (error) {
    console.error('Chat API Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '發生未知錯誤',
      },
      { status: 500 }
    )
  }
}
