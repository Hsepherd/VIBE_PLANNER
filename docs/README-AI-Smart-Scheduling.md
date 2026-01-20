# AI 智慧排程功能 - 完整規劃總覽

> **PRD**: PRD-AI-Smart-Scheduling.md
> **建立日期**: 2026-01-19
> **總 Stories**: 17 個
> **總點數**: 96 點

---

## 📋 功能概述

讓 AI 助理能夠查詢使用者的任務列表，自動預估每項任務所需時間，並根據優先級、截止日、工作時段等因素，智慧地將任務排入行事曆。

---

## 🎯 三階段規劃

| Phase | Epic | 目標 | Stories | 點數 | 狀態 |
|-------|------|------|---------|------|------|
| **Phase 1** | EPIC-001 | MVP 核心功能 | 8 | 44 | 待開發 |
| **Phase 2** | EPIC-002 | 學習能力 | 6 | 34 | 待開發 |
| **Phase 3** | EPIC-003 | 進階能力 | 3 | 18 | 待開發 |

---

## 📁 文件結構

```
docs/
├── README-AI-Smart-Scheduling.md    # 本文件（總覽）
├── PRD-AI-Smart-Scheduling.md       # 產品需求文件
│
├── EPIC-001-AI-Smart-Scheduling-P1.md  # Phase 1 Epic
├── EPIC-002-AI-Smart-Scheduling-P2.md  # Phase 2 Epic
├── EPIC-003-AI-Smart-Scheduling-P3.md  # Phase 3 Epic
│
└── stories/
    ├── S-001-db-estimated-time.md       # 資料庫變更
    ├── S-002-api-unscheduled-tasks.md   # API: 未排程任務
    ├── S-003-api-calendar-slots.md      # API: 可用時段
    ├── S-004-ai-function-calling.md     # AI Function Calling
    ├── S-005-ai-estimate-time.md        # AI 預估時間
    ├── S-006-scheduling-algorithm.md    # 排程演算法
    ├── S-007-ui-schedule-preview.md     # UI 預覽面板
    ├── S-008-integration-chat-scheduling.md  # 整合流程
    ├── S-009-task-timer.md              # 任務計時
    ├── S-010-record-actual-time.md      # 記錄實際時間
    ├── S-011-ai-learn-time-estimation.md # AI 學習預估
    ├── S-012-ai-learn-energy-curve.md   # AI 學習精力曲線
    ├── S-013-ai-task-dependency.md      # 任務依賴
    ├── S-014-one-click-reschedule.md    # 一鍵重新排程
    ├── S-015-parallel-tasks.md          # 並行任務
    ├── S-016-waiting-tasks.md           # 等待型任務
    └── S-017-cross-week-optimization.md # 跨週排程優化
```

---

## 🚀 Phase 1: MVP 核心功能 (44 點)

### 目標
- 使用者可用自然語言觸發排程
- AI 能預估任務所需時間
- 排程避開 Google Calendar 已有行程
- 提供預覽、調整、確認流程

### Stories

| ID | 標題 | 點數 | 依賴 | 類型 |
|----|------|------|------|------|
| **S-001** | 資料庫：預估時間欄位 | 2 | - | 後端 |
| **S-002** | API：未排程任務 | 3 | S-001 | 後端 |
| **S-003** | API：Calendar 可用時段 | 5 | - | 後端 |
| **S-004** | AI：Function Calling | 8 | - | AI |
| **S-005** | AI：預估時間 | 5 | S-004 | AI |
| **S-006** | 排程演算法 | 8 | S-002, S-003 | 核心 |
| **S-007** | UI：排程預覽 | 8 | S-006 | 前端 |
| **S-008** | 整合：對話排程 | 5 | 全部 | 整合 |

### 依賴關係圖

```
S-001 (DB) ──→ S-002 (API 任務)
                    ↓
S-003 (API Calendar) ──→ S-006 (演算法) ──→ S-007 (UI) ──→ S-008 (整合)
                              ↑
S-004 (Function Calling) ──→ S-005 (預估時間) ─────────────────↗
```

### 建議開發順序

```
第一批（可並行）：
├── S-001 資料庫 (2pt)
├── S-003 Calendar API (5pt)
└── S-004 Function Calling (8pt)

第二批：
├── S-002 未排程 API (3pt) ← 依賴 S-001
└── S-005 預估時間 (5pt) ← 依賴 S-004

第三批：
└── S-006 排程演算法 (8pt) ← 依賴 S-002, S-003

第四批：
└── S-007 UI 預覽 (8pt) ← 依賴 S-006

第五批：
└── S-008 整合 (5pt) ← 依賴全部
```

---

## 📈 Phase 2: 學習能力 (34 點)

### 目標
- 記錄任務實際花費時間
- AI 學習歷史數據優化預估
- 學習使用者的精力曲線
- 自動判斷任務依賴關係
- 一鍵重新排程

### Stories

| ID | 標題 | 點數 | 依賴 | 類型 |
|----|------|------|------|------|
| **S-009** | 任務計時功能 | 5 | EPIC-001 | 前端 |
| **S-010** | 記錄實際時間 | 3 | S-009 | 後端 |
| **S-011** | AI 學習預估模型 | 8 | S-010 | AI |
| **S-012** | AI 學習精力曲線 | 8 | S-010 | AI |
| **S-013** | AI 任務依賴 | 5 | EPIC-001 | AI |
| **S-014** | 一鍵重新排程 | 5 | S-006 | 核心 |

### 依賴關係圖

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

## 🚀 Phase 3: 進階能力 (18 點)

### 目標
- 支援並行任務和等待型任務
- 優化跨週的長期排程
- 提供更精準的時間管理

### Stories

| ID | 標題 | 點數 | 依賴 | 類型 |
|----|------|------|------|------|
| **S-015** | 並行任務排程 | 5 | EPIC-002 | 核心 |
| **S-016** | 等待型任務處理 | 5 | S-015 | 核心 |
| **S-017** | 跨週排程優化 | 8 | EPIC-002 | 核心 |

### 依賴關係圖

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

## 🗄️ 資料庫變更總覽

### Phase 1

```sql
ALTER TABLE tasks ADD COLUMN estimated_minutes INTEGER DEFAULT 60;
ALTER TABLE tasks ADD COLUMN task_type VARCHAR(20) DEFAULT 'focus';
```

### Phase 2

```sql
ALTER TABLE tasks ADD COLUMN actual_minutes INTEGER;
ALTER TABLE tasks ADD COLUMN started_at TIMESTAMP;
ALTER TABLE tasks ADD COLUMN completed_at TIMESTAMP;
ALTER TABLE tasks ADD COLUMN time_entries JSONB DEFAULT '[]';
ALTER TABLE tasks ADD COLUMN is_manually_scheduled BOOLEAN DEFAULT false;

CREATE TABLE user_time_patterns (...);
CREATE TABLE user_productivity_patterns (...);
CREATE TABLE task_dependencies (...);
```

### Phase 3

```sql
ALTER TABLE tasks ADD COLUMN active_minutes INTEGER;
-- task_type 擴充為 'focus' | 'background' | 'waiting'
```

---

## 🔌 API 端點總覽

### Phase 1

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/tasks/unscheduled` | 取得未排程任務 |
| GET | `/api/calendar/available-slots` | 取得可用時段 |
| POST | `/api/schedule/preview` | 產生排程預覽 |
| POST | `/api/schedule/confirm` | 確認排程 |

### Phase 2

| 方法 | 路徑 | 說明 |
|------|------|------|
| POST | `/api/tasks/:id/timer/start` | 開始計時 |
| POST | `/api/tasks/:id/timer/stop` | 結束計時 |
| PATCH | `/api/tasks/:id/actual-time` | 記錄實際時間 |
| GET | `/api/user/productivity-pattern` | 取得精力曲線 |
| POST | `/api/schedule/reschedule` | 一鍵重新排程 |

### Phase 3

| 方法 | 路徑 | 說明 |
|------|------|------|
| POST | `/api/schedule/cross-week` | 跨週排程 |

---

## 📊 總計

| 項目 | 數量 |
|------|------|
| PRD | 1 |
| Epic | 3 |
| Stories | 17 |
| 總點數 | 96 |
| 新增資料表 | 3 |
| 新增 API | 11+ |

---

## ✅ 驗收標準（總體）

### Phase 1 完成時
- [ ] 使用者說「幫我排今天行程」能觸發排程
- [ ] AI 正確預估任務時間
- [ ] 排程避開 Google Calendar 行程
- [ ] 使用者可預覽、調整、確認

### Phase 2 完成時
- [ ] 任務計時功能正常
- [ ] AI 預估準確度提升 20%
- [ ] 精力曲線影響排程
- [ ] 一鍵重新排程正常

### Phase 3 完成時
- [ ] 並行任務正確處理
- [ ] 等待型任務只佔主動時間
- [ ] 跨週排程工作量平衡

---

*文件建立於 2026-01-19*
