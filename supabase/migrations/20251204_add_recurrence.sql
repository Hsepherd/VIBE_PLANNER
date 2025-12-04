-- 新增例行性任務（Recurring Tasks）相關欄位
-- 執行時間：2024-12-04

-- 新增欄位到 tasks 表
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence_type TEXT CHECK (recurrence_type IN ('none', 'daily', 'weekly', 'monthly', 'yearly'));
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence_config JSONB;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS parent_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_recurring_instance BOOLEAN DEFAULT false;

-- 設定預設值
UPDATE tasks SET recurrence_type = 'none' WHERE recurrence_type IS NULL;

-- 新增索引
CREATE INDEX IF NOT EXISTS idx_tasks_recurrence_type ON tasks(recurrence_type);
CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_is_recurring_instance ON tasks(is_recurring_instance);

-- recurrence_config JSONB 欄位說明：
-- {
--   "interval": 1,           // 間隔數量（例如每 1 天、每 2 週）
--   "weekdays": [1, 3, 5],   // 週幾執行（1=週一, 7=週日），僅 weekly 使用
--   "monthDay": 15,          // 每月幾號，僅 monthly 使用
--   "endDate": "2024-12-31", // 結束日期（可選）
--   "maxOccurrences": 10     // 最大次數（可選）
-- }
