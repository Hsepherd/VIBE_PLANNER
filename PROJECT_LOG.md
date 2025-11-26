# Vibe Planner - 專案日誌

> 記錄所有開發過程、變更、問題與解決方案

---

## 2025-11-26

### 11:30 - 專案啟動

**事件**：開始討論 Vibe Planner 專案需求

**討論內容**：
- 使用者是營運主管，需要 AI 個人助理
- 核心需求：自動追蹤任務、解析會議逐字稿、進度報告
- 希望像「真人助理」一樣自然互動

**確定方向**：
- 建立 Web App（非使用現成工具如 Claude Pro）
- 本地運行優先
- 繁體中文介面

---

### 11:40 - PRD 初版完成

**事件**：完成產品需求文件 (PRD.md)

**包含內容**：
- 產品概述與願景
- 功能優先級（P1-P5）
- 技術架構設計
- 資料模型（Prisma Schema）
- API 設計
- UI 設計草稿
- 開發計劃與檔案結構

**功能優先級確定**：
| 優先級 | 功能 |
|-------|------|
| P1 | 逐字稿萃取、對話建議、Dashboard |
| P2 | 文字輸入自動整理 |
| P3 | 截圖上傳 AI 讀取 |
| P4 | 知識庫上傳 |
| P5 | 語音輸入 |

---

### 11:45 - 專案管理機制建立

**事件**：建立專案追蹤系統

**新增檔案**：
- `PROJECT_STATUS.md` - 專案進度追蹤
- `PROJECT_LOG.md` - 專案日誌（本文件）
- `.claude/commands/update.md` - 更新指令
- `.claude/commands/status.md` - 進度報告指令

**自定義指令**：
- `/update` - 更新專案進度與日誌
- `/status` - 報告專案進度

---

### 12:00 - PRD 技術選擇更新

**事件**：根據使用者需求和價格比較，更新技術選擇

**變更內容**：
1. **AI 模型**：Claude → GPT-4.1 Mini
   - 原因：價格最低（$0.40/$1.60 per 1M tokens）
   - 比 Claude Haiku 便宜 50%
   - 支援圖片識別、中文理解良好

2. **資料庫**：SQLite → Supabase
   - 原因：雲端同步、免費額度充足、未來擴展容易
   - 可跨裝置、內建 Auth、易與其他系統整合

**PRD 版本**：1.0 → 1.1

**參考資料**：
- [LLM API Pricing Comparison 2025](https://intuitionlabs.ai/articles/llm-api-pricing-comparison-2025)
- [Claude vs OpenAI Pricing](https://www.vantage.sh/blog/aws-bedrock-claude-vs-azure-openai-gpt-ai-cost)

---

### 17:35 - 🚀 部署到 Zeabur 完成

**事件**：成功部署 Vibe Planner 到 Zeabur

**線上網址**：https://vibeplanner.zeabur.app

**完成項目**：
- 簡化設定頁面（移除 API Key 顯示和手動同步按鈕）
- 推送到 GitHub (https://github.com/Hsepherd/VIBE_PLANNER)
- 在 Zeabur 建立服務並連結 GitHub
- 設定環境變數（OPENAI_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY）
- 設定自訂網域 vibeplanner.zeabur.app

**遇到問題**：
1. Next.js 專案在 `app/` 子目錄，Zeabur 無法識別
2. 移動檔案後出現 `app/app/` 雙層目錄問題
3. Next.js 16 的 Turbopack 根目錄偵測問題

**解決方案**：
1. 將 Next.js 專案移到根目錄
2. 修正目錄結構：`app/` 作為 App Router，`src/` 放元件和工具
3. 設定 `turbopack.root` 明確指定根目錄

**專案結構調整**：
- `app/` - Next.js App Router 頁面
- `src/components/` - React 元件
- `src/lib/` - 工具函數和 API

---

### 16:20 - ✅ 功能測試全部通過

**事件**：完成所有功能測試

**測試項目**：
- ✅ 設定頁面 - API Key 顯示（部分隱藏）
- ✅ 設定頁面 - Supabase URL 顯示
- ✅ AI 對話功能 - GPT-4.1 Mini 回應正常
- ✅ 雲端同步 - 上傳到 Supabase 成功
- ✅ 任務/專案 CRUD - 新增、刪除、修改正常

**新增功能**：
- 設定頁面 API Key 顯示/隱藏切換
- `/api/config` 端點取得設定狀態

**下一步**：部署到 Vercel

---

### 14:45 - ✅ Supabase Schema 建立完成

**事件**：在 Supabase Dashboard 成功執行 schema.sql

**完成內容**：
- projects 資料表
- tasks 資料表
- conversations 資料表
- api_usage 資料表
- 所有索引與觸發器
- Row Level Security 政策

**下一步**：測試雲端同步功能

---

### 12:10 - 🆕 MVP 核心功能完成

**事件**：完成 Vibe Planner MVP 的所有核心功能

**新增檔案**：

**基礎架構**
- `app/` - Next.js 14 專案
- `src/lib/supabase.ts` - Supabase 客戶端
- `src/lib/openai.ts` - OpenAI API 整合
- `src/lib/store.ts` - Zustand 狀態管理

**前端元件**
- `src/components/chat/` - 對話相關元件
  - `ChatWindow.tsx` - 對話視窗
  - `MessageBubble.tsx` - 訊息氣泡
  - `InputArea.tsx` - 輸入區域（含圖片上傳）
- `src/components/layout/Sidebar.tsx` - 側邊欄導航
- `src/components/ui/` - shadcn UI 元件

**頁面**
- `src/app/page.tsx` - 首頁（對話介面）
- `src/app/dashboard/page.tsx` - Dashboard
- `src/app/tasks/page.tsx` - 任務列表
- `src/app/projects/page.tsx` - 專案管理
- `src/app/settings/page.tsx` - 設定頁面

**API**
- `src/app/api/chat/route.ts` - 對話 API

**功能完成**：
- ✅ 對話式輸入
- ✅ 逐字稿萃取任務
- ✅ 截圖上傳與 AI 識別
- ✅ 任務管理（新增、完成、刪除）
- ✅ 專案管理
- ✅ Dashboard 進度追蹤
- ✅ 本地資料持久化 (localStorage)

**Build 結果**：成功編譯，無錯誤

---

## 變更記錄格式說明

每次更新請使用以下格式：

```markdown
### HH:MM - 標題

**事件**：簡述發生什麼事

**變更內容**：
- 修改了什麼
- 新增了什麼
- 刪除了什麼

**原因**：為什麼做這個變更

**影響**：這個變更影響了什麼

**問題**：（如有）遇到什麼問題

**解決方案**：（如有）如何解決
```

---

## 標籤說明

- 🆕 新功能
- 🐛 Bug 修復
- 🔧 重構/優化
- 📝 文件更新
- ⚠️ 重要變更
- 🚀 部署相關
