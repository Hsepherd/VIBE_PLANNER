-- 為 projects 和 tasks 表設置正確的 user-based RLS 政策
-- 這樣每個使用者只能看到自己的資料，實現跨裝置同步
--
-- ⚠️ 執行前注意：
-- 1. 先備份資料
-- 2. 如果有現有資料沒有 user_id，需要先指派給某個使用者
-- 3. 執行後，沒有 user_id 的資料將無法被存取

-- ============================================
-- Step 0: 查看現有沒有 user_id 的資料數量（可選）
-- ============================================
-- SELECT COUNT(*) FROM projects WHERE user_id IS NULL;
-- SELECT COUNT(*) FROM tasks WHERE user_id IS NULL;

-- ============================================
-- Step 1: 確保 user_id 欄位存在
-- ============================================

-- projects 表加入 user_id
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- tasks 表加入 user_id
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- api_usage 表加入 user_id
ALTER TABLE api_usage
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- ============================================
-- Step 2: 建立索引
-- ============================================

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_user_id ON api_usage(user_id);

-- ============================================
-- Step 3: 移除舊的公開政策
-- ============================================

DROP POLICY IF EXISTS "Allow public access to projects" ON projects;
DROP POLICY IF EXISTS "Allow public access to tasks" ON tasks;
DROP POLICY IF EXISTS "Allow public access to api_usage" ON api_usage;

-- 移除可能存在的舊政策
DROP POLICY IF EXISTS "Users can view own projects" ON projects;
DROP POLICY IF EXISTS "Users can insert own projects" ON projects;
DROP POLICY IF EXISTS "Users can update own projects" ON projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON projects;

DROP POLICY IF EXISTS "Users can view own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can insert own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can update own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can delete own tasks" ON tasks;

DROP POLICY IF EXISTS "Users can view own api_usage" ON api_usage;
DROP POLICY IF EXISTS "Users can insert own api_usage" ON api_usage;
DROP POLICY IF EXISTS "Users can delete own api_usage" ON api_usage;

-- ============================================
-- Step 4: 建立 user-based RLS 政策
-- ============================================

-- Projects RLS
CREATE POLICY "Users can view own projects" ON projects
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own projects" ON projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects" ON projects
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects" ON projects
  FOR DELETE USING (auth.uid() = user_id);

-- Tasks RLS
CREATE POLICY "Users can view own tasks" ON tasks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tasks" ON tasks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tasks" ON tasks
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tasks" ON tasks
  FOR DELETE USING (auth.uid() = user_id);

-- API Usage RLS
CREATE POLICY "Users can view own api_usage" ON api_usage
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own api_usage" ON api_usage
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own api_usage" ON api_usage
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- Step 5: 確保 RLS 已啟用
-- ============================================

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;
