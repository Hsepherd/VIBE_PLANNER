-- Migration: 新增任務排程相關欄位
-- Story: S-001 - AI 智慧排程 Phase 1
-- 日期: 2026-01-19

-- 1. 新增預估時間欄位（單位：分鐘）
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS estimated_minutes INTEGER DEFAULT 60;

-- 2. 新增任務類型欄位
-- 'focus' = 需要專注的任務，獨占時段
-- 'background' = 可背景執行的任務，可與其他任務並行
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS task_type VARCHAR(20) DEFAULT 'focus';

-- 3. 新增約束檢查
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'task_type_check'
  ) THEN
    ALTER TABLE tasks
    ADD CONSTRAINT task_type_check
    CHECK (task_type IN ('focus', 'background'));
  END IF;
END $$;

-- 4. 為現有任務設定預設值（冪等操作）
UPDATE tasks
SET estimated_minutes = 60
WHERE estimated_minutes IS NULL;

UPDATE tasks
SET task_type = 'focus'
WHERE task_type IS NULL;

-- 5. 建立索引以優化查詢
CREATE INDEX IF NOT EXISTS idx_tasks_estimated_minutes ON tasks(estimated_minutes);
CREATE INDEX IF NOT EXISTS idx_tasks_task_type ON tasks(task_type);

-- 6. 新增複合索引（用於排程查詢：未排程 + 有截止日）
CREATE INDEX IF NOT EXISTS idx_tasks_scheduling
ON tasks(start_date, due_date, priority, estimated_minutes)
WHERE status != 'completed';

COMMENT ON COLUMN tasks.estimated_minutes IS '預估完成任務所需的時間（分鐘）';
COMMENT ON COLUMN tasks.task_type IS '任務類型：focus（需專注）或 background（可背景執行）';
