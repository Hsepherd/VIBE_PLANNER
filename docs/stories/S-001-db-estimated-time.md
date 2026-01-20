# Story S-001: 資料庫 - 新增任務預估時間欄位

> **Story ID**: S-001
> **Epic**: EPIC-001 AI 智慧排程 Phase 1
> **估計點數**: 2
> **優先級**: P1
> **依賴**: 無

---

## User Story

**作為** 系統
**我想要** 在任務資料表新增預估時間和任務類型欄位
**以便** AI 可以記錄和使用任務的預估時間進行排程

---

## 驗收標準 (Acceptance Criteria)

### AC1: 預估時間欄位
```gherkin
Given 任務資料表
When 執行 migration
Then tasks 表新增 estimated_minutes 欄位 (INTEGER, DEFAULT 60)
```

### AC2: 任務類型欄位
```gherkin
Given 任務資料表
When 執行 migration
Then tasks 表新增 task_type 欄位 (VARCHAR(20), DEFAULT 'focus')
And 可接受的值為 'focus' 或 'background'
```

### AC3: 現有任務相容
```gherkin
Given 資料庫中已有任務
When 執行 migration
Then 所有現有任務的 estimated_minutes 設為 60
And 所有現有任務的 task_type 設為 'focus'
```

---

## 技術任務

- [ ] 建立 Supabase migration 檔案
- [ ] 新增 `estimated_minutes INTEGER DEFAULT 60`
- [ ] 新增 `task_type VARCHAR(20) DEFAULT 'focus'`
- [ ] 更新 Prisma schema (如有使用)
- [ ] 更新 TypeScript 型別定義
- [ ] 測試 migration 執行
- [ ] 更新 API 回傳欄位

---

## Migration SQL

```sql
-- Migration: 20260119_add_task_scheduling_fields.sql

-- 新增預估時間欄位
ALTER TABLE tasks
ADD COLUMN estimated_minutes INTEGER DEFAULT 60;

-- 新增任務類型欄位
ALTER TABLE tasks
ADD COLUMN task_type VARCHAR(20) DEFAULT 'focus';

-- 新增 check constraint
ALTER TABLE tasks
ADD CONSTRAINT task_type_check
CHECK (task_type IN ('focus', 'background'));

-- 為現有任務設定預設值 (冪等)
UPDATE tasks
SET estimated_minutes = 60
WHERE estimated_minutes IS NULL;

UPDATE tasks
SET task_type = 'focus'
WHERE task_type IS NULL;

-- 建立索引以優化查詢
CREATE INDEX idx_tasks_estimated_minutes ON tasks(estimated_minutes);
CREATE INDEX idx_tasks_task_type ON tasks(task_type);
```

---

## 測試案例

| # | 測試 | 預期結果 |
|---|------|----------|
| 1 | 新增任務不帶 estimated_minutes | 預設為 60 |
| 2 | 新增任務帶 estimated_minutes=30 | 儲存為 30 |
| 3 | 新增任務不帶 task_type | 預設為 'focus' |
| 4 | 新增任務帶 task_type='background' | 儲存為 'background' |
| 5 | 新增任務帶 task_type='invalid' | 應該失敗 |

---

## Definition of Done

- [ ] Migration 執行成功
- [ ] TypeScript 型別更新
- [ ] 現有 API 正常運作
- [ ] 測試案例通過
