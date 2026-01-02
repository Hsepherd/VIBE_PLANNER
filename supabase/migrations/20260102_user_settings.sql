-- 使用者設定表（儲存 Google Calendar 連接資訊等）
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE,

  -- Google Calendar 連接
  google_connected BOOLEAN NOT NULL DEFAULT false,
  google_email TEXT,
  google_access_token TEXT,
  google_refresh_token TEXT,
  google_token_expiry TIMESTAMPTZ,

  -- 同步設定
  calendar_sync_enabled BOOLEAN NOT NULL DEFAULT false,
  calendar_sync_direction TEXT CHECK (calendar_sync_direction IN ('to_google', 'from_google', 'bidirectional')),
  calendar_id TEXT DEFAULT 'primary',
  last_sync_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_settings_google_connected ON user_settings(google_connected);

-- 建立觸發器更新 updated_at
DROP TRIGGER IF EXISTS update_user_settings_updated_at ON user_settings;
CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 啟用 RLS
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- RLS 政策：使用者只能存取自己的設定
CREATE POLICY "Users can view their own settings" ON user_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings" ON user_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings" ON user_settings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all settings" ON user_settings
  FOR ALL USING (auth.role() = 'service_role');

-- 在 tasks 表新增 Google Calendar 事件 ID 欄位（用於同步追蹤）
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS google_event_id TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS synced_to_google BOOLEAN DEFAULT false;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS last_google_sync_at TIMESTAMPTZ;

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_tasks_google_event_id ON tasks(google_event_id);
CREATE INDEX IF NOT EXISTS idx_tasks_synced_to_google ON tasks(synced_to_google);
