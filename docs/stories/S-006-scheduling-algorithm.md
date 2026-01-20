# Story S-006: 排程 - 排程演算法 v1

> **Story ID**: S-006
> **Epic**: EPIC-001 AI 智慧排程 Phase 1
> **估計點數**: 8
> **優先級**: P1
> **依賴**: S-002, S-003

---

## User Story

**作為** 系統
**我想要** 一個排程演算法將任務安排到可用時段
**以便** 自動為使用者規劃最佳的工作時程

---

## 驗收標準 (Acceptance Criteria)

### AC1: 基本排程
```gherkin
Given 5 個未排程任務
And 今天有 6 小時可用時段
When 執行排程演算法
Then 產生時間不重疊的排程
And 總時間不超過可用時段
```

### AC2: 優先級排序
```gherkin
Given 任務 A (high), B (medium), C (low)
And 可用時段為 09:00-12:00
When 執行排程演算法
Then 任務 A 排在最前面
Then 任務 B 其次
Then 任務 C 最後（如果時間夠）
```

### AC3: 截止日優先
```gherkin
Given 任務 A (截止: 明天), B (截止: 下週)
When 執行排程演算法
Then 任務 A 排在任務 B 之前
```

### AC4: 避免衝突
```gherkin
Given 今天 10:00-11:00 有會議
When 執行排程演算法
Then 沒有任務排在 10:00-11:00
```

### AC5: 任務類型處理
```gherkin
Given 任務 A (focus, 60min), B (background, 30min)
And 可用時段為 09:00-10:00
When 執行排程演算法
Then 任務 A 排在 09:00-10:00
And 任務 B 可以和 A 重疊（因為是 background）
```

### AC6: 時間不足警告
```gherkin
Given 任務總需時 10 小時
And 可用時段只有 6 小時
When 執行排程演算法
Then 排入能排的任務
And 回傳警告：「有 4 小時的任務無法排入」
And 建議：哪些任務可以延後
```

---

## 演算法設計

### 輸入

```typescript
interface ScheduleInput {
  tasks: Array<{
    id: string;
    title: string;
    priority: 'high' | 'medium' | 'low';
    dueDate?: Date;
    estimatedMinutes: number;
    taskType: 'focus' | 'background';
  }>;
  availableSlots: Array<{
    date: string;
    slots: Array<{
      start: string; // "09:00"
      end: string;   // "12:00"
      minutes: number;
    }>;
  }>;
  preferences?: {
    focusHoursStart?: string;  // 黃金時段開始 "09:00"
    focusHoursEnd?: string;    // 黃金時段結束 "12:00"
  };
}
```

### 輸出

```typescript
interface ScheduleOutput {
  schedules: Array<{
    taskId: string;
    taskTitle: string;
    date: string;
    startTime: string;
    endTime: string;
    isOverlap?: boolean; // background 任務可能重疊
  }>;
  unscheduled: Array<{
    taskId: string;
    taskTitle: string;
    reason: string;
  }>;
  warnings: string[];
  stats: {
    totalTasks: number;
    scheduledTasks: number;
    totalMinutesNeeded: number;
    totalMinutesAvailable: number;
  };
}
```

### 演算法步驟（貪婪法）

```typescript
function scheduleTasksV1(input: ScheduleInput): ScheduleOutput {
  const { tasks, availableSlots, preferences } = input;
  const schedules: Schedule[] = [];
  const unscheduled: Unscheduled[] = [];

  // 1. 排序任務
  const sortedTasks = tasks.sort((a, b) => {
    // 優先級：截止日 > 優先級
    if (a.dueDate && b.dueDate) {
      const dateDiff = a.dueDate.getTime() - b.dueDate.getTime();
      if (dateDiff !== 0) return dateDiff;
    }
    if (a.dueDate && !b.dueDate) return -1;
    if (!a.dueDate && b.dueDate) return 1;

    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  // 2. 建立時段追蹤器
  const slotTracker = new SlotTracker(availableSlots);

  // 3. 為每個任務找時段
  for (const task of sortedTasks) {
    const slot = slotTracker.findSlot({
      minutes: task.estimatedMinutes,
      preferFocusHours: task.taskType === 'focus',
      dueDate: task.dueDate,
    });

    if (slot) {
      schedules.push({
        taskId: task.id,
        taskTitle: task.title,
        date: slot.date,
        startTime: slot.start,
        endTime: slot.end,
      });

      // 只有 focus 任務才佔用時段
      if (task.taskType === 'focus') {
        slotTracker.markUsed(slot);
      }
    } else {
      unscheduled.push({
        taskId: task.id,
        taskTitle: task.title,
        reason: '可用時間不足',
      });
    }
  }

  // 4. 產生警告
  const warnings = [];
  if (unscheduled.length > 0) {
    warnings.push(`有 ${unscheduled.length} 個任務無法排入，建議延後或重新安排`);
  }

  return { schedules, unscheduled, warnings, stats: { ... } };
}
```

---

## 技術任務

- [ ] 建立 `lib/scheduling/algorithm.ts`
- [ ] 實作任務排序邏輯
- [ ] 實作時段追蹤器 (SlotTracker)
- [ ] 實作時段查找邏輯
- [ ] 處理 background 任務重疊
- [ ] 實作時間不足警告
- [ ] 建立 `lib/scheduling/types.ts` 型別定義
- [ ] 單元測試

---

## 邊界情況

| 情況 | 處理方式 |
|------|----------|
| 任務時間 > 單一時段 | 暫時跳過，提示使用者拆分 |
| 截止日已過 | 標記為緊急，優先排入 |
| 所有時段已滿 | 回傳全部 unscheduled |
| 無任務 | 回傳空排程 |
| 無可用時段 | 回傳警告 |

---

## 測試案例

| # | 情境 | 預期結果 |
|---|------|----------|
| 1 | 3 任務，足夠時間 | 全部排入 |
| 2 | 3 任務，時間不足 | 部分排入 + 警告 |
| 3 | High 和 Low 優先級 | High 先排 |
| 4 | 有截止日的先排 | 截止近的先 |
| 5 | Focus + Background | Background 可重疊 |
| 6 | 中間有會議 | 避開會議時段 |

---

## Definition of Done

- [ ] 演算法正確排程
- [ ] 優先級排序正確
- [ ] 截止日排序正確
- [ ] 避開已有行程
- [ ] Background 任務可重疊
- [ ] 時間不足時回傳警告
- [ ] 單元測試通過
- [ ] 效能 < 100ms（100 個任務）
