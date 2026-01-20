# Epic: AI 智慧排程 Phase 3 (進階能力)

> **Epic ID**: EPIC-003
> **PRD**: PRD-AI-Smart-Scheduling.md
> **狀態**: 待開發
> **優先級**: P3
> **前置條件**: EPIC-002 完成

---

## Epic 概述

為 AI 智慧排程加入進階能力，處理複雜的任務類型（並行任務、等待型任務）以及長期排程優化。

### 目標
- 支援並行任務和等待型任務的智慧排程
- 優化跨週的長期排程
- 提供更精準的時間管理

### 範圍
- ✅ 並行任務處理
- ✅ 等待型任務（主動時間 vs 總時間）
- ✅ 跨週排程優化
- ✅ 任務類型智慧識別

---

## Stories 總覽

| Story ID | 標題 | 估計點數 | 依賴 |
|----------|------|----------|------|
| S-015 | 並行任務排程 | 5 | EPIC-002 |
| S-016 | 等待型任務處理 | 5 | S-015 |
| S-017 | 跨週排程優化 | 8 | EPIC-002 |

**總估計**: 18 點

---

## 依賴關係圖

```
EPIC-002 (Phase 2)
    ↓
┌───────────────────────────────────────┐
│                                       │
├──→ S-015 (並行任務) ──→ S-016 (等待任務)
│
└──→ S-017 (跨週優化)
```

---

## 驗收標準 (Epic Level)

- [ ] 背景任務可以和專注任務並行排程
- [ ] 等待型任務只佔用「主動時間」在行事曆
- [ ] AI 能從任務描述自動識別任務類型
- [ ] 跨週排程能平衡工作量
- [ ] 提供工作量預警

---

## 任務類型定義

```typescript
type TaskType =
  | 'focus'      // 需要專注，獨占時段
  | 'background' // 可背景執行，可與其他任務並行
  | 'waiting';   // 等待型，大部分時間在等待

interface WaitingTaskTime {
  activeMinutes: number;  // 主動操作時間（如：5分鐘啟動部署）
  totalMinutes: number;   // 總等待時間（如：30分鐘完成）
}
```

---

## 資料庫變更總覽

```sql
-- 擴充任務類型
ALTER TABLE tasks
DROP CONSTRAINT IF EXISTS task_type_check;

ALTER TABLE tasks
ADD CONSTRAINT task_type_check
CHECK (task_type IN ('focus', 'background', 'waiting'));

-- 新增等待任務欄位
ALTER TABLE tasks ADD COLUMN active_minutes INTEGER;
-- active_minutes: 等待型任務的主動操作時間
-- estimated_minutes: 仍表示總時間
```

---

*Epic 建立於 2026-01-19*
