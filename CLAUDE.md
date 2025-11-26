# Vibe Planner - Claude Code 專案設定

> 這個檔案定義了 Claude Code 在此專案中的行為規則

---

## 專案資訊

- **專案名稱**：Vibe Planner
- **語言**：繁體中文
- **技術棧**：Next.js 14 + Tailwind + shadcn/ui + Prisma + SQLite + Claude API

---

## 重要檔案

| 檔案 | 用途 |
|-----|------|
| `PRD.md` | 產品需求文件 |
| `PROJECT_STATUS.md` | 專案進度追蹤 |
| `PROJECT_LOG.md` | 專案日誌 |

---

## 自動行為

### 當使用者說「更新專案」或執行 /update

1. 讀取 `PROJECT_STATUS.md` 和 `PROJECT_LOG.md`
2. 根據對話內容更新進度
3. 在日誌中新增一條記錄
4. 回報更新摘要

### 當使用者說「報告進度」、「目前進度」或執行 /status

1. 讀取 `PROJECT_STATUS.md` 和 `PROJECT_LOG.md`
2. 產生完整的進度報告
3. 提供下一步建議

---

## 開發規則

1. **所有程式碼註解使用繁體中文**
2. **優先使用現有元件，避免重複造輪**
3. **每次重大變更後，提醒使用者更新專案進度**
4. **遇到問題時，記錄到 PROJECT_LOG.md**

---

## 檔案結構參考

```
vibe-planner/
├── app/                    # Next.js App Router
│   ├── page.tsx           # 首頁（對話介面）
│   ├── dashboard/         # Dashboard
│   ├── tasks/             # 任務列表
│   └── api/               # API Routes
├── components/            # React 元件
├── lib/                   # 工具函數
├── prisma/                # 資料庫
├── .claude/commands/      # 自定義指令
├── PRD.md
├── PROJECT_STATUS.md
├── PROJECT_LOG.md
└── CLAUDE.md              # 本文件
```

---

## 常用指令

- `/update` - 更新專案進度與日誌
- `/status` - 報告專案進度
