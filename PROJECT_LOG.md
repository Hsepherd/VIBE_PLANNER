# Vibe Planner - 專案日誌

> 記錄所有開發過程、變更、問題與解決方案

---

## 2025-12-01

### 📅 Apple Calendar 風格行事曆

**事件**：全面改版行事曆頁面，參考 Apple Calendar 設計實作橫條式任務顯示

**新增功能**：

1. **任務橫條跨日顯示**
   - 多日任務顯示為橫向連續色條
   - 使用 CSS calc() 計算位置：`marginLeft: calc(${startCol} * (100% / 7))`
   - 根據開始日和截止日計算跨越天數

2. **專案色系統（淡色系）**
   - 10 種 Apple Calendar 風格淡色：天藍、玫瑰、琥珀、翠綠、紫羅蘭、橙、青、粉、萊姆、靛藍
   - 使用 Tailwind `-200` 後綴確保柔和色調
   - 包含背景色、文字色、圓點色三組搭配

3. **專案 Hash 色彩分配**
   - 使用字串 hash 函數確保同專案同顏色
   - 已完成任務自動變為灰色系

4. **UI 細節優化**
   - 小圓點圖示（`w-2 h-2 rounded-full`）
   - 任務條高度 22px（週視圖）、20px（月視圖）
   - 半透明邊框線（`border-gray-200/50`、`border-gray-200/30`）
   - 粗體日期標題（`font-bold text-gray-800`）
   - Hover 亮度變化（`hover:brightness-95`）

5. **限制顯示與展開**
   - 週視圖：顯示前 3 筆 + 「還有 X 項...」
   - 月視圖：顯示前 4 筆 + 「+X 更多」

**修改檔案**：
- `app/calendar/page.tsx` - 行事曆主頁面

**技術細節**：
| 項目 | 實作方式 |
|-----|---------|
| 色彩系統 | `projectColors` 陣列 + `getProjectColor()` hash 函數 |
| 橫條定位 | CSS calc() + marginLeft + width 計算 |
| 邊框淡化 | Tailwind opacity 修飾符 `/50`、`/30` |
| 響應高度 | 週視圖 22px、月視圖 20px |

**遇到問題與解決**：
1. **左側邊框樣式不符 Apple 風格** → 改為全背景色橫條
2. **任務條太窄** → 高度從預設提升到 22px
3. **邊框線分割感太重** → 使用半透明邊框 `/50`
4. **顏色與標題衝突** → 改用淡色系 `-200` 配色

---

### 🎨 ClickUp 風格任務列表 UI 優化

**事件**：全面優化任務列表頁面 UI，參考 ClickUp 風格進行改進

**新增功能**：

1. **群組收合功能**
   - 點擊群組標題可展開/收合該群組
   - 使用 `collapsedGroups` Set 追蹤收合狀態
   - ChevronRight/ChevronDown 圖示指示狀態

2. **欄位寬度可拖曳調整**
   - 負責人、截止日、優先級欄位可拖曳調整寬度
   - 最小 70px，最大 200px
   - 使用 mousedown/mousemove/mouseup 事件處理

3. **版面優化**
   - 移除欄位間的邊框線，視覺更簡潔
   - 行高調整為 h-12，增加可讀性
   - 圖示對齊修正（使用 flex items-center）

4. **日期格式優化**
   - 非今年的日期顯示完整年份（如 2024/12/25）
   - 今年日期只顯示月日（如 12/25）
   - 支援「今天」「明天」快捷顯示

5. **版面配置調整**
   - 搜尋/新增區域置頂
   - 分類標籤和排序選項在表頭上方
   - 任務表格緊接在下方

**修改檔案**：
- `app/tasks/page.tsx` - 任務列表主頁面

**技術細節**：
| 項目 | 實作方式 |
|-----|---------|
| 收合狀態 | `useState<Set<string>>(new Set())` |
| 欄位拖曳 | `resizing`/`resizeStartX`/`resizeStartWidth` 狀態 |
| 寬度範圍 | `Math.max(70, Math.min(200, newWidth))` |
| 日期格式 | `formatDueDate()` 判斷年份 |

**遇到問題與解決**：
1. **欄位拖曳方向反了** → 改為 `resizeStartX - e.clientX`（原本是相反）
2. **圖示未對齊** → 統一使用 `flex items-center gap-2` + `shrink-0`
3. **欄位間線條太明顯** → 移除 `border-l` 類別

---

## 2025-11-29

### 🎯 負責人判斷優化 + 快速修正功能

**事件**：解決 AI 任務萃取時負責人判斷錯誤的問題

**問題描述**：
1. 負責人分配不準確（如電訪名單任務分配給非電訪組成員）
2. 負責人填錯人（Karen 的任務被標為 Vicky）
3. 把沒發言的人設為負責人
4. 報告當成任務（只是報告進度，沒有後續行動）

**解決方案**：

1. **強化 Prompt 錯誤範例**
   - 加入 4 個具體的錯誤案例分析（含逐字稿範例）
   - 案例 1：提出需求者 ≠ 執行者
   - 案例 2：說「我有請 XX 分析」= 執行者
   - 案例 3：只有說「好，我來」的人才是負責人
   - 案例 4：沒人明確接任務時填 null
   - 新增 6 條「絕對不要這樣判斷」規則

2. **負責人快速修正 UI**
   - 任務卡片負責人 Badge 可點擊編輯
   - 任務詳情 Dialog 中也可編輯負責人
   - 使用 Popover 彈出輸入框
   - 顯示「👤 未指定」當沒有負責人時
   - 鉛筆圖示提示可編輯

3. **修正記錄到學習系統**
   - 用戶修改負責人後自動記錄到 `learning_examples` 表
   - 記錄 `correction_type: 'assignee'`、`old_value`、`new_value`
   - 保存原始對話脈絡 `sourceContext`
   - Console 輸出：`[學習] 記錄負責人修正: XX → YY`

**修改檔案**：
- `src/lib/openai.ts` - Prompt 強化（加入錯誤案例）
- `src/lib/store.ts` - 新增 `updatePendingTask()` 函數
- `src/components/chat/ChatWindow.tsx` - 負責人編輯 UI

**技術細節**：
| 項目 | 實作方式 |
|-----|---------|
| 錯誤範例 | 4 個具體案例 + 逐字稿 + ✅❌ 標示 |
| 編輯 UI | Popover + Input + 確認按鈕 |
| 學習記錄 | `recordNegativeExample()` + reason='user_corrected_assignee' |
| 狀態更新 | `updatePendingTask(groupId, taskIndex, { assignee })` |

---

### 🎯 任務選擇性加入功能

**事件**：優化任務確認流程，支援部分選擇和去重複

**需求描述**：
1. 用戶選擇部分任務加入時，未選中的任務應保留在待確認卡片中
2. 重新萃取時，已處理過的任務不應重複出現

**解決方案**：

1. **部分選擇保留**
   - 修改 `handleConfirmTasks()`：只移除選中的任務，未選中的保留
   - 修改 `addSingleTask()`：加入後從 pendingTasks 移除該任務
   - 修改 `skipSingleTask()`：跳過後從 pendingTasks 移除該任務
   - 自動調整選中索引（因為陣列會變短）

2. **任務去重機制**
   - 收集所有已處理任務的標題（來自 `processedTaskGroups`）
   - 收集目前待確認列表的任務標題（來自 `pendingTasks`）
   - 新萃取的任務與上述標題比對（忽略大小寫）
   - 過濾掉重複任務後，才合併到 pendingTasks

**修改檔案**：
- `src/components/chat/ChatWindow.tsx` - 任務確認邏輯
- `src/components/chat/InputArea.tsx` - 萃取時去重邏輯

---

### 🐛 待確認任務跨對話問題修復

**事件**：修復切換對話時，待確認任務卡片會跟到新對話的問題

**問題描述**：
- 用戶在對話 A 中萃取任務，產生待確認任務卡片
- 切換到對話 B 或建立新對話時，任務卡片會跟著出現
- 預期行為：待確認任務只應停留在原對話中

**解決方案**：
在 `ChatSessionContext.tsx` 中加入 `clearPendingTasks()` 呼叫：
1. `switchSession()` - 切換對話時清除待確認任務
2. `createNewSession()` - 建立新對話時清除待確認任務

**修改檔案**：
- `src/lib/ChatSessionContext.tsx` - 加入 clearPendingTasks 邏輯

---

### 🎨 任務詳情 Popup 大優化

**事件**：根據用戶回饋，全面優化任務詳情彈窗的 UI/UX

**問題清單**：
1. Popup 內容被截斷，無法看到完整資訊
2. 任務沒有智慧分組（電訪相關應分到電訪組）
3. 執行細節需要可編輯的 Checklist
4. 排版無重點，字體大小顏色都一樣

**解決方案**：

1. **修復內容截斷**
   - Dialog 改為 flex 布局：`overflow-hidden flex flex-col`
   - 內容區域可滾動：`flex-1 overflow-y-auto`
   - 底部按鈕固定：`shrink-0`
   - 彈窗尺寸加大：`max-w-3xl max-h-[90vh]`

2. **智慧分組功能**
   - 根據任務標題和描述的關鍵字自動推薦組別
   - 組別映射：
     - 電訪組：電訪、接通、電話、撥打、通話、名單、電銷
     - 業務組：業務、銷售、SOP、話術、成交、業績、客戶開發、報價
     - 行政組：行政、文件、報表、整理、歸檔、會議紀錄
     - 客服組：客服、服務、投訴、退款、售後
     - 行銷組：行銷、廣告、推廣、活動、促銷
   - 未分組任務顯示「💡 建議分到『XX組』」按鈕

3. **執行細節 Checklist**
   - 每個步驟前有可勾選的 checkbox
   - 顯示完成進度（如「2/5 完成」）
   - 已勾選項目有刪除線效果
   - Hover 顯示編輯按鈕，可修改步驟內容

4. **重點排版優化**
   - 任務摘要：藍色區塊 + 較大字體
   - 執行細節：綠色區塊 + Checklist
   - 會議脈絡：紫色區塊
   - 原文引用：琥珀色區塊 + 左側 4px 邊框 + 斜體引號
   - 每個區塊左側有彩色指示條

**修改檔案**：
- `app/tasks/page.tsx` - TaskDetailDialog 元件重構

**技術細節**：
| 項目 | 實作方式 |
|-----|---------|
| 智慧分組 | `suggestGroupFromContent()` 關鍵字匹配 |
| Checklist | `stepChecks` 狀態陣列 + checkbox 按鈕 |
| 可滾動內容 | flex 布局 + overflow-y-auto |
| 顏色區分 | 藍/綠/紫/琥珀色背景 + 左側圓條 |

---

## 2025-11-28

### 🧠 AI Few-shot 學習系統

**事件**：重新設計 AI 學習系統，改為類似 GPT/Manus 的 Few-shot Learning 架構

**問題背景**：
- 原本的學習系統使用規則式（關鍵字 → 動作）
- 用戶希望 AI 能從對話、指令、回饋中全面學習
- 需要顯示基底 Prompt 讓用戶了解 AI 的核心指令

**新增功能**：

1. **對話完整脈絡學習**
   - 記錄完整對話：逐字稿 → AI 萃取 → 用戶回饋 → 最終任務
   - 計算品質分數（確認/拒絕任務比例）
   - 自動識別高品質範例供 Few-shot 使用

2. **用戶指令學習**
   - 自動偵測用戶回覆中的指令（如「標題要精簡」）
   - 辨識模式：「要/不要/請」開頭、「一點」「一些」結尾
   - 儲存指令並在後續 Prompt 中注入

3. **Few-shot Prompt 生成**
   - 從最佳範例中選取 2-3 個作為示範
   - 注入用戶的偏好指令
   - 只在長篇逐字稿時啟用

4. **基底 Prompt 檢視器**
   - 設定頁面新增「基底 Prompt」卡片
   - 可切換檢視「會議逐字稿」和「一般對話」版本
   - 支援展開/收合和複製功能

**新增檔案**：
- `supabase/migrations/20241128_conversation_learnings.sql` - 新資料表 Schema
- `src/lib/supabase-learning.ts` - Supabase API 層
- `src/lib/few-shot-learning.ts` - Few-shot 學習核心邏輯
- `src/components/preferences/BasePromptViewer.tsx` - 基底 Prompt 檢視器

**修改檔案**：
- `app/api/chat/stream/route.ts` - 注入 Few-shot Prompt
- `src/components/chat/InputArea.tsx` - 從用戶回覆學習指令
- `src/components/chat/ChatWindow.tsx` - 記錄任務回饋完整脈絡
- `src/components/preferences/LearningStatus.tsx` - 更新 UI 顯示新統計
- `src/components/preferences/index.ts` - 匯出 BasePromptViewer
- `app/settings/page.tsx` - 加入基底 Prompt 卡片

**資料表**：
| 表名 | 用途 |
|-----|------|
| `conversation_learnings` | 儲存完整對話脈絡（輸入、AI 回應、任務、回饋、品質分數）|
| `user_instructions` | 儲存用戶的明確指令和偏好 |

**技術細節**：
| 項目 | 實作方式 |
|-----|---------|
| 指令偵測 | 正則表達式匹配「要/不要/請」等模式 |
| 品質分數 | `confirmed / (confirmed + rejected)` |
| Few-shot 選取 | 按品質分數降序，取前 2-3 筆 |
| Prompt 注入 | 只在逐字稿 > 300 字時觸發 |

**學習統計 UI**：
- 對話學習：記錄的完整對話數量
- 學習指令：用戶的明確指令數量
- 滿意度：用戶確認任務的比例
- 平均品質：所有對話的平均品質分數

---

### 🎯 Manus 風格側邊欄收合

**事件**：重新設計側邊欄收合/展開交互，參考 Manus 風格

**新增功能**：

1. **收合狀態**
   - Logo 區 hover 時隱藏 Logo，顯示展開箭頭（ChevronRight）
   - 點擊展開側邊欄
   - 導航圖示置中顯示（40x40px）

2. **展開狀態**
   - Logo 區右側 hover 顯示收合按鈕（ChevronLeft）
   - 點擊收合側邊欄
   - 完整顯示文字和導航項目

3. **動畫效果**
   - 全局 fade in/out 動畫（`transition-all duration-300`）
   - 圖示切換使用 opacity 過渡（`transition-opacity duration-200`）
   - 滑順的展開/收合體驗

**修改檔案**：
- `src/components/layout/Sidebar.tsx` - 主要邏輯
- `src/components/chat/ChatSessionList.tsx` - 新建對話按鈕置中

**技術細節**：
| 項目 | 實作方式 |
|-----|---------|
| Logo 切換 | `group/logo` + `group-hover/logo:opacity-0` |
| 收合按鈕 | `group/sidebar` + `group-hover/sidebar:opacity-100` |
| 圖示置中 | `justify-center w-10 h-10 mx-auto` |
| Logo 不變形 | `objectFit: 'contain'` |

**遇到問題**：
1. `groups is not defined` → 變數名稱應為 `availableGroups`
2. 收合時跑版 → 調整 padding 和 justify-center
3. Logo 變形 → 改用 `objectFit: 'contain'`

---

### 📝 任務卡片行內編輯

**事件**：改進任務列表頁面，讓任務卡片固定顯示所有欄位並支援行內編輯

**新增功能**：

1. **固定顯示欄位**
   - 截止日期、負責人、群組、標籤
   - 無資料時顯示佔位文字（如「無日期」）

2. **行內編輯**
   - 日期：Popover 日曆選擇器
   - 負責人：DropdownMenu 選擇
   - 群組：DropdownMenu 選擇
   - 標籤：DropdownMenu 多選
   - 優先級：點擊徽章切換

**修改檔案**：
- `app/tasks/page.tsx` - TaskItem 元件重構

---

### 🎨 側邊欄 UI 優化

**事件**：改善側邊欄使用體驗，包含對話標題顯示、可調整寬度、收合按鈕優化

**新增功能**：

1. **對話標題完整顯示**
   - 從單行截斷改為雙行顯示（`line-clamp-2`）
   - 滑鼠懸停顯示完整標題 tooltip
   - 操作按鈕（置頂、編輯、刪除）移至右上角，hover 時顯示

2. **側邊欄可拖曳調整寬度**
   - 最小寬度：64px（收合狀態）
   - 預設寬度：224px
   - 最大寬度：400px
   - 拖曳右邊界可調整寬度
   - 寬度設定儲存到 localStorage

3. **收合按鈕優化**
   - 移至側邊欄下方（`bottom-20`）
   - 平常隱藏，滑鼠移到側邊欄時才顯示
   - 使用 Tailwind group hover（`group/sidebar`）

**修改檔案**：
- `src/components/chat/ChatSessionList.tsx` - 標題顯示和操作按鈕
- `src/components/layout/Sidebar.tsx` - 可調整寬度和收合按鈕

**技術細節**：
| 項目 | 實作方式 |
|-----|---------|
| 雙行標題 | Tailwind `line-clamp-2 leading-snug` |
| 拖曳調整 | React mouse events + localStorage |
| hover 顯示 | Tailwind `group/sidebar` + `group-hover/sidebar:opacity-100` |

---

### 🧠 AI 長對話記憶系統

**事件**：解決「prompt is too long」錯誤，實作智慧截斷 + 摘要機制

**問題背景**：
- 長會議逐字稿（1-3小時）導致 token 超過限制
- AI 會「失憶」忘記之前的對話內容

**解決方案**：

1. **模型升級：GPT-4.1**
   - 從 GPT-5（128K tokens）升級到 GPT-4.1（1M tokens）
   - 價格相同，容量提升 8 倍
   - 修改所有 API 端點使用 `gpt-4.1`

2. **智慧截斷機制**
   - 字數門檻：50,000 字（約 5 萬字）
   - 保留最近 4 則完整訊息
   - 超過門檻時自動觸發摘要

3. **高品質摘要 API**
   - 摘要長度：1000-1500 字
   - 保留內容：會議資訊、任務清單、人物角色、決議原因、數字/日期、風險、待追蹤事項
   - 摘要快取：同 session 不重複摘要

4. **UI 設計**
   - 對話框完整保留所有歷史訊息
   - 只有送給 API 的訊息會被摘要處理
   - 記憶體使用量指示器（超過 70% 時顯示）

**新增檔案**：
- `app/api/chat/summarize/route.ts` - 摘要 API 端點
- `src/lib/useConversationSummary.ts` - 摘要管理 Hook

**修改檔案**：
- `app/api/chat/route.ts` - 模型改為 gpt-4.1
- `app/api/chat/stream/route.ts` - 模型改為 gpt-4.1
- `src/lib/openai.ts` - 模型改為 gpt-4.1
- `src/lib/store.ts` - 定價更新為 gpt-4.1
- `src/components/chat/InputArea.tsx` - 整合摘要功能 + 記憶體指示器

**技術細節**：
| 項目 | 數值 |
|-----|------|
| 字數門檻 | 50,000 字 |
| 保留訊息數 | 4 則 |
| 摘要長度 | 1000-1500 字 |
| 模型 | gpt-4.1 |
| Context Window | 1,000,000 tokens |

**測試結果**：
- ✅ GPT-4.1 回應正常
- ✅ Streaming API 正常運作
- ✅ 無 "prompt is too long" 錯誤

---

## 2025-11-27

### 👤 使用者管理後台 + 驗證系統

**事件**：實作完整的使用者驗證系統和管理後台

**使用者驗證系統**：
1. **Supabase Auth 整合**
   - 支援 Email/Password 和 Google OAuth 登入
   - 登入/註冊頁面（/login, /signup）
   - AuthProvider 全局驗證狀態管理
   - useAuth Hook 提供驗證相關功能

2. **RLS 資料隔離**
   - 每個使用者只能看到自己的任務
   - tasks 表加入 user_id 欄位
   - Row Level Security 政策確保資料安全

3. **路由保護**
   - 未登入使用者自動導向登入頁
   - 側邊欄顯示使用者資訊和登出按鈕

**使用者管理後台**：
1. **Admin API**（使用 service_role key）
   - `/api/admin/users` - GET（列表）、POST（新增）
   - `/api/admin/users/[id]` - GET、PATCH、DELETE

2. **管理頁面**（/admin/users）
   - 管理員與一般使用者分開顯示
   - 表格排序功能（名稱、Email、建立日期、最後登入）
   - 新增/編輯使用者 Dialog
   - 刪除確認 Dialog
   - Toast 成功訊息

3. **權限控制**
   - 只有管理員（xk4xk4563022@gmail.com）可存取
   - 側邊欄只對管理員顯示「使用者管理」連結

**新增檔案**：
- `app/login/page.tsx` - 登入頁面
- `app/signup/page.tsx` - 註冊頁面
- `app/auth/callback/route.ts` - OAuth 回調
- `app/admin/users/page.tsx` - 使用者管理頁面
- `app/api/admin/users/route.ts` - 使用者 API
- `app/api/admin/users/[id]/route.ts` - 單一使用者 API
- `src/components/AuthProvider.tsx` - 驗證 Provider
- `src/lib/useAuth.ts` - 驗證 Hook
- `src/lib/supabase-client.ts` - 客戶端 Supabase
- `src/lib/supabase-server.ts` - 伺服器端 Supabase
- `src/lib/supabase-admin.ts` - Admin Supabase（service_role）

**修改檔案**：
- `src/components/layout/Sidebar.tsx` - 管理員連結
- `src/components/layout/ClientLayout.tsx` - AuthProvider

---

### 🎯 任務萃取 Prompt 優化 + UI 改版

**事件**：優化 AI 萃取功能，讓 description 更詳細；任務詳情改為 Popup 卡片

**Prompt 優化內容**：
1. **字數要求**：從 150-200 字提升到 300-500 字
2. **結構化格式**：必須包含四個部分
   - 【任務摘要】2-3 句話說明任務
   - 【執行細節】3-6 個編號步驟
   - 【會議脈絡】2-3 段背景說明
   - 【原文引用】3-5 段逐字稿引用
3. **時間戳必填**：原文引用必須從逐字稿複製時間戳（如【15:30】）
4. **maxTokens**：從 8000 提升到 16000（長篇逐字稿）

**UI 改版內容**：
1. **任務詳情改為 Popup 卡片**（shadcn Dialog）
2. **自動解析 description**：分割四個區塊並分別顯示
3. **樣式優化**：
   - 任務摘要：文字段落
   - 執行細節：編號列表
   - 會議脈絡：分段顯示
   - 原文引用：引用框樣式（左側邊框）
4. **頂部資訊**：優先級徽章、負責人、截止日、專案
5. **底部按鈕**：關閉、標記完成

**修改檔案**：
- `src/lib/openai.ts` - Prompt 優化
- `app/tasks/page.tsx` - 任務詳情 Popup 卡片
- `src/components/ui/dialog.tsx` - 新增 shadcn Dialog 元件

---

### 🧠 AI 學習偏好系統完成

**事件**：實作完整的 AI 學習偏好系統，讓 AI 能記住用戶習慣並自動優化

**新增功能**：
1. **回饋收集機制**
   - 每個 AI 訊息下方顯示 👍👎 按鈕
   - 取消勾選任務時顯示拒絕原因選擇器（太瑣碎、已完成、非我負責、太模糊）
   - 確認/取消任務時自動記錄正面/負面範例

2. **學習邏輯**
   - 從回饋中推斷偏好規則（關鍵字 → 動作）
   - 置信度計算（正面次數、負面次數）
   - 條件觸發：只有長篇逐字稿（>300字且含會議關鍵字）才注入偏好

3. **設定頁面**
   - 顯示學習進度、回饋統計
   - 顯示已學習的規則列表
   - 重置學習功能

**新增檔案**：
- `supabase/ai-learning-schema.sql` - 資料庫架構（3個表）
- `src/lib/preferences.ts` - 偏好系統核心邏輯
- `src/lib/supabase-preferences.ts` - Supabase API
- `src/components/feedback/FeedbackButtons.tsx` - 回饋按鈕
- `src/components/feedback/RejectReasonSelector.tsx` - 拒絕原因選擇器
- `src/components/preferences/LearningStatus.tsx` - 學習狀態卡片

**修改檔案**：
- `src/components/chat/ChatWindow.tsx` - 加入學習記錄
- `src/components/chat/MessageBubble.tsx` - 加入回饋按鈕
- `app/api/chat/stream/route.ts` - 加入偏好 Prompt 注入
- `app/settings/page.tsx` - 加入學習狀態元件
- `src/lib/store.ts` - 加入 lastInputContext 狀態

**資料表**：
- `user_preferences` - 儲存學習到的規則
- `learning_examples` - 正面/負面範例
- `feedback_logs` - 👍👎 回饋記錄

**遇到問題**：
1. 缺少 Progress 元件 → 執行 `npx shadcn@latest add progress`
2. Supabase policy 重複建立錯誤 → 建立獨立 SQL 檔案，使用 IF NOT EXISTS

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
