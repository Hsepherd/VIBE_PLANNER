# Story S-002: API - 取得未排程任務

> **Story ID**: S-002
> **Epic**: EPIC-001 AI 智慧排程 Phase 1
> **估計點數**: 3
> **優先級**: P1
> **依賴**: S-001

---

## User Story

**作為** AI 系統
**我想要** 能夠取得使用者的未排程任務清單
**以便** 可以為這些任務安排時間

---

## 驗收標準 (Acceptance Criteria)

### AC1: 取得未排程任務
```gherkin
Given 使用者已登入
And 有 10 個任務，其中 6 個沒有排程時間
When 呼叫 GET /api/tasks/unscheduled
Then 回傳 6 個未排程任務
And 包含 id, title, description, priority, dueDate, estimated_minutes, task_type
```

### AC2: 依優先級篩選
```gherkin
Given 使用者有多個未排程任務
When 呼叫 GET /api/tasks/unscheduled?priority=high
Then 只回傳優先級為 high 的任務
```

### AC3: 依截止日篩選
```gherkin
Given 使用者有多個未排程任務
When 呼叫 GET /api/tasks/unscheduled?dueBefore=2026-01-25
Then 只回傳截止日在 2026-01-25 之前的任務
```

### AC4: 依專案篩選
```gherkin
Given 使用者有多個未排程任務
When 呼叫 GET /api/tasks/unscheduled?projectId=xxx
Then 只回傳該專案的任務
```

---

## API 規格

### GET /api/tasks/unscheduled

**Request**
```
GET /api/tasks/unscheduled?priority=high&dueBefore=2026-01-25&projectId=xxx
Authorization: Bearer <token>
```

**Response 200**
```json
{
  "success": true,
  "tasks": [
    {
      "id": "uuid",
      "title": "小課程大綱",
      "description": "完成第一版大綱",
      "priority": "high",
      "dueDate": "2026-01-20T00:00:00Z",
      "estimatedMinutes": 90,
      "taskType": "focus",
      "projectId": "uuid",
      "projectName": "小課程製作",
      "status": "todo",
      "createdAt": "2026-01-15T00:00:00Z"
    }
  ],
  "total": 6
}
```

**「未排程」定義**:
- `start_date IS NULL` 或
- `start_date` 為今天之前且 `status != 'done'`

---

## 技術任務

- [ ] 建立 `/api/tasks/unscheduled/route.ts`
- [ ] 實作查詢邏輯（未排程 = 沒有 start_date）
- [ ] 實作 priority 篩選
- [ ] 實作 dueBefore 篩選
- [ ] 實作 projectId 篩選
- [ ] 回傳包含 estimated_minutes 和 task_type
- [ ] 依截止日排序（近的在前）

---

## 測試案例

| # | 測試 | 預期結果 |
|---|------|----------|
| 1 | 未登入呼叫 | 401 Unauthorized |
| 2 | 無未排程任務 | 空陣列 |
| 3 | 有未排程任務 | 正確回傳 |
| 4 | priority=high 篩選 | 只有高優先任務 |
| 5 | 組合篩選 | 正確交集 |

---

## Definition of Done

- [ ] API 端點正常運作
- [ ] 所有篩選條件正確
- [ ] 回傳格式正確
- [ ] 測試案例通過
