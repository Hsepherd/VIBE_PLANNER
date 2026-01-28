# 會議記錄整理 + AI 任務預覽編輯功能

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 新增會議記錄整理功能（Notion 風格）並修復 AI 建議任務預覽中的組別/專案編輯功能

**Architecture:**
1. 會議記錄整理：新增 AI function `organizeMeetingNotes`，將散亂會議內容整理成結構化格式，並在對話中以可複製 Markdown 呈現
2. 任務預覽編輯：在 ChatWindow.tsx 的 AI 建議任務卡片中，為「組別」和「專案」欄位加入 Popover 編輯功能（參照現有「負責人」編輯的實作模式）

**Tech Stack:** Next.js 16, React, TypeScript, OpenAI GPT-4.1, Supabase, shadcn/ui

---

## Part 1: AI 任務預覽 - 組別/專案編輯功能

### Task 1: 新增 useSupabaseGroups hook

**Files:**
- Create: `src/lib/useSupabaseGroups.ts`

**Step 1: 建立 groups hook**

```typescript
// src/lib/useSupabaseGroups.ts
'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from './useAuth'

export interface Group {
  id: string
  name: string
  color: string
  user_id: string
  created_at: string
}

export function useSupabaseGroups() {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()
  const supabase = createClient()

  const fetchGroups = useCallback(async () => {
    if (!user) {
      setGroups([])
      setLoading(false)
      return
    }

    try {
      // 從 tasks 表中取得所有不重複的 groupName
      const { data, error } = await supabase
        .from('tasks')
        .select('group_name')
        .eq('user_id', user.id)
        .not('group_name', 'is', null)

      if (error) throw error

      // 整理成唯一的群組列表
      const uniqueGroups = [...new Set(data?.map(t => t.group_name).filter(Boolean))]
      const groupList: Group[] = uniqueGroups.map((name, i) => ({
        id: `group-${i}`,
        name: name as string,
        color: getGroupColor(name as string),
        user_id: user.id,
        created_at: new Date().toISOString(),
      }))

      setGroups(groupList)
    } catch (err) {
      console.error('Failed to fetch groups:', err)
    } finally {
      setLoading(false)
    }
  }, [user, supabase])

  useEffect(() => {
    fetchGroups()
  }, [fetchGroups])

  return { groups, loading, refresh: fetchGroups }
}

// 根據名稱生成顏色
function getGroupColor(name: string): string {
  const colors = ['blue', 'green', 'purple', 'orange', 'pink', 'cyan', 'yellow', 'red']
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return colors[hash % colors.length]
}
```

**Step 2: 驗證檔案建立成功**

確認檔案存在且無 TypeScript 錯誤。

---

### Task 2: ChatWindow 新增組別/專案編輯 state

**Files:**
- Modify: `src/components/chat/ChatWindow.tsx`

**Step 1: 匯入 groups hook 和新增 state（約 line 8 和 160）**

在 imports 區塊新增：
```typescript
import { useSupabaseGroups } from '@/lib/useSupabaseGroups'
```

在 component 內新增 state（在 `editingAssignee` 附近）：
```typescript
// 組別相關
const { groups: availableGroups } = useSupabaseGroups()

// 編輯組別 state
const [editingGroup, setEditingGroup] = useState<{groupId: string, taskIndex: number} | null>(null)
const [groupInputValue, setGroupInputValue] = useState('')

// 編輯專案 state
const [editingProject, setEditingProject] = useState<{groupId: string, taskIndex: number} | null>(null)
const [projectInputValue, setProjectInputValue] = useState('')
```

**Step 2: 新增更新函數（在 confirmAssigneeEdit 附近）**

```typescript
// 確認組別編輯
const confirmGroupEdit = (groupId: string, taskIndex: number) => {
  if (!groupInputValue.trim()) return
  updatePendingTask(groupId, taskIndex, { group: groupInputValue.trim() })
  setEditingGroup(null)
  setGroupInputValue('')
}

// 確認專案編輯
const confirmProjectEdit = (groupId: string, taskIndex: number) => {
  if (!projectInputValue.trim()) return
  updatePendingTask(groupId, taskIndex, { project: projectInputValue.trim() })
  setEditingProject(null)
  setProjectInputValue('')
}
```

---

### Task 3: 替換專案 Badge 為可編輯 Popover

**Files:**
- Modify: `src/components/chat/ChatWindow.tsx`

**Step 1: 找到專案 Badge（約 line 1154-1158）並替換**

原本：
```tsx
{task.project && (
  <Badge variant="outline" className="text-xs py-0 bg-purple-50 text-purple-700 border-purple-200">
    📁 {task.project}
  </Badge>
)}
```

替換為：
```tsx
{/* 專案 Badge（可編輯） */}
<Popover>
  <PopoverTrigger asChild>
    <button
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1 text-xs py-0.5 px-2 rounded-full border bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 transition-colors"
    >
      📁 {task.project || '未設定'}
      <Pencil className="h-2.5 w-2.5 text-purple-500" />
    </button>
  </PopoverTrigger>
  <PopoverContent className="w-56 p-2" align="start" onClick={(e) => e.stopPropagation()}>
    <div className="text-xs text-muted-foreground mb-2">選擇或輸入專案</div>
    <div className="space-y-2">
      {/* 現有專案列表 */}
      <div className="max-h-32 overflow-y-auto space-y-1">
        {projects.filter(p => p.status === 'active').map(p => (
          <button
            key={p.id}
            onClick={() => {
              updatePendingTask(group.id, taskIndex, { project: p.name })
            }}
            className={`w-full text-left text-xs px-2 py-1 rounded hover:bg-muted ${
              task.project === p.name ? 'bg-purple-100 text-purple-700' : ''
            }`}
          >
            📁 {p.name}
          </button>
        ))}
      </div>
      {/* 手動輸入 */}
      <div className="flex items-center gap-1 pt-2 border-t">
        <Input
          value={projectInputValue}
          onChange={(e) => setProjectInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              confirmProjectEdit(group.id, taskIndex)
            }
          }}
          className="h-7 text-xs"
          placeholder="或輸入新專案名"
          onFocus={() => setProjectInputValue(task.project || '')}
        />
        <Button
          size="sm"
          className="h-7 px-2"
          onClick={() => confirmProjectEdit(group.id, taskIndex)}
        >
          確認
        </Button>
      </div>
    </div>
  </PopoverContent>
</Popover>
```

---

### Task 4: 替換組別 Badge 為可編輯 Popover

**Files:**
- Modify: `src/components/chat/ChatWindow.tsx`

**Step 1: 找到組別 Badge（約 line 1159-1163）並替換**

原本：
```tsx
{task.group && (
  <Badge variant="outline" className="text-xs py-0 bg-blue-50 text-blue-700 border-blue-200">
    {task.group}
  </Badge>
)}
```

替換為：
```tsx
{/* 組別 Badge（可編輯） */}
<Popover>
  <PopoverTrigger asChild>
    <button
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1 text-xs py-0.5 px-2 rounded-full border bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 transition-colors"
    >
      {task.group || '未設定組別'}
      <Pencil className="h-2.5 w-2.5 text-blue-500" />
    </button>
  </PopoverTrigger>
  <PopoverContent className="w-48 p-2" align="start" onClick={(e) => e.stopPropagation()}>
    <div className="text-xs text-muted-foreground mb-2">選擇或輸入組別</div>
    <div className="space-y-2">
      {/* 現有組別列表 */}
      <div className="max-h-32 overflow-y-auto space-y-1">
        {availableGroups.map(g => (
          <button
            key={g.id}
            onClick={() => {
              updatePendingTask(group.id, taskIndex, { group: g.name })
            }}
            className={`w-full text-left text-xs px-2 py-1 rounded hover:bg-muted ${
              task.group === g.name ? 'bg-blue-100 text-blue-700' : ''
            }`}
          >
            {g.name}
          </button>
        ))}
      </div>
      {/* 手動輸入 */}
      <div className="flex items-center gap-1 pt-2 border-t">
        <Input
          value={groupInputValue}
          onChange={(e) => setGroupInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              confirmGroupEdit(group.id, taskIndex)
            }
          }}
          className="h-7 text-xs"
          placeholder="或輸入新組別"
          onFocus={() => setGroupInputValue(task.group || '')}
        />
        <Button
          size="sm"
          className="h-7 px-2"
          onClick={() => confirmGroupEdit(group.id, taskIndex)}
        >
          確認
        </Button>
      </div>
    </div>
  </PopoverContent>
</Popover>
```

---

## Part 2: 會議記錄整理功能

### Task 5: 新增 organizeMeetingNotes AI Function 定義

**Files:**
- Modify: `src/lib/ai-functions/definitions.ts`

**Step 1: 新增 function 定義**

在 `definitions` 陣列中新增：
```typescript
{
  name: 'organizeMeetingNotes',
  description: '整理散亂的會議記錄成結構化格式。當使用者說「整理會議記錄」、「幫我整理這段會議內容」等請求時使用。',
  parameters: {
    type: 'object',
    properties: {
      rawContent: {
        type: 'string',
        description: '原始會議記錄內容',
      },
      meetingTitle: {
        type: 'string',
        description: '會議標題（可選，AI 可自動推測）',
      },
    },
    required: ['rawContent'],
  },
}
```

---

### Task 6: 實作 organizeMeetingNotes handler

**Files:**
- Create: `src/lib/ai-functions/handlers/organizeMeetingNotes.ts`

**Step 1: 建立 handler 檔案**

```typescript
// src/lib/ai-functions/handlers/organizeMeetingNotes.ts
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface OrganizeMeetingNotesArgs {
  rawContent: string
  meetingTitle?: string
}

interface OrganizedMeetingNotes {
  title: string
  date: string
  participants: string[]
  discussionPoints: { topic: string; details: string }[]
  decisions: string[]
  actionItems: { task: string; assignee?: string; dueDate?: string }[]
  nextSteps: string[]
}

export async function organizeMeetingNotes(
  args: OrganizeMeetingNotesArgs
): Promise<{ success: boolean; organized: OrganizedMeetingNotes; markdown: string }> {
  const { rawContent, meetingTitle } = args

  const systemPrompt = `你是一位專業的會議記錄整理專家。請將使用者提供的散亂會議內容，整理成 Notion 風格的結構化格式。

輸出 JSON 格式：
{
  "title": "會議標題",
  "date": "會議日期（從內容推測，格式 YYYY-MM-DD，若無法推測則用今天）",
  "participants": ["參與者1", "參與者2"],
  "discussionPoints": [
    { "topic": "討論主題", "details": "討論內容摘要" }
  ],
  "decisions": ["決議事項1", "決議事項2"],
  "actionItems": [
    { "task": "待辦任務", "assignee": "負責人", "dueDate": "截止日期" }
  ],
  "nextSteps": ["下一步行動1"]
}

注意事項：
1. 從內容中自動識別參與者、日期
2. 整理討論要點時，將相關內容歸類到同一主題
3. 決議事項是明確做出的決定
4. 待辦任務是需要執行的具體工作
5. 若某欄位無相關內容，使用空陣列
6. 所有輸出使用繁體中文`

  const response = await openai.chat.completions.create({
    model: 'gpt-4.1-2025-04-14',
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: meetingTitle
          ? `會議標題：${meetingTitle}\n\n會議內容：\n${rawContent}`
          : `請整理以下會議內容：\n${rawContent}`
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  })

  const content = response.choices[0]?.message?.content
  if (!content) {
    throw new Error('AI 回應為空')
  }

  const organized: OrganizedMeetingNotes = JSON.parse(content)

  // 生成 Markdown 格式
  const markdown = generateMarkdown(organized)

  return {
    success: true,
    organized,
    markdown,
  }
}

function generateMarkdown(notes: OrganizedMeetingNotes): string {
  const lines: string[] = []

  // 標題區塊
  lines.push(`# 📋 ${notes.title}`)
  lines.push('')
  lines.push(`> **日期**：${notes.date}`)
  if (notes.participants.length > 0) {
    lines.push(`> **參與者**：${notes.participants.join('、')}`)
  }
  lines.push('')

  // 討論要點
  if (notes.discussionPoints.length > 0) {
    lines.push('## 💬 討論要點')
    lines.push('')
    notes.discussionPoints.forEach((point, i) => {
      lines.push(`### ${i + 1}. ${point.topic}`)
      lines.push(point.details)
      lines.push('')
    })
  }

  // 決議事項
  if (notes.decisions.length > 0) {
    lines.push('## ✅ 決議事項')
    lines.push('')
    notes.decisions.forEach(decision => {
      lines.push(`- ${decision}`)
    })
    lines.push('')
  }

  // 待辦任務
  if (notes.actionItems.length > 0) {
    lines.push('## 📝 待辦任務')
    lines.push('')
    notes.actionItems.forEach(item => {
      let taskLine = `- [ ] ${item.task}`
      if (item.assignee) taskLine += ` (@${item.assignee})`
      if (item.dueDate) taskLine += ` [截止：${item.dueDate}]`
      lines.push(taskLine)
    })
    lines.push('')
  }

  // 下一步
  if (notes.nextSteps.length > 0) {
    lines.push('## 🚀 下一步')
    lines.push('')
    notes.nextSteps.forEach(step => {
      lines.push(`- ${step}`)
    })
    lines.push('')
  }

  return lines.join('\n')
}
```

---

### Task 7: 註冊 organizeMeetingNotes 到 executor

**Files:**
- Modify: `src/lib/ai-functions/executor.ts`

**Step 1: 匯入並註冊 handler**

在 imports 區塊新增：
```typescript
import { organizeMeetingNotes } from './handlers/organizeMeetingNotes'
```

在 switch case 或 handlers 物件中新增：
```typescript
case 'organizeMeetingNotes':
  return await organizeMeetingNotes(args)
```

---

### Task 8: 前端渲染整理後的會議記錄

**Files:**
- Modify: `src/components/chat/ChatWindow.tsx` 或 `MessageBubble.tsx`

**Step 1: 處理 organized_meeting_notes 類型的訊息**

在訊息渲染邏輯中，偵測 `type === 'organized_meeting_notes'` 並顯示：

```tsx
{message.type === 'organized_meeting_notes' && message.organized && (
  <div className="mt-4 p-4 bg-muted/50 rounded-lg border">
    <div className="flex items-center justify-between mb-3">
      <h3 className="font-semibold flex items-center gap-2">
        📋 {message.organized.title}
      </h3>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          navigator.clipboard.writeText(message.markdown || '')
          toast({ title: '已複製 Markdown 到剪貼簿' })
        }}
      >
        <Copy className="h-4 w-4 mr-1" />
        複製 Markdown
      </Button>
    </div>

    {/* 會議資訊 */}
    <div className="text-sm text-muted-foreground mb-4">
      <span>📅 {message.organized.date}</span>
      {message.organized.participants.length > 0 && (
        <span className="ml-4">👥 {message.organized.participants.join('、')}</span>
      )}
    </div>

    {/* 討論要點 */}
    {message.organized.discussionPoints.length > 0 && (
      <div className="mb-4">
        <h4 className="text-sm font-medium mb-2">💬 討論要點</h4>
        <div className="space-y-2">
          {message.organized.discussionPoints.map((point, i) => (
            <div key={i} className="text-sm pl-4 border-l-2 border-blue-300">
              <p className="font-medium">{point.topic}</p>
              <p className="text-muted-foreground">{point.details}</p>
            </div>
          ))}
        </div>
      </div>
    )}

    {/* 決議事項 */}
    {message.organized.decisions.length > 0 && (
      <div className="mb-4">
        <h4 className="text-sm font-medium mb-2">✅ 決議事項</h4>
        <ul className="text-sm space-y-1">
          {message.organized.decisions.map((d, i) => (
            <li key={i}>• {d}</li>
          ))}
        </ul>
      </div>
    )}

    {/* 待辦任務 */}
    {message.organized.actionItems.length > 0 && (
      <div className="mb-4">
        <h4 className="text-sm font-medium mb-2">📝 待辦任務</h4>
        <ul className="text-sm space-y-1">
          {message.organized.actionItems.map((item, i) => (
            <li key={i} className="flex items-center gap-2">
              <Square className="h-4 w-4 text-muted-foreground" />
              <span>{item.task}</span>
              {item.assignee && <Badge variant="outline" className="text-xs">@{item.assignee}</Badge>}
              {item.dueDate && <span className="text-xs text-amber-600">{item.dueDate}</span>}
            </li>
          ))}
        </ul>
      </div>
    )}
  </div>
)}
```

---

### Task 9: 測試並提交

**Step 1: 啟動開發伺服器測試**

```bash
npm run dev
```

**Step 2: 測試 AI 任務預覽編輯**

1. 貼上一段會議記錄讓 AI 萃取任務
2. 在預覽卡片中點擊「專案」或「組別」
3. 確認可以選擇或輸入新值

**Step 3: 測試會議記錄整理**

1. 輸入「幫我整理這段會議記錄：[貼上散亂內容]」
2. 確認顯示結構化格式
3. 點擊「複製 Markdown」確認功能正常

**Step 4: 提交變更**

```bash
git add -A
git commit -m "feat: 新增會議記錄整理功能 + AI任務預覽組別/專案編輯

- 新增 organizeMeetingNotes AI function
- 會議記錄整理成 Notion 風格（討論要點、決議、待辦）
- 支援複製 Markdown
- AI 建議任務預覽可編輯組別和專案欄位
- 新增 useSupabaseGroups hook"
```

---

## 完成檢查清單

- [ ] useSupabaseGroups hook 建立
- [ ] ChatWindow 新增編輯 state
- [ ] 專案 Badge 改為可編輯 Popover
- [ ] 組別 Badge 改為可編輯 Popover
- [ ] organizeMeetingNotes function 定義
- [ ] organizeMeetingNotes handler 實作
- [ ] executor 註冊新 function
- [ ] 前端渲染整理後會議記錄
- [ ] 複製 Markdown 功能
- [ ] 測試通過並提交
