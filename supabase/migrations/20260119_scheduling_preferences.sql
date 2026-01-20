-- Migration: 排程偏好學習系統
-- Story: S-009 - 學習排程偏好
-- 日期: 2026-01-19

-- 1. 建立排程偏好表
CREATE TABLE IF NOT EXISTS scheduling_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 工作時間偏好
  work_start_time TIME DEFAULT '09:00',           -- 工作開始時間
  work_end_time TIME DEFAULT '18:00',             -- 工作結束時間
  lunch_start_time TIME DEFAULT '12:00',          -- 午休開始
  lunch_end_time TIME DEFAULT '13:00',            -- 午休結束

  -- 專注時段偏好
  focus_period_start TIME DEFAULT '09:00',        -- 專注時段開始（處理重要任務）
  focus_period_end TIME DEFAULT '12:00',          -- 專注時段結束

  -- 排程限制
  max_daily_hours NUMERIC(4,2) DEFAULT 6.0,       -- 每日最大工作時數
  min_task_gap_minutes INTEGER DEFAULT 15,        -- 任務間隔分鐘數
  max_tasks_per_day INTEGER DEFAULT 8,            -- 每日最大任務數

  -- 週間偏好（JSON 格式，可設定每天不同）
  -- 格式: { "monday": { "enabled": true, "start": "09:00", "end": "18:00" }, ... }
  weekly_schedule JSONB DEFAULT '{
    "monday": { "enabled": true },
    "tuesday": { "enabled": true },
    "wednesday": { "enabled": true },
    "thursday": { "enabled": true },
    "friday": { "enabled": true },
    "saturday": { "enabled": false },
    "sunday": { "enabled": false }
  }'::jsonb,

  -- 優先級時段偏好
  -- 格式: { "urgent": "morning", "high": "morning", "medium": "afternoon", "low": "anytime" }
  priority_time_preferences JSONB DEFAULT '{
    "urgent": "morning",
    "high": "morning",
    "medium": "afternoon",
    "low": "anytime"
  }'::jsonb,

  -- 學習統計
  learned_from_modifications INTEGER DEFAULT 0,    -- 從用戶修改學習的次數
  learned_from_instructions INTEGER DEFAULT 0,     -- 從明確指令學習的次數
  last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

  UNIQUE(user_id)
);

-- 2. 建立排程偏好學習記錄表（記錄學習來源）
CREATE TABLE IF NOT EXISTS scheduling_preference_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 學習來源
  source_type VARCHAR(50) NOT NULL,               -- 'modification' | 'instruction' | 'rejection'
  source_context TEXT,                            -- 學習的上下文（對話內容或操作描述）

  -- 學習內容
  preference_key VARCHAR(100) NOT NULL,           -- 偏好欄位名稱
  old_value TEXT,                                 -- 舊值
  new_value TEXT,                                 -- 新值

  -- 信心度
  confidence NUMERIC(3,2) DEFAULT 0.5,            -- 0.0 - 1.0

  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. 建立索引
CREATE INDEX IF NOT EXISTS idx_scheduling_preferences_user_id
  ON scheduling_preferences(user_id);

CREATE INDEX IF NOT EXISTS idx_scheduling_preference_logs_user_id
  ON scheduling_preference_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_scheduling_preference_logs_source_type
  ON scheduling_preference_logs(source_type);

-- 4. 建立 RLS 政策
ALTER TABLE scheduling_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduling_preference_logs ENABLE ROW LEVEL SECURITY;

-- 用戶只能存取自己的排程偏好
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own scheduling_preferences'
  ) THEN
    CREATE POLICY "Users can view own scheduling_preferences"
      ON scheduling_preferences FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own scheduling_preferences'
  ) THEN
    CREATE POLICY "Users can insert own scheduling_preferences"
      ON scheduling_preferences FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own scheduling_preferences'
  ) THEN
    CREATE POLICY "Users can update own scheduling_preferences"
      ON scheduling_preferences FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own scheduling_preferences'
  ) THEN
    CREATE POLICY "Users can delete own scheduling_preferences"
      ON scheduling_preferences FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- 用戶只能存取自己的學習記錄
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own scheduling_preference_logs'
  ) THEN
    CREATE POLICY "Users can view own scheduling_preference_logs"
      ON scheduling_preference_logs FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own scheduling_preference_logs'
  ) THEN
    CREATE POLICY "Users can insert own scheduling_preference_logs"
      ON scheduling_preference_logs FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 5. 建立自動更新 last_updated_at 的觸發器
CREATE OR REPLACE FUNCTION update_scheduling_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_scheduling_preferences_updated_at
  ON scheduling_preferences;

CREATE TRIGGER trigger_update_scheduling_preferences_updated_at
  BEFORE UPDATE ON scheduling_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_scheduling_preferences_updated_at();

-- 6. 註解
COMMENT ON TABLE scheduling_preferences IS '用戶排程偏好設定（AI 學習）';
COMMENT ON TABLE scheduling_preference_logs IS '排程偏好學習記錄';

COMMENT ON COLUMN scheduling_preferences.focus_period_start IS '專注時段開始，適合處理高優先級任務';
COMMENT ON COLUMN scheduling_preferences.priority_time_preferences IS '不同優先級任務的偏好時段：morning/afternoon/evening/anytime';
COMMENT ON COLUMN scheduling_preferences.weekly_schedule IS '每週排程設定，可停用週末或設定不同時間';
