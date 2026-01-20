# Story S-012: AI 學習精力曲線

> **Story ID**: S-012
> **Epic**: EPIC-002 AI 智慧排程 Phase 2
> **估計點數**: 8
> **優先級**: P2
> **依賴**: S-010

---

## User Story

**作為** 使用者
**我想要** AI 學習我一天中的精力分布
**以便** 排程時把高難度任務排在我精力最好的時段

---

## 驗收標準 (Acceptance Criteria)

### AC1: 收集精力數據
```gherkin
Given 使用者完成一個高優先任務
When 系統記錄完成時間
Then 記錄完成的時段（小時）
And 記錄任務優先級和類型
And 記錄完成效率（預估 vs 實際）
```

### AC2: 分析精力曲線
```gherkin
Given 使用者有 30+ 個完成任務的歷史
When 系統分析數據
Then 識別出高效時段（例如 09:00-12:00）
And 識別出低效時段（例如 14:00-15:00）
And 產生個人化精力曲線
```

### AC3: 排程時應用精力曲線
```gherkin
Given 使用者的精力曲線顯示早上效率高
When AI 排程高優先任務
Then 優先排在 09:00-12:00
And 低優先/簡單任務排在下午
```

### AC4: 顯示精力曲線
```gherkin
Given 使用者想了解自己的精力分布
When 進入設定頁面
Then 顯示精力曲線圖表
And 顯示每個時段的效率評分
And 可以手動調整
```

### AC5: 週間差異
```gherkin
Given 使用者週一和週五的精力不同
When 系統學習時
Then 分別記錄每天的精力曲線
And 排程時考慮星期幾
```

---

## 精力曲線模型

### 數據收集

```typescript
interface ProductivitySample {
  userId: string;
  taskId: string;
  completedAt: Date;
  hourOfDay: number;     // 0-23
  dayOfWeek: number;     // 0-6 (日-六)
  priority: 'high' | 'medium' | 'low';
  taskType: 'focus' | 'background';
  efficiency: number;    // actualMinutes / estimatedMinutes
}
```

### 精力曲線

```typescript
interface EnergyPattern {
  userId: string;

  // 每小時效率 (0-23)
  hourlyEfficiency: number[];  // 例如 [0.6, 0.6, ..., 1.2, 1.1, 0.9, ...]

  // 每天效率 (0-6)
  dailyEfficiency: number[];   // 例如 [0.8, 1.0, 1.0, 1.0, 1.0, 0.9, 0.7]

  // 最佳時段
  peakHours: {
    start: number;  // 9
    end: number;    // 12
    avgEfficiency: number;
  };

  // 低效時段
  lowHours: {
    start: number;  // 14
    end: number;    // 15
    avgEfficiency: number;
  };

  // 統計
  sampleCount: number;
  lastUpdatedAt: Date;
}
```

---

## UI 設計

### 設定頁面 - 精力曲線

```
┌─────────────────────────────────────────────────────────┐
│ ⚡ 你的精力曲線                                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  效率                                                   │
│  ↑                                                      │
│  │     ████                                             │
│  │   ████████                                           │
│  │ ████████████        ████                             │
│  │ ██████████████    ████████                           │
│  │ ████████████████████████████                         │
│  └──────────────────────────────────────────────→ 時間  │
│    06 07 08 09 10 11 12 13 14 15 16 17 18 19 20        │
│                                                         │
│  🌟 黃金時段: 09:00 - 12:00 (效率 +20%)                 │
│  😴 低效時段: 14:00 - 15:00 (效率 -15%)                 │
│                                                         │
│  📊 基於 47 個已完成任務分析                             │
│                                                         │
│  [手動調整] [重新分析]                                   │
└─────────────────────────────────────────────────────────┘
```

### 手動調整

```
┌─────────────────────────────────────────────────────────┐
│ 調整精力曲線                                             │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 早上 (06:00-12:00)                                      │
│ [😴 低] [😐 一般] [🔥 高] [⚡ 最高]                      │
│                     ────●                               │
│                                                         │
│ 下午 (12:00-18:00)                                      │
│ [😴 低] [😐 一般] [🔥 高] [⚡ 最高]                      │
│            ●────                                        │
│                                                         │
│ 晚上 (18:00-22:00)                                      │
│ [😴 低] [😐 一般] [🔥 高] [⚡ 最高]                      │
│   ●────                                                 │
│                                                         │
│              [取消]  [儲存]                              │
└─────────────────────────────────────────────────────────┘
```

---

## 資料庫設計

```sql
-- 精力模式表
CREATE TABLE user_productivity_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,

  -- 每小時效率 (JSON array of 24 numbers)
  hourly_efficiency JSONB DEFAULT '[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]',

  -- 每天效率 (JSON array of 7 numbers, 日-六)
  daily_efficiency JSONB DEFAULT '[1,1,1,1,1,1,1]',

  -- 最佳時段
  peak_hour_start INTEGER DEFAULT 9,
  peak_hour_end INTEGER DEFAULT 12,
  peak_efficiency DECIMAL DEFAULT 1.2,

  -- 低效時段
  low_hour_start INTEGER DEFAULT 14,
  low_hour_end INTEGER DEFAULT 15,
  low_efficiency DECIMAL DEFAULT 0.8,

  -- 是否手動設定
  is_manual_override BOOLEAN DEFAULT false,

  -- 統計
  sample_count INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(user_id)
);

-- 索引
CREATE INDEX idx_productivity_patterns_user_id ON user_productivity_patterns(user_id);

-- RLS
ALTER TABLE user_productivity_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own patterns"
  ON user_productivity_patterns FOR ALL
  USING (auth.uid() = user_id);
```

---

## 整合排程演算法

```typescript
// 修改 S-006 的排程演算法
function scheduleTasksV2(input: ScheduleInput): ScheduleOutput {
  // ... 原有邏輯 ...

  // 取得使用者精力曲線
  const energyPattern = await getUserEnergyPattern(userId);

  // 修改時段評分邏輯
  function scoreSlot(slot: Slot, task: Task): number {
    let score = 0;

    // 基礎分：時段長度是否足夠
    if (slot.minutes >= task.estimatedMinutes) {
      score += 100;
    }

    // 精力分：高優先任務在高效時段加分
    if (task.priority === 'high' && task.taskType === 'focus') {
      const hourEfficiency = energyPattern.hourlyEfficiency[slot.startHour];
      score += hourEfficiency * 50;
    }

    // 截止日分：接近截止日加分
    if (task.dueDate) {
      const daysUntilDue = differenceInDays(task.dueDate, slot.date);
      if (daysUntilDue <= 1) score += 80;
      else if (daysUntilDue <= 3) score += 40;
    }

    return score;
  }

  // 為每個任務選擇最佳時段
  for (const task of sortedTasks) {
    const bestSlot = availableSlots
      .map(slot => ({ slot, score: scoreSlot(slot, task) }))
      .sort((a, b) => b.score - a.score)[0];

    // ...
  }
}
```

---

## 技術任務

- [ ] 建立 `user_productivity_patterns` 表
- [ ] 實作數據收集（任務完成時記錄時段）
- [ ] 實作精力曲線分析演算法
- [ ] 建立精力曲線 UI（圖表）
- [ ] 實作手動調整功能
- [ ] 整合到排程演算法
- [ ] 定期更新精力曲線（cron job）
- [ ] API: 取得/更新精力曲線

---

## 測試案例

| # | 測試 | 預期結果 |
|---|------|----------|
| 1 | 新使用者 | 使用預設精力曲線 |
| 2 | 有歷史資料 | 分析出個人曲線 |
| 3 | 高優先任務排程 | 優先排在高效時段 |
| 4 | 手動調整曲線 | 正確儲存並應用 |
| 5 | 查看精力圖表 | 正確顯示 |

---

## Definition of Done

- [ ] 數據收集正常
- [ ] 精力曲線分析正確
- [ ] UI 圖表顯示正常
- [ ] 手動調整功能正常
- [ ] 排程整合正常
- [ ] 高優先任務排在高效時段
- [ ] 測試案例通過
