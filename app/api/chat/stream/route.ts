import { NextRequest } from 'next/server'
import openai, { getFullSystemPrompt, getMeetingTranscriptPrompt } from '@/lib/openai'

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

    // 根據內容類型選擇不同的 prompt
    const systemPrompt = isLongTranscript ? getMeetingTranscriptPrompt() : getFullSystemPrompt()

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

    // 使用 GPT-5 Streaming
    const stream = await openai.chat.completions.create({
      model: 'gpt-5',
      messages: chatMessages as Parameters<typeof openai.chat.completions.create>[0]['messages'],
      max_completion_tokens: isLongTranscript ? 16000 : 8000,
      stream: true,
    })

    // 建立 ReadableStream 回傳
    const encoder = new TextEncoder()
    let fullContent = ''
    let usageData: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null = null

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || ''
            if (content) {
              fullContent += content
              // 發送文字內容
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'content', content })}\n\n`))
            }

            // 檢查是否有 usage 資訊（在最後一個 chunk）
            if (chunk.usage) {
              usageData = chunk.usage
            }
          }

          // 發送完成訊號和 usage 資訊
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'done',
            fullContent,
            usage: usageData ? {
              model: 'gpt-5',
              promptTokens: usageData.prompt_tokens,
              completionTokens: usageData.completion_tokens,
              totalTokens: usageData.total_tokens,
            } : null
          })}\n\n`))

          controller.close()
        } catch (error) {
          console.error('Streaming error:', error)
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: 'Streaming failed' })}\n\n`))
          controller.close()
        }
      },
    })

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Chat Stream API Error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : '發生未知錯誤',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
