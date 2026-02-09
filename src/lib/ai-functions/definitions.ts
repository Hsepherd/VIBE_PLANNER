import type { ChatCompletionTool } from 'openai/resources/chat/completions'

/**
 * AI Function Calling 定義
 * 這些 functions 讓 AI 能夠執行實際動作（查詢任務、排程等）
 */
export const AI_FUNCTIONS: ChatCompletionTool[] = [
  // 1. 取得未排程任務
  {
    type: 'function',
    function: {
      name: 'getUnscheduledTasks',
      description: '取得使用者的未排程任務清單。當使用者想要排程、規劃行程、或詢問有哪些任務待處理時使用。',
      parameters: {
        type: 'object',
        properties: {
          priority: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'urgent'],
            description: '篩選特定優先級的任務（可選）',
          },
          dueBefore: {
            type: 'string',
            description: '篩選截止日期在此之前的任務，格式為 YYYY-MM-DD（可選）',
          },
          projectId: {
            type: 'string',
            description: '篩選特定專案的任務（可選）',
          },
        },
        additionalProperties: false,
      },
    },
  },

  // 2. 取得可用時段
  {
    type: 'function',
    function: {
      name: 'getAvailableSlots',
      description: '取得使用者行事曆的可用時段。會讀取 Google Calendar 避開已有行程。',
      parameters: {
        type: 'object',
        properties: {
          startDate: {
            type: 'string',
            description: '開始日期，格式為 YYYY-MM-DD',
          },
          endDate: {
            type: 'string',
            description: '結束日期，格式為 YYYY-MM-DD',
          },
          workStart: {
            type: 'string',
            description: '工作開始時間，格式為 HH:mm，預設 09:00',
          },
          workEnd: {
            type: 'string',
            description: '工作結束時間，格式為 HH:mm，預設 18:00',
          },
        },
        required: ['startDate'],
        additionalProperties: false,
      },
    },
  },

  // 3. 預估任務時間
  {
    type: 'function',
    function: {
      name: 'estimateTaskTime',
      description: '根據任務標題和描述，預估完成任務所需的時間（分鐘）。',
      parameters: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: '任務 ID',
          },
          taskTitle: {
            type: 'string',
            description: '任務標題',
          },
          taskDescription: {
            type: 'string',
            description: '任務描述（可選）',
          },
        },
        required: ['taskId', 'taskTitle'],
        additionalProperties: false,
      },
    },
  },

  // 4. 批次預估多個任務時間
  {
    type: 'function',
    function: {
      name: 'estimateMultipleTasksTime',
      description: '批次預估多個任務的所需時間，用於排程前的準備。',
      parameters: {
        type: 'object',
        properties: {
          tasks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                taskId: { type: 'string' },
                taskTitle: { type: 'string' },
                taskDescription: { type: 'string' },
              },
              required: ['taskId', 'taskTitle'],
            },
            description: '要預估時間的任務陣列',
          },
        },
        required: ['tasks'],
        additionalProperties: false,
      },
    },
  },

  // 5. 產生排程預覽
  {
    type: 'function',
    function: {
      name: 'createSchedulePreview',
      description: '根據任務和可用時段，產生排程預覽。這是排程流程的最後一步。',
      parameters: {
        type: 'object',
        properties: {
          schedules: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                taskId: {
                  type: 'string',
                  description: '任務 ID',
                },
                taskTitle: {
                  type: 'string',
                  description: '任務標題',
                },
                startTime: {
                  type: 'string',
                  description: '開始時間，ISO 格式',
                },
                endTime: {
                  type: 'string',
                  description: '結束時間，ISO 格式',
                },
                estimatedMinutes: {
                  type: 'number',
                  description: '預估時間（分鐘）',
                },
              },
              required: ['taskId', 'taskTitle', 'startTime', 'endTime'],
            },
            description: '排程陣列',
          },
        },
        required: ['schedules'],
        additionalProperties: false,
      },
    },
  },

  // 6. 更新任務的預估時間
  {
    type: 'function',
    function: {
      name: 'updateTaskEstimate',
      description: '更新任務的預估時間和任務類型。',
      parameters: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: '任務 ID',
          },
          estimatedMinutes: {
            type: 'number',
            description: '預估時間（分鐘）',
          },
          taskType: {
            type: 'string',
            enum: ['focus', 'background'],
            description: '任務類型：focus（需專注）或 background（可背景執行）',
          },
        },
        required: ['taskId', 'estimatedMinutes'],
        additionalProperties: false,
      },
    },
  },

  // 7. 智慧排程（一鍵排程所有任務）
  {
    type: 'function',
    function: {
      name: 'generateSmartSchedule',
      description: `智慧排程功能：自動取得未排程任務、分析可用時段、預估時間，並產生最佳排程建議。

支援自然語言日期指定：
- 「排到下週」→ 設定 startDate 為下週一，endDate 為下週日
- 「排到這週」「排到本週」→ 設定為本週一到本週日
- 「排到明天」→ startDate 和 endDate 都設為明天
- 「排未來三天」→ startDate 為今天，endDate 為三天後

請根據使用者的自然語言描述，轉換為正確的 YYYY-MM-DD 格式日期。`,
      parameters: {
        type: 'object',
        properties: {
          startDate: {
            type: 'string',
            description: '排程開始日期，格式為 YYYY-MM-DD。請將自然語言（如「下週」「明天」）轉換為實際日期。預設今天。',
          },
          endDate: {
            type: 'string',
            description: '排程結束日期，格式為 YYYY-MM-DD。請將自然語言（如「下週」）轉換為實際日期。預設 7 天後。',
          },
          workStart: {
            type: 'string',
            description: '工作開始時間，格式為 HH:mm（預設 09:00）',
          },
          workEnd: {
            type: 'string',
            description: '工作結束時間，格式為 HH:mm（預設 18:00）',
          },
          respectDeadlines: {
            type: 'boolean',
            description: '是否優先處理快到期的任務（預設 true）',
          },
          maxTasksPerDay: {
            type: 'number',
            description: '每天最多排幾個任務（預設 8）',
          },
        },
        additionalProperties: false,
      },
    },
  },

  // 8. 從自然語言萃取任務並排程
  {
    type: 'function',
    function: {
      name: 'extractAndScheduleTasks',
      description: '從使用者的自然語言描述中萃取任務並自動排程到具體時間。當使用者說「今天要做...」「我的待辦是...」等列出任務清單時使用。',
      parameters: {
        type: 'object',
        properties: {
          tasks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string', description: '任務標題' },
                estimatedMinutes: { type: 'number', description: '預估時間（分鐘），如使用者未指定則由 AI 估算' },
                priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'], description: '優先級' },
                description: { type: 'string', description: '任務描述（可選）' },
              },
              required: ['title', 'estimatedMinutes'],
            },
            description: '從使用者描述中萃取的任務陣列',
          },
          scheduleDate: { type: 'string', description: '排程日期，YYYY-MM-DD，預設今天' },
          workStart: { type: 'string', description: '工作開始時間 HH:mm，預設 09:00' },
          workEnd: { type: 'string', description: '工作結束時間 HH:mm，預設 18:00' },
        },
        required: ['tasks'],
        additionalProperties: false,
      },
    },
  },

  // 9. 整理會議記錄
  {
    type: 'function',
    function: {
      name: 'organizeMeetingNotes',
      description: '整理散亂的會議記錄成結構化格式。當使用者說「整理會議記錄」、「幫我整理這段會議內容」等請求時使用。',
      parameters: {
        type: 'object',
        properties: {
          rawContent: {
            type: 'string',
            description: '原始會議記錄內容',
          },
          meetingTitle: {
            type: 'string',
            description: '會議標題（可選，AI 可自動推測）',
          },
        },
        required: ['rawContent'],
        additionalProperties: false,
      },
    },
  },
]

// Function 名稱類型
export type AIFunctionName =
  | 'getUnscheduledTasks'
  | 'getAvailableSlots'
  | 'estimateTaskTime'
  | 'estimateMultipleTasksTime'
  | 'createSchedulePreview'
  | 'updateTaskEstimate'
  | 'generateSmartSchedule'
  | 'extractAndScheduleTasks'
  | 'organizeMeetingNotes'

// 檢查是否為會議記錄相關對話
export function isMeetingNotesRelated(message: string): boolean {
  const meetingKeywords = [
    // 直接請求
    '整理會議', '會議記錄', '會議紀錄', '會議整理',
    '整理這段', '整理筆記', '整理逐字稿',
    '逐字稿', '開會紀錄', '開會內容',
    'meeting notes', 'meeting transcript',
    // 會議內容特徵（長文本常見詞）
    '討論', '決議', '待辦', '行動項目',
    '與會', '出席', '會議時間', '會議地點',
  ]

  const lowerMessage = message.toLowerCase()

  // 檢查關鍵詞
  const hasKeyword = meetingKeywords.some(keyword => lowerMessage.includes(keyword))

  // 檢查是否為長文本（可能是會議逐字稿）
  const isLongText = message.length > 500

  return hasKeyword || isLongText
}

// 檢查是否為排程相關對話
export function isSchedulingRelated(message: string): boolean {
  const schedulingKeywords = [
    // 排程相關
    '排程', '排行程', '排今天', '排這週', '排下週', '排本週',
    '安排', '規劃', '計畫', '計劃',
    '時間表', '行事曆', '日程',
    '什麼時候做', '什麼時間',
    '幫我排', '幫我安排',
    '空檔', '可用時間',
    '預估時間', '要多久',
    'schedule', 'plan', 'calendar',

    // 自然語言日期表達（S-011）
    '排到今天', '排到明天', '排到後天',
    '排到這週', '排到下週', '排到本週', '排到下周',
    '排到週末', '排到下週末',
    '排到這個月', '排到下個月',
    '排未來', '排接下來',
    '今天的任務', '明天的任務', '這週的任務', '下週的任務',
    '任務排到', '工作排到',

    // 列出待辦事項的自然語言表達
    '今天要做', '今天的待辦', '我今天要', '我要做',
    '今天的事', '今天要處理', '待辦清單',
    '幫我安排今天', '今天的工作',
    '接下來要做', '等等要做', '要完成的事',
    '今天計畫', '今天規劃',
  ]

  const lowerMessage = message.toLowerCase()
  return schedulingKeywords.some(keyword => lowerMessage.includes(keyword))
}
