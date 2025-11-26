import { NextRequest, NextResponse } from 'next/server'
import openai, { getFullSystemPrompt, parseAIResponse } from '@/lib/openai'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { messages, image } = body

    // 動態生成系統提示詞（包含今天日期）
    const systemPrompt = getFullSystemPrompt()

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

    // 呼叫 OpenAI API
    const response = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: chatMessages as Parameters<typeof openai.chat.completions.create>[0]['messages'],
      temperature: 0.7,
      max_tokens: 2000,
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
            model: 'gpt-4.1-mini',
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
