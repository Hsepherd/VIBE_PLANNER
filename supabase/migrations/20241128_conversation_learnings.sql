-- 對話學習資料表 - 儲存完整的對話上下文用於 AI Few-shot Learning
-- 這個表格記錄：逐字稿 → AI 萃取 → 用戶回饋/指令 的完整流程

CREATE TABLE IF NOT EXISTS conversation_learnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 原始輸入：用戶發送給 AI 的逐字稿或訊息
  input_content TEXT NOT NULL,
  input_type VARCHAR(50) DEFAULT 'transcript', -- transcript, chat, instruction

  -- AI 萃取結果：原始的 JSON 回應
  ai_response JSONB,
  extracted_tasks JSONB, -- AI 萃取出的任務列表

  -- 用戶回饋與指令
  user_feedback_type VARCHAR(50), -- positive, negative, correction, instruction
  user_feedback_content TEXT, -- 用戶的文字回覆或指令

  -- 最終結果：用戶確認/修改後的任務
  final_tasks JSONB, -- 用戶最終確認的任務（可能經過修改）

  -- 學習重點：從這次互動中學到什麼
  learning_points TEXT[], -- 例如：['用戶不喜歡太短的標題', '這類會議通常有10+任務']

  -- 學習品質評估
  quality_score DECIMAL(3,2) DEFAULT 0.5, -- 0-1，根據用戶回饋調整
  is_useful_example BOOLEAN DEFAULT true, -- 是否適合作為 few-shot 範例

  -- 元資料
  session_id VARCHAR(100), -- 對話 session ID
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 用戶指令學習表 - 儲存用戶的明確指令和偏好
CREATE TABLE IF NOT EXISTS user_instructions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 指令內容
  instruction_text TEXT NOT NULL, -- 用戶說的話，例如「標題要更精簡」
  instruction_type VARCHAR(50), -- style, content, filter, priority, other

  -- 關聯的對話學習
  conversation_learning_id UUID REFERENCES conversation_learnings(id),

  -- 學習到的規則（從指令中提取）
  learned_rule TEXT, -- 例如：「任務標題應控制在 15 字以內」

  -- 置信度和啟用狀態
  confidence DECIMAL(3,2) DEFAULT 0.7,
  is_active BOOLEAN DEFAULT true,

  -- 元資料
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_conversation_learnings_created
  ON conversation_learnings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_learnings_quality
  ON conversation_learnings(quality_score DESC)
  WHERE is_useful_example = true;
CREATE INDEX IF NOT EXISTS idx_conversation_learnings_session
  ON conversation_learnings(session_id);
CREATE INDEX IF NOT EXISTS idx_user_instructions_type
  ON user_instructions(instruction_type)
  WHERE is_active = true;

-- 更新 updated_at 的觸發器
CREATE OR REPLACE FUNCTION update_conversation_learnings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_conversation_learnings_updated ON conversation_learnings;
CREATE TRIGGER trigger_conversation_learnings_updated
  BEFORE UPDATE ON conversation_learnings
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_learnings_updated_at();

-- RLS 政策（如果需要）
-- ALTER TABLE conversation_learnings ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE user_instructions ENABLE ROW LEVEL SECURITY;
