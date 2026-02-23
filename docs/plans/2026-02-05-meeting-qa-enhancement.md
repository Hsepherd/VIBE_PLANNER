# Meeting Q&A Enhancement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 實作會議記錄的 AI 問答功能，讓使用者能基於會議內容向 AI 提問並獲得準確回答

**Architecture:**
- 建立專用的 API endpoint (`/api/meeting-notes/qa`) 處理問答請求
- 將會議內容（rawContent、organized）作為上下文注入 prompt
- 使用 OpenAI GPT-4 streaming API 提供即時回覆
- 前端支援 streaming 顯示，提升使用者體驗

**Tech Stack:** Next.js API Routes, OpenAI GPT-4.1, React useState/useRef for streaming

---

## Task 1: Create Meeting Q&A API Endpoint

**Files:**
- Create: `app/api/meeting-notes/qa/route.ts`

**Step 1: Create the API route file**

```typescript
/**
 * 會議記錄問答 API
 * 基於會議內容回答使用者問題
 */

import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase-server'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const { meetingNoteId, question, chatHistory } = await request.json()

    if (!meetingNoteId || !question) {
      return NextResponse.json(
        { error: '缺少必要參數' },
        { status: 400 }
      )
    }

    // 驗證使用者身份
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '未登入' }, { status: 401 })
    }

    // 取得會議記錄
    const { data: meetingNote, error: fetchError } = await supabase
      .from('meeting_notes')
      .select('*')
      .eq('id', meetingNoteId)
      .single()

    if (fetchError || !meetingNote) {
      return NextResponse.json({ error: '找不到會議記錄' }, { status: 404 })
    }

    // 建構系統提示詞
    const systemPrompt = buildMeetingQAPrompt(meetingNote)

    // 建構訊息陣列
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
    ]

    // 加入歷史對話（最多保留 10 輪）
    if (chatHistory && Array.isArray(chatHistory)) {
      const recentHistory = chatHistory.slice(-20) // 10 輪 = 20 條訊息
      for (const msg of recentHistory) {
        messages.push({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        })
      }
    }

    // 加入當前問題
    messages.push({ role: 'user', content: question })

    // 使用 streaming 回覆
    const stream = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages,
      temperature: 0.3,
      stream: true,
    })

    // 建立 ReadableStream
    const encoder = new TextEncoder()
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || ''
            if (content) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`))
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        } catch (error) {
          controller.error(error)
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
    console.error('Meeting QA error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '問答失敗' },
      { status: 500 }
    )
  }
}

/**
 * 建構會議問答的系統提示詞
 */
function buildMeetingQAPrompt(meetingNote: {
  title: string
  date: string
  participants: string[]
  raw_content: string
  organized: {
    discussionPoints?: { topic: string; details: string }[]
    decisions?: string[]
    actionItems?: { task: string; assignee?: string; dueDate?: string }[]
    nextSteps?: string[]
  }
}): string {
  const { title, date, participants, raw_content, organized } = meetingNote

  // 格式化結構化內容
  let structuredContent = ''

  if (organized.discussionPoints?.length) {
    structuredContent += '\n### 討論要點\n'
    organized.discussionPoints.forEach((point, i) => {
      structuredContent += `${i + 1}. **${point.topic}**\n   ${point.details}\n`
    })
  }

  if (organized.decisions?.length) {
    structuredContent += '\n### 決議事項\n'
    organized.decisions.forEach((d, i) => {
      structuredContent += `${i + 1}. ${d}\n`
    })
  }

  if (organized.actionItems?.length) {
    structuredContent += '\n### 待辦任務\n'
    organized.actionItems.forEach((item, i) => {
      let line = `${i + 1}. ${item.task}`
      if (item.assignee) line += ` (負責人: ${item.assignee})`
      if (item.dueDate) line += ` [截止: ${item.dueDate}]`
      structuredContent += line + '\n'
    })
  }

  if (organized.nextSteps?.length) {
    structuredContent += '\n### 下一步\n'
    organized.nextSteps.forEach((step, i) => {
      structuredContent += `${i + 1}. ${step}\n`
    })
  }

  return `你是一位專業的會議助理，專門回答關於特定會議記錄的問題。

## 會議資訊
- **標題**：${title}
- **日期**：${date}
- **參與者**：${participants.join('、')}

## AI 整理後的結構化內容
${structuredContent}

## 原始會議逐字稿
\`\`\`
${raw_content}
\`\`\`

## 回答規則
1. **只根據上述會議內容回答**，不要編造不存在的資訊
2. 如果問題與會議內容無關，禮貌地說明這個問題在會議中沒有被討論
3. 回答要**簡潔明確**，直接回答問題
4. 可以引用會議中的原話作為佐證，用引號標示
5. 如果問到待辦任務，要清楚說明負責人和截止日期
6. 使用**繁體中文**回答
7. 如果使用者問「有沒有漏掉什麼」或類似問題，請仔細檢查逐字稿是否有未被整理到結構化內容中的重要資訊

## 回答風格
- 專業但親切
- 條理分明
- 適時使用列點整理
- 引用原文時標注出處（如：「在會議中提到...」）`
}
```

**Step 2: Verify the file was created correctly**

Run: `cat app/api/meeting-notes/qa/route.ts | head -20`
Expected: File contents showing the imports and POST function start

**Step 3: Commit**

```bash
git add app/api/meeting-notes/qa/route.ts
git commit -m "feat: add meeting Q&A API endpoint with streaming support"
```

---

## Task 2: Update Frontend to Use Real API with Streaming

**Files:**
- Modify: `app/meeting-notes/page.tsx` (lines 634-666, 1476-1498)

**Step 1: Update sendChatMessage function to call real API**

Find and replace the `sendChatMessage` function (around line 634-666):

```typescript
  // 發送聊天訊息
  const sendChatMessage = async () => {
    if (!currentNote || !chatInput.trim() || isSendingChat) return

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: chatInput.trim(),
      timestamp: new Date(),
    }

    // 立即更新 UI 顯示使用者訊息
    setChatByNote(prev => ({
      ...prev,
      [currentNote.id]: [...(prev[currentNote.id] || []), userMessage]
    }))
    setChatInput('')
    setIsSendingChat(true)

    // 建立 AI 回覆的 placeholder
    const aiMessageId = `msg-${Date.now()}-ai`
    const aiMessage: ChatMessage = {
      id: aiMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    }

    setChatByNote(prev => ({
      ...prev,
      [currentNote.id]: [...(prev[currentNote.id] || []), aiMessage]
    }))

    try {
      // 取得歷史對話（不包含剛加入的空 AI 訊息）
      const history = chatByNote[currentNote.id] || []

      const response = await fetch('/api/meeting-notes/qa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meetingNoteId: currentNote.id,
          question: userMessage.content,
          chatHistory: history.map(m => ({ role: m.role, content: m.content })),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '問答失敗')
      }

      // 處理 streaming response
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let accumulatedContent = ''

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') continue

              try {
                const parsed = JSON.parse(data)
                if (parsed.content) {
                  accumulatedContent += parsed.content
                  // 即時更新 AI 訊息內容
                  setChatByNote(prev => ({
                    ...prev,
                    [currentNote.id]: prev[currentNote.id].map(m =>
                      m.id === aiMessageId
                        ? { ...m, content: accumulatedContent }
                        : m
                    )
                  }))
                }
              } catch {
                // 忽略解析錯誤
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Meeting QA error:', error)
      // 更新 AI 訊息為錯誤訊息
      setChatByNote(prev => ({
        ...prev,
        [currentNote.id]: prev[currentNote.id].map(m =>
          m.id === aiMessageId
            ? { ...m, content: `抱歉，發生錯誤：${error instanceof Error ? error.message : '未知錯誤'}` }
            : m
        )
      }))
      toast.error('問答失敗，請稍後再試')
    } finally {
      setIsSendingChat(false)
    }
  }
```

**Step 2: Verify the changes compile**

Run: `npx tsc --noEmit 2>&1 | grep -i "meeting-notes/page" || echo "No errors in meeting-notes/page"`
Expected: No errors related to meeting-notes/page.tsx

**Step 3: Commit**

```bash
git add app/meeting-notes/page.tsx
git commit -m "feat: integrate streaming AI Q&A in meeting notes page"
```

---

## Task 3: Add Loading Animation for Streaming Response

**Files:**
- Modify: `app/meeting-notes/page.tsx` (chat message display section, around line 1456-1475)

**Step 1: Update chat message display to show typing indicator**

Find the chat message display section and update:

```typescript
                  {/* 聊天記錄 */}
                  {currentChat.length > 0 && (
                    <div className="space-y-4 mb-4">
                      {currentChat.map((msg) => (
                        <div
                          key={msg.id}
                          className={cn(
                            "p-3 rounded-lg",
                            msg.role === 'user'
                              ? "bg-white border border-[#e3e2e0]"
                              : "bg-purple-50 border border-purple-100"
                          )}
                        >
                          <div className="text-xs text-[#9b9a97] mb-1">
                            {msg.role === 'user' ? '你' : 'AI 助手'}
                          </div>
                          <div className="text-sm text-[#37352f] whitespace-pre-wrap">
                            {msg.content || (
                              <span className="flex items-center gap-2 text-[#9b9a97]">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                正在思考...
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
```

**Step 2: Verify the UI displays correctly**

Run: `npm run dev` (manual verification)
Expected: When AI is responding, show "正在思考..." with spinner

**Step 3: Commit**

```bash
git add app/meeting-notes/page.tsx
git commit -m "feat: add typing indicator for AI streaming response"
```

---

## Task 4: Add Suggested Questions Feature

**Files:**
- Modify: `app/meeting-notes/page.tsx`

**Step 1: Add suggested questions state and UI**

Add state near other chat states (around line 267):

```typescript
  // 建議問題
  const suggestedQuestions = [
    '這次會議有哪些重要決議？',
    '待辦任務有漏掉的嗎？',
    '誰負責最多任務？',
    '下一步行動是什麼？',
  ]
```

**Step 2: Add suggested questions UI before input**

Add this before the input section (before line 1477):

```typescript
                  {/* 建議問題 - 僅在沒有對話時顯示 */}
                  {currentChat.length === 0 && (
                    <div className="mb-4">
                      <div className="text-xs text-[#9b9a97] mb-2">建議問題</div>
                      <div className="flex flex-wrap gap-2">
                        {suggestedQuestions.map((q, i) => (
                          <button
                            key={i}
                            onClick={() => {
                              setChatInput(q)
                            }}
                            className="px-3 py-1.5 text-xs bg-white border border-[#e3e2e0] rounded-full text-[#73726e] hover:bg-purple-50 hover:border-purple-200 hover:text-purple-700 transition-colors"
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
```

**Step 3: Commit**

```bash
git add app/meeting-notes/page.tsx
git commit -m "feat: add suggested questions for meeting Q&A"
```

---

## Task 5: Add Clear Chat History Feature

**Files:**
- Modify: `app/meeting-notes/page.tsx`

**Step 1: Add clear chat function**

Add after `sendChatMessage` function:

```typescript
  // 清除聊天記錄
  const clearChatHistory = () => {
    if (!currentNote) return
    setChatByNote(prev => ({
      ...prev,
      [currentNote.id]: []
    }))
  }
```

**Step 2: Add clear button in UI**

Update the 會議問答 header section:

```typescript
              {/* 會議問答 */}
              <section className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold text-[#37352f] flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-purple-600" />
                    會議問答
                  </h2>
                  {currentChat.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearChatHistory}
                      className="text-xs text-[#9b9a97] hover:text-[#37352f]"
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      清除對話
                    </Button>
                  )}
                </div>
```

**Step 3: Commit**

```bash
git add app/meeting-notes/page.tsx
git commit -m "feat: add clear chat history button for meeting Q&A"
```

---

## Task 6: Final Integration Test

**Step 1: Run the development server**

Run: `npm run dev`

**Step 2: Manual verification checklist**

- [ ] Navigate to meeting notes page
- [ ] Select a meeting note with content
- [ ] See suggested questions displayed
- [ ] Click a suggested question - should fill input
- [ ] Send a question about the meeting
- [ ] Verify streaming response shows "正在思考..." then gradually reveals answer
- [ ] Verify answer is based on actual meeting content
- [ ] Send follow-up question to test context retention
- [ ] Click "清除對話" to reset chat history
- [ ] Verify suggested questions reappear after clearing

**Step 3: Final commit**

```bash
git add .
git commit -m "feat: complete meeting Q&A enhancement with streaming AI responses"
```

---

## Summary

This plan implements a complete meeting Q&A feature with:
1. **Backend API** - Streaming endpoint with meeting context injection
2. **Streaming UI** - Real-time response display with typing indicator
3. **Suggested Questions** - Help users get started quickly
4. **Chat History** - Maintain conversation context within session
5. **Clear Function** - Reset chat to start fresh

Total estimated tasks: 6
Each task has clear verification steps and commits.
