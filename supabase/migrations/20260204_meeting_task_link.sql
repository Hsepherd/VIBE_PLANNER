-- 新增 meeting_note_id 欄位到 tasks 表
-- 用於關聯會議記錄與任務

ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS meeting_note_id UUID REFERENCES meeting_notes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_meeting_note_id ON tasks(meeting_note_id);
