-- 為 api_usage 表新增 user_id 欄位（如果不存在）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_usage' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE api_usage ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 更新 RLS 政策
DROP POLICY IF EXISTS "Allow public access to api_usage" ON api_usage;

-- 允許使用者讀取自己的 API 使用量
CREATE POLICY "Users can view own api_usage"
  ON api_usage FOR SELECT
  USING (auth.uid() = user_id);

-- 允許使用者新增自己的 API 使用量
CREATE POLICY "Users can insert own api_usage"
  ON api_usage FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 允許使用者刪除自己的 API 使用量
CREATE POLICY "Users can delete own api_usage"
  ON api_usage FOR DELETE
  USING (auth.uid() = user_id);

-- 建立索引提升查詢效能
CREATE INDEX IF NOT EXISTS idx_api_usage_user_id ON api_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_created_at ON api_usage(created_at);
