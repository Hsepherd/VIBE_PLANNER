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
  actionItems: { task: string; description?: string; assignee?: string; group?: string; dueDate?: string; startDate?: string }[]
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
    {
      "task": "待辦任務標題（簡短）",
      "description": "【任務摘要】\n一句話描述這個任務的目標和背景\n\n【執行細節】\n1. 具體步驟一\n2. 具體步驟二\n3. 具體步驟三\n\n【會議脈絡】\n簡述這個任務在會議中的討論背景\n\n【原文引用】\n「[00:05:30] 從會議中引用的相關原話」\n「[00:08:15] 另一段相關原話」",
      "assignee": "負責人姓名",
      "group": "負責組別/部門",
      "dueDate": "截止日期",
      "startDate": "開始日期"
    }
  ],
  "nextSteps": ["下一步行動1"]
}

注意事項：
1. 從內容中自動識別參與者、日期
2. 整理討論要點時，將相關內容歸類到同一主題
3. 決議事項是明確做出的決定
4. 待辦任務是需要執行的具體工作
5. 若某欄位無相關內容，使用空陣列
6. 所有輸出使用繁體中文

actionItems 欄位規則（極重要）：
- task：簡短的任務標題（10-30字）
- description：必須使用以下格式，包含四個區塊：
  【任務摘要】一段話說明任務目標（30-50字）
  【執行細節】列出 2-4 個具體執行步驟（用數字編號）
  【會議脈絡】說明這個任務產生的會議背景（20-40字）
  【原文引用】引用會議中提到這個任務的原話，格式為「[時間碼] 原話內容」
    - 如果原始內容有時間碼（如 00:05:30、5:30、[05:30] 等），保留並使用該時間碼
    - 如果沒有時間碼，根據內容在會議中的相對位置估算（如會議開始、中段、結尾）
    - 範例：「[00:12:45] 我們需要在下週前完成這個功能」
- assignee：只能填寫「participants」陣列中出現的人名。如果沒有明確指定負責人，assignee 留空字串 ""
- group：填組別或部門名稱（如：行銷組、技術部門、客服組）
- 絕對不要編造或猜測不存在的人名
- startDate 預設為會議日期（date 欄位的值）
- dueDate 從內容明確提到的截止日期推測，若無則留空`

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
      if (item.group) taskLine += ` [${item.group}]`
      if (item.startDate) taskLine += ` [開始：${item.startDate}]`
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
