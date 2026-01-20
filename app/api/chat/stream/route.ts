import { NextRequest } from 'next/server'
import openai, { getFullSystemPrompt, getMeetingTranscriptPrompt, isLongMeetingTranscript, generateCalendarContext, generateProjectsContext } from '@/lib/openai'
import { generatePreferencePrompt, shouldInjectPreferences } from '@/lib/preferences'
import { generateFewShotPrompt } from '@/lib/few-shot-learning'
import { AI_FUNCTIONS, isSchedulingRelated, executeFunctionCall } from '@/lib/ai-functions'
import { learnPreferenceFromMessage, containsPreferenceIntent } from '@/lib/ai-functions/handlers/learnPreference'
import type { ChatCompletionMessageParam, ChatCompletionToolMessageParam } from 'openai/resources/chat/completions'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { messages, image, calendarTasks, userInfo, projects, userId } = body

    // 取得最後一條使用者訊息
    const lastUserMessage = messages.filter((m: { role: string }) => m.role === 'user').pop()
    const isLongTranscript = lastUserMessage && isLongMeetingTranscript(lastUserMessage.content)

    // 偵測並學習排程偏好（非阻塞，背景執行）
    let learnedPreference: { key?: string; value?: string; message?: string } | null = null
    if (userId && lastUserMessage && containsPreferenceIntent(lastUserMessage.content)) {
      try {
        const learnResult = await learnPreferenceFromMessage(userId, lastUserMessage.content)
        if (learnResult.learned) {
          learnedPreference = {
            key: learnResult.preferenceKey,
            value: learnResult.newValue,
            message: learnResult.message,
          }
          console.log('[Chat Stream] 學習到偏好:', learnedPreference)
        }
      } catch (error) {
        console.error('[Chat Stream] 偏好學習失敗:', error)
      }
    }

    // 根據內容類型選擇不同的 prompt
    let systemPrompt = isLongTranscript ? getMeetingTranscriptPrompt() : getFullSystemPrompt()

    // 注入 AI 學習記憶（Few-shot Learning）
    // 對於長篇逐字稿，注入過往成功案例和用戶偏好
    if (isLongTranscript) {
      try {
        const fewShotPrompt = await generateFewShotPrompt()
        if (fewShotPrompt) {
          systemPrompt += '\n' + fewShotPrompt
        }
      } catch (error) {
        console.error('載入 AI 學習記憶失敗:', error)
      }
    }

    // 如果符合條件，注入使用者偏好（舊版，保持向後相容）
    if (lastUserMessage && shouldInjectPreferences(lastUserMessage.content)) {
      try {
        const preferencePrompt = await generatePreferencePrompt()
        if (preferencePrompt) {
          systemPrompt += '\n' + preferencePrompt
        }
      } catch (error) {
        console.error('載入偏好設定失敗:', error)
      }
    }

    // 注入使用者資料（讓 AI 知道正在與誰對話）
    if (userInfo) {
      systemPrompt += `\n\n## 👤 目前使用者資訊
- 名稱：${userInfo.name}
- Email：${userInfo.email}

**重要規則**：
1. 當使用者說「我要做」「我來」「我負責」或任何表示自己要做的任務時，負責人（assignee）必須填入「${userInfo.name}」
2. 當使用者問到自己的資訊時，可以回答以上資訊
3. 萃取任務時，如果內容沒有明確指定其他人，預設負責人就是「${userInfo.name}」
`
    }

    // 注入行事曆上下文（讓 AI 了解目前的任務狀態）
    if (calendarTasks && calendarTasks.length > 0) {
      const calendarContext = generateCalendarContext(calendarTasks)
      if (calendarContext) {
        systemPrompt += '\n' + calendarContext
      }
    }

    // 注入專案上下文（讓 AI 知道可用的專案）
    if (projects && projects.length > 0) {
      const projectsContext = generateProjectsContext(projects)
      if (projectsContext) {
        systemPrompt += '\n' + projectsContext
      }
    }

    // 檢查是否為排程相關對話，啟用 Function Calling
    const enableFunctionCalling = lastUserMessage && isSchedulingRelated(lastUserMessage.content) && userId

    // 如果啟用 Function Calling，加入排程相關提示
    if (enableFunctionCalling) {
      // 計算常用日期範圍
      const today = new Date()
      const todayStr = today.toISOString().split('T')[0]

      // 計算本週和下週
      const dayOfWeek = today.getDay()
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
      const thisMonday = new Date(today)
      thisMonday.setDate(today.getDate() + mondayOffset)
      const thisSunday = new Date(thisMonday)
      thisSunday.setDate(thisMonday.getDate() + 6)
      const nextMonday = new Date(thisMonday)
      nextMonday.setDate(thisMonday.getDate() + 7)
      const nextSunday = new Date(nextMonday)
      nextSunday.setDate(nextMonday.getDate() + 6)

      systemPrompt += `\n
## 🗓️ AI 排程能力

你現在可以使用以下功能來幫助使用者排程：
1. **generateSmartSchedule** - 智慧一鍵排程（推薦使用）
2. **getUnscheduledTasks** - 取得使用者的未排程任務
3. **getAvailableSlots** - 取得行事曆可用時段

### 重要：自然語言日期解析

今天的日期是：${todayStr}
本週範圍：${thisMonday.toISOString().split('T')[0]} 至 ${thisSunday.toISOString().split('T')[0]}
下週範圍：${nextMonday.toISOString().split('T')[0]} 至 ${nextSunday.toISOString().split('T')[0]}

當使用者說以下日期表達時，請轉換為正確的 startDate 和 endDate：
- 「今天」→ startDate: ${todayStr}, endDate: ${todayStr}
- 「明天」→ startDate: ${new Date(today.getTime() + 86400000).toISOString().split('T')[0]}, endDate: 同上
- 「本週」「這週」→ startDate: ${thisMonday.toISOString().split('T')[0]}, endDate: ${thisSunday.toISOString().split('T')[0]}
- 「下週」「下周」→ startDate: ${nextMonday.toISOString().split('T')[0]}, endDate: ${nextSunday.toISOString().split('T')[0]}
- 「未來 7 天」→ startDate: ${todayStr}, endDate: ${new Date(today.getTime() + 6 * 86400000).toISOString().split('T')[0]}
- 「這個月」→ 從今天到月底

### 排程流程

當使用者說「幫我排程」「安排任務」「規劃行程」等，請直接使用 **generateSmartSchedule** 函數：

\`\`\`
generateSmartSchedule({
  startDate: "YYYY-MM-DD",  // 根據使用者指定的日期
  endDate: "YYYY-MM-DD"     // 如果使用者只說「下週」，就是下週一到下週日
})
\`\`\`

範例：
- 使用者：「幫我把任務排到下週」→ 呼叫 generateSmartSchedule({ startDate: "${nextMonday.toISOString().split('T')[0]}", endDate: "${nextSunday.toISOString().split('T')[0]}" })
- 使用者：「安排這週的工作」→ 呼叫 generateSmartSchedule({ startDate: "${thisMonday.toISOString().split('T')[0]}", endDate: "${thisSunday.toISOString().split('T')[0]}" })
- 使用者：「幫我排未來三天的任務」→ 呼叫 generateSmartSchedule({ startDate: "${todayStr}", endDate: "${new Date(today.getTime() + 2 * 86400000).toISOString().split('T')[0]}" })
`
    }

    // 構建訊息陣列
    const chatMessages: ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
    ]

    // 加入歷史訊息
    for (const msg of messages) {
      chatMessages.push({
        role: msg.role,
        content: msg.content,
      } as ChatCompletionMessageParam)
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

    // 準備 API 參數
    const apiParams: Parameters<typeof openai.chat.completions.create>[0] = {
      model: 'gpt-4.1',
      messages: chatMessages,
      max_tokens: isLongTranscript ? 16000 : 8000,
      temperature: isLongTranscript ? 0.3 : 0.7,
      stream: true,
      stream_options: { include_usage: true },
    }

    // 如果啟用 Function Calling，加入 tools
    if (enableFunctionCalling) {
      apiParams.tools = AI_FUNCTIONS
      apiParams.tool_choice = 'auto'
    }

    // 使用 GPT-4.1 Streaming（1M context window）
    // 確保 stream: true 讓 TypeScript 知道回傳的是 Stream
    const stream = await openai.chat.completions.create({
      ...apiParams,
      stream: true,
    })

    // 建立 ReadableStream 回傳
    const encoder = new TextEncoder()
    let fullContent = ''
    let usageData: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null = null

    // 用於收集 tool calls
    const toolCalls: Array<{
      id: string
      type: 'function'
      function: { name: string; arguments: string }
    }> = []

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          // 第一輪：處理初始 stream
          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta

            // 處理文字內容
            if (delta?.content) {
              fullContent += delta.content
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'content', content: delta.content })}\n\n`))
            }

            // 處理 tool calls（收集）
            if (delta?.tool_calls) {
              for (const toolCall of delta.tool_calls) {
                const index = toolCall.index
                if (!toolCalls[index]) {
                  toolCalls[index] = {
                    id: toolCall.id || '',
                    type: 'function',
                    function: { name: '', arguments: '' },
                  }
                }
                if (toolCall.id) {
                  toolCalls[index].id = toolCall.id
                }
                if (toolCall.function?.name) {
                  toolCalls[index].function.name = toolCall.function.name
                }
                if (toolCall.function?.arguments) {
                  toolCalls[index].function.arguments += toolCall.function.arguments
                }
              }
            }

            // 收集 usage 資訊
            if (chunk.usage) {
              usageData = chunk.usage
            }
          }

          // 如果有 tool calls，執行並繼續對話
          if (toolCalls.length > 0 && enableFunctionCalling && userId) {
            console.log('[Chat Stream] 偵測到 tool calls:', toolCalls.map(tc => tc.function.name))

            // 發送 function calling 狀態
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'function_calling',
              functions: toolCalls.map(tc => tc.function.name),
            })}\n\n`))

            // 加入 assistant 的 tool_calls 訊息
            const assistantMessage: ChatCompletionMessageParam = {
              role: 'assistant',
              content: fullContent || null,
              tool_calls: toolCalls,
            }
            chatMessages.push(assistantMessage)

            // 執行每個 function 並加入結果
            for (const toolCall of toolCalls) {
              try {
                const args = JSON.parse(toolCall.function.arguments || '{}')
                const result = await executeFunctionCall(
                  toolCall.function.name,
                  args,
                  { userId }
                )

                const toolMessage: ChatCompletionToolMessageParam = {
                  role: 'tool',
                  tool_call_id: toolCall.id,
                  content: JSON.stringify(result),
                }
                chatMessages.push(toolMessage)

                // 發送 function 執行結果通知
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                  type: 'function_result',
                  function: toolCall.function.name,
                  success: result.success,
                })}\n\n`))

                // 如果是排程函數，發送排程預覽事件
                if (toolCall.function.name === 'generateSmartSchedule' && result.success && result.data) {
                  const scheduleData = result.data as {
                    scheduledTasks: unknown[]
                    unscheduledTasks: unknown[]
                    summary: unknown
                    // S-010: 衝突資訊
                    conflictCheck?: unknown
                    conflictSummary?: string
                  }
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                    type: 'schedule_preview',
                    data: scheduleData,
                  })}\n\n`))
                }
              } catch (funcError) {
                console.error(`[Chat Stream] Function ${toolCall.function.name} 執行失敗:`, funcError)
                const toolMessage: ChatCompletionToolMessageParam = {
                  role: 'tool',
                  tool_call_id: toolCall.id,
                  content: JSON.stringify({ success: false, error: '執行失敗' }),
                }
                chatMessages.push(toolMessage)
              }
            }

            // 繼續對話，取得最終回應
            const continuedStream = await openai.chat.completions.create({
              model: 'gpt-4.1',
              messages: chatMessages,
              max_tokens: 8000,
              temperature: 0.7,
              stream: true,
              stream_options: { include_usage: true },
            })

            // 處理第二輪 stream
            fullContent = '' // 重置內容
            for await (const chunk of continuedStream) {
              const content = chunk.choices[0]?.delta?.content || ''
              if (content) {
                fullContent += content
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'content', content })}\n\n`))
              }
              if (chunk.usage) {
                // 累加 usage
                if (usageData) {
                  usageData.prompt_tokens = (usageData.prompt_tokens || 0) + (chunk.usage.prompt_tokens || 0)
                  usageData.completion_tokens = (usageData.completion_tokens || 0) + (chunk.usage.completion_tokens || 0)
                  usageData.total_tokens = (usageData.total_tokens || 0) + (chunk.usage.total_tokens || 0)
                } else {
                  usageData = chunk.usage
                }
              }
            }
          }

          // 如果有學習到偏好，發送通知事件
          if (learnedPreference) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'preference_learned',
              preference: learnedPreference,
            })}\n\n`))
          }

          // 發送完成訊號和 usage 資訊
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'done',
            fullContent,
            usage: usageData ? {
              model: 'gpt-4.1',
              promptTokens: usageData.prompt_tokens,
              completionTokens: usageData.completion_tokens,
              totalTokens: usageData.total_tokens,
            } : null,
            hadFunctionCalls: toolCalls.length > 0,
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
