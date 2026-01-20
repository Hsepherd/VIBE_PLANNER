# Story S-015: 並行任務排程

> **Story ID**: S-015
> **Epic**: EPIC-003 AI 智慧排程 Phase 3
> **估計點數**: 5
> **優先級**: P3
> **依賴**: EPIC-002 完成

---

## User Story

**作為** 使用者
**我想要** 背景任務可以和其他任務並行排程
**以便** 更有效利用時間（例如：等待部署時可以做其他事）

---

## 驗收標準 (Acceptance Criteria)

### AC1: 背景任務並行
```gherkin
Given 任務 A (focus, 60min) 和 任務 B (background, 30min)
When AI 排程
Then 任務 B 可以排在任務 A 的時段內
And 顯示為並行/重疊
```

### AC2: 並行視覺化
```gherkin
Given 有並行任務
When 在行事曆顯示
Then 並行任務並排顯示（或用不同樣式標示）
And 清楚區分主要任務和背景任務
```

### AC3: 並行上限
```gherkin
Given 已有 1 個 focus 任務 和 2 個 background 任務並行
When 嘗試再加入 1 個 background 任務
Then 系統提示「並行任務過多，建議分開處理」
And 可選擇忽略或調整
```

### AC4: 自動識別任務類型
```gherkin
Given 任務標題為「部署到測試環境」
When AI 分析任務
Then 自動識別為 background 類型
And 使用者可確認或修改
```

---

## UI 設計

### 行事曆並行顯示

```
09:00 ┬─────────────────────────────────────────┐
      │ 🔴 準備週會簡報                          │
      │    (專注任務)                            │
      ├─────────────────┐                       │
      │ ⏳ 部署測試環境   │                       │
      │    (背景執行)    │                       │
09:30 ┴─────────────────┘                       │
      │                                         │
10:00 │                                         │
      │                                         │
10:30 ┴─────────────────────────────────────────┘
```

### 並行任務標示

```
┌─────────────────────────────────────┐
│ 📋 部署測試環境              ⏳ 背景 │
│    09:00-09:30 (與「準備簡報」並行)  │
│                                     │
│ 可以同時進行其他工作                 │
└─────────────────────────────────────┘
```

### 任務類型選擇

```
┌─────────────────────────────────────┐
│ 任務類型                             │
├─────────────────────────────────────┤
│ ● 🎯 專注任務 (focus)               │
│   需要集中注意力，獨占時段           │
│                                     │
│ ○ ⏳ 背景任務 (background)          │
│   可以和其他任務並行執行             │
│                                     │
│ ○ ⏸️ 等待任務 (waiting)             │
│   大部分時間在等待結果               │
└─────────────────────────────────────┘
```

---

## 排程演算法修改

```typescript
function scheduleWithParallel(input: ScheduleInput): ScheduleOutput {
  const schedules: Schedule[] = [];

  // 分類任務
  const focusTasks = input.tasks.filter(t => t.taskType === 'focus');
  const backgroundTasks = input.tasks.filter(t => t.taskType === 'background');

  // 1. 先排 focus 任務
  for (const task of sortedFocusTasks) {
    const slot = slotTracker.findSlot(task.estimatedMinutes);
    if (slot) {
      schedules.push({
        taskId: task.id,
        ...slot,
        isParallel: false,
      });
      slotTracker.markUsed(slot);  // focus 任務會佔用時段
    }
  }

  // 2. 再排 background 任務（可以並行）
  for (const task of sortedBackgroundTasks) {
    // 找到有 focus 任務的時段（優先並行）
    const parallelSlot = findParallelSlot(schedules, task.estimatedMinutes);

    if (parallelSlot) {
      schedules.push({
        taskId: task.id,
        ...parallelSlot,
        isParallel: true,
        parallelWith: parallelSlot.focusTaskId,
      });
      // 不標記為已使用（可以再並行）
    } else {
      // 沒有可並行的時段，獨立排程
      const slot = slotTracker.findSlot(task.estimatedMinutes);
      if (slot) {
        schedules.push({
          taskId: task.id,
          ...slot,
          isParallel: false,
        });
      }
    }
  }

  return { schedules, ... };
}

function findParallelSlot(
  existingSchedules: Schedule[],
  neededMinutes: number
): ParallelSlot | null {
  // 找到一個 focus 任務，其時長 >= neededMinutes
  // 且並行任務數 < MAX_PARALLEL (例如 2)
  for (const schedule of existingSchedules) {
    if (schedule.taskType === 'focus' &&
        schedule.durationMinutes >= neededMinutes &&
        schedule.parallelCount < MAX_PARALLEL) {
      return {
        start: schedule.startTime,
        end: addMinutes(schedule.startTime, neededMinutes),
        focusTaskId: schedule.taskId,
      };
    }
  }
  return null;
}
```

---

## 自動識別任務類型

```typescript
const BACKGROUND_KEYWORDS = [
  '部署', 'deploy', '發布', 'release',
  '備份', 'backup',
  '執行', 'run', 'execute',
  '下載', 'download', '上傳', 'upload',
  '編譯', 'compile', 'build',
  '測試', 'test', 'CI/CD',
  '等待', 'wait',
];

function suggestTaskType(title: string, description?: string): TaskType {
  const text = `${title} ${description || ''}`.toLowerCase();

  for (const keyword of BACKGROUND_KEYWORDS) {
    if (text.includes(keyword.toLowerCase())) {
      return 'background';
    }
  }

  return 'focus';  // 預設為專注任務
}
```

---

## 技術任務

- [ ] 修改排程演算法支援並行
- [ ] 實作並行時段查找邏輯
- [ ] 行事曆並行視覺化
- [ ] 任務類型選擇 UI
- [ ] 自動識別任務類型
- [ ] 並行上限設定
- [ ] 並行任務資料結構（parallelWith）

---

## 測試案例

| # | 測試 | 預期結果 |
|---|------|----------|
| 1 | Focus + Background | Background 可並行 |
| 2 | 2 個 Background | 都可並行（在限制內）|
| 3 | 超過並行上限 | 顯示警告 |
| 4 | 識別「部署」| 建議為 background |
| 5 | 並行視覺化 | 正確顯示 |

---

## Definition of Done

- [ ] 並行排程邏輯正確
- [ ] 行事曆視覺化正確
- [ ] 任務類型選擇 UI 正常
- [ ] 自動識別功能正常
- [ ] 並行上限正常
- [ ] 測試案例通過
