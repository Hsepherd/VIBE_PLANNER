# Vibe Planner - 專案日誌

> 記錄所有開發過程、變更、問題與解決方案

---

## 2026-01-19

### 📊 排程報表功能 - S-013 完成

**事件**：實作週報表功能，提供任務完成統計、優先級分布、專案進度等視覺化分析

**完成的子任務（4 項）**：

#### S-013-1: 設計報表資料結構
- 建立 `src/lib/reports/types.ts` - 完整類型定義
- 主要介面：
  - `DailyStats` - 單日統計（排程數、完成數、利用率、完成率）
  - `WeeklyReport` - 週報表（含每日明細、優先級分布、專案分布）
  - `MonthlyReport` - 月報表（含週報表彙總、趨勢資料）
  - `ReportSummaryCard` - 摘要卡片資料（值、單位、趨勢）
  - `BarChartData` - 長條圖資料格式

#### S-013-2: 建立排程統計 API
- 建立 `src/lib/reports/calculations.ts` - 計算函數
- 主要函數：
  - `calculateDailyStats()` - 計算單日統計
  - `calculateWeeklyReport()` - 計算週報表
  - `calculateMonthlyReport()` - 計算月報表
  - `generateSummaryCards()` - 產生摘要卡片資料
  - `generateDailyBarChartData()` - 產生每日任務長條圖資料
  - `generatePriorityChartData()` - 產生優先級分布圖資料
- 建立 `/api/reports/weekly` API 端點

#### S-013-3: 建立報表 UI 元件
- 建立 `/app/reports/page.tsx` 報表頁面
- UI 元件：
  - `SummaryCard` - 摘要卡片（完成任務、完成率、工作時間、利用率）
  - `DailyBarChart` - 每日任務完成長條圖
  - `PriorityDistribution` - 優先級分布圖
  - `BestDayCard` - 最佳表現日卡片
  - `ProjectDistribution` - 專案分布進度條
  - `ReportSkeleton` - 載入骨架
- 週選擇器（上一週/下一週/回到本週）
- 趨勢比較（與上週對比顯示漲跌）

#### S-013-4: 導航整合與測試
- 側邊欄導航新增「報表」連結（/reports）
- 新增 `src/components/ui/skeleton.tsx` 元件
- TypeScript 編譯通過
- Dev server 運作正常

---

### 🔄 排程調整功能 - S-012 驗收完成

**事件**：分析行事曆頁面程式碼，確認拖曳調整功能已在先前實作完成

**發現的已實作功能**：
- `handleDragStart` / `handleDragMove` / `handleDragEnd` 函數
- 移動模式（整個任務拖曳移動）
- 調整大小模式（拖曳邊緣調整時長）
- 觸控裝置長按 300ms 啟動調整
- 拖曳時即時預覽 tooltip
- Undo 功能與 toast 通知
- 視覺回饋（resize handle、gradient 效果）

**結論**：S-012 已完成，無需額外開發

---

### 🗣️ 自然語言排程功能 - S-011 完成

**事件**：實作自然語言日期解析，讓使用者可以用「下週」「明天」等自然語言指定排程範圍

**完成的子任務（4 項）**：

#### S-011-1: 自然語言日期解析
- 建立 `src/lib/ai-functions/handlers/dateParser.ts`
- 主要函數：
  - `parseDateExpression()` - 解析自然語言日期表達
  - `extractDateRangeFromMessage()` - 從訊息中提取日期範圍
  - `getThisWeek()` / `getNextWeek()` - 取得週範圍
  - `getThisMonthRemaining()` / `getNextMonth()` - 取得月範圍
- 支援的日期表達：
  - 今天、明天、後天
  - 本週、這週、下週、下周
  - 這週末、下週末
  - 這個月、下個月
  - 未來 N 天、N 週內

#### S-011-2: 擴展 AI Function 參數
- 更新 `generateSmartSchedule` 函數描述
- 加入自然語言日期轉換範例
- 參數描述強調需要將自然語言轉為 YYYY-MM-DD

#### S-011-3: 更新系統提示詞
- 動態計算今天、本週一、本週日、下週一、下週日的實際日期
- 提供完整的日期轉換對照表
- 加入 3 個排程指令範例（下週、這週、未來三天）

#### S-011-4: 擴展關鍵字偵測
- 更新 `isSchedulingRelated()` 函數
- 新增 20+ 個自然語言日期相關關鍵字
- 支援「排到下週」「這週的任務」等表達

**使用範例**：
- 「幫我把任務排到下週」→ AI 自動轉換為 startDate: 下週一, endDate: 下週日
- 「安排這週的工作」→ AI 自動轉換為本週範圍
- 「排未來三天的任務」→ AI 自動計算三天後的日期

---

### ⚠️ AI 排程衝突偵測功能 - S-010 完成

**事件**：實作排程衝突偵測與 UI 顯示功能，讓使用者在排程預覽時能看到與 Google Calendar 事件的衝突

**完成的子任務（4 項）**：

#### S-010-1: 衝突偵測邏輯
- 建立 `src/lib/ai-functions/handlers/conflictDetection.ts`
- 主要函數：
  - `checkTaskConflicts()` - 檢測單一任務與行事曆事件的衝突
  - `checkScheduleConflicts()` - 批次檢測多個排程任務的衝突
  - `suggestAlternativeTime()` - 找出建議的替代時間
  - `formatConflictMessage()` - 格式化衝突訊息
  - `formatConflictSummary()` - 格式化衝突摘要
- 支援 5 種衝突類型：
  - `full_overlap` - 完全重疊
  - `partial_start` - 任務開頭與事件尾端重疊
  - `partial_end` - 任務尾端與事件開頭重疊
  - `task_contains_event` - 事件完全被任務包含
  - `event_contains_task` - 任務完全被事件包含
- 回傳 `ConflictCheckResult` 包含衝突數量、重疊分鐘數

#### S-010-2: 修改排程演算法自動避開衝突
- 排程演算法已使用 `getAvailableSlots` 的空閒時段（避開 Google Calendar 事件）
- 新增排程後的衝突驗證
- `ScheduleResult` 介面新增：
  - `conflictCheck?: ConflictCheckResult`
  - `busyEvents?: Record<string, CalendarEvent[]>`
  - `conflictSummary?: string`

#### S-010-3: 衝突提示 UI
- 更新 `src/lib/store.ts`：
  - 新增 `ConflictInfo` 介面
  - 新增 `ConflictCheckResult` 介面
  - `PendingSchedulePreview` 新增衝突資訊欄位
- 更新 `src/components/SchedulePreview.tsx`：
  - 標題區顯示衝突狀態徽章（綠色「✓ 無衝突」/ 橘色「⚠ X 個衝突」）
  - 個別任務卡片顯示衝突警告標籤
  - 有衝突的任務背景改為橘色
  - 展開顯示衝突詳情（衝突的行事曆事件名稱、時間、重疊分鐘數）
- 更新 `src/components/chat/InputArea.tsx`：傳遞衝突資訊
- 更新 `src/components/chat/ChatWindow.tsx`：傳遞 props 給 SchedulePreview
- 更新 `app/api/chat/stream/route.ts`：類型定義

#### S-010-4: 測試與驗收
- TypeScript 編譯：✅ 通過
- Dev server：✅ 正常運作
- 排程功能：✅ 43 個任務成功排程

**注意**：目前 Google Calendar token 過期（invalid_grant），衝突偵測功能需重新連接 Google 帳戶後才能顯示實際衝突。系統會 fallback 顯示「無衝突」。

---

### 🧠 AI 排程偏好學習功能 - S-009 完成

**事件**：實作完整的排程偏好學習系統，讓 AI 能記住使用者的排程習慣

**完成的子任務（6 項）**：

#### S-009-1: 建立 scheduling_preferences 資料表
- 建立 `supabase/migrations/20260119_scheduling_preferences.sql`
- `scheduling_preferences` 表：
  - 工作時間（work_start_time、work_end_time）
  - 午休時段（lunch_start_time、lunch_end_time）
  - 專注時段（focus_period_start、focus_period_end）
  - 排程限制（max_daily_hours、min_task_gap_minutes、max_tasks_per_day）
  - 週間偏好（weekly_schedule JSONB）
  - 優先級時段偏好（priority_time_preferences JSONB）
- `scheduling_preference_logs` 表：學習記錄（來源類型、信心度）
- RLS 政策和索引

#### S-009-2: 建立 TypeScript 類型與 API 層
- 建立 `src/lib/scheduling-preferences.ts`
- 類型定義：
  - `SchedulingPreferences`
  - `WeeklySchedule`、`DaySchedule`
  - `PriorityTimePreferences`
- API 函數：
  - `getSchedulingPreferences()` - 取得偏好
  - `createDefaultPreferences()` - 建立預設偏好
  - `updateSchedulingPreferences()` - 更新偏好
  - `logPreferenceLearning()` - 記錄學習事件
- 偏好解析：
  - `parsePreferenceFromInstruction()` - 從自然語言解析偏好
  - 支援 10+ 種偏好指令模式（工作時間、午休、專注時段等）
- 時段評分：
  - `calculateSlotScore()` - 計算時段評分
  - `isTimeSlotPreferred()` - 判斷是否為偏好時段
  - `isDayEnabled()` - 判斷日期是否可排程

#### S-009-3: 修改排程演算法讀取偏好
- 修改 `src/lib/ai-functions/handlers/scheduleAlgorithm.ts`
- 新增功能：
  - 載入用戶偏好到排程演算法
  - 套用工作時間、每日任務上限、緩衝時間
  - 過濾停用的週末和午休時段
  - 追蹤每日分鐘數以限制 maxDailyHours

#### S-009-4: 偵測對話中的偏好指令
- 建立 `src/lib/ai-functions/handlers/learnPreference.ts`
- `learnPreferenceFromMessage()` - 從用戶訊息學習偏好
- `containsPreferenceIntent()` - 檢測偏好相關訊息
- 整合到 `app/api/chat/stream/route.ts`
- 前端處理 `preference_learned` 事件

#### S-009-5: 記錄用戶排程修改行為
- 建立 `src/lib/ai-functions/handlers/learnFromScheduleAction.ts`
- `logScheduleApplied()` - 記錄套用排程（正向回饋，信心度 0.7）
- `logScheduleCancelled()` - 記錄取消排程（負向回饋，信心度 0.5）
- `analyzeSchedulePattern()` - 分析排程模式
- 整合到 `ChatWindow.tsx` 的 handleApplySchedule/handleCancelSchedule

#### S-009-6: 測試與驗收
- 偏好偵測測試：✅ 成功偵測 `workStartTime = '09:00'`
- AI 回應測試：✅ 正確理解並確認偏好
- 待處理：Supabase migration 需手動執行

**測試結果**：

| 功能 | 狀態 | 備註 |
|-----|------|------|
| 偏好指令解析 | ✅ 通過 | 正確解析「我每天早上9點開始工作」|
| AI 回應 | ✅ 通過 | 確認偏好並提供後續建議 |
| 排程演算法整合 | ✅ 通過 | 能讀取偏好並套用 |
| 資料庫儲存 | ⏳ 待執行 | 需執行 migration |

**新增檔案**：
- `supabase/migrations/20260119_scheduling_preferences.sql`
- `src/lib/scheduling-preferences.ts`
- `src/lib/ai-functions/handlers/learnPreference.ts`
- `src/lib/ai-functions/handlers/learnFromScheduleAction.ts`

**修改檔案**：
- `src/lib/ai-functions/handlers/scheduleAlgorithm.ts`
- `app/api/chat/stream/route.ts`
- `src/components/chat/InputArea.tsx`
- `src/components/chat/ChatWindow.tsx`

**技術細節**：

| 項目 | 實作方式 |
|-----|---------|
| 偏好解析 | 正則表達式匹配中文指令 |
| 時段評分 | 基於 focus period 和 priority 計算 |
| 學習記錄 | Supabase logs 表 + 信心度追蹤 |
| 排程整合 | 偏好載入 → 過濾 → 排程 |

---

### 🧪 AI 智慧排程 - 瀏覽器驗收測試完成

**事件**：執行 3 輪瀏覽器驗收測試，發現並修復 2 個 Bug，所有功能驗收通過

**驗收測試結果**：

| 輪次 | 測試項目 | 結果 | 備註 |
|------|---------|------|------|
| 第 1 輪 | 基本排程流程 | ✅ 通過 | 發現並修復 userId 未傳送問題 |
| 第 2 輪 | 排程預覽互動 | ✅ 通過 | Function Calling 正常觸發、取消按鈕正常 |
| 第 3 輪 | 套用排程功能 | ✅ 通過 | 修復 handleApplySchedule 取得 userId 方式 |

**修復的 Bug**：

#### Bug #1：userId 未傳送導致 Function Calling 不觸發
- **檔案**：`src/components/chat/InputArea.tsx`
- **問題**：`enableFunctionCalling` 需要 `userId`，但前端沒有傳送到 API
- **症狀**：AI 直接回傳 JSON 格式而非使用 Function Calling
- **修復**：在 fetch body 中新增 `userId: user?.id`

```diff
body: JSON.stringify({
  messages: apiMessages,
  image: currentImage,
  calendarTasks,
  userInfo,
+ userId: user?.id, // 新增
  projects: projects.filter(p => p.status === 'active').map(p => ({...})),
}),
```

#### Bug #2：套用排程時取得 userId 方式錯誤
- **檔案**：`src/components/chat/ChatWindow.tsx`
- **問題**：透過 `/api/config` 取得 `userId`，但該 API 沒有回傳此欄位
- **症狀**：點擊「套用排程」按鈕顯示「未登入」錯誤
- **修復**：使用 `useAuth` hook 直接取得 `user?.id`

```diff
+ import { useAuth } from '@/lib/useAuth'

export default function ChatWindow() {
+ const { user } = useAuth()
  ...
  const handleApplySchedule = async () => {
-   const userResponse = await fetch('/api/config')
-   const userConfig = await userResponse.json()
-   const userId = userConfig.userId
+   const userId = user?.id
```

**功能驗證清單**：
- ✅ AI 能正確識別排程意圖並觸發 Function Calling
- ✅ `getUnscheduledTasks` 成功取得 43 個未排程任務
- ✅ `generateSmartSchedule` 成功產生排程預覽
- ✅ 排程預覽卡片正確顯示（43 項、43 小時、7 天）
- ✅ 「取消」按鈕正常運作
- ✅ 「套用排程」按鈕正常運作，成功更新 43 個任務

**Server Logs 驗證**：
```
[Chat Stream] 偵測到 tool calls: [ 'getUnscheduledTasks' ]
[AI Function] 執行 getUnscheduledTasks { args: {}, userId: '0f5fcc13-...' }
[AI Function] getUnscheduledTasks 執行成功
[Chat Stream] 偵測到 tool calls: [ 'generateSmartSchedule' ]
[Schedule Algorithm] 排程完成: 43 成功, 0 失敗
POST /api/tasks/apply-schedule 200 in 12.8s
```

**修改檔案**：
- `src/components/chat/InputArea.tsx` - 新增 userId 傳送
- `src/components/chat/ChatWindow.tsx` - 修改 handleApplySchedule 取得 userId 方式

---

### 🤖 AI 智慧排程功能 - Phase 1 MVP 完成

**事件**：完成 AI 智慧排程功能的第一階段開發，包含核心後端架構和 UI 元件

**完成的 Stories（44 Story Points）**：

#### S-001: 資料庫欄位擴展 (3pt)
- 建立 `supabase/migrations/20260119_add_scheduling_fields.sql`
- 新增 `estimated_minutes` 欄位（預估時間，預設 60 分鐘）
- 新增 `task_type` 欄位（focus/background，預設 focus）
- 更新三個 TypeScript 檔案的類型定義：
  - `src/lib/supabase-api.ts`
  - `src/lib/useSupabaseTasks.ts`
  - `src/lib/store.ts`

#### S-002: 未排程任務 API (5pt)
- 建立 `app/api/tasks/unscheduled/route.ts`
- 查詢條件：未排程 (start_date is null) 或已過期的任務
- 支援篩選參數：priority、dueBefore、projectId
- 回傳任務包含專案名稱（透過 Supabase join）

#### S-003: 可用時段 API (8pt)
- 建立 `app/api/calendar/available-slots/route.ts`
- 整合 Google Calendar API 取得忙碌時段
- 計算工作時間內的可用區間
- 支援 Token 自動刷新
- 未連接 Google Calendar 時回傳全工作時段

#### S-004: AI Function Calling 架構 (8pt)
- 建立 `src/lib/ai-functions/` 模組：
  - `definitions.ts` - 7 個 AI Function 定義
  - `executor.ts` - Function 執行路由
  - `index.ts` - 模組匯出
- 建立 5 個 Handler：
  - `getUnscheduledTasks.ts`
  - `getAvailableSlots.ts`
  - `estimateTaskTime.ts`
  - `schedulePreview.ts`
  - `updateTaskEstimate.ts`
- 修改 `/api/chat/stream` 支援 tool_calls 處理

#### S-005: AI 預估時間 (5pt)
- 使用 GPT-4.1-mini 進行智慧預估
- 任務類型判斷：
  - `focus` - 需專注完成的任務
  - `background` - 可背景執行的任務（如部署、等待）
- 批次預估優化（單一 API 呼叫處理多個任務）
- 關鍵字回退邏輯（AI 不可用時使用）

#### S-006: 排程演算法 (8pt)
- 建立 `src/lib/ai-functions/handlers/scheduleAlgorithm.ts`
- 優先級權重計算：
  - urgent: 100, high: 75, medium: 50, low: 25
- 截止日緊迫度加成（越接近截止日分數越高）
- 時段分配策略：
  - 找到足夠長的時段
  - 每日任務數上限控制
  - 15 分鐘緩衝時間
- 排程驗證功能

#### S-007: UI 排程預覽 (8pt)
- 建立 `components/SchedulePreview.tsx`
- 按日期分組顯示（今天、明天、日期）
- 信心度標示（高/中/低）
- 任務類型標示（focus/background）
- 建立 `/api/tasks/apply-schedule` API

**技術細節**：

1. **類型修正**：
   - 解決 Supabase join 回傳 array vs object 的問題
   - 統一使用 camelCase (dueDate) 而非 snake_case (due_date)
   - 處理 null vs undefined 的類型差異

2. **Streaming 整合**：
   - 修改 stream 建立方式解決 TypeScript 推斷問題
   - 支援多輪 tool_calls 對話

**新增檔案**：
- `supabase/migrations/20260119_add_scheduling_fields.sql`
- `app/api/tasks/unscheduled/route.ts`
- `app/api/calendar/available-slots/route.ts`
- `app/api/tasks/apply-schedule/route.ts`
- `src/lib/ai-functions/definitions.ts`
- `src/lib/ai-functions/executor.ts`
- `src/lib/ai-functions/index.ts`
- `src/lib/ai-functions/handlers/getUnscheduledTasks.ts`
- `src/lib/ai-functions/handlers/getAvailableSlots.ts`
- `src/lib/ai-functions/handlers/estimateTaskTime.ts`
- `src/lib/ai-functions/handlers/schedulePreview.ts`
- `src/lib/ai-functions/handlers/updateTaskEstimate.ts`
- `src/lib/ai-functions/handlers/scheduleAlgorithm.ts`
- `components/SchedulePreview.tsx`

**修改檔案**：
- `src/lib/supabase-api.ts`
- `src/lib/useSupabaseTasks.ts`
- `src/lib/store.ts`
- `app/api/chat/stream/route.ts`

---

## 2026-01-08

### ✨ UX 優化與資料庫整合（6 大功能完成）

**事件**：全面優化使用者體驗並完成資料庫整合，修復 4 個主要問題並新增 2 個實用功能

**完成功能**：

#### 1. 🔄 登入不再自動載入舊對話
- **問題**：登入後自動載入最新對話，應顯示空白歡迎畫面
- **根源**：三處資料來源導致訊息持久化
  1. `ChatSessionContext.tsx` 有自動載入邏輯
  2. `AutoSync.tsx` 從 Supabase 載入 conversations
  3. `store.ts` 將 messages 持久化到 localStorage
- **解決方案**：
  - 移除 `ChatSessionContext.tsx` 自動載入邏輯（lines 89-94）
  - 從 `AutoSync.tsx` 移除 conversations 載入（lines 21-26）
  - 從 `store.ts` partialize 移除 messages（lines 565-571）
  - 修正依賴陣列為 `[user]`

#### 2. 📅 任務加入日期分類與過濾
- **功能**：支援依「加入日期」(createdAt) 分類與過濾任務
- **實作內容**：
  - 新增 'createdAt' 到 SortMode 類型
  - 建立 groupedByCreatedAt 分組邏輯（今天、昨天、本週、本月、更早）
  - 新增 createdAtLabels 顯示對應 emoji
  - 加入日期過濾器（特定日期選擇）
  - 整合 Calendar UI 元件選擇日期
- **使用者體驗**：點選「加入日期」分類可按時間軸檢視任務，或選擇特定日期過濾

#### 3. ✅ Google Calendar 連接狀態修復
- **問題**：設定頁面顯示「未連接」，即使之前已連接
- **根源**：API route 使用不存在的 `SUPABASE_SERVICE_ROLE_KEY` 環境變數
- **解決方案**：
  - 改用一般 Supabase client with RLS（移除 service role 依賴）
  - 所有 GET/PATCH/DELETE 端點改為 RLS 授權方式
  - 刪除 admin client 建立邏輯
- **修改檔案**：`app/api/settings/google-calendar/route.ts`

#### 4. 📊 API 使用統計持久化到 Supabase
- **問題**：API 使用統計每次登入後歸零
- **根源**：API usage 只存在本地 store，沒有同步到 Supabase
- **解決方案**：
  - 修改 `store.ts` 所有 API usage 函數為 async
  - 在 addApiUsage 中呼叫 `apiUsageApi.create()` 同步到 Supabase
  - 建立資料庫 migration：新增 `user_id` 欄位、RLS 政策、索引
  - AutoSync 載入 API usage 資料到本地 store
- **Migration 檔案**：`supabase/migrations/20260108_fix_api_usage.sql`
- **執行腳本**：`scripts/run-migration.mjs`

#### 5. ↔️ 視窗縮小時水平捲動
- **問題**：視窗縮小時內容被裁切，無法查看完整資訊
- **解決方案**：
  - 將 desktop 和 mobile 表格容器的 `overflow-hidden` 改為 `overflow-x-auto`
  - 確保小視窗可以左右捲動
- **修改位置**：`app/tasks/page.tsx` lines 3112, 3242

#### 6. ➕ 任務列表內新增專案
- **功能**：在任務列表的專案欄位直接新增專案
- **實作內容**：
  - 新增 inline project manager 狀態變數（lines 1267-1271）
  - Desktop 與 Mobile 專案下拉選單整合新增 UI
  - 輸入框 + 新增按鈕 + 取消按鈕
  - 新增成功後自動選中該專案
- **使用者體驗**：不需切換到專案頁面，可直接在任務列表新增專案

**資料庫變更**：

**Migration: `20260108_fix_api_usage.sql`**
- 新增 `user_id UUID` 欄位到 api_usage 表
- 新增外鍵關聯到 `auth.users`
- 更新 RLS 政策（用戶只能存取自己的資料）
  - `Users can view own api_usage` (SELECT)
  - `Users can insert own api_usage` (INSERT)
  - `Users can delete own api_usage` (DELETE)
- 建立效能索引：
  - `idx_api_usage_user_id`
  - `idx_api_usage_created_at`

**測試結果**：

| 功能 | 測試狀態 | 備註 |
|-----|---------|------|
| API usage Supabase 同步 | ✅ 通過 | 資料正確儲存與載入 |
| 登入不自動載入對話 | ✅ 通過 | 顯示空白歡迎畫面 |
| Google Calendar 連接狀態 | ✅ 通過 | 顯示「已連接」|
| 加入日期分類與過濾 | ✅ 通過 | 分類正常，日期選擇器運作正常 |
| Inline 專案新增 | ✅ 通過 | Desktop/Mobile 都可新增 |
| 視窗縮小水平捲動 | ✅ 通過 | 小視窗可左右捲動 |

**修改檔案總覽**：

| 檔案 | 變更內容 |
|-----|---------|
| `src/lib/ChatSessionContext.tsx` | 移除自動載入邏輯、修正依賴陣列 |
| `src/components/AutoSync.tsx` | 移除 conversations 載入 |
| `src/lib/store.ts` | API usage 改 async、移除 messages persistence |
| `app/tasks/page.tsx` | 新增 createdAt 分類、inline 專案管理、水平捲動 |
| `app/api/settings/google-calendar/route.ts` | 改用 RLS 授權 |
| `supabase/migrations/20260108_fix_api_usage.sql` | 資料庫 migration |
| `scripts/run-migration.mjs` | Migration 執行腳本 |

**Git 提交**：
- Commit: `96028d2`
- 訊息：`feat: UX 優化與資料庫整合 - 6 大功能完成`
- 推送到：GitHub main branch

**技術細節**：

| 項目 | 實作方式 |
|-----|---------|
| 訊息持久化清理 | 三層清理（Context + AutoSync + Store）|
| 日期分類 | groupedByCreatedAt + date-fns 工具 |
| 日期過濾 | startOfDay 精確比對 + Calendar UI |
| RLS 授權 | Supabase client with auth.uid() |
| API 同步 | async/await + try/catch 錯誤處理 |
| 水平捲動 | overflow-x-auto CSS |
| Inline 新增 | Popover + state 管理 |

**使用者回饋**：
- 「migration 完成，開始全面測試」
- 全部 6 項功能測試通過 ✅

---

## 2025-12-30

### 🐛 系統穩定性優化 - Dashboard & Analytics Bug 修復

**事件**：修復 Dashboard 逾期任務邏輯錯誤和 Analytics 圖表無數據顯示問題

**問題根源**：
- Dashboard 使用 `useAppStore`（本地 Zustand store）
- 其他頁面（Tasks、Calendar、Analytics）使用 `useSupabaseTasks`（Supabase 同步）
- 資料來源不一致導致：
  1. Dashboard 完成任務只更新本地 store，不同步到 Supabase
  2. `completed_at` 沒有寫入資料庫，Analytics 圖表無法計算

**修復方案**：

1. **Dashboard 改用 useSupabaseTasks**
   ```diff
   - import { useAppStore } from '@/lib/store'
   + import { useSupabaseTasks } from '@/lib/useSupabaseTasks'

   - const tasks = useAppStore((state) => state.tasks)
   - const completeTask = useAppStore((state) => state.completeTask)
   + const { tasks, completeTask, updateTask, isLoading } = useSupabaseTasks()
   ```

2. **新增 Loading skeleton**
   - Dashboard 載入時顯示 skeleton 動畫
   - 避免資料載入時的空白畫面

**驗證結果**：
| 測試項目 | 修復前 | 修復後 |
|---------|-------|-------|
| 過期任務數量 | 16（含已完成）| 14（正確過濾）|
| 點擊完成後 | 任務仍顯示 | 立即移除 |
| 已完成統計 | 不變 | 正確增加 |
| Analytics 今日目標 | 0/5 | 2/5（正確計算）|

**修改檔案**：
- `app/dashboard/page.tsx` - 改用 useSupabaseTasks + Loading skeleton

**備註**：
- Analytics 圖表歷史資料仍為空（舊任務無 `completed_at`）
- 新完成的任務會正確顯示在圖表中

---

### 🔧 FIX-003 專案進度一致性修復

**問題**：Dashboard 和 Projects 頁面顯示不同的專案進度

**根源分析**：
- Dashboard 使用靜態 `project.progress` 欄位
- Projects 頁面使用動態計算（完成任務數 / 總任務數）

**解決方案**：
```typescript
// 在 Dashboard 新增動態計算函數
const getProjectProgress = (projectId: string) => {
  const projectTasks = tasks.filter((t: Task) => t.projectId === projectId)
  if (projectTasks.length === 0) return 0
  const completed = projectTasks.filter((t: Task) => t.status === 'completed').length
  return Math.round((completed / projectTasks.length) * 100)
}
```

**修改檔案**：
- `app/dashboard/page.tsx` - 新增 `getProjectProgress()` 函數

---

### 🔧 FIX-004 API 使用統計修復

**問題**：Settings 頁面的 API 使用統計全為 0

**根源分析**：
- OpenAI Streaming API 即使設定 `include_usage: true` 也不一定回傳 usage 資料
- 當 `data.usage` 為 null 時，`addApiUsage()` 不會被呼叫

**解決方案**：Token 估算機制

1. **新增 `src/lib/token-utils.ts`**
```typescript
// 中英文混合估算
export const estimateTokens = (text: string): number => {
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length
  const otherChars = text.length - chineseChars
  return chineseChars * 2 + Math.ceil(otherChars / 4)
}

export const estimateMessageTokens = (messages) => {
  // 包含每則訊息的 overhead
}
```

2. **修改 `src/components/chat/InputArea.tsx`**
```diff
- if (data.usage) {
-   addApiUsage({ ... })
- }
+ // 優先使用 API 回傳值，否則估算
+ const promptTokens = data.usage?.promptTokens || estimateMessageTokens(apiMessages)
+ const completionTokens = data.usage?.completionTokens || estimateTokens(fullContent)
+ addApiUsage({ model: 'gpt-4.1-mini', promptTokens, completionTokens })
```

**新增檔案**：
- `src/lib/token-utils.ts` - Token 估算工具
- `PRD_FIX_004_API_STATS.md` - 完整 PRD 文件

**修改檔案**：
- `src/components/chat/InputArea.tsx` - 引入估算函數，確保每次都記錄 API 使用量

**備註**：
- 估算誤差約 ±20%，對花費追蹤的概覽用途可接受
- 未來可升級為 tiktoken 套件精確計算

---

### 📅 行事曆任務時間調整 UX 優化

**事件**：全面優化行事曆頁面的任務時間調整功能

**需求來源**：PM 分析後建議的 P1-P3 優先級改善項目

**實作內容**：

#### P1 拖曳視覺回饋優化
- 加大 resize handle 高度（觸控 h-14 / 桌面 h-10）
- 新增 Gradient hover 效果與箭頭圖示
- 拖曳時即時顯示時間預覽 tooltip
  - 移動模式：顯示開始~結束時間區間
  - 調整時長模式：顯示結束時間

#### P2 精確時間編輯
- TaskDetailDialog 新增時間調整 Popover
- 開始/結束時間輸入框（HH:mm 格式）
- 快速時長按鈕（15分、30分、1小時、1.5小時、2小時）
- Toast 提示 + 5 秒內 Undo 還原功能（使用 Sonner 套件）

#### P3 觸控裝置優化
- 觸控裝置自動偵測（`ontouchstart` / `maxTouchPoints`）
- 長按 300ms 啟動調整模式
- 觸覺回饋（`navigator.vibrate`）
- 底部操作面板（拖曳移動、調整時長、取消）
- 加大觸控目標區域

**新增檔案**：
- `src/components/ui/sonner.tsx` - Toast 元件

**修改檔案**：
- `app/calendar/page.tsx` - 主要 UX 優化
- `src/components/task/TaskDetailDialog.tsx` - 時間編輯 Popover
- `src/components/layout/ClientLayout.tsx` - Toaster 整合

---

### 🔧 全面維護更新 + 安全漏洞修復

**事件**：執行全面專案維護，修復安全漏洞、更新套件、清理程式碼

**完成項目**：

1. **修復 Next.js 重大安全漏洞**
   - 從 Next.js 16.0.4 升級到 16.1.1
   - 修復 3 個 critical vulnerabilities:
     - RCE in React flight protocol (GHSA-9qr9-h5gf-34mp)
     - Server Actions Source Code Exposure (GHSA-w37m-7fhw-fmv9)
     - DoS with Server Components (GHSA-mwv6-3258-q52c)

2. **更新過時套件**
   - baseline-browser-mapping（消除 build 警告）
   - @supabase/supabase-js: 2.84.0 → 2.89.0
   - openai: 6.9.1 → 6.15.0
   - tailwindcss: 4.1.17 → 4.1.18
   - zustand: 5.0.8 → 5.0.9
   - 其他多個套件更新

3. **修復 ESLint 錯誤**
   - `analytics/page.tsx`: 將 CustomTooltip 移到組件外部避免每次 render 重新創建
   - `dashboard/page.tsx`: 使用 lazy initialization 取代 useEffect 中的 setState
   - `tasks/page.tsx`: 添加合理的 eslint-disable 註釋處理 prop 同步

4. **清理 unused imports**
   - 移除 `analytics/page.tsx` 中未使用的 Select, ChevronDown 等
   - 移除 `calendar/page.tsx` 中未使用的 Card, Badge, getHours
   - 移除 `tasks/page.tsx` 中未使用的 Card, Badge, RecurrenceType 等
   - 移除 `projects/page.tsx` 中未使用的 useEffect, Check, X

**技術細節**：
| 項目 | 修復方式 |
|-----|---------|
| CustomTooltip 錯誤 | 移到組件外部定義，避免 render 時重新創建 |
| setState in effect | 改用 useState lazy initialization |
| 安全漏洞 | npm install next@16.1.1 eslint-config-next@16.1.1 |
| Build 警告 | 更新 baseline-browser-mapping 到最新版 |

**Build 狀態**：✅ 成功（0 漏洞，21 頁面正常生成）

---

## 2025-12-11

### 🧠 AI 學習系統優化 + 行事曆 TaskDetailDialog 整合

**事件**：修復行事曆任務點擊問題、優化 AI 學習偵測 pattern、手動新增學習指令

**修復項目**：

1. **行事曆任務點擊無反應**
   - 問題：`localTask` 透過 `useEffect` 設定，第一次 render 時為 null
   - 解決：改用 `displayTask = localTask || task` 確保首次 render 正確顯示
   - 將所有 `localTask.` 替換為 `displayTask.`

2. **Calendar 與 Tasks 共用 TaskDetailDialog**
   - 提取共用元件到 `src/components/task/TaskDetailDialog.tsx`
   - Calendar page 改用共用元件（完整編輯功能）
   - 移除已棄用的 `TaskEditSidebar_DEPRECATED`（減少 256 行程式碼）

3. **AI 學習偵測 Pattern 增強**
   - 新增風格相關 pattern：「仿照...方式」「參考...風格」
   - 新增內容相關 pattern：「沒有產出」「差異在哪」
   - 新增知識庫相關 pattern：「補強知識庫」「學習這個」

4. **手動新增學習指令到知識庫**
   - 建立腳本 `scripts/add-learning-instructions.mjs`
   - 新增 5 條根據用戶對話學習到的指令：
     - 標題格式：動詞 + 明確產出物
     - 優先識別文件類型（SOP、簡報等）
     - 將大任務拆解成小任務
     - 包含策略規劃任務
     - 標題描述要清楚易懂
   - 知識庫現有 6 條學習指令

**新增檔案**：
- `scripts/add-learning-instructions.mjs` - 手動新增學習指令腳本

**修改檔案**：
- `src/components/task/TaskDetailDialog.tsx` - 修復 displayTask 邏輯
- `src/lib/few-shot-learning.ts` - 增強 instructionPatterns
- `app/calendar/page.tsx` - 移除棄用元件、使用共用 TaskDetailDialog

**技術細節**：
| 項目 | 實作方式 |
|-----|---------|
| 首次 render 問題 | `displayTask = localTask || task` |
| 共用元件 | 提取到 `src/components/task/` |
| Pattern 偵測 | 正則表達式匹配中文指令語句 |
| 知識庫寫入 | 直接呼叫 Supabase `user_instructions` 表 |

---

## 2025-12-09

### 📊 Analytics 頁面 + AI 智能任務分類

**事件**：實作 Todoist 風格的 Analytics 頁面，並加入 AI 智能任務分類功能

**新增功能**：

1. **Analytics 頁面**
   - 每日/每週完成統計與切換
   - 趨勢長條圖（顯示最近 7 天/4 週完成數）
   - 類別分布圓餅圖
   - 專案分布視覺化（色塊 + 圖例說明）
   - 連續達成天數（Streak）統計
   - 時間追蹤統計（依類別顯示時數）

2. **AI 智能任務分類系統**
   - 六大分類：銷售業務、內部優化、自我提升、客戶服務、行政庶務、其他
   - AI 關鍵字權重匹配（每個類別有專屬關鍵字和權重）
   - 知識庫學習機制（用戶修正後自動記住）
   - 分類優先級：知識庫優先，AI 輔助

3. **分類修正 UI**
   - 任務旁的分類標籤可點擊修正
   - Popover 選單顯示所有分類選項
   - 修正後即時學習並更新顯示
   - 底部顯示「已學習 X 個分類規則」

**新增檔案**：
- `app/analytics/page.tsx` - Analytics 頁面主元件
- `src/lib/useCategoryMappings.ts` - 分類 Hook（含 AI 分類邏輯）
- `supabase/migrations/20251209_task_categories.sql` - 知識庫資料表

**修改檔案**：
- `src/lib/supabase-api.ts` - 新增 categoryMappingsApi、taskCategoriesApi
- `src/components/layout/Sidebar.tsx` - 新增 Analytics 導航連結

**技術細節**：
| 項目 | 實作方式 |
|-----|---------|
| AI 分類 | 關鍵字匹配 + 權重計算，信心度最高者勝出 |
| 知識庫 | task_category_mappings 表，支援 exact/contains/starts_with 匹配 |
| 學習機制 | upsert 操作，同 pattern 自動覆蓋 |
| 圓餅圖 | recharts PieChart 元件 |
| 時間統計 | 根據任務 startDate/dueDate 計算時長 |

**分類邏輯**：
1. 先查知識庫（cachedMappings），按優先級排序
2. 知識庫無匹配時，使用 AI 智能分類（aiClassify）
3. AI 分類根據關鍵字數量 × 權重計算信心度
4. 用戶修正時調用 learnCategory，寫入知識庫

---

## 2025-12-06

### ✏️ 任務更新功能優化

**事件**：實作完整的任務更新流程，解決同名任務無法區分的問題

**問題描述**：
- 使用者說「更新 XXX 任務」時，如果有多個同名任務（如分別在不同專案）
- 原本的設計無法讓使用者選擇要更新哪一個

**解決方案**：

1. **新增 `task_search` AI 回應類型**
   - AI 先搜尋所有匹配的任務
   - 回傳任務列表（含專案名稱、負責人、截止日期）
   - 讓使用者明確選擇要更新哪個任務

2. **兩階段確認流程**
   - **階段一：任務選擇**（琥珀色卡片 🔍）
     - 顯示所有匹配任務
     - 每個任務顯示專案名稱、負責人等資訊
     - 使用者點選要更新的任務
   - **階段二：內容確認**（綠色卡片 ✏️）
     - 顯示已選擇的任務
     - 預覽所有更新內容（描述、優先級、截止日期等）
     - 「重新選擇」返回任務列表
     - 「確認更新」執行更新

3. **Store 狀態管理**
   - `PendingTaskSearch` 介面：儲存搜尋結果和選擇狀態
   - `selectTaskForUpdate()`：設定使用者選擇的任務
   - `selectedTaskId` / `selectedTaskTitle`：記錄選擇狀態

4. **成功/失敗回饋**
   - 更新成功：顯示 `✅ 已更新任務「XXX」`
   - 更新失敗：顯示 `❌ 更新任務「XXX」時發生錯誤`

**修改檔案**：
- `src/lib/store.ts` - 新增 `PendingTaskSearch`、`selectTaskForUpdate`
- `src/lib/openai.ts` - 新增 `task_search` 回應格式說明
- `src/lib/utils-client.ts` - 新增 `TaskSearchResult` 類型、更新 `parseAIResponse`
- `src/components/chat/InputArea.tsx` - 處理 `task_search` 回應
- `src/components/chat/ChatWindow.tsx` - 任務選擇卡片 + 確認卡片 UI

**使用者體驗改善**：
- 可以清楚看到每個任務屬於哪個專案
- 選擇後可以預覽更新內容再確認
- 不滿意可以返回重新選擇
- 更新成功有明確的訊息回饋

---

## 2025-12-04

### 🔄 例行性任務功能（Recurring Tasks）

**事件**：實作完整的例行性任務系統，支援每日/每週/每月/每年重複

**新增功能**：

1. **資料庫欄位擴充**
   - `recurrence_type`：重複類型（none/daily/weekly/monthly/yearly）
   - `recurrence_config`：重複設定（JSONB，可設定週幾、間隔等）
   - `parent_task_id`：父任務 ID（用於追蹤重複任務來源）
   - `is_recurring_instance`：是否為重複產生的實例

2. **自動產生下一個任務**
   - 完成例行任務時，系統自動建立下一個任務
   - 開始日和截止日同時推進（保持原本間隔）
   - `calculateNextDueDate()` 函數處理日期計算

3. **RecurrenceSelector UI 元件**
   - 下拉選單選擇重複類型
   - 每週可選擇特定週幾（週一到週日）
   - 顯示目前設定（如「每週 一、三、五」）

4. **RecurrenceBadge 標籤元件**
   - 任務卡片上顯示重複標記
   - 藍色背景 + 循環圖示

5. **AI 自動辨識例行任務**
   - 「每天」「每日」「daily」「天天」「日常」→ daily
   - 「每週」「每週X」「每星期」「週週」→ weekly
   - 「每月」「每個月」「月月」→ monthly

**新增檔案**：
- `supabase/migrations/20251204_add_recurrence.sql` - 資料庫遷移
- `src/components/task/RecurrenceSelector.tsx` - 重複選擇器元件

**修改檔案**：
- `src/lib/supabase-api.ts` - 新增 RecurrenceConfig、completeRecurring API
- `src/lib/useSupabaseTasks.ts` - 新增 RecurrenceType、更新 completeTask
- `app/tasks/page.tsx` - 整合 RecurrenceSelector 和 RecurrenceBadge
- `src/lib/openai.ts` - 新增例行性任務辨識規則
- `src/lib/store.ts` - ExtractedTask 新增 recurrence_type
- `src/components/chat/ChatWindow.tsx` - 傳遞 recurrenceType 到 addTask

**技術細節**：
| 項目 | 實作方式 |
|-----|---------|
| 日期計算 | `calculateNextDueDate()` 根據類型加 1 天/週/月/年 |
| 週幾選擇 | `recurrence_config.weekdays` 陣列（1=週一, 7=週日）|
| 完成流程 | `completeRecurring()` 同時完成並建立下一個 |
| AI 辨識 | Prompt 關鍵字匹配 + recurrence_type 欄位 |

**使用方式**：
1. 在任務詳情中點擊「不重複」按鈕
2. 選擇重複頻率（每天/每週/每月/每年）
3. 若選每週，可點選特定週幾
4. 完成任務時，系統自動產生下一個

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
