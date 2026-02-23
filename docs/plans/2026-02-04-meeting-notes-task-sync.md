# 會議記錄任務同步功能 Implementation Plan (v2)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 讓會議記錄的待辦任務與系統任務列表完全同步，使用系統設定的專案/負責人/組別

**Architecture:**
1. 儲存會議記錄時，讓用戶勾選要建立哪些任務（非全自動）
2. 會議記錄頁面改用 Supabase 任務資料，不用獨立的 MeetingTask
3. 使用 inline 展開顯示任務詳情，不用完整 Dialog

**Tech Stack:** Next.js 14, Supabase, React, TypeScript, shadcn/ui

**時間估算:** 3-3.5 小時

---

## Task 1: 資料庫與介面更新

**Files:**
- Create: `supabase/migrations/20260204_meeting_task_link.sql`
- Modify: `src/lib/supabase-api.ts` (DbTask 介面)
- Modify: `src/lib/useSupabaseTasks.ts` (Task 介面 + dbTaskToTask)

### Step 1: 建立資料庫遷移

```sql
-- supabase/migrations/20260204_meeting_task_link.sql
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS meeting_note_id UUID REFERENCES meeting_notes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_meeting_note_id ON tasks(meeting_note_id);
```

### Step 2: 更新 DbTask 介面

```typescript
// src/lib/supabase-api.ts
export interface DbTask {
  // ... 現有欄位
  meeting_note_id: string | null
}
```

### Step 3: 更新 Task 介面和轉換函數

```typescript
// src/lib/useSupabaseTasks.ts
export interface Task {
  // ... 現有欄位
  meetingNoteId?: string
}

// dbTaskToTask 函數內新增
meetingNoteId: dbTask.meeting_note_id || undefined,
```

### Step 4: 新增查詢函數

```typescript
// src/lib/supabase-api.ts
export async function getTasksByMeetingNoteId(meetingNoteId: string): Promise<DbTask[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('meeting_note_id', meetingNoteId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data || []
}
```

### Step 5: Commit

```bash
git add supabase/migrations/20260204_meeting_task_link.sql src/lib/supabase-api.ts src/lib/useSupabaseTasks.ts
git commit -m "feat: add meeting_note_id to tasks table"
```

---

## Task 2: 修改儲存流程 - 可勾選任務

**Files:**
- Modify: `src/components/chat/ChatWindow.tsx`
- Modify: `src/lib/supabase-api.ts`

### Step 1: 新增批次建立任務函數

```typescript
// src/lib/supabase-api.ts
export async function createTasksFromMeetingNotes(
  meetingNoteId: string,
  actionItems: { task: string; assignee?: string; dueDate?: string }[],
  userId: string
): Promise<DbTask[]> {
  const tasksToInsert = actionItems.map(item => ({
    id: crypto.randomUUID(),
    title: item.task,
    assignee: item.assignee || null,
    due_date: item.dueDate ? new Date(item.dueDate).toISOString() : null,
    status: 'pending',
    priority: 'medium',
    user_id: userId,
    meeting_note_id: meetingNoteId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }))

  const { data, error } = await supabase
    .from('tasks')
    .insert(tasksToInsert)
    .select()

  if (error) throw error
  return data || []
}
```

### Step 2: 新增任務選擇狀態到 PendingMeetingNotes

```typescript
// src/lib/store.ts - PendingMeetingNotes 介面
export interface PendingMeetingNotes {
  // ... 現有欄位
  selectedTaskIndices?: number[]  // 勾選的任務索引
}
```

### Step 3: 修改會議記錄預覽 UI - 加入勾選框

找到 ChatWindow.tsx 中的待辦任務區塊（約第 1849-1866 行），修改為可勾選：

```typescript
{/* 待辦任務 - 可勾選 */}
{pendingMeetingNotes.organized.actionItems?.length > 0 && (
  <div className="mb-4">
    <div className="flex items-center justify-between mb-2">
      <h4 className="text-sm font-medium text-amber-700 dark:text-amber-400">📝 待辦任務</h4>
      <button
        className="text-xs text-muted-foreground hover:text-foreground"
        onClick={() => {
          const allIndices = pendingMeetingNotes.organized.actionItems.map((_, i) => i)
          const currentSelected = pendingMeetingNotes.selectedTaskIndices || allIndices
          const newSelected = currentSelected.length === allIndices.length ? [] : allIndices
          setPendingMeetingNotes({ ...pendingMeetingNotes, selectedTaskIndices: newSelected })
        }}
      >
        {(pendingMeetingNotes.selectedTaskIndices?.length || pendingMeetingNotes.organized.actionItems.length) === pendingMeetingNotes.organized.actionItems.length
          ? '取消全選' : '全選'}
      </button>
    </div>
    <ul className="text-sm space-y-1">
      {pendingMeetingNotes.organized.actionItems.map((item, i) => {
        const isSelected = pendingMeetingNotes.selectedTaskIndices?.includes(i) ?? true
        return (
          <li key={i} className="flex items-center gap-2">
            <Checkbox
              checked={isSelected}
              onCheckedChange={(checked) => {
                const current = pendingMeetingNotes.selectedTaskIndices ??
                  pendingMeetingNotes.organized.actionItems.map((_, idx) => idx)
                const newSelected = checked
                  ? [...current, i]
                  : current.filter(idx => idx !== i)
                setPendingMeetingNotes({ ...pendingMeetingNotes, selectedTaskIndices: newSelected })
              }}
            />
            <span className={!isSelected ? 'text-muted-foreground line-through' : ''}>
              {item.task}
            </span>
            {item.assignee && <Badge variant="outline" className="text-xs py-0">@{item.assignee}</Badge>}
          </li>
        )
      })}
    </ul>
  </div>
)}
```

### Step 4: 修改儲存按鈕 - 分成兩個選項

```typescript
{/* 儲存按鈕區 */}
<div className="flex items-center gap-2">
  {/* 只存會議記錄 */}
  <Button
    variant="outline"
    size="sm"
    onClick={async () => {
      try {
        await addMeetingNote({
          title: pendingMeetingNotes.organized.title,
          date: new Date(pendingMeetingNotes.organized.date),
          participants: pendingMeetingNotes.organized.participants || [],
          rawContent: pendingMeetingNotes.rawContent || '',
          organized: pendingMeetingNotes.organized,
          markdown: pendingMeetingNotes.markdown,
        })
        toast.success('會議記錄已儲存')
        clearPendingMeetingNotes()
      } catch (err) {
        toast.error('儲存失敗')
      }
    }}
  >
    只存會議記錄
  </Button>

  {/* 儲存 + 建立任務 */}
  <Button
    variant="default"
    size="sm"
    onClick={async () => {
      const selectedIndices = pendingMeetingNotes.selectedTaskIndices ??
        pendingMeetingNotes.organized.actionItems?.map((_, i) => i) ?? []
      const selectedItems = selectedIndices
        .map(i => pendingMeetingNotes.organized.actionItems?.[i])
        .filter(Boolean)

      try {
        const savedNote = await addMeetingNote({...})

        if (selectedItems.length > 0 && savedNote?.id) {
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            await createTasksFromMeetingNotes(savedNote.id, selectedItems, user.id)
          }
        }

        toast.success(`已儲存，建立 ${selectedItems.length} 個任務`)
        clearPendingMeetingNotes()
      } catch (err) {
        toast.error('儲存失敗')
      }
    }}
    disabled={!(pendingMeetingNotes.selectedTaskIndices?.length ?? pendingMeetingNotes.organized.actionItems?.length)}
  >
    <Check className="h-4 w-4 mr-1" />
    儲存 + 建立 {pendingMeetingNotes.selectedTaskIndices?.length ?? pendingMeetingNotes.organized.actionItems?.length} 個任務
  </Button>
</div>
```

### Step 5: Commit

```bash
git add src/components/chat/ChatWindow.tsx src/lib/supabase-api.ts src/lib/store.ts
git commit -m "feat: allow selecting tasks to create when saving meeting notes"
```

---

## Task 3: 會議記錄頁面 - 使用系統資料

**Files:**
- Modify: `app/meeting-notes/page.tsx`

### Step 1: 移除靜態資料，引入系統 Hooks

```typescript
// 刪除這些（約第 89-96 行）
// const groupOptions = [...]
// const projectOptions = [...]
// const assigneeOptions = [...]

// 新增引入
import { useSupabaseTasks } from '@/lib/useSupabaseTasks'
import { useSupabaseProjects } from '@/lib/useSupabaseProjects'
import { getGroups, Group } from '@/lib/groups'
import { getTeamMembers } from '@/lib/team-members'
import { getTasksByMeetingNoteId } from '@/lib/supabase-api'
```

### Step 2: 使用系統資料

```typescript
// 在元件內部
const { tasks: allTasks, updateTask, deleteTask, refresh: refreshTasks } = useSupabaseTasks()
const { projects } = useSupabaseProjects()
const [groups, setGroups] = useState<Group[]>([])
const [teamMembers, setTeamMembers] = useState<string[]>([])

useEffect(() => {
  setGroups(getGroups())
  setTeamMembers(getTeamMembers())
}, [])

// 取得該會議記錄關聯的任務
const meetingTasks = useMemo(() => {
  if (!selectedNote) return []
  return allTasks.filter(t => t.meetingNoteId === selectedNote.id)
}, [allTasks, selectedNote])

// 頁面載入時 refresh
useEffect(() => {
  refreshTasks()
}, [selectedNote])
```

### Step 3: 移除本地 MeetingTask 狀態

刪除整個 `tasksByNote` 狀態和相關函數（約第 97-315 行的大部分）。

### Step 4: 修改下拉選單使用系統資料

```typescript
// 負責人下拉選單
{teamMembers.map((member) => (
  <DropdownMenuItem onClick={() => updateTask(task.id, { assignee: member })}>
    {member}
  </DropdownMenuItem>
))}

// 組別下拉選單
{groups.map((group) => (
  <DropdownMenuItem onClick={() => updateTask(task.id, { groupName: group.name })}>
    {group.name}
  </DropdownMenuItem>
))}

// 專案下拉選單
{projects.map((project) => (
  <DropdownMenuItem onClick={() => updateTask(task.id, { projectId: project.id })}>
    {project.name}
  </DropdownMenuItem>
))}
```

### Step 5: Commit

```bash
git add app/meeting-notes/page.tsx
git commit -m "refactor: use system data for meeting notes page"
```

---

## Task 4: 任務詳情 - Inline 展開（輕量版）

**Files:**
- Modify: `app/meeting-notes/page.tsx`

### Step 1: 新增展開狀態

```typescript
const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null)
```

### Step 2: 修改 TaskRow 加入展開功能

```typescript
const TaskRow = ({ task }: { task: Task }) => {
  const isExpanded = expandedTaskId === task.id
  const project = projects.find(p => p.id === task.projectId)

  return (
    <div className="border-b border-gray-100">
      {/* 主要列 */}
      <div className="group flex items-center gap-2 py-2 px-3 hover:bg-[#f7f6f3]">
        {/* 勾選框 */}
        <button onClick={() => updateTask(task.id, {
          status: task.status === 'completed' ? 'pending' : 'completed'
        })}>
          {task.status === 'completed' ? <CheckCircle2 /> : <Circle />}
        </button>

        {/* 任務名稱 - 點擊展開 */}
        <div
          className="flex-1 min-w-0 cursor-pointer hover:text-blue-600"
          onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
        >
          <span className={task.status === 'completed' ? 'line-through text-gray-400' : ''}>
            {task.title}
          </span>
          <ChevronDown className={`inline ml-1 h-3 w-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </div>

        {/* 其他欄位的下拉選單... */}
      </div>

      {/* 展開的詳情區 */}
      {isExpanded && (
        <div className="px-10 py-3 bg-gray-50 border-t border-gray-100">
          {task.description && (
            <p className="text-sm text-gray-600 mb-2">{task.description}</p>
          )}
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>優先級: {task.priority}</span>
            {task.startDate && <span>開始: {format(task.startDate, 'MM/dd')}</span>}
            {task.dueDate && <span>截止: {format(task.dueDate, 'MM/dd')}</span>}
          </div>
          <div className="mt-2">
            <Link
              href={`/tasks?highlight=${task.id}`}
              className="text-xs text-blue-500 hover:underline"
            >
              在任務列表中查看完整詳情 →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
```

### Step 3: Commit

```bash
git add app/meeting-notes/page.tsx
git commit -m "feat: add inline task expansion in meeting notes"
```

---

## Task 5: 向後相容 - 舊會議記錄支援

**Files:**
- Modify: `app/meeting-notes/page.tsx`

### Step 1: 處理沒有關聯任務的舊會議記錄

```typescript
// 如果資料庫沒有關聯任務，fallback 到 organized.actionItems
const meetingTasks = useMemo(() => {
  if (!selectedNote) return []

  // 優先使用資料庫關聯任務
  const dbTasks = allTasks.filter(t => t.meetingNoteId === selectedNote.id)
  if (dbTasks.length > 0) return dbTasks

  // Fallback: 從 organized.actionItems 轉換（舊資料）
  const actionItems = selectedNote.organized?.actionItems || []
  return actionItems.map((item, i) => ({
    id: `legacy-${selectedNote.id}-${i}`,
    title: item.task,
    assignee: item.assignee,
    dueDate: item.dueDate ? new Date(item.dueDate) : undefined,
    status: 'pending' as const,
    priority: 'medium' as const,
    isLegacy: true,  // 標記為舊資料
  }))
}, [allTasks, selectedNote])
```

### Step 2: 舊資料提示轉換

```typescript
{meetingTasks.some(t => t.isLegacy) && (
  <div className="bg-amber-50 border border-amber-200 rounded p-2 mb-3 text-xs">
    <span>這是舊會議記錄，任務尚未同步到系統。</span>
    <button
      className="ml-2 text-amber-600 hover:underline"
      onClick={async () => {
        // 將 legacy 任務轉換為系統任務
        const legacyItems = selectedNote.organized.actionItems || []
        const { data: { user } } = await supabase.auth.getUser()
        if (user && selectedNote.id) {
          await createTasksFromMeetingNotes(selectedNote.id, legacyItems, user.id)
          refreshTasks()
          toast.success('任務已同步到系統')
        }
      }}
    >
      立即同步
    </button>
  </div>
)}
```

### Step 3: Commit

```bash
git add app/meeting-notes/page.tsx
git commit -m "feat: backward compatibility for legacy meeting notes"
```

---

## Task 6: 對話標題優化（獨立功能）

**Files:**
- Modify: `app/api/chat/title/route.ts`

### Step 1: 修改標題生成 Prompt

```typescript
const systemPrompt = `你是對話標題產生器。根據對話內容產生簡短標題（10-20 字）。

規則：
1. 會議記錄格式：「[會議名稱]」
2. 任務萃取格式：「[主題] (N 個任務)」
3. 一般對話：描述性標題

範例：
- 「週會討論紀錄」
- 「電訪名單整理 (5 個任務)」
- 「產品規劃會議」
`
```

### Step 2: Commit

```bash
git add app/api/chat/title/route.ts
git commit -m "feat: improve conversation title format"
```

---

## Task 7: 測試與驗收

### 測試清單

1. ✅ 新增會議記錄 → 勾選任務 → 儲存 → 任務出現在系統
2. ✅ 新增會議記錄 → 只存會議記錄 → 不建立任務
3. ✅ 會議記錄頁面 → 下拉選單顯示系統設定的專案/組別/負責人
4. ✅ 點擊任務 → inline 展開詳情
5. ✅ 在會議記錄頁面更新任務 → 任務列表同步
6. ✅ 在任務列表更新任務 → 回到會議記錄頁面（refresh 後）同步
7. ✅ 舊會議記錄 → 顯示「立即同步」按鈕
8. ✅ 對話標題 → 格式正確

### Step 1: 執行完整流程測試

### Step 2: 清理未使用程式碼

### Step 3: TypeScript 檢查

```bash
npx tsc --noEmit
```

### Step 4: 最終 Commit

```bash
git add .
git commit -m "feat: complete meeting notes task sync feature"
```

---

## 執行摘要

| Task | 說明 | 預估時間 |
|------|------|---------|
| 1 | 資料庫與介面更新 | 30 min |
| 2 | 可勾選任務儲存流程 | 45 min |
| 3 | 使用系統資料 | 30 min |
| 4 | Inline 任務展開 | 30 min |
| 5 | 向後相容處理 | 20 min |
| 6 | 對話標題優化 | 15 min |
| 7 | 測試與驗收 | 30 min |

**總計：約 3.5 小時**

---

## 主要改進（相比 v1）

1. ✅ **用戶控制權** - 任務可勾選，非全自動建立
2. ✅ **輕量 UI** - 用 inline 展開取代完整 Dialog
3. ✅ **類型修正** - 正確處理 MeetingTask vs Task 差異
4. ✅ **向後相容** - 舊會議記錄可一鍵同步
5. ✅ **拆分獨立功能** - 標題優化獨立為 Task 6
