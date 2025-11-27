import { NextRequest } from 'next/server'
import openai, { getFullSystemPrompt, getMeetingTranscriptPrompt, isLongMeetingTranscript } from '@/lib/openai'
import { generatePreferencePrompt, shouldInjectPreferences } from '@/lib/preferences'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { messages, image } = body

    // 取得最後一條使用者訊息
    const lastUserMessage = messages.filter((m: { role: string }) => m.role === 'user').pop()
    const isLongTranscript = lastUserMessage && isLongMeetingTranscript(lastUserMessage.content)

    // 根據內容類型選擇不同的 prompt
    let systemPrompt = isLongTranscript ? getMeetingTranscriptPrompt() : getFullSystemPrompt()

    // 如果符合條件，注入使用者偏好
    if (lastUserMessage && shouldInjectPreferences(lastUserMessage.content)) {
      try {
        const preferencePrompt = await generatePreferencePrompt()
        if (preferencePrompt) {
          systemPrompt += '\n' + preferencePrompt
        }
      } catch (error) {
        console.error('載入偏好設定失敗:', error)
        // 即使偏好載入失敗，仍繼續處理請求
      }
    }

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
