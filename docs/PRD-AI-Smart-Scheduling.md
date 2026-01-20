# AI 智慧排程功能 - 產品需求文件 (PRD)

> **版本**：1.0
> **日期**：2026-01-19
> **狀態**：草稿
> **類型**：棕地專案 (Brownfield) - 新功能

---

## 1. 概述

### 1.1 功能名稱
**AI 智慧排程 (AI Smart Scheduling)**

### 1.2 功能摘要
讓 AI 助理能夠查詢使用者的任務列表，自動預估每項任務所需時間，並根據優先級、截止日、工作時段等因素，智慧地將任務排入行事曆。

### 1.3 問題陳述
| 痛點 | 影響 |
|------|------|
| 任務太多，難以預估時間 | 時間預估不準確 |
| 舊任務執行中又有新任務進來 | 行程衝突 |
| 缺乏整體規劃視角 | 無法在預期時間內交件 |
| 手動排程耗時且易出錯 | 降低工作效率 |

### 1.4 目標
1. **減少行程衝突** - AI 自動考慮現有行程與任務
2. **提升時間預估準確度** - AI 學習歷史數據來預估
3. **節省排程時間** - 一句話完成整天/整週排程
4. **提高交付率** - 確保任務在截止日前有足夠時間

---

## 2. 使用者故事

### 2.1 主要使用情境

#### 情境 A：每日排程
```
使用者：「幫我排今天的行程」

AI：根據你的 8 個待辦任務和今天的行事曆，我建議這樣安排：

📅 今日排程建議
┌─────────────────────────────────────┐
│ 09:00-10:30  小課程大綱 (1.5hr)      │ 🔴 高優先
│ 10:30-11:00  休息                    │
│ 11:00-12:00  審核老師影片 (1hr)      │ 🟡 中優先
│ 14:00-15:30  準備週會簡報 (1.5hr)    │ 🔴 明天截止
│ 15:30-16:00  回覆客戶郵件 (0.5hr)    │ 🟢 快速任務
│ 16:00-17:00  測試新功能 (1hr)        │ ⏳ 可背景執行
└─────────────────────────────────────┘

[預覽調整] [確認排程] [重新排程]
```

#### 情境 B：新任務建議時間
```
使用者：「新增任務：準備 Q1 報告，下週五前要交」

AI：已新增任務！根據任務內容，我預估需要約 3 小時。
建議安排在週三下午 14:00-17:00（你的專注時段）。
要直接排進行事曆嗎？

[排入建議時段] [選擇其他時間] [稍後再排]
```

#### 情境 C：整週排程
```
使用者：「幫我把這週的任務都排好」

AI：好的，讓我分析你這週的 15 個任務...

📅 本週排程建議
[顯示週視圖預覽]

⚠️ 注意：週四有 3 個任務截止但時間不足，建議：
1. 將「審核影片」提前到週二
2. 「測試功能」可以和「部署」並行

[預覽調整] [確認排程] [重新排程]
```

---

## 3. 功能規格

### 3.1 Phase 1 - MVP (核心功能)

#### 3.1.1 AI 預估任務時間
| 項目 | 規格 |
|------|------|
| 觸發時機 | 任務沒有設定預估時間時 |
| 預估依據 | 任務標題、描述、類型、專案 |
| 輸出 | `estimated_minutes` 欄位 (整數，單位：分鐘) |
| 預設值 | 60 分鐘（若無法判斷）|
| 顯示格式 | 「約 1.5 小時」「約 30 分鐘」|

**資料庫變更**：
```sql
ALTER TABLE tasks ADD COLUMN estimated_minutes INTEGER DEFAULT 60;
ALTER TABLE tasks ADD COLUMN task_type VARCHAR(20) DEFAULT 'focus';
-- 'focus' = 需專注, 'background' = 可背景執行
```

#### 3.1.2 對話中請求排程
| 項目 | 規格 |
|------|------|
| 觸發關鍵字 | 「排程」「排今天」「排這週」「幫我安排」「schedule」|
| 範圍選項 | 今天 / 明天 / 本週 / 指定日期範圍 |
| AI 能力 | Function Calling - `getUnscheduledTasks()`, `scheduleTask()` |

**AI Function 定義**：
```typescript
// 取得未排程任務
function getUnscheduledTasks(options?: {
  projectId?: string;
  priority?: 'high' | 'medium' | 'low';
  dueBefore?: Date;
}): Task[]

// 排程任務到行事曆
function scheduleTask(taskId: string, schedule: {
  startTime: Date;
  endTime: Date;
  isPreview?: boolean; // true = 只預覽不實際排程
}): ScheduleResult

// 批次排程
function batchScheduleTasks(schedules: Array<{
  taskId: string;
  startTime: Date;
  endTime: Date;
}>): BatchScheduleResult
```

#### 3.1.3 排程預覽 + 手動調整 + 確認

**UI 元件**：新增「排程預覽面板」

```
┌─────────────────────────────────────────────────┐
│ 📅 排程預覽                           [重新排程] │
├─────────────────────────────────────────────────┤
│                                                 │
│  09:00 ┬─────────────────────┐                 │
│        │ 小課程大綱           │ 🔴 [調整] [移除]│
│  10:30 ┴─────────────────────┘                 │
│                                                 │
│  11:00 ┬─────────────────────┐                 │
│        │ 審核老師影片         │ 🟡 [調整] [移除]│
│  12:00 ┴─────────────────────┘                 │
│                                                 │
│  ... (可拖拉調整時間)                            │
│                                                 │
├─────────────────────────────────────────────────┤
│           [取消]  [確認排程到行事曆]              │
└─────────────────────────────────────────────────┘
```

**互動規格**：
- 支援拖拉調整時間
- 點擊「調整」可修改開始/結束時間
- 點擊「移除」將該任務從本次排程中移除（不刪除任務）
- 「重新排程」重新讓 AI 計算
- 「確認排程」將所有任務寫入行事曆

#### 3.1.4 排程演算法考量因素

| 優先級 | 因素 | 說明 |
|--------|------|------|
| 1 | 截止日 | 截止日近的優先排 |
| 2 | 任務優先級 | high > medium > low |
| 3 | Google Calendar 衝突 | 避開已有行程 |
| 4 | 工作時段 | 預設 09:00-18:00 |
| 5 | 任務類型 | 專注型排早上，背景型可並行 |

**排程邏輯虛擬碼**：
```
1. 取得所有未排程任務
2. 取得指定日期範圍的 Google Calendar 行程
3. 計算可用時段 (工作時段 - 已有行程)
4. 依優先級排序任務
5. 為每個任務找到最適合的時段：
   - 截止日前必須完成
   - 高優先任務排入黃金時段 (09:00-12:00)
   - 背景任務可與其他任務重疊
6. 若時間不足，提出警告
7. 產生預覽結果
```

---

### 3.2 Phase 2 - 進階功能

#### 3.2.1 一鍵重新排程
- 當任務狀態改變時，可重新計算整體排程
- 保留使用者手動調整過的任務

#### 3.2.2 AI 學習實際花費時間
**資料庫變更**：
```sql
ALTER TABLE tasks ADD COLUMN actual_minutes INTEGER;
ALTER TABLE tasks ADD COLUMN started_at TIMESTAMP;
ALTER TABLE tasks ADD COLUMN completed_at TIMESTAMP;
```

**學習機制**：
- 收集 `estimated_minutes` vs `actual_minutes` 差異
- 依任務類型/專案/使用者建立預估模型
- 漸進式調整未來預估

#### 3.2.3 AI 自動判斷任務依賴
- 從任務描述分析關鍵字（「等...完成後」「需要先...」）
- 建議依賴關係，使用者確認
- 排程時自動考慮順序

#### 3.2.4 AI 學習精力曲線
**資料收集**：
- 記錄使用者完成高優先任務的時段
- 分析任務完成率 vs 時段的關係
- 建立個人化精力模型

**資料庫變更**：
```sql
CREATE TABLE user_productivity_patterns (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  hour_of_day INTEGER, -- 0-23
  day_of_week INTEGER, -- 0-6
  task_completion_rate DECIMAL,
  avg_focus_score DECIMAL,
  sample_count INTEGER,
  updated_at TIMESTAMP
);
```

#### 3.2.5 任務計時功能
- 任務卡片新增「開始」按鈕
- 計時中顯示經過時間
- 完成時自動記錄 `actual_minutes`
- 支援暫停/繼續

---

### 3.3 Phase 3 - 高階功能

#### 3.3.1 並行任務 / 等待時間處理

**任務類型擴充**：
```typescript
type TaskType =
  | 'focus'      // 需要專注，不可並行
  | 'background' // 可背景執行，可與其他任務並行
  | 'waiting'    // 等待型（如：部署中、等回覆）
```

**排程邏輯**：
- `background` 任務可以和 `focus` 任務重疊
- `waiting` 任務只佔用少量「檢查時間」
- AI 自動從描述判斷任務類型

---

## 4. 技術規格

### 4.1 AI Function Calling 架構

**目前狀態**：AI 只能產生文字回覆，無法執行動作

**需要實作**：
```typescript
// lib/ai-functions.ts
const AI_FUNCTIONS = [
  {
    name: 'getUnscheduledTasks',
    description: '取得使用者的未排程任務',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '篩選特定專案' },
        priority: { type: 'string', enum: ['high', 'medium', 'low'] },
        dueBefore: { type: 'string', format: 'date-time' }
      }
    }
  },
  {
    name: 'scheduleTask',
    description: '將任務排入行事曆',
    parameters: {
      type: 'object',
      properties: {
        taskId: { type: 'string', required: true },
        startTime: { type: 'string', format: 'date-time', required: true },
        endTime: { type: 'string', format: 'date-time', required: true }
      }
    }
  },
  {
    name: 'getGoogleCalendarEvents',
    description: '取得 Google Calendar 行程',
    parameters: {
      type: 'object',
      properties: {
        startDate: { type: 'string', format: 'date', required: true },
        endDate: { type: 'string', format: 'date', required: true }
      }
    }
  }
];
```

### 4.2 資料庫變更總覽

**Phase 1**：
```sql
-- 任務表新增欄位
ALTER TABLE tasks ADD COLUMN estimated_minutes INTEGER DEFAULT 60;
ALTER TABLE tasks ADD COLUMN task_type VARCHAR(20) DEFAULT 'focus';
```

**Phase 2**：
```sql
-- 任務表新增欄位
ALTER TABLE tasks ADD COLUMN actual_minutes INTEGER;
ALTER TABLE tasks ADD COLUMN started_at TIMESTAMP;
ALTER TABLE tasks ADD COLUMN completed_at TIMESTAMP;

-- 精力曲線表
CREATE TABLE user_productivity_patterns (...);
```

### 4.3 API 端點

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/tasks/unscheduled` | 取得未排程任務 |
| POST | `/api/schedule/preview` | 產生排程預覽 |
| POST | `/api/schedule/confirm` | 確認排程 |
| GET | `/api/calendar/available-slots` | 取得可用時段 |

---

## 5. UI/UX 規格

### 5.1 新增 UI 元件

| 元件 | 位置 | 說明 |
|------|------|------|
| 排程預覽面板 | 對話視窗右側 / Modal | 顯示 AI 建議的排程 |
| 時間選擇器 | 任務編輯 | 設定預估時間 |
| 任務類型選擇 | 任務編輯 | 專注 / 背景 |
| 計時器 | 任務卡片 | Phase 2 |

### 5.2 對話 UI 增強

AI 回覆中可嵌入互動元件：
```
AI: 我已經幫你排好今天的行程，請確認：

[互動式排程預覽卡片]

[確認排程] [調整] [重新排程]
```

---

## 6. 驗收標準

### 6.1 Phase 1 MVP

| # | 標準 | 驗證方式 |
|---|------|----------|
| 1 | 使用者可在對話中說「幫我排今天行程」觸發排程 | 功能測試 |
| 2 | AI 能正確取得未排程任務列表 | API 測試 |
| 3 | AI 能預估任務所需時間（誤差 < 50%） | 人工驗證 |
| 4 | 排程結果避開 Google Calendar 已有行程 | 整合測試 |
| 5 | 使用者可預覽、調整、確認排程 | UI 測試 |
| 6 | 確認後任務正確寫入行事曆 | 整合測試 |
| 7 | 排程處理時間 < 10 秒 | 效能測試 |

---

## 7. 風險與緩解

| 風險 | 影響 | 緩解措施 |
|------|------|----------|
| AI 時間預估不準確 | 使用者信任度下降 | 顯示「預估」標籤，允許手動修改 |
| Google Calendar API 限制 | 同步失敗 | 實作 retry 機制，快取行程 |
| 排程演算法複雜度高 | 開發時間過長 | MVP 使用簡單貪婪演算法 |
| 使用者不習慣 AI 排程 | 採用率低 | 提供手動模式，漸進式引導 |

---

## 8. 里程碑

### Phase 1 - MVP
- [ ] 資料庫 migration (estimated_minutes, task_type)
- [ ] AI Function Calling 架構
- [ ] 排程演算法 v1
- [ ] 排程預覽 UI
- [ ] Google Calendar 整合（讀取行程）
- [ ] 對話觸發排程

### Phase 2 - 學習能力
- [ ] 任務計時功能
- [ ] 實際時間記錄
- [ ] AI 學習預估模型
- [ ] 精力曲線學習
- [ ] 一鍵重新排程

### Phase 3 - 進階
- [ ] 任務依賴自動判斷
- [ ] 並行任務處理
- [ ] 跨週排程優化

---

## 9. 附錄

### 9.1 參考對話範例

**範例 1：快速排程**
```
User: 排一下今天
AI: [執行 getUnscheduledTasks + getGoogleCalendarEvents]
AI: 你今天有 5 個待辦任務，我已經避開你 10:00 的會議，建議這樣安排...
```

**範例 2：指定任務排程**
```
User: 把「準備簡報」排到明天下午
AI: [執行 scheduleTask]
AI: 好的！「準備簡報」已排到明天 14:00-16:00（預估 2 小時）。
```

**範例 3：時間不足警告**
```
User: 幫我排這週的任務
AI: ⚠️ 注意：你這週有 12 個任務共需約 25 小時，但可用時間只有 20 小時。
建議：
1. 將「審核影片」延到下週
2. 「測試功能」可以縮短為快速驗證
要我按這個調整排程嗎？
```

---

*文件結束*
