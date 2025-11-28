-- 為 conversations 表加入 user_id 欄位
-- 執行此 SQL 來更新資料表

-- 加入 user_id 欄位（如果不存在）
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 建立索引以提升查詢效能
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);

-- 移除舊的政策（如果存在）
DROP POLICY IF EXISTS "Allow public access to conversations" ON conversations;
DROP POLICY IF EXISTS "Users can view own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can insert own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can delete own conversations" ON conversations;

-- 建立新的 RLS 政策：使用者只能存取自己的對話
CREATE POLICY "Users can view own conversations" ON conversations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversations" ON conversations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations" ON conversations
  FOR DELETE USING (auth.uid() = user_id);
