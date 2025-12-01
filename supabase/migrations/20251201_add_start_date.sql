-- 新增任務開始日期欄位
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ DEFAULT NULL;

-- 新增索引以提升查詢效能
CREATE INDEX IF NOT EXISTS idx_tasks_start_date ON tasks(start_date);
