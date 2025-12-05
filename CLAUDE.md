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

---

## MCP Chrome DevTools 設定與使用

### 設定方式（一次性）

```bash
claude mcp add chrome-devtools -s user -- npx chrome-devtools-mcp@latest
```

設定完成後**必須重啟 Claude Code**，MCP server 只在 session 初始化時載入。

### 使用前提

1. Chrome 瀏覽器必須以 remote debugging 模式開啟：
   ```bash
   open -a "Google Chrome" --args --remote-debugging-port=9222
   ```
2. 或讓 MCP 自動開啟 headless Chrome

### 常用工具

| 工具 | 功能 |
|-----|------|
| `mcp__chrome-devtools__list_pages` | 列出所有頁面 |
| `mcp__chrome-devtools__select_page` | 選擇頁面（用 pageIdx） |
| `mcp__chrome-devtools__navigate_page` | 導航到 URL |
| `mcp__chrome-devtools__new_page` | 開新頁面 |
| `mcp__chrome-devtools__take_screenshot` | 截圖 |
| `mcp__chrome-devtools__take_snapshot` | 取得 a11y tree |
| `mcp__chrome-devtools__click` | 點擊元素（用 uid） |
| `mcp__chrome-devtools__fill` | 填寫表單 |
| `mcp__chrome-devtools__list_console_messages` | 查看 console |
| `mcp__chrome-devtools__list_network_requests` | 查看網路請求 |

### 標準流程

```
1. mcp__chrome-devtools__list_pages          # 列出頁面
2. mcp__chrome-devtools__select_page         # 選擇頁面
3. mcp__chrome-devtools__navigate_page       # 導航到目標 URL
4. mcp__chrome-devtools__take_screenshot     # 截圖確認
5. mcp__chrome-devtools__take_snapshot       # 取得元素 uid
6. mcp__chrome-devtools__click / fill        # 操作元素
```

### 注意事項

- **不要用** `@modelcontextprotocol/server-puppeteer`（已 deprecated）
- **不要用** `puppeteer-mcp-server`（連線不穩定）
- **正確套件**：`chrome-devtools-mcp@latest`
- 遇到 timeout 超過 10 秒，換方法不要等
