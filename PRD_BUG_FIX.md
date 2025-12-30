# PRD：Vibe Planner 系統穩定性優化

> **版本**：1.0
> **建立日期**：2025-12-30
> **狀態**：待審核

---

## 1. 背景與目標

### 1.1 背景

經過全面系統測試，發現 Vibe Planner 存在以下問題：
- Dashboard 逾期任務顯示邏輯錯誤
- Analytics 圖表數據無法正常渲染
- 部分數據在不同頁面顯示不一致

### 1.2 目標

1. 修復所有已發現的 Bug
2. 確保數據一致性
3. 提升系統穩定性
4. 優化用戶體驗

---

## 2. 需求詳述

### 2.1 修復 Dashboard 逾期任務邏輯 🔴

**需求 ID**：FIX-001

**問題**：已完成任務仍顯示在逾期列表中

**驗收標準**：
- [ ] 逾期任務列表只顯示 `status !== 'completed'` 的任務
- [ ] 點擊完成後，任務立即從逾期列表移除
- [ ] 逾期數量統計準確

**技術方案**：
```typescript
// app/dashboard/page.tsx

// 修改前（問題代碼）
const overdueTasks = tasks.filter(task =>
  new Date(task.dueDate) < new Date()
);

// 修改後
const overdueTasks = tasks.filter(task =>
  new Date(task.dueDate) < new Date() &&
  task.status !== 'completed'
);
```

**影響範圍**：
- `app/dashboard/page.tsx`
- 可能需要同步修改 AI 回應邏輯

---

### 2.2 修復 Analytics 圖表渲染 🟡

**需求 ID**：FIX-002

**問題**：過去 7 天圖表無數據顯示

**驗收標準**：
- [ ] 圖表正確顯示過去 7 天的完成任務數
- [ ] Y 軸刻度根據數據自動調整
- [ ] 圖例和標籤正確顯示

**技術方案**：
```typescript
// app/analytics/page.tsx

// 檢查項目：
// 1. completedAt 欄位是否有正確儲存
// 2. groupByDate 邏輯是否正確
// 3. Recharts BarChart data prop 是否正確傳入

// 建議檢查的函數
const getCompletedTasksByDate = (tasks: Task[]) => {
  const last7Days = [...Array(7)].map((_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - i);
    return date.toISOString().split('T')[0];
  }).reverse();

  return last7Days.map(date => ({
    date,
    count: tasks.filter(t =>
      t.completedAt?.startsWith(date)
    ).length
  }));
};
```

**影響範圍**：
- `app/analytics/page.tsx`
- 可能需要檢查任務完成時的 `completedAt` 更新邏輯

---

### 2.3 專案進度一致性 🟢

**需求 ID**：FIX-003

**問題**：Dashboard 和 Projects 頁面顯示不同進度

**驗收標準**：
- [ ] 統一專案進度計算公式
- [ ] 所有頁面顯示一致的進度

**技術方案**：
```typescript
// 建議抽取共用函數
// lib/utils/project.ts

export const calculateProjectProgress = (project: Project, tasks: Task[]) => {
  const projectTasks = tasks.filter(t => t.projectId === project.id);
  if (projectTasks.length === 0) return 0;

  const completedTasks = projectTasks.filter(t => t.status === 'completed');
  return Math.round((completedTasks.length / projectTasks.length) * 100);
};
```

**影響範圍**：
- `app/dashboard/page.tsx`
- `app/projects/page.tsx`
- 建議建立 `lib/utils/project.ts` 共用函數

---

### 2.4 API 統計累加修復 🟢

**需求 ID**：FIX-004

**問題**：API 使用統計全為 0

**驗收標準**：
- [ ] 每次 API 調用正確累加統計
- [ ] 統計數據持久化到 localStorage 或資料庫
- [ ] 設定頁面顯示正確數據

**技術方案**：
```typescript
// lib/api-usage.ts

export const trackApiUsage = (usage: {
  inputTokens: number;
  outputTokens: number;
  cost: number;
}) => {
  const current = getApiUsage();
  const updated = {
    totalCost: current.totalCost + usage.cost,
    totalInputTokens: current.totalInputTokens + usage.inputTokens,
    totalOutputTokens: current.totalOutputTokens + usage.outputTokens,
    dialogCount: current.dialogCount + 1,
  };
  saveApiUsage(updated);
};
```

---

## 3. 實作順序

| 優先級 | 需求 ID | 預估工時 |
|-------|--------|---------|
| 1 | FIX-001 | 0.5 小時 |
| 2 | FIX-002 | 1 小時 |
| 3 | FIX-003 | 1 小時 |
| 4 | FIX-004 | 0.5 小時 |

**總預估工時**：3 小時

---

## 4. 測試計劃

### 4.1 FIX-001 測試

1. 建立已完成的逾期任務
2. 確認 Dashboard 不顯示該任務
3. 將任務改為未完成，確認顯示在逾期列表

### 4.2 FIX-002 測試

1. 完成數個任務
2. 確認 Analytics 圖表顯示數據
3. 切換日期範圍，確認數據更新

### 4.3 FIX-003 測試

1. 在專案中建立任務
2. 完成部分任務
3. 確認 Dashboard 和 Projects 顯示相同進度

### 4.4 FIX-004 測試

1. 發送 AI 對話
2. 確認設定頁面統計更新
3. 刷新頁面確認數據持久化

---

## 5. 風險評估

| 風險 | 影響 | 緩解措施 |
|-----|-----|---------|
| 修改邏輯影響其他功能 | 中 | 充分測試後再部署 |
| 數據遷移問題 | 低 | 修復後不影響現有數據 |

---

## 6. 驗收標準

- [ ] 所有 Bug 修復完成
- [ ] 測試計劃全部通過
- [ ] 無新增 Bug 產生
- [ ] 代碼已 commit 並推送

---

## 附錄

- [BUG_REPORT.md](./BUG_REPORT.md) - 完整測試報告
- [PROJECT_STATUS.md](./PROJECT_STATUS.md) - 專案進度

---

*PRD 由 PM Agent 自動生成*
