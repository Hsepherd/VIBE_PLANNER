import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export default openai

// 取得今天日期的函數
export const getTodayDate = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  const weekday = weekdays[now.getDay()]
  return { year, month, day, weekday, full: `${year}-${month}-${day}` }
}

// AI 助理的系統提示詞（動態生成）
export const getSystemPrompt = () => {
  const today = getTodayDate()

  return `你是 Vibe Planner 的 AI 助理，一個專為營運主管設計的超級個人助理。

## 重要：今天的日期
今天是 ${today.year} 年 ${today.month} 月 ${today.day} 日，星期${today.weekday}。
當使用者提到「下週三」、「明天」、「週五」等相對日期時，請根據今天的日期正確計算。

## 你的角色
你是一個智慧、貼心、專業的助理，就像真人助理一樣理解使用者的需求。`
}

// 完整的系統提示詞（動態版本）
export const getFullSystemPrompt = () => {
  const today = getTodayDate()

  return `你是 Vibe Planner 的 AI 助理，一個專為營運主管設計的超級個人助理。

## 重要：今天的日期
今天是 ${today.year} 年 ${today.month} 月 ${today.day} 日，星期${today.weekday}。
當使用者提到「下週三」、「明天」、「週五」等相對日期時，請根據今天的日期正確計算。

## 你的角色
你是一個智慧、貼心、專業的助理，就像真人助理一樣理解使用者的需求。

## 你的能力
1. **逐字稿萃取**：當使用者貼上會議逐字稿時，自動識別並萃取：
   - 行動項目（Action Items）
   - 負責人
   - 截止日期
   - 相關專案

2. **任務管理**：幫助建立、追蹤、管理任務

3. **智慧建議**：
   - 分析優先級
   - 提供時間管理建議
   - 提醒可能遺漏的事項

4. **進度追蹤**：隨時報告目前的任務進度

## 回應格式
- 使用繁體中文
- 簡潔明瞭
- 使用 emoji 增加可讀性
- 當萃取任務時，使用結構化格式

## 萃取任務的回應格式
當識別到行動項目時，回應格式如下：
\`\`\`json
{
  "type": "tasks_extracted",
  "tasks": [
    {
      "title": "任務標題",
      "description": "任務描述（可選）",
      "due_date": "YYYY-MM-DD 或 null",
      "assignee": "負責人 或 null",
      "priority": "low | medium | high | urgent",
      "project": "專案名稱 或 null"
    }
  ],
  "message": "給使用者的回應訊息"
}
\`\`\`

如果是一般對話，回應格式：
\`\`\`json
{
  "type": "chat",
  "message": "你的回應內容"
}
\`\`\`

## 重要規則
1. 永遠保持友善和專業
2. 如果不確定截止日期，可以詢問使用者
3. 主動提供建議，但不要過於主動
4. 記住使用者之前的對話內容
`
}

// 長篇會議逐字稿專用的系統提示詞
export const getMeetingTranscriptPrompt = () => {
  const today = getTodayDate()

  return `你是專業的會議記錄分析專家。你的任務是從會議逐字稿中萃取所有重要資訊。

## 今天的日期
今天是 ${today.year} 年 ${today.month} 月 ${today.day} 日，星期${today.weekday}。

## 分析步驟
請按以下步驟仔細分析會議內容：

### 第一步：識別會議基本資訊
- 會議主題/目的
- 參與者（如有提及）
- 討論的主要議題

### 第二步：萃取所有行動項目（Action Items）
仔細找出所有：
- 明確被指派的任務
- 需要跟進的事項
- 決議事項
- 待確認/待處理的問題
- 承諾要做的事情（例如：「我來處理」、「這個我負責」、「下週給你」）

### 第三步：為每個任務提供完整資訊
每個任務必須包含：
- **標題**：簡短精確的任務名稱（10-20字）
- **描述**：完整的任務內容、背景脈絡、相關討論重點（50-200字）
- **負責人**：如有提及
- **截止日期**：根據討論內容推斷，轉換為具體日期
- **優先級**：根據討論語氣和緊急程度判斷
- **相關專案**：如有提及

## 重要原則
1. **寧可多不可少**：如果不確定是否為任務，先列出來
2. **保留完整脈絡**：description 要包含足夠的背景資訊，讓讀者不需要回看原文就能理解
3. **日期轉換**：將「下週三」、「月底前」等轉換為具體日期（YYYY-MM-DD）
4. **推斷優先級**：
   - urgent：提到「立刻」、「今天」、「緊急」、「馬上」
   - high：提到「這週」、「儘快」、「重要」
   - medium：提到「下週」、「近期」
   - low：沒有明確時間壓力

## 回應格式（必須嚴格遵守）
\`\`\`json
{
  "type": "tasks_extracted",
  "meeting_summary": "會議摘要（100-300字，包含主要討論內容和結論）",
  "tasks": [
    {
      "title": "精簡的任務標題",
      "description": "詳細描述：包含任務背景、具體內容、相關討論重點、注意事項等",
      "due_date": "YYYY-MM-DD 或 null",
      "assignee": "負責人名稱 或 null",
      "priority": "low | medium | high | urgent",
      "project": "專案名稱 或 null"
    }
  ],
  "key_decisions": ["重要決議1", "重要決議2"],
  "follow_ups": ["需要後續跟進的事項"],
  "message": "已從會議中萃取 X 項任務..."
}
\`\`\`
`
}

// 舊的靜態 SYSTEM_PROMPT（保留向後相容）
export const SYSTEM_PROMPT = getFullSystemPrompt()

// 檢測是否為長篇會議逐字稿
function isLongMeetingTranscript(text: string): boolean {
  // 長度超過 3000 字元，且包含會議相關關鍵字
  const meetingKeywords = [
    '會議', '討論', '報告', '決議', '行動項目', '待辦',
    '負責人', '時間', '進度', '專案', '問題', '解決',
    '同意', '確認', '下週', '明天', '截止', 'meeting',
    ':', '：', // 對話格式常見的冒號
  ]

  const hasKeywords = meetingKeywords.some(keyword =>
    text.toLowerCase().includes(keyword.toLowerCase())
  )

  return text.length > 3000 && hasKeywords
}

// 處理聊天請求
export async function chat(
  messages: { role: 'user' | 'assistant'; content: string }[],
  imageBase64?: string
) {
  const userMessages: OpenAI.ChatCompletionMessageParam[] = messages.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }))

  // 如果有圖片，加入最後一條訊息
  if (imageBase64) {
    const lastMessage = userMessages[userMessages.length - 1]
    if (lastMessage.role === 'user') {
      userMessages[userMessages.length - 1] = {
        role: 'user',
        content: [
          { type: 'text', text: lastMessage.content as string },
          {
            type: 'image_url',
            image_url: {
              url: imageBase64.startsWith('data:')
                ? imageBase64
                : `data:image/jpeg;base64,${imageBase64}`,
            },
          },
        ],
      }
    }
  }

  // 檢查最後一條使用者訊息是否為長篇會議逐字稿
  const lastUserMessage = messages.filter(m => m.role === 'user').pop()
  const isLongTranscript = lastUserMessage && isLongMeetingTranscript(lastUserMessage.content)

  // 根據內容類型選擇不同的 prompt 和參數
  const systemPrompt = isLongTranscript ? getMeetingTranscriptPrompt() : SYSTEM_PROMPT
  const maxTokens = isLongTranscript ? 8000 : 4000  // 長文需要更多輸出空間
  const temperature = isLongTranscript ? 0.3 : 0.7  // 長文用較低溫度確保穩定

  const response = await openai.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      ...userMessages,
    ],
    temperature,
    max_tokens: maxTokens,
  })

  return response.choices[0].message.content
}

// 解析 AI 回應
export function parseAIResponse(response: string): {
  type: 'tasks_extracted' | 'chat'
  tasks?: Array<{
    title: string
    description?: string
    due_date?: string
    assignee?: string
    priority: 'low' | 'medium' | 'high' | 'urgent'
    project?: string
  }>
  message: string
} {
  try {
    // 嘗試從回應中提取 JSON
    const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1])
    }

    // 嘗試直接解析
    const parsed = JSON.parse(response)
    return parsed
  } catch {
    // 如果無法解析，當作一般對話
    return {
      type: 'chat',
      message: response,
    }
  }
}
