-- 修正 tasks 表的 RLS 政策，允許匿名使用者 INSERT
-- 請在 Supabase Dashboard > SQL Editor 執行此腳本

-- 刪除舊的政策
DROP POLICY IF EXISTS "Allow public access to tasks" ON tasks;

-- 建立新的完整政策（包含 INSERT 權限）
CREATE POLICY "Allow public access to tasks" ON tasks
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 同樣修正其他表（以防萬一）
DROP POLICY IF EXISTS "Allow public access to projects" ON projects;
CREATE POLICY "Allow public access to projects" ON projects
  FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public access to conversations" ON conversations;
CREATE POLICY "Allow public access to conversations" ON conversations
  FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public access to api_usage" ON api_usage;
CREATE POLICY "Allow public access to api_usage" ON api_usage
  FOR ALL
  USING (true)
  WITH CHECK (true);
