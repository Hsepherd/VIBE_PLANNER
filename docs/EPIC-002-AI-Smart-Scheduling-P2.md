# Epic: AI 智慧排程 Phase 2 (學習能力)

> **Epic ID**: EPIC-002
> **PRD**: PRD-AI-Smart-Scheduling.md
> **狀態**: 待開發
> **優先級**: P2
> **前置條件**: EPIC-001 完成

---

## Epic 概述

為 AI 智慧排程加入學習能力，讓系統能從使用者的歷史行為中學習，提供更準確的時間預估和更個人化的排程建議。

### 目標
- 記錄任務實際花費時間
- AI 學習歷史數據優化預估
- 學習使用者的精力曲線
- 自動判斷任務依賴關係
- 一鍵重新排程

### 範圍
- ✅ 任務計時功能
- ✅ 記錄實際花費時間
- ✅ AI 學習預估模型
- ✅ AI 學習精力曲線
- ✅ AI 自動判斷任務依賴
- ✅ 一鍵重新排程

---

## Stories 總覽

| Story ID | 標題 | 估計點數 | 依賴 |
|----------|------|----------|------|
| S-009 | 任務計時功能 | 5 | EPIC-001 |
| S-010 | 記錄實際花費時間 | 3 | S-009 |
| S-011 | AI 學習時間預估模型 | 8 | S-010 |
| S-012 | AI 學習精力曲線 | 8 | S-010 |
| S-013 | AI 自動判斷任務依賴 | 5 | EPIC-001 |
| S-014 | 一鍵重新排程 | 5 | S-006 |

**總估計**: 34 點

---

## 依賴關係圖

```
EPIC-001 (Phase 1)
    ↓
┌───────────────────────────────────────┐
│                                       │
S-009 (計時) ──→ S-010 (記錄時間) ──┬──→ S-011 (學習預估)
                                   │
                                   └──→ S-012 (學習精力)

S-006 (演算法) ──→ S-014 (一鍵重排)

EPIC-001 ──→ S-013 (任務依賴)
```

---

## 驗收標準 (Epic Level)

- [ ] 使用者可以為任務開始/暫停/結束計時
- [ ] 系統記錄每個任務的實際花費時間
- [ ] AI 預估時間準確度提升 20% (與 Phase 1 比較)
- [ ] AI 能根據使用者精力曲線推薦最佳工作時段
- [ ] AI 能從任務描述自動識別依賴關係
- [ ] 使用者可一鍵重新排程所有任務

---

## 資料庫變更總覽

```sql
-- S-009/S-010: 計時相關欄位
ALTER TABLE tasks ADD COLUMN actual_minutes INTEGER;
ALTER TABLE tasks ADD COLUMN started_at TIMESTAMP;
ALTER TABLE tasks ADD COLUMN completed_at TIMESTAMP;
ALTER TABLE tasks ADD COLUMN time_entries JSONB DEFAULT '[]';

-- S-012: 精力曲線表
CREATE TABLE user_productivity_patterns (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  hour_of_day INTEGER,
  day_of_week INTEGER,
  task_completion_rate DECIMAL,
  avg_focus_score DECIMAL,
  sample_count INTEGER,
  updated_at TIMESTAMP
);

-- S-013: 任務依賴表
CREATE TABLE task_dependencies (
  id UUID PRIMARY KEY,
  task_id UUID REFERENCES tasks,
  depends_on_task_id UUID REFERENCES tasks,
  dependency_type VARCHAR(20),
  created_at TIMESTAMP,
  is_ai_suggested BOOLEAN DEFAULT false
);
```

---

*Epic 建立於 2026-01-19*
