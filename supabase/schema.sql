-- Vibe Planner Database Schema
-- 執行此 SQL 來建立所需的資料表

-- 啟用 UUID 擴展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 專案表
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 任務表
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  due_date TIMESTAMPTZ,
  assignee TEXT,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- 對話歷史表
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- API 使用量表
CREATE TABLE IF NOT EXISTS api_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  model TEXT NOT NULL,
  prompt_tokens INTEGER NOT NULL,
  completion_tokens INTEGER NOT NULL,
  total_tokens INTEGER NOT NULL,
  cost DECIMAL(10, 6) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 建立索引以提升查詢效能
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at);

-- 建立更新 updated_at 的觸發器函數
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 為 projects 表建立觸發器
DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 為 tasks 表建立觸發器
DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 啟用 Row Level Security (RLS) - 目前先設為公開，之後可加入使用者認證
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;

-- 建立公開存取政策（暫時，之後可改為需要認證）
CREATE POLICY "Allow public access to projects" ON projects FOR ALL USING (true);
CREATE POLICY "Allow public access to tasks" ON tasks FOR ALL USING (true);
CREATE POLICY "Allow public access to conversations" ON conversations FOR ALL USING (true);
CREATE POLICY "Allow public access to api_usage" ON api_usage FOR ALL USING (true);

-- ========================================
-- AI 學習偏好系統資料表
-- ========================================

-- 使用者偏好表（儲存學習到的規則）
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category TEXT NOT NULL CHECK (category IN ('priority', 'assignee', 'project', 'filter', 'style')),
  pattern TEXT NOT NULL,           -- 觸發條件/關鍵字
  action TEXT NOT NULL,            -- 對應動作
  confidence DECIMAL(3,2) NOT NULL DEFAULT 0.50 CHECK (confidence >= 0 AND confidence <= 1),
  positive_count INTEGER NOT NULL DEFAULT 0,
  negative_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 學習範例表（正面/負面範例）
CREATE TABLE IF NOT EXISTS learning_examples (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  example_type TEXT NOT NULL CHECK (example_type IN ('positive', 'negative')),
  source_action TEXT NOT NULL CHECK (source_action IN ('confirm', 'reject', 'edit', 'delete')),
  original_content JSONB NOT NULL,   -- AI 萃取的原始內容
  final_content JSONB,               -- 使用者修改後的內容
  context_snippet TEXT,              -- 來源逐字稿片段
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 回饋記錄表（👍👎 和拒絕原因）
CREATE TABLE IF NOT EXISTS feedback_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('thumbs_up', 'thumbs_down', 'task_reject')),
  reason TEXT,                       -- 拒絕原因
  message_content TEXT,              -- 相關訊息內容
  context JSONB,                     -- 額外上下文
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_preferences_category ON user_preferences(category);
CREATE INDEX IF NOT EXISTS idx_preferences_confidence ON user_preferences(confidence DESC);
CREATE INDEX IF NOT EXISTS idx_preferences_active ON user_preferences(is_active);
CREATE INDEX IF NOT EXISTS idx_examples_type ON learning_examples(example_type);
CREATE INDEX IF NOT EXISTS idx_examples_action ON learning_examples(source_action);
CREATE INDEX IF NOT EXISTS idx_feedback_type ON feedback_logs(feedback_type);
CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback_logs(created_at DESC);

-- 為 user_preferences 表建立觸發器
DROP TRIGGER IF EXISTS update_preferences_updated_at ON user_preferences;
CREATE TRIGGER update_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 啟用 RLS
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_examples ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_logs ENABLE ROW LEVEL SECURITY;

-- 建立公開存取政策
CREATE POLICY "Allow public access to user_preferences" ON user_preferences FOR ALL USING (true);
CREATE POLICY "Allow public access to learning_examples" ON learning_examples FOR ALL USING (true);
CREATE POLICY "Allow public access to feedback_logs" ON feedback_logs FOR ALL USING (true);
