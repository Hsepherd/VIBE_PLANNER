-- 新增 notes 欄位到 tasks 表
-- 用於存放任務的備註

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS notes TEXT;

-- 為 notes 欄位建立索引以支援全文搜尋（可選）
-- CREATE INDEX IF NOT EXISTS idx_tasks_notes ON tasks USING gin(to_tsvector('chinese', notes));
