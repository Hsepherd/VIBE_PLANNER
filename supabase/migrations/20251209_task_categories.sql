-- 任務分類知識庫
-- 用於儲存任務名稱與類別的對應關係，支援學習功能

-- 建立分類知識庫表
CREATE TABLE IF NOT EXISTS task_category_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pattern TEXT NOT NULL,           -- 任務名稱模式（關鍵字或完整名稱）
  category TEXT NOT NULL,          -- 分類名稱
  match_type TEXT NOT NULL DEFAULT 'exact',  -- 匹配類型: exact（完全匹配）, contains（包含）, starts_with（開頭）
  priority INTEGER DEFAULT 0,      -- 優先級（數字越大越優先）
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 同一用戶不能有重複的 pattern
  UNIQUE(user_id, pattern)
);

-- 建立分類定義表（用戶可以自訂分類）
CREATE TABLE IF NOT EXISTS task_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,              -- 分類名稱
  color TEXT NOT NULL DEFAULT '#9CA3AF',  -- 顏色
  icon TEXT DEFAULT 'circle',      -- 圖標名稱
  sort_order INTEGER DEFAULT 0,    -- 排序順序
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- 同一用戶不能有重複的分類名稱
  UNIQUE(user_id, name)
);

-- 啟用 RLS
ALTER TABLE task_category_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_categories ENABLE ROW LEVEL SECURITY;

-- RLS 政策：用戶只能存取自己的資料
CREATE POLICY "Users can manage own category mappings" ON task_category_mappings
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own categories" ON task_categories
  FOR ALL USING (auth.uid() = user_id);

-- 更新時間觸發器
CREATE OR REPLACE FUNCTION update_task_category_mappings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_task_category_mappings_timestamp
  BEFORE UPDATE ON task_category_mappings
  FOR EACH ROW
  EXECUTE FUNCTION update_task_category_mappings_updated_at();

-- 索引
CREATE INDEX IF NOT EXISTS idx_task_category_mappings_user_id ON task_category_mappings(user_id);
CREATE INDEX IF NOT EXISTS idx_task_category_mappings_pattern ON task_category_mappings(pattern);
CREATE INDEX IF NOT EXISTS idx_task_categories_user_id ON task_categories(user_id);
