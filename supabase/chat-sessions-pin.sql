-- 新增 is_pinned 欄位到 chat_sessions 表
-- 執行此 SQL 以新增置頂功能

ALTER TABLE chat_sessions
ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;

-- 建立索引以優化查詢
CREATE INDEX IF NOT EXISTS idx_chat_sessions_pinned
ON chat_sessions (user_id, is_pinned DESC, updated_at DESC);
