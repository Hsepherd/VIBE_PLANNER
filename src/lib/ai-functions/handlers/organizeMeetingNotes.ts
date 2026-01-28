/**
 * 會議記錄整理工具
 * 使用 OpenAI GPT-4 將散亂的會議內容整理成結構化格式
 */

import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface OrganizeMeetingNotesArgs {
  rawContent: string
  meetingTitle?: string
}

interface OrganizedMeetingNotes {
  title: string
  date: string
  participants: string[]
  discussionPoints: { topic: string; details: string }[]
  decisions: string[]
  actionItems: { task: string; assignee?: string; dueDate?: string }[]
  nextSteps: string[]
}

/**
 * 整理會議記錄
 * 將散亂的會議內容轉換為結構化 JSON 和 Markdown 格式
 */
export async function organizeMeetingNotes(
  args: OrganizeMeetingNotesArgs
): Promise<{ success: boolean; organized: OrganizedMeetingNotes; markdown: string }> {
  const { rawContent, meetingTitle } = args

  const systemPrompt = `你是一位專業的會議記錄整理專家。請將使用者提供的散亂會議內容，整理成 Notion 風格的結構化格式。

輸出 JSON 格式：
{
  "title": "會議標題",
  "date": "會議日期（從內容推測，格式 YYYY-MM-DD，若無法推測則用今天）",
  "participants": ["參與者1", "參與者2"],
  "discussionPoints": [
    { "topic": "討論主題", "details": "討論內容摘要" }
  ],
  "decisions": ["決議事項1", "決議事項2"],
  "actionItems": [
    { "task": "待辦任務", "assignee": "負責人", "dueDate": "截止日期" }
  ],
  "nextSteps": ["下一步行動1"]
}

注意事項：
1. 從內容中自動識別參與者、日期
2. 整理討論要點時，將相關內容歸類到同一主題
3. 決議事項是明確做出的決定
4. 待辦任務是需要執行的具體工作
5. 若某欄位無相關內容，使用空陣列
6. 所有輸出使用繁體中文`

  const response = await openai.chat.completions.create({
    model: 'gpt-4.1-2025-04-14',
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: meetingTitle
          ? `會議標題：${meetingTitle}\n\n會議內容：\n${rawContent}`
          : `請整理以下會議內容：\n${rawContent}`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  })

  const content = response.choices[0]?.message?.content
  if (!content) {
    throw new Error('AI 回應為空')
  }

  const organized: OrganizedMeetingNotes = JSON.parse(content)

  // 生成 Markdown 格式
  const markdown = generateMarkdown(organized)

  return {
    success: true,
    organized,
    markdown,
  }
}

/**
 * 將結構化會議記錄轉換為 Markdown 格式
 */
function generateMarkdown(notes: OrganizedMeetingNotes): string {
  const lines: string[] = []

  // 標題區塊
  lines.push(`# ${notes.title}`)
  lines.push('')
  lines.push(`> **日期**：${notes.date}`)
  if (notes.participants.length > 0) {
    lines.push(`> **參與者**：${notes.participants.join('、')}`)
  }
  lines.push('')

  // 討論要點
  if (notes.discussionPoints.length > 0) {
    lines.push('## 討論要點')
    lines.push('')
    notes.discussionPoints.forEach((point, i) => {
      lines.push(`### ${i + 1}. ${point.topic}`)
      lines.push(point.details)
      lines.push('')
    })
  }

  // 決議事項
  if (notes.decisions.length > 0) {
    lines.push('## 決議事項')
    lines.push('')
    notes.decisions.forEach((decision) => {
      lines.push(`- ${decision}`)
    })
    lines.push('')
  }

  // 待辦任務
  if (notes.actionItems.length > 0) {
    lines.push('## 待辦任務')
    lines.push('')
    notes.actionItems.forEach((item) => {
      let taskLine = `- [ ] ${item.task}`
      if (item.assignee) taskLine += ` (@${item.assignee})`
      if (item.dueDate) taskLine += ` [截止：${item.dueDate}]`
      lines.push(taskLine)
    })
    lines.push('')
  }

  // 下一步
  if (notes.nextSteps.length > 0) {
    lines.push('## 下一步')
    lines.push('')
    notes.nextSteps.forEach((step) => {
      lines.push(`- ${step}`)
    })
    lines.push('')
  }

  return lines.join('\n')
}
