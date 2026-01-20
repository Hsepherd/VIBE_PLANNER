# Story S-005: AI - 預估任務時間功能

> **Story ID**: S-005
> **Epic**: EPIC-001 AI 智慧排程 Phase 1
> **估計點數**: 5
> **優先級**: P1
> **依賴**: S-004

---

## User Story

**作為** 使用者
**我想要** AI 自動預估每個任務所需的時間
**以便** 不需要手動輸入預估時間，讓排程更準確

---

## 驗收標準 (Acceptance Criteria)

### AC1: 基於任務內容預估
```gherkin
Given 任務標題為「準備週會簡報」
And 任務描述為「整理本週進度，製作 10 頁簡報」
When AI 預估時間
Then 回傳預估時間（例如：90 分鐘）
And 回傳信心度（high/medium/low）
And 回傳預估理由
```

### AC2: 考慮任務類型
```gherkin
Given 任務標題為「部署到測試環境」
When AI 預估時間
Then 辨識為「背景執行」類型
And 預估主動時間（5 分鐘）
And 預估總時間（30 分鐘）
```

### AC3: 新增任務時自動預估
```gherkin
Given 使用者新增任務但沒有設定預估時間
When 任務儲存時
Then 自動呼叫 AI 預估
And 將預估時間存入 estimated_minutes
```

### AC4: 批次預估
```gherkin
Given 有 10 個任務沒有預估時間
When 使用者請求排程
Then AI 一次預估所有任務的時間
And 預估時間 < 5 秒
```

---

## 預估邏輯

### Prompt 設計

```typescript
const ESTIMATE_PROMPT = `
你是一個任務時間預估專家。根據任務的標題和描述，預估完成所需的時間。

考慮因素：
1. 任務複雜度
2. 是否需要協作
3. 是否涉及創意工作（需要更多時間）
4. 是否為例行任務（較快完成）

回傳格式（JSON）：
{
  "estimatedMinutes": 90,
  "taskType": "focus", // "focus" 或 "background"
  "confidence": "medium", // "high", "medium", "low"
  "reasoning": "簡報製作通常需要 1-2 小時，10 頁內容適中"
}

常見任務時間參考：
- 回覆郵件: 15-30 分鐘
- 簡短會議: 30 分鐘
- 一般會議: 60 分鐘
- 程式碼審查: 30-60 分鐘
- 撰寫文件: 60-120 分鐘
- 簡報製作: 60-180 分鐘
- 部署/測試: 30-60 分鐘（背景）

如果無法判斷，預設 60 分鐘，confidence 為 low。
`;
```

### Function 實作

```typescript
// lib/ai-functions/handlers/estimateTaskTime.ts

interface EstimateResult {
  estimatedMinutes: number;
  taskType: 'focus' | 'background';
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}

export async function estimateTaskTime(params: {
  taskId?: string;
  taskTitle: string;
  taskDescription?: string;
}): Promise<EstimateResult> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4.1-mini', // 使用較快的模型
    messages: [
      { role: 'system', content: ESTIMATE_PROMPT },
      {
        role: 'user',
        content: `任務標題：${params.taskTitle}\n任務描述：${params.taskDescription || '無'}`
      }
    ],
    response_format: { type: 'json_object' },
    max_tokens: 200,
  });

  return JSON.parse(response.choices[0].message.content);
}

// 批次預估
export async function batchEstimateTaskTime(
  tasks: Array<{ id: string; title: string; description?: string }>
): Promise<Map<string, EstimateResult>> {
  // 並行處理，但限制同時請求數
  const results = await Promise.all(
    tasks.map(task => estimateTaskTime({
      taskId: task.id,
      taskTitle: task.title,
      taskDescription: task.description,
    }))
  );

  return new Map(tasks.map((task, i) => [task.id, results[i]]));
}
```

---

## 技術任務

- [ ] 建立 `lib/ai-functions/handlers/estimateTaskTime.ts`
- [ ] 設計預估 prompt
- [ ] 實作單一任務預估
- [ ] 實作批次預估（並行 + 限流）
- [ ] 整合到任務新增流程（可選）
- [ ] 整合到排程流程（必須）
- [ ] 快取預估結果（避免重複呼叫）

---

## API 使用優化

為了節省 API 成本：
- 使用 `gpt-4.1-mini` 模型進行預估
- 快取已預估的任務
- 批次預估時並行處理

---

## 測試案例

| # | 任務 | 預期預估 | 類型 |
|---|------|----------|------|
| 1 | 回覆客戶郵件 | 15-30 分鐘 | focus |
| 2 | 準備週會簡報 10 頁 | 60-120 分鐘 | focus |
| 3 | 部署到測試環境 | 30-60 分鐘 | background |
| 4 | 審核 PR | 30-60 分鐘 | focus |
| 5 | 等待 CI 跑完 | 20-30 分鐘 | background |
| 6 | （空白描述） | 60 分鐘 | focus |

---

## Definition of Done

- [ ] 單一任務預估正常
- [ ] 批次預估正常
- [ ] 辨識 focus/background 類型
- [ ] 回傳信心度和理由
- [ ] 處理時間 < 2 秒（單一）/ < 5 秒（批次 10 個）
- [ ] 測試案例通過
