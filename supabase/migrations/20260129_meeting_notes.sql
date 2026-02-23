-- Migration: 會議記錄儲存系統
-- Date: 2026-01-29
-- Purpose: 建立會議記錄表，儲存 AI 整理的會議記錄及原始逐字稿

-- 1. 建立會議記錄表
CREATE TABLE IF NOT EXISTS meeting_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- 基本資訊
  title TEXT NOT NULL,
  date DATE NOT NULL,
  participants TEXT[] DEFAULT '{}',

  -- 原始內容
  raw_content TEXT NOT NULL,                -- 原始會議逐字稿

  -- AI 整理的結構化內容
  organized JSONB NOT NULL,                 -- 包含 discussionPoints, decisions, actionItems, nextSteps
  markdown TEXT NOT NULL,                   -- Markdown 格式的會議記錄

  -- 關聯
  user_id UUID NOT NULL,                    -- 擁有者
  chat_session_id UUID,                     -- 關聯的對話會話（可選）

  -- 時間戳
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 外鍵約束
  CONSTRAINT fk_chat_session
    FOREIGN KEY (chat_session_id)
    REFERENCES chat_sessions(id)
    ON DELETE SET NULL
);

-- 2. 建立索引以提升查詢效能
CREATE INDEX IF NOT EXISTS idx_meeting_notes_user_id ON meeting_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_meeting_notes_date ON meeting_notes(date DESC);
CREATE INDEX IF NOT EXISTS idx_meeting_notes_created_at ON meeting_notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_meeting_notes_chat_session ON meeting_notes(chat_session_id);

-- 3. 建立全文搜尋索引（支援在原始逐字稿中搜尋）
CREATE INDEX IF NOT EXISTS idx_meeting_notes_raw_content_search
  ON meeting_notes
  USING gin(to_tsvector('chinese', raw_content));

CREATE INDEX IF NOT EXISTS idx_meeting_notes_title_search
  ON meeting_notes
  USING gin(to_tsvector('chinese', title));

-- 4. 為 meeting_notes 表建立 updated_at 觸發器
DROP TRIGGER IF EXISTS update_meeting_notes_updated_at ON meeting_notes;
CREATE TRIGGER update_meeting_notes_updated_at
  BEFORE UPDATE ON meeting_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 5. 啟用 Row Level Security
ALTER TABLE meeting_notes ENABLE ROW LEVEL SECURITY;

-- 6. 建立 RLS 政策：使用者只能存取自己的會議記錄
CREATE POLICY "Users can view their own meeting notes"
  ON meeting_notes
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own meeting notes"
  ON meeting_notes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own meeting notes"
  ON meeting_notes
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own meeting notes"
  ON meeting_notes
  FOR DELETE
  USING (auth.uid() = user_id);

-- 7. 新增註解說明
COMMENT ON TABLE meeting_notes IS '會議記錄表，儲存 AI 整理的會議記錄及原始逐字稿';
COMMENT ON COLUMN meeting_notes.raw_content IS '原始會議逐字稿，用於對話檢索';
COMMENT ON COLUMN meeting_notes.organized IS '結構化會議記錄 JSON，包含 discussionPoints, decisions, actionItems, nextSteps';
COMMENT ON COLUMN meeting_notes.markdown IS 'Markdown 格式的會議記錄，用於顯示';
