-- Migration: 儲存待確認任務群組和已處理任務群組到對話會話
-- Date: 2026-01-29
-- Purpose: 解決登出後待確認任務變成摘要的問題

-- 1. 在 chat_sessions 表中新增欄位儲存任務群組
ALTER TABLE chat_sessions
ADD COLUMN IF NOT EXISTS pending_task_groups JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS processed_task_groups JSONB DEFAULT '[]'::jsonb;

-- 2. 新增註解說明
COMMENT ON COLUMN chat_sessions.pending_task_groups IS '待確認任務群組（未加入/未略過的任務）';
COMMENT ON COLUMN chat_sessions.processed_task_groups IS '已處理任務群組（已加入或已略過的任務歷史）';
