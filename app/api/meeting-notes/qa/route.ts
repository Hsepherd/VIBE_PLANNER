/**
 * 會議記錄 Q&A API
 * 根據會議內容回答使用者問題，支援 Streaming SSE
 */

import { NextRequest } from 'next/server'
import openai from '@/lib/openai'
import { createClient } from '@/lib/supabase-server'
import type { OrganizedMeetingNotes } from '@/lib/supabase-api'

// 聊天歷史訊息類型
interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// 建構會議 Q&A 的系統提示詞
function buildMeetingQASystemPrompt(meetingNote: {
  title: string
  date: string
  participants: string[]
  raw_content: string
  organized: OrganizedMeetingNotes
  markdown: string
}): string {
  const { title, date, participants, raw_content, organized } = meetingNote

  // 格式化結構化內容
  const discussionPointsText = organized.discussionPoints
    ?.map((dp, i) => `${i + 1}. ${dp.topic}：${dp.details}`)
    .join('\n') || '（無）'

  const decisionsText = organized.decisions
    ?.map((d, i) => `${i + 1}. ${d}`)
    .join('\n') || '（無）'

  const actionItemsText = organized.actionItems
    ?.map((item, i) => {
      let text = `${i + 1}. ${item.task}`
      if (item.assignee) text += `（負責人：${item.assignee}）`
      if (item.group) text += `（組別：${item.group}）`
      if (item.dueDate) text += `（截止：${item.dueDate}）`
      return text
    })
    .join('\n') || '（無）'

  const nextStepsText = organized.nextSteps
    ?.map((step, i) => `${i + 1}. ${step}`)
    .join('\n') || '（無）'

  return `你是一個專業的會議記錄助理，專門回答關於會議內容的問題。

## 會議資訊
- **標題**：${title}
- **日期**：${date}
- **參與者**：${participants.join('、') || '未記錄'}

## 結構化會議內容

### 討論重點
${discussionPointsText}

### 決議事項
${decisionsText}

### 行動項目
${actionItemsText}

### 後續追蹤
${nextStepsText}

## 原始會議逐字稿
${raw_content}

---

## 回答規則
1. **只根據以上會議內容回答問題**，不要編造或推測會議中未提及的內容
2. 如果問題與會議內容無關，請禮貌地說明這個問題不在會議討論範圍內
3. 如果會議中沒有明確提及相關資訊，請誠實告知「會議中未提及此內容」
4. 回答時可以引用原始逐字稿中的相關段落作為佐證
5. 使用**繁體中文**回答
6. 回答要**簡潔明瞭**，必要時使用條列式呈現
7. 如果被問到「誰說了什麼」，請盡量引用原文

## 回答風格
- 專業且友善
- 直接回答問題，不要過度寒暄
- 當有多個相關資訊時，整理成結構化的回答`
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { meetingNoteId, question, chatHistory } = body as {
      meetingNoteId: string
      question: string
      chatHistory?: ChatMessage[]
    }

    // 驗證必要參數
    if (!meetingNoteId) {
      return new Response(
        JSON.stringify({ error: '缺少會議記錄 ID' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!question?.trim()) {
      return new Response(
        JSON.stringify({ error: '缺少問題內容' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // 取得 Supabase client 和驗證使用者
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return new Response(
        JSON.stringify({ error: '未登入' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // 從資料庫取得會議記錄（包含使用者所有權驗證）
    const { data: meetingNote, error: fetchError } = await supabase
      .from('meeting_notes')
      .select('*')
      .eq('id', meetingNoteId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !meetingNote) {
      console.error('[Meeting Q&A] 查詢會議記錄失敗:', fetchError)
      return new Response(
        JSON.stringify({ error: '找不到會議記錄' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // 建構系統提示詞
    const systemPrompt = buildMeetingQASystemPrompt({
      title: meetingNote.title,
      date: meetingNote.date,
      participants: meetingNote.participants || [],
      raw_content: meetingNote.raw_content,
      organized: meetingNote.organized as OrganizedMeetingNotes,
      markdown: meetingNote.markdown,
    })

    // 建構訊息陣列
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
    ]

    // 加入聊天歷史（如果有），限制最多 10 輪對話（20 則訊息）以避免 context 過長
    if (chatHistory && chatHistory.length > 0) {
      const recentHistory = chatHistory.slice(-20)
      for (const msg of recentHistory) {
        messages.push({
          role: msg.role,
          content: msg.content,
        })
      }
    }

    // 加入目前的問題
    messages.push({ role: 'user', content: question })

    // 呼叫 OpenAI API（使用 streaming）
    const stream = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages,
      max_tokens: 2000,
      temperature: 0.3,
      stream: true,
      stream_options: { include_usage: true },
    })

    // 建立 SSE ReadableStream
    const encoder = new TextEncoder()
    let fullContent = ''
    let usageData: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null = null

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta

            // 處理文字內容
            if (delta?.content) {
              fullContent += delta.content
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'content', content: delta.content })}\n\n`)
              )
            }

            // 收集 usage 資訊
            if (chunk.usage) {
              usageData = chunk.usage
            }
          }

          // 發送完成訊號
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              type: 'done',
              fullContent,
              usage: usageData ? {
                model: 'gpt-4.1-mini',
                promptTokens: usageData.prompt_tokens,
                completionTokens: usageData.completion_tokens,
                totalTokens: usageData.total_tokens,
              } : null,
            })}\n\n`)
          )

          controller.close()
        } catch (error) {
          console.error('[Meeting Q&A] Streaming error:', error)
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'error', error: 'Streaming 失敗' })}\n\n`)
          )
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
    console.error('[Meeting Q&A] API Error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : '發生未知錯誤',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
