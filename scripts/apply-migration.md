# 執行會議記錄 Migration

## 方式一：使用 Supabase Dashboard（推薦）

1. 前往 Supabase Dashboard: https://supabase.com/dashboard
2. 選擇你的專案
3. 點擊左側選單的 **SQL Editor**
4. 點擊 **New query**
5. 複製 `supabase/migrations/20260129_meeting_notes.sql` 的內容
6. 貼上並點擊 **Run**

## 方式二：使用 psql（需要資料庫直連）

如果你有資料庫連線字串：

```bash
psql "你的資料庫連線字串" < supabase/migrations/20260129_meeting_notes.sql
```

## 驗證 Migration

執行完成後，運行測試腳本：

```bash
node scripts/test-meeting-notes.mjs
```

應該會看到：
- ✅ 表已存在
- ✅ 插入成功
- ✅ 讀取成功
- ✅ 刪除成功

## Migration 包含內容

- `meeting_notes` 資料表
- 索引（user_id, date, created_at, chat_session_id）
- 全文搜尋索引（raw_content, title）
- RLS 政策（Row Level Security）
- updated_at 自動更新觸發器
