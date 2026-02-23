# 會議記錄 UI 修復與完善計畫

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**目標：** 修復會議記錄詳細頁面的 Markdown 渲染問題，並完善整體 UI 體驗

**架構：** 使用 react-markdown 正確渲染 Markdown 內容，優化卡片佈局，改善整體視覺呈現

**技術棧：**
- react-markdown - Markdown 渲染
- remark-gfm - GitHub Flavored Markdown 支援
- rehype-raw - HTML 支援
- Tailwind CSS - 樣式
- shadcn/ui - UI 元件庫

---

## 問題分析

**當前問題：**
1. ❌ Markdown 內容使用 `dangerouslySetInnerHTML` + 簡單換行替換
2. ❌ 沒有正確處理 Markdown 語法（標題、列表、粗體等）
3. ❌ 詳細對話框內容顯示不美觀
4. ❌ 缺少語法高亮和樣式

**預期效果：**
1. ✅ 正確渲染 Markdown 語法
2. ✅ 美觀的排版和樣式
3. ✅ 支援 GFM（表格、任務列表等）
4. ✅ 改善整體 UI 體驗

---

## Task 1: 安裝 Markdown 渲染依賴

**Files:**
- Modify: `package.json`

**Step 1: 安裝 react-markdown 和相關套件**

```bash
npm install react-markdown remark-gfm rehype-raw rehype-sanitize
```

Expected output:
```
added 15 packages, and audited 500 packages in 10s
```

**Step 2: 驗證安裝**

```bash
npm list react-markdown remark-gfm rehype-raw rehype-sanitize
```

Expected: 顯示已安裝的套件版本

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add react-markdown and plugins for meeting notes rendering"
```

---

## Task 2: 建立 MeetingNotesMarkdown 元件

**Files:**
- Create: `src/components/meeting-notes/MeetingNotesMarkdown.tsx`

**Step 1: 建立 Markdown 渲染元件**

Create `src/components/meeting-notes/MeetingNotesMarkdown.tsx`:

```typescript
'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import { cn } from '@/lib/utils'

interface MeetingNotesMarkdownProps {
  content: string
  className?: string
}

export function MeetingNotesMarkdown({ content, className }: MeetingNotesMarkdownProps) {
  return (
    <div className={cn('prose prose-sm max-w-none dark:prose-invert', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeSanitize]}
        components={{
          // 自訂標題樣式
          h1: ({ node, ...props }) => (
            <h1 className="text-2xl font-bold mt-6 mb-4 pb-2 border-b" {...props} />
          ),
          h2: ({ node, ...props }) => (
            <h2 className="text-xl font-semibold mt-5 mb-3" {...props} />
          ),
          h3: ({ node, ...props }) => (
            <h3 className="text-lg font-semibold mt-4 mb-2" {...props} />
          ),
          h4: ({ node, ...props }) => (
            <h4 className="text-base font-semibold mt-3 mb-2" {...props} />
          ),

          // 自訂列表樣式
          ul: ({ node, ...props }) => (
            <ul className="list-disc list-inside space-y-1 my-3" {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className="list-decimal list-inside space-y-1 my-3" {...props} />
          ),
          li: ({ node, ...props }) => (
            <li className="leading-relaxed" {...props} />
          ),

          // 自訂段落樣式
          p: ({ node, ...props }) => (
            <p className="my-2 leading-relaxed" {...props} />
          ),

          // 自訂強調樣式
          strong: ({ node, ...props }) => (
            <strong className="font-semibold text-foreground" {...props} />
          ),
          em: ({ node, ...props }) => (
            <em className="italic text-muted-foreground" {...props} />
          ),

          // 自訂程式碼區塊樣式
          code: ({ node, inline, ...props }) => {
            if (inline) {
              return (
                <code
                  className="px-1.5 py-0.5 rounded bg-muted text-sm font-mono"
                  {...props}
                />
              )
            }
            return (
              <code
                className="block p-3 rounded-lg bg-muted text-sm font-mono overflow-x-auto my-3"
                {...props}
              />
            )
          },

          // 自訂引用樣式
          blockquote: ({ node, ...props }) => (
            <blockquote
              className="border-l-4 border-primary pl-4 py-2 my-3 italic text-muted-foreground"
              {...props}
            />
          ),

          // 自訂連結樣式
          a: ({ node, ...props }) => (
            <a
              className="text-primary underline hover:text-primary/80 transition-colors"
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            />
          ),

          // 自訂分隔線樣式
          hr: ({ node, ...props }) => (
            <hr className="my-6 border-border" {...props} />
          ),

          // 自訂表格樣式
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto my-4">
              <table className="min-w-full divide-y divide-border" {...props} />
            </div>
          ),
          thead: ({ node, ...props }) => (
            <thead className="bg-muted" {...props} />
          ),
          tbody: ({ node, ...props }) => (
            <tbody className="divide-y divide-border" {...props} />
          ),
          tr: ({ node, ...props }) => (
            <tr className="hover:bg-muted/50 transition-colors" {...props} />
          ),
          th: ({ node, ...props }) => (
            <th className="px-4 py-2 text-left text-sm font-semibold" {...props} />
          ),
          td: ({ node, ...props }) => (
            <td className="px-4 py-2 text-sm" {...props} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
```

**Step 2: 驗證元件建立**

```bash
cat src/components/meeting-notes/MeetingNotesMarkdown.tsx | head -20
```

Expected: 顯示檔案前 20 行內容

**Step 3: Commit**

```bash
git add src/components/meeting-notes/MeetingNotesMarkdown.tsx
git commit -m "feat: create MeetingNotesMarkdown component with custom styling"
```

---

## Task 3: 更新會議記錄頁面使用新元件

**Files:**
- Modify: `app/meeting-notes/page.tsx:1-296`

**Step 1: 匯入新元件**

在 `app/meeting-notes/page.tsx` 第 29 行後添加：

```typescript
import { MeetingNotesMarkdown } from '@/components/meeting-notes/MeetingNotesMarkdown'
```

**Step 2: 替換 dangerouslySetInnerHTML**

修改 `app/meeting-notes/page.tsx` 第 275-280 行：

原本：
```typescript
<ScrollArea className="flex-1 -mx-6 px-6">
  {selectedNote && (
    <div className="prose prose-sm max-w-none">
      <div dangerouslySetInnerHTML={{ __html: selectedNote.markdown.replace(/\n/g, '<br>') }} />
    </div>
  )}
</ScrollArea>
```

改為：
```typescript
<ScrollArea className="flex-1 -mx-6 px-6">
  {selectedNote && (
    <MeetingNotesMarkdown content={selectedNote.markdown} />
  )}
</ScrollArea>
```

**Step 3: 驗證修改**

```bash
grep -n "MeetingNotesMarkdown" app/meeting-notes/page.tsx
```

Expected: 顯示匯入和使用的行號

**Step 4: Commit**

```bash
git add app/meeting-notes/page.tsx
git commit -m "feat: use MeetingNotesMarkdown component for proper rendering"
```

---

## Task 4: 改善詳細對話框樣式

**Files:**
- Modify: `app/meeting-notes/page.tsx:257-293`

**Step 1: 優化對話框佈局**

修改 `app/meeting-notes/page.tsx` 第 257-293 行的對話框部分：

```typescript
{/* 會議記錄詳細對話框 */}
<Dialog open={!!selectedNote} onOpenChange={(open) => !open && setSelectedNote(null)}>
  <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col p-0">
    {/* 標題區域 - 添加背景色 */}
    <DialogHeader className="px-6 py-4 border-b bg-muted/30">
      <DialogTitle className="text-2xl font-bold">{selectedNote?.title}</DialogTitle>
      <DialogDescription className="flex flex-wrap items-center gap-3 pt-2 text-sm">
        <span className="flex items-center gap-1.5">
          <Calendar className="h-4 w-4" />
          {selectedNote && format(selectedNote.date, 'yyyy年MM月dd日', { locale: zhTW })}
        </span>
        {selectedNote && selectedNote.participants.length > 0 && (
          <span className="flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            {selectedNote.participants.join('、')}
          </span>
        )}
      </DialogDescription>
    </DialogHeader>

    {/* 內容區域 - 增加內邊距 */}
    <ScrollArea className="flex-1 px-6 py-4">
      {selectedNote && (
        <MeetingNotesMarkdown
          content={selectedNote.markdown}
          className="pb-4"
        />
      )}
    </ScrollArea>

    {/* 底部操作區 - 添加背景色 */}
    <div className="flex justify-between items-center px-6 py-4 border-t bg-muted/30">
      <Button variant="outline" disabled>
        <MessageSquare className="h-4 w-4 mr-2" />
        提問功能（開發中）
      </Button>
      <Button onClick={() => setSelectedNote(null)}>
        關閉
      </Button>
    </div>
  </DialogContent>
</Dialog>
```

**Step 2: 驗證檔案語法**

```bash
npx tsc --noEmit
```

Expected: No errors

**Step 3: Commit**

```bash
git add app/meeting-notes/page.tsx
git commit -m "style: improve meeting notes dialog layout and styling"
```

---

## Task 5: 改善卡片樣式與佈局

**Files:**
- Modify: `app/meeting-notes/page.tsx:186-250`

**Step 1: 優化卡片設計**

修改 `app/meeting-notes/page.tsx` 第 186-250 行：

```typescript
<ScrollArea className="h-full">
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-6">
    {displayNotes.map((note) => (
      <Card
        key={note.id}
        className="group cursor-pointer hover:shadow-xl hover:scale-[1.02] transition-all duration-200 border-2 hover:border-primary/50"
        onClick={() => setSelectedNote(note)}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-lg line-clamp-2 group-hover:text-primary transition-colors">
              {note.title}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                handleDelete(note.id)
              }}
              className="shrink-0 h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* 日期 */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4 shrink-0" />
            <span>{format(note.date, 'yyyy-MM-dd', { locale: zhTW })}</span>
          </div>

          {/* 參與者 */}
          {note.participants.length > 0 && (
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4 shrink-0 mt-0.5" />
              <span className="line-clamp-2">
                {note.participants.join('、')}
              </span>
            </div>
          )}

          {/* 摘要統計 - 使用網格佈局 */}
          <div className="grid grid-cols-2 gap-2 pt-2">
            {note.organized.discussionPoints.length > 0 && (
              <Badge variant="secondary" className="text-xs justify-center">
                <MessageSquare className="h-3 w-3 mr-1" />
                {note.organized.discussionPoints.length} 討論
              </Badge>
            )}
            {note.organized.decisions.length > 0 && (
              <Badge variant="secondary" className="text-xs justify-center">
                ✓ {note.organized.decisions.length} 決議
              </Badge>
            )}
            {note.organized.actionItems.length > 0 && (
              <Badge variant="secondary" className="text-xs justify-center">
                □ {note.organized.actionItems.length} 待辦
              </Badge>
            )}
            {note.organized.nextSteps.length > 0 && (
              <Badge variant="secondary" className="text-xs justify-center">
                → {note.organized.nextSteps.length} 下一步
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
</ScrollArea>
```

**Step 2: 驗證語法**

```bash
npx tsc --noEmit
```

Expected: No errors

**Step 3: Commit**

```bash
git add app/meeting-notes/page.tsx
git commit -m "style: enhance meeting notes card design with better visual hierarchy"
```

---

## Task 6: 測試與驗證

**Files:**
- Test: Browser at http://localhost:3000/meeting-notes

**Step 1: 啟動開發伺服器**

```bash
npm run dev
```

Expected: Server starts at http://localhost:3000

**Step 2: 測試 Markdown 渲染**

1. 開啟瀏覽器到 http://localhost:3000/meeting-notes
2. 點擊任一會議記錄卡片
3. 驗證：
   - ✅ 標題正確渲染（# ## ### 等）
   - ✅ 列表正確渲染（- 和數字列表）
   - ✅ 粗體、斜體正確顯示
   - ✅ 區塊引用正確顯示
   - ✅ 整體排版美觀

Expected: 所有 Markdown 語法正確渲染

**Step 3: 測試卡片樣式**

1. 檢查會議記錄列表
2. 驗證：
   - ✅ 卡片 hover 效果流暢
   - ✅ 摘要徽章顯示正確
   - ✅ 刪除按鈕位置正確
   - ✅ 響應式佈局正常

Expected: 卡片樣式美觀且互動流暢

**Step 4: 測試對話框**

1. 打開會議記錄詳細對話框
2. 驗證：
   - ✅ 標題區域背景色正確
   - ✅ 內容區域滾動正常
   - ✅ 底部按鈕對齊正確
   - ✅ 關閉按鈕功能正常

Expected: 對話框佈局美觀且功能正常

**Step 5: 截圖記錄**

在瀏覽器中：
1. 截取列表頁面
2. 截取詳細對話框
3. 驗證視覺效果符合預期

**Step 6: Commit**

```bash
git add -A
git commit -m "test: verify markdown rendering and UI improvements"
```

---

## Task 7: 建立測試檔案記錄 UI 改進

**Files:**
- Create: `docs/meeting-notes-ui-improvements.md`

**Step 1: 建立改進記錄文件**

Create `docs/meeting-notes-ui-improvements.md`:

```markdown
# 會議記錄 UI 改進記錄

## 改進日期
2026-01-29

## 問題描述
會議記錄詳細頁面使用 `dangerouslySetInnerHTML` 渲染 Markdown，導致：
- Markdown 語法未正確解析（標題、列表、粗體等）
- 內容顯示為純文字，排版混亂
- 缺少視覺層次和樣式

## 解決方案

### 1. 技術改進
- ✅ 安裝 `react-markdown` 套件
- ✅ 安裝 `remark-gfm` 支援 GitHub Flavored Markdown
- ✅ 安裝 `rehype-raw` 和 `rehype-sanitize` 處理 HTML

### 2. 元件重構
- ✅ 建立 `MeetingNotesMarkdown` 元件
- ✅ 自訂所有 Markdown 元素的樣式
- ✅ 支援標題、列表、程式碼區塊、引用、表格等

### 3. UI 優化
- ✅ 改善卡片 hover 效果（陰影、縮放、邊框）
- ✅ 優化摘要徽章佈局（使用網格）
- ✅ 增強對話框視覺層次（背景色、間距）
- ✅ 改善響應式佈局（支援 xl 螢幕 4 欄）

## 效果對比

### 修復前
- ❌ Markdown 顯示為純文字
- ❌ 所有內容擠在一起
- ❌ 缺少視覺層次
- ❌ 使用不安全的 `dangerouslySetInnerHTML`

### 修復後
- ✅ Markdown 語法正確渲染
- ✅ 清晰的排版和間距
- ✅ 豐富的視覺層次
- ✅ 使用安全的 react-markdown

## 技術細節

### 使用的套件
```json
{
  "react-markdown": "^9.0.0",
  "remark-gfm": "^4.0.0",
  "rehype-raw": "^7.0.0",
  "rehype-sanitize": "^6.0.0"
}
```

### 自訂元件樣式
- 標題：不同層級使用不同大小和間距
- 列表：增加行距，使用內建圖示
- 程式碼：區分 inline 和 block，添加背景色
- 引用：左側邊框 + 斜體 + 顏色區分
- 表格：hover 效果 + 分隔線

## 後續改進建議
1. 考慮添加程式碼語法高亮（使用 `react-syntax-highlighter`）
2. 支援數學公式渲染（使用 `remark-math` + `rehype-katex`）
3. 添加目錄導航功能
4. 支援匯出為 PDF
```

**Step 2: Commit**

```bash
git add docs/meeting-notes-ui-improvements.md
git commit -m "docs: add meeting notes UI improvements documentation"
```

---

## 完成檢查清單

執行完所有任務後，驗證以下項目：

- [ ] `react-markdown` 和相關套件已安裝
- [ ] `MeetingNotesMarkdown` 元件已建立且樣式完整
- [ ] 會議記錄頁面已更新使用新元件
- [ ] 詳細對話框樣式已優化
- [ ] 卡片樣式已改善
- [ ] 瀏覽器測試通過（Markdown 渲染正確）
- [ ] UI 測試通過（樣式美觀、互動流暢）
- [ ] 所有變更已 commit
- [ ] 改進文件已建立

---

## 驗收標準

### Markdown 渲染
✅ 標題（# ## ### ####）正確顯示不同大小
✅ 列表（- 和數字）正確縮排和間距
✅ **粗體**和 *斜體* 正確渲染
✅ > 引用區塊有左側邊框和樣式
✅ `inline code` 有背景色
✅ 表格有分隔線和 hover 效果

### UI 視覺效果
✅ 卡片 hover 有陰影、縮放和邊框動畫
✅ 摘要徽章使用網格佈局，整齊美觀
✅ 對話框標題和底部有背景色區分
✅ 內容區域間距合理，易於閱讀
✅ 響應式佈局在不同螢幕尺寸正常

### 程式碼品質
✅ 沒有使用 `dangerouslySetInnerHTML`
✅ TypeScript 型別檢查通過
✅ 所有元件都有適當的 className
✅ 程式碼遵循專案風格規範

---

## 預估時間
- Task 1: 5 分鐘（安裝套件）
- Task 2: 15 分鐘（建立元件）
- Task 3: 5 分鐘（更新頁面）
- Task 4: 10 分鐘（優化對話框）
- Task 5: 10 分鐘（改善卡片）
- Task 6: 10 分鐘（測試驗證）
- Task 7: 5 分鐘（文件記錄）

**總計：約 60 分鐘**
