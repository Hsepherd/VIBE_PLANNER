-- ========================================
-- AI 學習偏好系統資料表（獨立執行）
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

-- 為 user_preferences 表建立觸發器（使用已存在的 update_updated_at_column 函數）
DROP TRIGGER IF EXISTS update_preferences_updated_at ON user_preferences;
CREATE TRIGGER update_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 啟用 RLS
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_examples ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_logs ENABLE ROW LEVEL SECURITY;

-- 建立公開存取政策（使用 IF NOT EXISTS 風格，避免重複錯誤）
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_preferences' AND policyname = 'Allow public access to user_preferences') THEN
    CREATE POLICY "Allow public access to user_preferences" ON user_preferences FOR ALL USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'learning_examples' AND policyname = 'Allow public access to learning_examples') THEN
    CREATE POLICY "Allow public access to learning_examples" ON learning_examples FOR ALL USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'feedback_logs' AND policyname = 'Allow public access to feedback_logs') THEN
    CREATE POLICY "Allow public access to feedback_logs" ON feedback_logs FOR ALL USING (true);
  END IF;
END
$$;
