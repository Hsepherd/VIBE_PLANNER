# Story S-004: AI - 實作 Function Calling 架構

> **Story ID**: S-004
> **Epic**: EPIC-001 AI 智慧排程 Phase 1
> **估計點數**: 8
> **優先級**: P1
> **依賴**: 無

---

## User Story

**作為** 開發者
**我想要** 建立 AI Function Calling 架構
**以便** AI 可以執行實際動作（查詢任務、排程等）而不只是產生文字

---

## 驗收標準 (Acceptance Criteria)

### AC1: Function 定義架構
```gherkin
Given AI Function Calling 架構
When AI 判斷需要查詢任務
Then AI 能呼叫 getUnscheduledTasks function
And 系統執行該 function 並回傳結果
And AI 根據結果產生回覆
```

### AC2: 多輪 Function 呼叫
```gherkin
Given 使用者說「幫我排今天行程」
When AI 處理請求
Then AI 先呼叫 getUnscheduledTasks
Then AI 再呼叫 getAvailableSlots
Then AI 產生排程建議
```

### AC3: Function 執行權限
```gherkin
Given AI 要呼叫 function
When function 需要使用者資料
Then 只能存取當前登入使用者的資料
```

---

## 技術架構

### Function 定義

```typescript
// lib/ai-functions/definitions.ts
export const AI_FUNCTIONS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'getUnscheduledTasks',
      description: '取得使用者的未排程任務清單',
      parameters: {
        type: 'object',
        properties: {
          priority: {
            type: 'string',
            enum: ['high', 'medium', 'low'],
            description: '篩選優先級'
          },
          dueBefore: {
            type: 'string',
            format: 'date',
            description: '篩選截止日期前的任務'
          },
          projectId: {
            type: 'string',
            description: '篩選特定專案'
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getAvailableSlots',
      description: '取得使用者行事曆的可用時段',
      parameters: {
        type: 'object',
        properties: {
          startDate: {
            type: 'string',
            format: 'date',
            description: '開始日期'
          },
          endDate: {
            type: 'string',
            format: 'date',
            description: '結束日期'
          }
        },
        required: ['startDate', 'endDate']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'createSchedulePreview',
      description: '產生排程預覽',
      parameters: {
        type: 'object',
        properties: {
          schedules: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                taskId: { type: 'string' },
                startTime: { type: 'string', format: 'date-time' },
                endTime: { type: 'string', format: 'date-time' }
              },
              required: ['taskId', 'startTime', 'endTime']
            }
          }
        },
        required: ['schedules']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'estimateTaskTime',
      description: '預估任務所需時間',
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'string' },
          taskTitle: { type: 'string' },
          taskDescription: { type: 'string' }
        }
      }
    }
  }
];
```

### Function 執行器

```typescript
// lib/ai-functions/executor.ts
export async function executeFunctionCall(
  functionName: string,
  args: Record<string, unknown>,
  context: { userId: string }
): Promise<unknown> {
  switch (functionName) {
    case 'getUnscheduledTasks':
      return await getUnscheduledTasks(context.userId, args);
    case 'getAvailableSlots':
      return await getAvailableSlots(context.userId, args);
    case 'createSchedulePreview':
      return await createSchedulePreview(context.userId, args);
    case 'estimateTaskTime':
      return await estimateTaskTime(args);
    default:
      throw new Error(`Unknown function: ${functionName}`);
  }
}
```

### Chat API 整合

```typescript
// app/api/chat/stream/route.ts (修改)

// 1. 加入 tools 參數
const response = await openai.chat.completions.create({
  model: 'gpt-4.1',
  messages: chatMessages,
  tools: AI_FUNCTIONS,
  tool_choice: 'auto',
  stream: true,
});

// 2. 處理 function call
for await (const chunk of response) {
  if (chunk.choices[0]?.delta?.tool_calls) {
    // 收集 function call
    // 執行 function
    // 將結果加入 messages
    // 繼續對話
  }
}
```

---

## 技術任務

- [ ] 建立 `lib/ai-functions/definitions.ts` - Function 定義
- [ ] 建立 `lib/ai-functions/executor.ts` - Function 執行器
- [ ] 建立 `lib/ai-functions/handlers/` - 各 function 實作
- [ ] 修改 `app/api/chat/stream/route.ts` 支援 Function Calling
- [ ] 實作 function call 的 streaming 處理
- [ ] 實作多輪 function call 邏輯
- [ ] 加入 function call 的 token 計算

---

## 流程圖

```
使用者: "幫我排今天行程"
         ↓
AI 判斷需要 function call
         ↓
┌─────────────────────────────────┐
│ 1. getUnscheduledTasks()        │
│    → 回傳 6 個任務              │
├─────────────────────────────────┤
│ 2. getAvailableSlots()          │
│    → 回傳今天可用時段            │
├─────────────────────────────────┤
│ 3. AI 計算排程                   │
├─────────────────────────────────┤
│ 4. createSchedulePreview()      │
│    → 產生預覽資料               │
└─────────────────────────────────┘
         ↓
AI 產生回覆 + 排程預覽 UI
```

---

## 測試案例

| # | 測試 | 預期結果 |
|---|------|----------|
| 1 | 一般對話不觸發 function | 正常文字回覆 |
| 2 | 排程相關對話 | 觸發 function call |
| 3 | Function 執行失敗 | AI 回報錯誤 |
| 4 | 多輪 function call | 正確串接 |
| 5 | Function 權限檢查 | 只能存取自己的資料 |

---

## Definition of Done

- [ ] Function 定義完成
- [ ] Function 執行器完成
- [ ] Chat API 整合完成
- [ ] Streaming 正常運作
- [ ] 測試案例通過
