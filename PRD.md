# Vibe Planner - 產品需求文件 (PRD)

> **版本**：1.1
> **日期**：2025-11-26
> **狀態**：已確認

---

## 1. 產品概述

### 1.1 產品名稱
**Vibe Planner** - AI 驅動的個人超級助理

### 1.2 產品願景
打造一個「像真人助理一樣」的 AI 規劃工具。使用者只需用自然語言（文字、語音、截圖、逐字稿）與系統互動，AI 會自動整理任務、追蹤進度、給予建議，並隨著使用時間越來越了解使用者的工作模式。

### 1.3 目標使用者
- **主要使用者**：營運主管、專案經理、創業者
- **使用情境**：工作繁忙、需要同時追蹤多個專案、會議頻繁、容易遺忘待辦事項
- **痛點**：
  - 開會後忘記追蹤行動項目
  - 同時進行太多專案，容易迷失進度
  - 沒有時間手動整理待辦清單
  - 需要一個「懂我」的助理來提醒和建議

### 1.4 核心價值主張
| 傳統工具 | Vibe Planner |
|---------|--------------|
| 手動建立任務 | 貼上逐字稿，AI 自動萃取 |
| 需要學習操作介面 | 像聊天一樣自然對話 |
| 只是記錄工具 | 會給建議的智慧助理 |
| 每次都要重新說明背景 | 記住你的一切，越用越懂你 |

---

## 2. 功能規格

### 2.1 功能優先級總覽

| 優先級 | 功能 | MVP 包含 |
|-------|------|---------|
| P1 | 逐字稿萃取行動項目 | ✅ |
| P1 | 對話式建議 | ✅ |
| P1 | 進度追蹤 Dashboard | ✅ |
| P2 | 文字輸入 → 自動整理任務 | ✅ |
| P3 | 截圖上傳 → AI 讀取內容 | ✅ |
| P4 | 知識庫上傳（課程、資料） | Phase 2 |
| P5 | 語音輸入 → 轉文字 → 整理 | Phase 2 |

---

### 2.2 核心功能詳細規格

#### 2.2.1 【P1】逐字稿萃取行動項目

**功能描述**
使用者貼上會議逐字稿，AI 自動：
1. 識別所有行動項目（Action Items）
2. 識別負責人
3. 識別截止日期
4. 識別專案歸屬
5. 自動建立任務到系統

**輸入**
```
使用者貼上：
「...老闆說下週三之前要把小課程大綱完成，然後 Amy 負責腳本，
12/10 要交第一版，拍攝預計 12/15...」
```

**輸出**
```
AI 回應：
📋 已從會議紀錄萃取 3 個任務：

1. 小課程大綱
   - 負責人：你
   - 截止日：下週三 (12/4)
   - 專案：小課程製作

2. 腳本第一版
   - 負責人：Amy
   - 截止日：12/10
   - 專案：小課程製作

3. 拍攝
   - 負責人：待指派
   - 預計日：12/15
   - 專案：小課程製作

已加入追蹤，要調整任何內容嗎？
```

**驗收標準**
- [ ] 能正確識別 80% 以上的行動項目
- [ ] 能從上下文推斷截止日期
- [ ] 自動建立任務到資料庫
- [ ] 處理時間 < 10 秒

---

#### 2.2.2 【P1】對話式建議

**功能描述**
AI 不只是被動記錄，還會：
1. 主動給予建議
2. 分析優先級
3. 提醒可能遺漏的事項
4. 根據使用者的工作模式給予個人化建議

**對話範例**
```
使用者：我今天應該先做什麼？

AI：根據你目前的任務，建議優先處理：

🔴 緊急且重要
1. 小課程大綱（明天截止）
   → 建議花 2 小時專注完成

🟡 重要但不緊急
2. 審核老師影片
   → 可以安排在下午

💡 我注意到你上週的營運會議提到要追蹤廣告 ROAS，
   但還沒有相關任務，需要我幫你建立嗎？
```

**驗收標準**
- [ ] 能根據截止日和重要性排序
- [ ] 能記住過去對話內容並引用
- [ ] 回應時間 < 5 秒
- [ ] 建議具體且可執行

---

#### 2.2.3 【P1】進度追蹤 Dashboard

**功能描述**
視覺化顯示所有任務和專案的進度

**Dashboard 元素**
```
┌─────────────────────────────────────────────────────────┐
│                    📊 進度總覽                           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  本週概況                今日待辦                        │
│  ┌──────────┐           ┌──────────────────┐           │
│  │ 待處理 8  │           │ ☐ 小課程大綱      │           │
│  │ 進行中 3  │           │ ☐ 審核影片        │           │
│  │ 已完成 12 │           │ ☐ 回覆客戶信      │           │
│  └──────────┘           └──────────────────┘           │
│                                                         │
│  專案進度                                               │
│  ┌─────────────────────────────────────────┐           │
│  │ 小課程製作     ████████░░░░░░ 60%       │           │
│  │ Simple AI 系統 ██████████████░ 90%      │           │
│  │ 12月行銷活動   ████░░░░░░░░░░ 30%       │           │
│  └─────────────────────────────────────────┘           │
│                                                         │
│  即將到期                                               │
│  • 小課程大綱 - 明天                                    │
│  • 腳本第一版 - 12/10 (5天後)                           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**驗收標準**
- [ ] 即時顯示任務狀態統計
- [ ] 顯示專案進度百分比
- [ ] 顯示即將到期任務（7天內）
- [ ] 支援篩選（依專案、狀態、日期）
- [ ] 可直接在 Dashboard 完成任務

---

#### 2.2.4 【P2】文字輸入 → 自動整理任務

**功能描述**
使用者用自然語言輸入，AI 自動理解並建立任務

**輸入範例**
```
「下週三之前要完成提案，然後記得週五跟 Amy 開會討論行銷策略」
```

**輸出**
```
✅ 已建立 2 個任務：

1. 完成提案
   - 截止：下週三 (12/4)

2. 與 Amy 開會討論行銷策略
   - 日期：週五 (12/6)
   - 類型：會議

還有其他要補充的嗎？
```

---

#### 2.2.5 【P3】截圖上傳 → AI 讀取內容

**功能描述**
使用者上傳截圖（如：對話紀錄、行事曆、待辦清單截圖），AI 讀取並萃取資訊

**支援格式**
- PNG, JPG, JPEG, WebP
- 最大 10MB

**使用情境**
- LINE/Slack 對話截圖
- 行事曆截圖
- 其他 App 的待辦清單截圖
- 手寫筆記照片

---

### 2.3 Phase 2 功能（未來）

#### 知識庫上傳
- 上傳 PDF、文件、網頁連結
- AI 學習內容，成為顧問知識
- 查詢時可引用知識庫

#### 語音輸入
- 支援中文語音輸入
- 即時轉文字
- 自動萃取任務

#### 系統整合
- 串接工作室數據系統
- 自動帶入營收、廣告、諮詢數據
- 整合分析

---

## 3. 技術架構

### 3.1 技術棧

| 層級 | 技術 | 說明 |
|-----|------|-----|
| 前端框架 | Next.js 14 | App Router, Server Components |
| UI 元件 | Tailwind CSS + shadcn/ui | 快速開發、美觀 |
| AI 核心 | GPT-4.1 Mini (OpenAI) | 性價比最高（見下方比較） |
| 資料庫 | Supabase (PostgreSQL) | 雲端託管、即時同步、免費額度充足 |
| 狀態管理 | React Context / Zustand | 輕量級 |
| 部署 | 本地運行 (npm run dev) | Phase 1 本地開發 |

### 3.1.1 AI 模型選擇理由

經過價格與功能比較，**推薦使用 GPT-4.1 Mini**：

| 模型 | 輸入 (每百萬 tokens) | 輸出 (每百萬 tokens) | 圖片支援 | 推薦 |
|-----|---------------------|---------------------|---------|-----|
| GPT-4.1 Mini | $0.40 | $1.60 | ✅ | ⭐ **首選** |
| GPT-4.1 | $2.00 | $8.00 | ✅ | 備選 |
| Claude Haiku 3.5 | $0.80 | $4.00 | ✅ | 備選 |
| Claude Sonnet 4 | $3.00 | $15.00 | ✅ | 高品質需求 |

**選擇 GPT-4.1 Mini 原因**：
1. **價格最低**：比 Claude Haiku 便宜 50%
2. **功能足夠**：支援圖片識別、中文理解良好
3. **回應快速**：Mini 模型延遲低
4. **可隨時升級**：需要更高品質時切換到 GPT-4.1 或 Claude

**備註**：系統設計支援多模型切換，未來可根據需求調整。

### 3.1.2 資料庫選擇理由

**從 SQLite 改為 Supabase**：

| 特性 | SQLite | Supabase |
|-----|--------|----------|
| 設置難度 | 簡單 | 簡單 |
| 雲端同步 | ❌ | ✅ |
| 免費額度 | N/A | 500MB、50K 月請求 |
| 即時更新 | ❌ | ✅ Realtime |
| 未來擴展 | 困難 | 容易 |
| 多裝置 | ❌ | ✅ |

**選擇 Supabase 原因**：
1. 免費額度足夠個人使用
2. 未來可跨裝置同步
3. 內建 Auth（未來需要時）
4. 與現有工作室系統整合更容易

### 3.2 系統架構圖

```
┌─────────────────────────────────────────────────────────┐
│                      使用者介面                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │
│  │  對話介面   │ │  Dashboard  │ │  任務列表   │        │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘       │
└─────────┼───────────────┼───────────────┼───────────────┘
          │               │               │
          ▼               ▼               ▼
┌─────────────────────────────────────────────────────────┐
│                     API Routes                          │
│  /api/chat    /api/tasks    /api/projects              │
└─────────────────────────┬───────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  OpenAI API  │ │   Supabase   │ │  Supabase    │
│ (GPT-4.1 Mini)│ │  (PostgreSQL)│ │  Storage     │
└──────────────┘ └──────────────┘ └──────────────┘
```

### 3.3 資料模型

```prisma
// 專案
model Project {
  id          String   @id @default(uuid())
  name        String
  description String?
  status      String   @default("active") // active, completed, archived
  progress    Int      @default(0) // 0-100
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  tasks       Task[]
}

// 任務
model Task {
  id          String    @id @default(uuid())
  title       String
  description String?
  status      String    @default("pending") // pending, in_progress, completed
  priority    String    @default("medium") // low, medium, high, urgent
  dueDate     DateTime?
  assignee    String?
  projectId   String?
  project     Project?  @relation(fields: [projectId], references: [id])
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  completedAt DateTime?
}

// 對話歷史（AI 記憶）
model Conversation {
  id        String   @id @default(uuid())
  role      String   // user, assistant
  content   String
  metadata  String?  // JSON: 萃取的任務ID、相關專案等
  createdAt DateTime @default(now())
}

// 知識庫（Phase 2）
model Knowledge {
  id        String   @id @default(uuid())
  title     String
  content   String
  type      String   // document, course, note
  tags      String?  // JSON array
  createdAt DateTime @default(now())
}
```

---

## 4. 使用者介面設計

### 4.1 主要頁面

#### 首頁 - 對話介面
```
┌─────────────────────────────────────────────────────────┐
│  🎯 Vibe Planner                    [Dashboard] [任務]  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │ 👤 我剛開完營運會議，這是逐字稿...               │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │ 🤖 收到！我從會議紀錄中萃取了 5 個行動項目：      │ │
│  │                                                   │ │
│  │    1. ☐ 小課程大綱 (12/4)                        │ │
│  │    2. ☐ 腳本第一版 - Amy (12/10)                 │ │
│  │    ...                                           │ │
│  │                                                   │ │
│  │    已加入追蹤！需要調整嗎？                       │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │ 💬 輸入訊息... 或貼上逐字稿          [📎] [送出] │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

#### Dashboard 頁面
（參考 2.2.3 的設計）

#### 任務列表頁面
```
┌─────────────────────────────────────────────────────────┐
│  📋 任務列表           [+ 新任務] [篩選▼] [排序▼]      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  🔴 緊急                                               │
│  ├─ ☐ 小課程大綱              12/4   小課程製作       │
│  └─ ☐ 回覆客戶信              今天   --              │
│                                                         │
│  🟡 本週                                               │
│  ├─ ☐ 腳本第一版 @Amy         12/10  小課程製作       │
│  ├─ ☐ 審核老師影片            12/6   --              │
│  └─ ☐ 行銷策略會議            12/6   12月行銷活動    │
│                                                         │
│  ✅ 已完成 (12)                              [展開 ▼]  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 5. API 設計

### 5.1 主要 API 端點

| 方法 | 路徑 | 說明 |
|-----|------|-----|
| POST | `/api/chat` | 對話（含任務萃取） |
| GET | `/api/tasks` | 取得所有任務 |
| POST | `/api/tasks` | 建立任務 |
| PATCH | `/api/tasks/:id` | 更新任務 |
| DELETE | `/api/tasks/:id` | 刪除任務 |
| GET | `/api/projects` | 取得所有專案 |
| POST | `/api/projects` | 建立專案 |
| GET | `/api/dashboard` | Dashboard 統計資料 |
| POST | `/api/upload` | 上傳截圖 |

### 5.2 對話 API 詳細規格

**POST /api/chat**

Request:
```json
{
  "message": "使用者輸入的文字",
  "image": "base64 encoded image (optional)",
  "context": "transcript | general | task"
}
```

Response:
```json
{
  "reply": "AI 的回應文字",
  "extractedTasks": [
    {
      "title": "任務標題",
      "dueDate": "2024-12-04",
      "assignee": "Amy",
      "projectId": "xxx",
      "priority": "high"
    }
  ],
  "suggestions": [
    "你可能還需要追蹤...",
    "建議優先處理..."
  ]
}
```

---

## 6. 開發計劃

### 6.1 MVP 範圍（Phase 1）

**預計功能**
- [x] 專案設定與基礎架構
- [ ] 對話介面（文字輸入）
- [ ] Claude API 整合
- [ ] 逐字稿萃取功能
- [ ] 任務 CRUD
- [ ] 基本 Dashboard
- [ ] 截圖上傳與識別

**不包含**
- 語音輸入
- 知識庫
- 使用者登入
- 外部系統整合

### 6.2 檔案結構

```
vibe-planner/
├── app/
│   ├── page.tsx              # 首頁（對話介面）
│   ├── dashboard/
│   │   └── page.tsx          # Dashboard
│   ├── tasks/
│   │   └── page.tsx          # 任務列表
│   ├── api/
│   │   ├── chat/
│   │   │   └── route.ts      # 對話 API
│   │   ├── tasks/
│   │   │   └── route.ts      # 任務 API
│   │   ├── projects/
│   │   │   └── route.ts      # 專案 API
│   │   ├── dashboard/
│   │   │   └── route.ts      # Dashboard API
│   │   └── upload/
│   │       └── route.ts      # 上傳 API
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── chat/
│   │   ├── ChatWindow.tsx
│   │   ├── MessageBubble.tsx
│   │   └── InputArea.tsx
│   ├── dashboard/
│   │   ├── StatsCard.tsx
│   │   ├── ProjectProgress.tsx
│   │   └── UpcomingTasks.tsx
│   ├── tasks/
│   │   ├── TaskList.tsx
│   │   ├── TaskItem.tsx
│   │   └── TaskForm.tsx
│   └── ui/                   # shadcn components
├── lib/
│   ├── ai.ts                 # Claude API 封裝
│   ├── db.ts                 # Prisma client
│   ├── prompts.ts            # AI 提示詞
│   └── utils.ts
├── prisma/
│   └── schema.prisma
├── public/
├── .env.local                # API keys
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── PRD.md                    # 本文件
```

---

## 7. 成功指標

### 7.1 功能性指標
- 逐字稿任務萃取準確率 > 80%
- 對話回應時間 < 5 秒
- 系統穩定運行，無重大 Bug

### 7.2 使用者體驗指標
- 使用者能在 30 秒內開始對話
- 使用者能在 1 分鐘內看到萃取的任務
- Dashboard 載入時間 < 2 秒

---

## 8. 風險與緩解

| 風險 | 影響 | 緩解措施 |
|-----|------|---------|
| Claude API 費用過高 | 成本 | 優化 prompt、設定 token 上限 |
| 任務萃取不準確 | 體驗 | 允許使用者編輯、優化 prompt |
| 資料遺失 | 嚴重 | SQLite 定期備份 |
| 中文理解問題 | 體驗 | 選用 Claude（中文能力強） |

---

## 9. 附錄

### 9.1 環境變數

```env
# .env.local
OPENAI_API_KEY=your_openai_api_key_here
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 9.2 參考資源
- [OpenAI API 文件](https://platform.openai.com/docs)
- [Supabase 文件](https://supabase.com/docs)
- [Next.js 文件](https://nextjs.org/docs)
- [shadcn/ui](https://ui.shadcn.com/)

### 9.3 AI API 價格參考來源
- [LLM API Pricing Comparison 2025](https://intuitionlabs.ai/articles/llm-api-pricing-comparison-2025)
- [Claude vs OpenAI Pricing](https://www.vantage.sh/blog/aws-bedrock-claude-vs-azure-openai-gpt-ai-cost)

---

## 10. 版本歷史

| 版本 | 日期 | 變更 |
|-----|------|-----|
| 1.0 | 2025-11-26 | 初版 PRD |
| 1.1 | 2025-11-26 | 更新技術選擇：AI 改用 GPT-4.1 Mini、資料庫改用 Supabase |

---

**下一步**：開始實作 MVP。
