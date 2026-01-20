# Story S-003: API - 取得 Google Calendar 可用時段

> **Story ID**: S-003
> **Epic**: EPIC-001 AI 智慧排程 Phase 1
> **估計點數**: 5
> **優先級**: P1
> **依賴**: 無

---

## User Story

**作為** AI 系統
**我想要** 能夠取得使用者 Google Calendar 的可用時段
**以便** 排程時避開已有行程

---

## 驗收標準 (Acceptance Criteria)

### AC1: 取得已有行程
```gherkin
Given 使用者已連接 Google Calendar
And 今天有 2 個行程：10:00-11:00, 14:00-15:00
When 呼叫 GET /api/calendar/events?date=2026-01-19
Then 回傳這 2 個行程的時間區間
```

### AC2: 計算可用時段
```gherkin
Given 工作時段為 09:00-18:00
And 今天有行程 10:00-11:00, 14:00-15:00
When 呼叫 GET /api/calendar/available-slots?date=2026-01-19
Then 回傳可用時段: [09:00-10:00, 11:00-14:00, 15:00-18:00]
```

### AC3: 多日查詢
```gherkin
Given 使用者已連接 Google Calendar
When 呼叫 GET /api/calendar/available-slots?startDate=2026-01-19&endDate=2026-01-25
Then 回傳這 7 天每天的可用時段
```

### AC4: 未連接 Google Calendar
```gherkin
Given 使用者未連接 Google Calendar
When 呼叫 GET /api/calendar/available-slots
Then 回傳全工作時段（假設無衝突）
And 回傳 warning: "Google Calendar 未連接，無法檢測衝突"
```

---

## API 規格

### GET /api/calendar/available-slots

**Request**
```
GET /api/calendar/available-slots?startDate=2026-01-19&endDate=2026-01-25&workStart=09:00&workEnd=18:00
Authorization: Bearer <token>
```

**Response 200**
```json
{
  "success": true,
  "googleConnected": true,
  "workingHours": {
    "start": "09:00",
    "end": "18:00"
  },
  "slots": {
    "2026-01-19": [
      { "start": "09:00", "end": "10:00", "minutes": 60 },
      { "start": "11:00", "end": "14:00", "minutes": 180 },
      { "start": "15:00", "end": "18:00", "minutes": 180 }
    ],
    "2026-01-20": [
      { "start": "09:00", "end": "18:00", "minutes": 540 }
    ]
  },
  "busyEvents": {
    "2026-01-19": [
      { "start": "10:00", "end": "11:00", "title": "團隊會議" },
      { "start": "14:00", "end": "15:00", "title": "客戶通話" }
    ]
  }
}
```

---

## 技術任務

- [ ] 建立 `/api/calendar/available-slots/route.ts`
- [ ] 整合 Google Calendar API 讀取行程
- [ ] 處理 token 過期和刷新
- [ ] 實作可用時段計算邏輯
- [ ] 支援自訂工作時段 (預設 09:00-18:00)
- [ ] 支援多日查詢
- [ ] 處理未連接 Google Calendar 情況

---

## 計算邏輯

```typescript
function calculateAvailableSlots(
  workStart: string,  // "09:00"
  workEnd: string,    // "18:00"
  busyEvents: Array<{ start: Date; end: Date }>
): Array<{ start: string; end: string; minutes: number }> {
  // 1. 將 busyEvents 按開始時間排序
  // 2. 合併重疊的 busy 區間
  // 3. 計算 busy 區間之間的空檔
  // 4. 回傳可用時段
}
```

---

## 測試案例

| # | 測試 | 預期結果 |
|---|------|----------|
| 1 | 無行程的一天 | 回傳整個工作時段 |
| 2 | 有多個行程 | 正確計算空檔 |
| 3 | 行程重疊 | 正確合併 |
| 4 | 行程跨越工作時段 | 只計算工作時段內 |
| 5 | Google 未連接 | 回傳全時段 + warning |
| 6 | Token 過期 | 自動刷新後重試 |

---

## Definition of Done

- [ ] API 端點正常運作
- [ ] 正確讀取 Google Calendar 行程
- [ ] 正確計算可用時段
- [ ] 處理邊界情況
- [ ] 測試案例通過
