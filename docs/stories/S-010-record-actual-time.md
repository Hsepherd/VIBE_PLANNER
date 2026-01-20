# Story S-010: 記錄實際花費時間

> **Story ID**: S-010
> **Epic**: EPIC-002 AI 智慧排程 Phase 2
> **估計點數**: 3
> **優先級**: P2
> **依賴**: S-009

---

## User Story

**作為** 系統
**我想要** 記錄每個任務的實際花費時間
**以便** AI 可以學習並優化未來的時間預估

---

## 驗收標準 (Acceptance Criteria)

### AC1: 自動記錄
```gherkin
Given 使用者使用計時器完成任務
When 任務標記為完成
Then 自動計算並記錄 actual_minutes
And 記錄 started_at 和 completed_at
```

### AC2: 手動記錄
```gherkin
Given 使用者沒有使用計時器
When 任務標記為完成
Then 顯示彈窗詢問「這個任務花了多久？」
And 提供快速選項：15分/30分/1小時/2小時/自訂
And 記錄使用者輸入的時間
```

### AC3: 時間差異分析
```gherkin
Given 任務有 estimated_minutes 和 actual_minutes
When 顯示任務詳情
Then 顯示預估 vs 實際的差異
And 顯示差異百分比
And 如果差異 > 50%，顯示提示
```

### AC4: 歷史時間查詢
```gherkin
Given 使用者想查看時間紀錄
When 進入任務詳情頁面
Then 顯示所有 time_entries
And 顯示總花費時間
And 顯示每次工作的時間分布
```

---

## UI 設計

### 完成任務時的時間輸入

```
┌─────────────────────────────────────┐
│ ✅ 任務完成！                        │
│                                     │
│ 這個任務花了多久？                   │
│                                     │
│ [15分] [30分] [1小時] [2小時] [自訂] │
│                                     │
│ 💡 你的預估是 1.5 小時               │
│                                     │
│              [跳過]  [確認]          │
└─────────────────────────────────────┘
```

### 任務詳情 - 時間紀錄

```
┌─────────────────────────────────────┐
│ ⏱️ 時間紀錄                          │
├─────────────────────────────────────┤
│                                     │
│ 預估時間: 1.5 小時                   │
│ 實際時間: 2 小時 15 分               │
│ 差異: +50% ⚠️                        │
│                                     │
│ 📊 工作紀錄                          │
│ ├─ 01/19 09:00-09:45 (45分)         │
│ ├─ 01/19 10:30-11:30 (60分)         │
│ └─ 01/19 14:00-14:30 (30分)         │
│                                     │
│ 總計: 2 小時 15 分                   │
└─────────────────────────────────────┘
```

---

## 資料庫變更

```sql
-- 確保欄位存在（S-009 可能已建立）
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS actual_minutes INTEGER;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS started_at TIMESTAMP;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS time_entries JSONB DEFAULT '[]';

-- 建立索引
CREATE INDEX idx_tasks_actual_minutes ON tasks(actual_minutes);
CREATE INDEX idx_tasks_completed_at ON tasks(completed_at);
```

---

## 技術任務

- [ ] 完成任務時彈出時間輸入對話框
- [ ] 實作快速時間選項
- [ ] 實作自訂時間輸入
- [ ] 計算並儲存 actual_minutes
- [ ] 顯示預估 vs 實際差異
- [ ] 任務詳情頁時間紀錄區塊
- [ ] API: 更新實際時間

---

## API 端點

| 方法 | 路徑 | 說明 |
|------|------|------|
| PATCH | `/api/tasks/:id/actual-time` | 記錄實際時間 |
| GET | `/api/tasks/:id/time-entries` | 取得時間紀錄 |

---

## 資料收集（為 S-011 做準備）

記錄以下資料供 AI 學習：

```typescript
interface TaskTimeData {
  taskId: string;
  title: string;
  description?: string;
  projectId?: string;
  taskType: 'focus' | 'background';
  priority: 'high' | 'medium' | 'low';
  estimatedMinutes: number;
  actualMinutes: number;
  accuracy: number; // actual / estimated
  completedAt: Date;
  dayOfWeek: number;
  hourOfDay: number;
}
```

---

## 測試案例

| # | 測試 | 預期結果 |
|---|------|----------|
| 1 | 計時器完成 | 自動記錄時間 |
| 2 | 無計時器完成 | 彈出輸入對話框 |
| 3 | 快速選項輸入 | 正確記錄 |
| 4 | 自訂時間輸入 | 正確記錄 |
| 5 | 跳過輸入 | 不記錄，但任務完成 |
| 6 | 查看時間紀錄 | 正確顯示 |

---

## Definition of Done

- [ ] 自動/手動記錄時間功能
- [ ] 完成時輸入對話框
- [ ] 時間差異顯示
- [ ] 時間紀錄查詢
- [ ] 資料正確儲存
- [ ] 測試案例通過
