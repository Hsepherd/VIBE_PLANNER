/**
 * AI 預估任務時間
 * 使用 GPT-4.1-mini 進行智慧預估
 */

import OpenAI from 'openai'

// 初始化 OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// 預估結果介面
export interface TaskTimeEstimate {
  taskId: string
  taskTitle: string
  estimatedMinutes: number
  taskType: 'focus' | 'background'
  confidence: 'high' | 'medium' | 'low'
  reasoning: string
}

// 預估 Prompt
const ESTIMATE_PROMPT = `你是一個任務時間預估專家。根據任務的標題和描述，預估完成所需的時間。

## 考慮因素
1. 任務複雜度
2. 是否需要協作或等待他人
3. 是否涉及創意工作（需要更多時間）
4. 是否為例行任務（較快完成）
5. 是否為技術任務（如部署、測試）

## 任務類型
- **focus**: 需要專注完成的任務，會獨占時段
- **background**: 可以在背景執行的任務（如部署、等待審核），可以同時做其他事

## 常見任務時間參考
- 回覆郵件/訊息: 10-30 分鐘 (focus)
- 簡短會議: 30 分鐘 (focus)
- 一般會議: 60 分鐘 (focus)
- 程式碼審查: 30-60 分鐘 (focus)
- 撰寫文件/報告: 60-180 分鐘 (focus)
- 簡報製作: 60-180 分鐘 (focus)
- 開發功能: 60-240 分鐘 (focus)
- Bug 修復: 30-120 分鐘 (focus)
- 部署/發布: 15-60 分鐘 (background)
- 執行測試: 15-45 分鐘 (background)
- 等待審核/回覆: 30-120 分鐘 (background)

## 信心度判斷
- **high**: 任務描述清楚，有明確的工作範圍
- **medium**: 任務描述一般，可以合理推測
- **low**: 任務描述模糊，只能給預設估計

回傳 JSON 格式（只回傳 JSON，不要有其他文字）：
{
  "estimatedMinutes": 數字,
  "taskType": "focus" 或 "background",
  "confidence": "high" 或 "medium" 或 "low",
  "reasoning": "簡短說明預估理由（20字內）"
}`

interface EstimateTaskTimeArgs {
  taskId: string
  taskTitle: string
  taskDescription?: string
}

/**
 * 使用 AI 預估單一任務時間
 */
export async function estimateTaskTime(
  args: EstimateTaskTimeArgs
): Promise<TaskTimeEstimate> {
  const { taskId, taskTitle, taskDescription } = args

  try {
    // 呼叫 GPT-4.1-mini 進行預估
    const response = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: ESTIMATE_PROMPT },
        {
          role: 'user',
          content: `任務標題：${taskTitle}\n任務描述：${taskDescription || '無'}`,
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 200,
      temperature: 0.3, // 低 temperature 讓回答更一致
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('AI 回應為空')
    }

    const result = JSON.parse(content)

    // 驗證並回傳結果
    return {
      taskId,
      taskTitle,
      estimatedMinutes: Math.max(5, Math.min(480, result.estimatedMinutes || 60)), // 限制 5-480 分鐘
      taskType: result.taskType === 'background' ? 'background' : 'focus',
      confidence: ['high', 'medium', 'low'].includes(result.confidence) ? result.confidence : 'low',
      reasoning: result.reasoning || '根據任務內容預估',
    }
  } catch (error) {
    console.error('[AI Estimate] 預估失敗，使用回退邏輯:', error)
    // 回退到關鍵字匹配邏輯
    return fallbackEstimate(taskId, taskTitle, taskDescription)
  }
}

/**
 * 回退預估邏輯（當 AI 不可用時）
 */
function fallbackEstimate(
  taskId: string,
  taskTitle: string,
  taskDescription?: string
): TaskTimeEstimate {
  const text = `${taskTitle} ${taskDescription || ''}`.toLowerCase()

  // 背景任務關鍵字
  const backgroundKeywords = [
    '部署', 'deploy', '發布', 'release', '備份', 'backup',
    '執行', 'run', '下載', 'download', '上傳', 'upload',
    '編譯', 'compile', 'build', '測試', 'test', 'CI/CD',
    '等待', 'wait', '安裝', 'install',
  ]

  // 常見任務時間對照
  const timeHints: Record<string, { min: number; max: number; type: 'focus' | 'background' }> = {
    '會議': { min: 30, max: 120, type: 'focus' },
    '開會': { min: 30, max: 120, type: 'focus' },
    'meeting': { min: 30, max: 120, type: 'focus' },
    '電話': { min: 15, max: 60, type: 'focus' },
    '通話': { min: 15, max: 60, type: 'focus' },
    '報告': { min: 60, max: 180, type: 'focus' },
    '文件': { min: 30, max: 120, type: 'focus' },
    '簡報': { min: 60, max: 180, type: 'focus' },
    '開發': { min: 60, max: 240, type: 'focus' },
    '程式': { min: 60, max: 240, type: 'focus' },
    '修復': { min: 30, max: 120, type: 'focus' },
    'bug': { min: 30, max: 120, type: 'focus' },
    '部署': { min: 15, max: 60, type: 'background' },
    'deploy': { min: 15, max: 60, type: 'background' },
    '審核': { min: 15, max: 60, type: 'focus' },
    'review': { min: 15, max: 60, type: 'focus' },
    '回覆': { min: 10, max: 30, type: 'focus' },
    'email': { min: 10, max: 45, type: 'focus' },
  }

  // 判斷任務類型
  let taskType: 'focus' | 'background' = 'focus'
  for (const keyword of backgroundKeywords) {
    if (text.includes(keyword.toLowerCase())) {
      taskType = 'background'
      break
    }
  }

  // 根據關鍵字推斷時間
  let estimatedMinutes = 60
  let reasoning = '根據預設值估計'

  for (const [keyword, hint] of Object.entries(timeHints)) {
    if (text.includes(keyword.toLowerCase())) {
      estimatedMinutes = Math.round((hint.min + hint.max) / 2)
      taskType = hint.type
      reasoning = `根據「${keyword}」關鍵字估計`
      break
    }
  }

  return {
    taskId,
    taskTitle,
    estimatedMinutes,
    taskType,
    confidence: 'low',
    reasoning,
  }
}

interface EstimateMultipleTasksArgs {
  tasks: Array<{
    taskId: string
    taskTitle: string
    taskDescription?: string
  }>
}

/**
 * 批次預估多個任務時間（並行處理）
 */
export async function estimateMultipleTasksTime(
  args: EstimateMultipleTasksArgs
): Promise<{ estimates: TaskTimeEstimate[]; totalMinutes: number }> {
  const { tasks } = args

  if (tasks.length === 0) {
    return { estimates: [], totalMinutes: 0 }
  }

  // 限制並行數量（避免 rate limiting）
  const BATCH_SIZE = 5
  const estimates: TaskTimeEstimate[] = []

  for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
    const batch = tasks.slice(i, i + BATCH_SIZE)
    const batchResults = await Promise.all(
      batch.map((task) =>
        estimateTaskTime({
          taskId: task.taskId,
          taskTitle: task.taskTitle,
          taskDescription: task.taskDescription,
        })
      )
    )
    estimates.push(...batchResults)
  }

  const totalMinutes = estimates.reduce((sum, e) => sum + e.estimatedMinutes, 0)

  return {
    estimates,
    totalMinutes,
  }
}

/**
 * 批次預估（使用單一 API 呼叫，更節省成本）
 */
export async function estimateMultipleTasksTimeOptimized(
  args: EstimateMultipleTasksArgs
): Promise<{ estimates: TaskTimeEstimate[]; totalMinutes: number }> {
  const { tasks } = args

  if (tasks.length === 0) {
    return { estimates: [], totalMinutes: 0 }
  }

  // 如果只有 1-2 個任務，直接用個別預估
  if (tasks.length <= 2) {
    return estimateMultipleTasksTime(args)
  }

  try {
    // 組合任務列表
    const taskList = tasks
      .map((t, i) => `${i + 1}. 標題：${t.taskTitle}${t.taskDescription ? `\n   描述：${t.taskDescription}` : ''}`)
      .join('\n\n')

    const batchPrompt = `${ESTIMATE_PROMPT}

請為以下所有任務預估時間，回傳 JSON 陣列：
[
  { "index": 1, "estimatedMinutes": 數字, "taskType": "focus"或"background", "confidence": "high"/"medium"/"low", "reasoning": "理由" },
  ...
]

任務列表：
${taskList}`

    const response = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: '你是任務時間預估專家。請回傳 JSON 陣列格式。' },
        { role: 'user', content: batchPrompt },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 100 * tasks.length, // 每個任務約 100 tokens
      temperature: 0.3,
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('AI 回應為空')
    }

    const parsed = JSON.parse(content)
    const results = Array.isArray(parsed) ? parsed : parsed.estimates || parsed.results || []

    const estimates: TaskTimeEstimate[] = tasks.map((task, i) => {
      const result = results.find((r: { index: number }) => r.index === i + 1) || results[i] || {}
      return {
        taskId: task.taskId,
        taskTitle: task.taskTitle,
        estimatedMinutes: Math.max(5, Math.min(480, result.estimatedMinutes || 60)),
        taskType: result.taskType === 'background' ? 'background' : 'focus',
        confidence: ['high', 'medium', 'low'].includes(result.confidence) ? result.confidence : 'low',
        reasoning: result.reasoning || '批次預估',
      }
    })

    const totalMinutes = estimates.reduce((sum, e) => sum + e.estimatedMinutes, 0)

    return { estimates, totalMinutes }
  } catch (error) {
    console.error('[AI Estimate] 批次預估失敗，回退到個別預估:', error)
    // 回退到個別預估
    return estimateMultipleTasksTime(args)
  }
}
