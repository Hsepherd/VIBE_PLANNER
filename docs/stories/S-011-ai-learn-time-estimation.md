# Story S-011: AI 學習時間預估模型

> **Story ID**: S-011
> **Epic**: EPIC-002 AI 智慧排程 Phase 2
> **估計點數**: 8
> **優先級**: P2
> **依賴**: S-010

---

## User Story

**作為** 使用者
**我想要** AI 從我過去完成任務的實際時間中學習
**以便** 未來的時間預估更加準確

---

## 驗收標準 (Acceptance Criteria)

### AC1: 收集學習資料
```gherkin
Given 使用者完成一個任務並記錄實際時間
When 資料儲存時
Then 系統收集該任務的學習資料
And 包含：標題、描述、類型、專案、預估、實際時間
```

### AC2: 預估時考慮歷史
```gherkin
Given 使用者有 10+ 個已完成任務的歷史資料
When AI 預估新任務時間
Then AI 參考相似任務的歷史資料
And 調整預估時間
And 顯示「根據你的歷史紀錄調整」提示
```

### AC3: 預估準確度提升
```gherkin
Given 使用 AI 學習後的預估
When 與實際時間比較
Then 預估準確度比 Phase 1 提升 20%
```

### AC4: 個人化調整係數
```gherkin
Given 某使用者完成任務總是比預估多 30%
When AI 為該使用者預估時間
Then 自動乘以 1.3 的調整係數
```

### AC5: 專案/類型特化
```gherkin
Given 使用者在「小課程」專案的任務都比預估多 50%
When AI 預估「小課程」專案的新任務
Then 使用該專案的特化係數
```

---

## 學習模型設計

### 資料收集

```typescript
interface LearningData {
  userId: string;
  taskId: string;
  title: string;
  description?: string;
  projectId?: string;
  projectName?: string;
  taskType: 'focus' | 'background';
  priority: 'high' | 'medium' | 'low';
  tags?: string[];
  estimatedMinutes: number;
  actualMinutes: number;
  completedAt: Date;
}
```

### 學習特徵

```typescript
interface UserTimePattern {
  userId: string;

  // 全局調整係數
  globalMultiplier: number;  // 例如 1.3 = 用戶通常多花 30%

  // 專案特化係數
  projectMultipliers: Map<string, number>;

  // 任務類型係數
  taskTypeMultipliers: {
    focus: number;
    background: number;
  };

  // 優先級係數
  priorityMultipliers: {
    high: number;
    medium: number;
    low: number;
  };

  // 關鍵字模式（例如「簡報」類任務的係數）
  keywordPatterns: Array<{
    keywords: string[];
    multiplier: number;
    confidence: number;
  }>;

  // 樣本數和更新時間
  sampleCount: number;
  lastUpdatedAt: Date;
}
```

### 預估演算法

```typescript
async function estimateWithLearning(
  task: Task,
  userId: string
): Promise<EstimateResult> {
  // 1. 取得基礎預估（Phase 1 的 AI 預估）
  const baseEstimate = await estimateTaskTime(task);

  // 2. 取得使用者的學習模型
  const userPattern = await getUserTimePattern(userId);

  if (!userPattern || userPattern.sampleCount < 10) {
    // 資料不足，使用基礎預估
    return baseEstimate;
  }

  // 3. 計算調整係數
  let multiplier = userPattern.globalMultiplier;

  // 專案特化
  if (task.projectId && userPattern.projectMultipliers[task.projectId]) {
    multiplier = userPattern.projectMultipliers[task.projectId];
  }

  // 關鍵字匹配
  for (const pattern of userPattern.keywordPatterns) {
    if (matchesKeywords(task.title, pattern.keywords)) {
      multiplier = pattern.multiplier;
      break;
    }
  }

  // 4. 應用調整
  const adjustedMinutes = Math.round(baseEstimate.estimatedMinutes * multiplier);

  return {
    ...baseEstimate,
    estimatedMinutes: adjustedMinutes,
    isLearningAdjusted: true,
    adjustmentReason: `根據你過去 ${userPattern.sampleCount} 個任務的紀錄調整`,
    originalEstimate: baseEstimate.estimatedMinutes,
  };
}
```

---

## 資料庫設計

```sql
-- 使用者時間模式表
CREATE TABLE user_time_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,

  -- 全局係數
  global_multiplier DECIMAL DEFAULT 1.0,

  -- 專案係數 (JSONB)
  project_multipliers JSONB DEFAULT '{}',

  -- 任務類型係數
  focus_multiplier DECIMAL DEFAULT 1.0,
  background_multiplier DECIMAL DEFAULT 1.0,

  -- 關鍵字模式
  keyword_patterns JSONB DEFAULT '[]',

  -- 統計
  sample_count INTEGER DEFAULT 0,
  avg_accuracy DECIMAL,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(user_id)
);

-- 索引
CREATE INDEX idx_user_time_patterns_user_id ON user_time_patterns(user_id);

-- RLS
ALTER TABLE user_time_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own patterns"
  ON user_time_patterns FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own patterns"
  ON user_time_patterns FOR UPDATE
  USING (auth.uid() = user_id);
```

---

## 技術任務

- [ ] 建立 `user_time_patterns` 表
- [ ] 實作學習資料收集（任務完成時觸發）
- [ ] 實作係數計算邏輯
- [ ] 修改預估 function 加入學習調整
- [ ] 實作專案特化係數
- [ ] 實作關鍵字模式識別
- [ ] 建立學習模型更新 cron job
- [ ] UI 顯示「根據歷史調整」提示
- [ ] 預估準確度追蹤和報告

---

## 學習更新觸發

```typescript
// 每次任務完成時更新學習模型
async function onTaskCompleted(task: TaskWithActualTime) {
  if (!task.actualMinutes || !task.estimatedMinutes) return;

  const accuracy = task.actualMinutes / task.estimatedMinutes;

  // 更新全局係數（移動平均）
  await updateGlobalMultiplier(task.userId, accuracy);

  // 如果有專案，更新專案係數
  if (task.projectId) {
    await updateProjectMultiplier(task.userId, task.projectId, accuracy);
  }

  // 更新樣本數
  await incrementSampleCount(task.userId);
}
```

---

## 測試案例

| # | 測試 | 預期結果 |
|---|------|----------|
| 1 | 新使用者（無歷史） | 使用基礎預估 |
| 2 | 有 5 個歷史任務 | 使用基礎預估（資料不足） |
| 3 | 有 15 個歷史任務 | 使用學習調整 |
| 4 | 用戶總是多花 30% | 預估乘以 1.3 |
| 5 | 特定專案多花 50% | 該專案預估乘以 1.5 |
| 6 | 「簡報」類任務 | 匹配關鍵字係數 |

---

## 成功指標

- 預估準確度（|實際-預估|/實際）從 Phase 1 的 ~40% 提升到 ~25%
- 使用者回報預估「更準確」的比例 > 70%

---

## Definition of Done

- [ ] 學習資料收集正常
- [ ] 係數計算邏輯正確
- [ ] 預估整合學習調整
- [ ] 專案特化係數運作
- [ ] 關鍵字模式運作
- [ ] UI 顯示調整提示
- [ ] 預估準確度提升可驗證
- [ ] 測試案例通過
