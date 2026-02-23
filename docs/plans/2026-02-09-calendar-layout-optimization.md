# 行事曆版面優化 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 優化行事曆三種視圖（日/週/月）的版面品質，讓任務在時間軸上正確顯示

**Architecture:** 將日視圖從平面列表改為時間格版面（與週視圖一致），利用 `estimatedMinutes` 計算任務方塊高度，並加入自動捲動到當前時間的功能

**Tech Stack:** Next.js 14, Tailwind CSS, date-fns, Zustand

---

## 問題分析

從截圖觀察到的三大問題：

1. **日視圖是平面列表**（`DayView` lines 684-743）：任務用 `TaskCard` 元件垂直堆疊，沒有根據時間定位在時間格上，左邊的時間軸形同虛設
2. **週視圖任務方塊高度不正確**：透過 `extractAndScheduleTasks` 建立的任務只有 `start_date`（沒有 `dueDate`），導致方塊高度預設為 50px；有 `estimatedMinutes` 但未被使用來計算高度
3. **未自動捲動到當前時間**：週視圖和日視圖載入後停在 0:00，使用者需要手動往下滾到工作時段

---

## Task 1: 週視圖 - 用 estimatedMinutes 計算任務方塊高度

**Files:**
- Modify: `app/calendar/page.tsx:1020-1050` (getTaskLayout 函數)
- Modify: `app/calendar/page.tsx:1144-1155` (任務方塊高度計算)

**Step 1: 修改 getTaskLayout 函數中的 endMinutes 計算**

在 `app/calendar/page.tsx` 的 `getTaskLayout` 函數（line 1025-1046）中，當 `taskEnd` 不存在或等於 `taskStart` 時，使用 `estimatedMinutes` 計算 endMinutes：

```typescript
// 在 getTaskLayout 函數內，修改 endMinutes 計算邏輯
const taskRanges = tasksToLayout.map(task => {
  const currentTask = draggingTask?.id === task.id ? draggingTask : task
  const taskStart = currentTask.startDate ? new Date(currentTask.startDate) : null
  const taskEnd = currentTask.dueDate ? new Date(currentTask.dueDate) : null

  let startMinutes = 0
  let endMinutes = 60

  if (taskStart && isSameDay(taskStart, day)) {
    startMinutes = taskStart.getHours() * 60 + taskStart.getMinutes()
    if (taskEnd && isSameDay(taskEnd, day) && taskEnd.getTime() !== taskStart.getTime()) {
      endMinutes = taskEnd.getHours() * 60 + taskEnd.getMinutes()
    } else if (currentTask.estimatedMinutes) {
      // 使用預估時間計算結束時間
      endMinutes = startMinutes + currentTask.estimatedMinutes
    } else {
      endMinutes = startMinutes + 60
    }
  } else if (taskEnd && isSameDay(taskEnd, day)) {
    endMinutes = taskEnd.getHours() * 60 + taskEnd.getMinutes()
    startMinutes = endMinutes - (currentTask.estimatedMinutes || 60)
  }

  return { task, startMinutes, endMinutes }
}).sort((a, b) => a.startMinutes - b.startMinutes)
```

**Step 2: 修改任務方塊高度計算邏輯**

在 line 1144-1155 的任務方塊渲染處，修改 height 計算：

```typescript
// 計算高度：優先用 endTime，其次用 estimatedMinutes
let height = 50
if (endTime && !isPointTask) {
  const durationMinutes = differenceInMinutes(endTime, displayTime)
  height = Math.max(24, (durationMinutes / 60) * 56 - 4)
} else if (displayTask.estimatedMinutes) {
  // 沒有結束時間但有預估時間
  height = Math.max(24, (displayTask.estimatedMinutes / 60) * 56 - 4)
}
```

同時修改時間顯示，當沒有 endTime 但有 estimatedMinutes 時，計算並顯示推算的結束時間：

```typescript
// 計算推算的結束時間（用於顯示）
const inferredEndTime = endTime || (displayTask.estimatedMinutes
  ? addMinutes(displayTime, displayTask.estimatedMinutes)
  : null)

// ...在 JSX 中
<p className="text-[10px] opacity-75 truncate">
  {format(displayTime, 'HH:mm')}{inferredEndTime ? ` - ${format(inferredEndTime, 'HH:mm')}` : ''}
</p>
```

**Step 3: 修改 isPointTask 判斷**

當任務有 estimatedMinutes 時，即使 startDate === dueDate，也不應視為「時間點任務」：

```typescript
const isPointTask = taskStart && taskEnd
  && taskStart.getTime() === taskEnd.getTime()
  && !displayTask.estimatedMinutes  // 有預估時間就不算 point task
```

**Step 4: 驗證**

在瀏覽器開啟 http://localhost:3000/calendar 的週視圖，確認：
- 有 estimatedMinutes 的任務方塊高度正確反映預估時間
- 30 分鐘任務約佔半格高度，1 小時佔一格
- 時間顯示 "08:00 - 08:30" 而非 "08:00 - 08:00"

**Step 5: Commit**

```bash
git add app/calendar/page.tsx
git commit -m "fix: use estimatedMinutes for task block height in week view"
```

---

## Task 2: 日視圖改為時間格版面

**Files:**
- Modify: `app/calendar/page.tsx:684-743` (DayView 函數完整改寫)

**Step 1: 改寫 DayView 為時間格版面**

將現有的平面列表 DayView 改為跟 WeekView 一樣的時間格版面，但只顯示一天。保留全天任務區和時間任務區的區隔。

```typescript
const DayView = () => {
  const dayTasks = getTasksForDate(currentDate)

  // 區分全天任務和有時間的任務
  const isSingleDayTimedTask = (task: Task) => {
    const taskStart = task.startDate ? new Date(task.startDate) : null
    const taskEnd = task.dueDate ? new Date(task.dueDate) : null

    if (taskStart && taskEnd && taskStart.getTime() === taskEnd.getTime() && !task.estimatedMinutes) {
      return false // 時間點任務且無預估時間，視為全天
    }

    if (taskStart && (taskStart.getHours() !== 0 || taskStart.getMinutes() !== 0)) {
      return true
    }
    if (taskEnd && (taskEnd.getHours() !== 0 || taskEnd.getMinutes() !== 0)) {
      return true
    }
    // 有 estimatedMinutes 且有 startDate（來自排程）
    if (taskStart && task.estimatedMinutes) {
      return true
    }

    return false
  }

  const timedTasks = dayTasks.filter(t => isSingleDayTimedTask(t))
  const allDayTasks = dayTasks.filter(t => !isSingleDayTimedTask(t))

  // 計算重疊任務的並排位置（複用 WeekView 的邏輯）
  const getTaskLayout = (tasksToLayout: Task[]) => {
    const layoutMap = new Map<string, { column: number; totalColumns: number }>()

    const taskRanges = tasksToLayout.map(task => {
      const currentTask = draggingTask?.id === task.id ? draggingTask : task
      const taskStart = currentTask.startDate ? new Date(currentTask.startDate) : null
      const taskEnd = currentTask.dueDate ? new Date(currentTask.dueDate) : null

      let startMinutes = 0
      let endMinutes = 60

      if (taskStart) {
        startMinutes = taskStart.getHours() * 60 + taskStart.getMinutes()
        if (taskEnd && taskEnd.getTime() !== taskStart.getTime()) {
          endMinutes = taskEnd.getHours() * 60 + taskEnd.getMinutes()
        } else if (currentTask.estimatedMinutes) {
          endMinutes = startMinutes + currentTask.estimatedMinutes
        } else {
          endMinutes = startMinutes + 60
        }
      } else if (taskEnd) {
        endMinutes = taskEnd.getHours() * 60 + taskEnd.getMinutes()
        startMinutes = endMinutes - (currentTask.estimatedMinutes || 60)
      }

      return { task, startMinutes, endMinutes }
    }).sort((a, b) => a.startMinutes - b.startMinutes)

    const groups: typeof taskRanges[] = []
    let currentGroup: typeof taskRanges = []

    taskRanges.forEach(range => {
      if (currentGroup.length === 0) {
        currentGroup.push(range)
      } else {
        const overlaps = currentGroup.some(r =>
          range.startMinutes < r.endMinutes && range.endMinutes > r.startMinutes
        )
        if (overlaps) {
          currentGroup.push(range)
        } else {
          groups.push(currentGroup)
          currentGroup = [range]
        }
      }
    })
    if (currentGroup.length > 0) groups.push(currentGroup)

    groups.forEach(group => {
      const columns: typeof taskRanges[] = []
      group.forEach(range => {
        let placed = false
        for (let col = 0; col < columns.length; col++) {
          const canPlace = columns[col].every(r =>
            range.startMinutes >= r.endMinutes || range.endMinutes <= r.startMinutes
          )
          if (canPlace) {
            columns[col].push(range)
            layoutMap.set(range.task.id, { column: col, totalColumns: 0 })
            placed = true
            break
          }
        }
        if (!placed) {
          columns.push([range])
          layoutMap.set(range.task.id, { column: columns.length - 1, totalColumns: 0 })
        }
      })
      group.forEach(range => {
        const layout = layoutMap.get(range.task.id)!
        layout.totalColumns = columns.length
      })
    })

    return layoutMap
  }

  const taskLayout = getTaskLayout(timedTasks)

  return (
    <div className="flex flex-col flex-1 overflow-y-auto relative">
      {/* 全天任務區 */}
      {allDayTasks.length > 0 && (
        <div className="shrink-0 border-b bg-background sticky top-0 z-20">
          <div className="flex">
            <div className="w-14 shrink-0 border-r border-gray-200/50 text-xs font-medium text-gray-500 pr-2 text-right py-1">
              全天
            </div>
            <div className="flex-1 py-1 px-2 space-y-1">
              {allDayTasks.map((task) => (
                <TaskCard key={task.id} task={task} compact />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 時間格 + 任務方塊 */}
      <div
        className="flex-1"
        ref={timeGridRef}
        onMouseMove={handleDragMove}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
      >
        <div className="flex">
          {/* 時間軸 */}
          <div className="w-14 shrink-0 border-r border-gray-200/50">
            {hours.map((hour) => (
              <div
                key={hour}
                className="h-14 border-b border-gray-200/30 text-xs font-medium text-gray-500 pr-2 text-right pt-1"
              >
                {hour}:00
              </div>
            ))}
          </div>

          {/* 任務區域 */}
          <div className="flex-1 relative">
            {/* 時間格線 + 點擊新增 */}
            {hours.map((hour) => (
              <div
                key={hour}
                className="h-14 border-b border-gray-100/50 cursor-pointer hover:bg-blue-50/30 transition-colors"
                onClick={() => handleTimeSlotClick(currentDate, hour)}
              />
            ))}

            {/* 有時間的任務方塊 */}
            {timedTasks.map((task) => {
              const displayTask = draggingTask?.id === task.id ? draggingTask : task
              const isDragging = draggingTask?.id === task.id

              const taskStart = displayTask.startDate ? new Date(displayTask.startDate) : null
              const taskEnd = displayTask.dueDate ? new Date(displayTask.dueDate) : null

              let displayTime: Date
              let endTime: Date | null = null

              const isPointTask = taskStart && taskEnd
                && taskStart.getTime() === taskEnd.getTime()
                && !displayTask.estimatedMinutes

              if (taskStart) {
                displayTime = taskStart
                if (taskEnd && taskEnd.getTime() !== taskStart.getTime()) {
                  endTime = taskEnd
                }
              } else if (taskEnd) {
                displayTime = taskEnd
              } else {
                return null
              }

              const startHour = displayTime.getHours()
              const startMinute = displayTime.getMinutes()
              const topOffset = startHour * 56 + (startMinute / 60) * 56

              let height = 50
              if (endTime && !isPointTask) {
                const durationMinutes = differenceInMinutes(endTime, displayTime)
                height = Math.max(24, (durationMinutes / 60) * 56 - 4)
              } else if (displayTask.estimatedMinutes) {
                height = Math.max(24, (displayTask.estimatedMinutes / 60) * 56 - 4)
              }

              const colors = getTaskBarStyle(displayTask)
              const layout = taskLayout.get(task.id) || { column: 0, totalColumns: 1 }
              const columnWidth = 100 / layout.totalColumns
              const leftOffset = layout.column * columnWidth

              const inferredEndTime = endTime || (displayTask.estimatedMinutes
                ? addMinutes(displayTime, displayTask.estimatedMinutes)
                : null)

              return (
                <div
                  key={task.id}
                  className={`
                    absolute rounded-md px-2 py-1 text-xs
                    overflow-hidden select-none
                    ${colors.bg} ${colors.text}
                    ${displayTask.status === 'completed' ? 'opacity-50' : ''}
                    ${isDragging ? 'shadow-xl ring-2 ring-primary cursor-grabbing z-30 scale-[1.02]' : 'cursor-grab hover:brightness-95 hover:shadow-md z-5'}
                    transition-shadow
                  `}
                  style={{
                    top: `${topOffset}px`,
                    height: `${height}px`,
                    left: `calc(${leftOffset}% + 4px)`,
                    width: `calc(${columnWidth}% - 8px)`,
                  }}
                  onMouseDown={(e) => handleDragStart(e, task, 'move', 0)}
                  onClick={() => !hasDragged && setSelectedTask(task)}
                >
                  <div className="flex items-start gap-1 h-full">
                    <span className={`w-1 h-full rounded-full shrink-0 ${colors.dot}`} />
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <p className={`font-medium truncate leading-tight text-[12px] ${displayTask.status === 'completed' ? 'line-through' : ''}`}>
                        {displayTask.title}
                      </p>
                      {height > 30 && (
                        <p className="text-[11px] opacity-75 truncate">
                          {format(displayTime, 'HH:mm')}{inferredEndTime ? ` - ${format(inferredEndTime, 'HH:mm')}` : ''}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* 底部 resize handle */}
                  {(taskStart || taskEnd) && !isDragging && (
                    <div
                      className="absolute bottom-0 left-0 right-0 h-[6px] cursor-ns-resize group z-20 rounded-b-md"
                      onMouseDown={(e) => {
                        e.stopPropagation()
                        e.preventDefault()
                        handleDragStart(e, task, 'resize', 0)
                      }}
                    >
                      <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2
                                      w-8 h-1 rounded-full bg-current opacity-0
                                      group-hover:opacity-50 transition-all duration-150" />
                    </div>
                  )}
                </div>
              )
            })}

            {/* 當前時間線 */}
            {isToday(currentDate) && (
              <div
                className="absolute left-0 right-0 border-t-2 border-red-500 z-10"
                style={{
                  top: `${(new Date().getHours() * 56 + (new Date().getMinutes() / 60) * 56)}px`,
                }}
              >
                <div className="w-2.5 h-2.5 bg-red-500 rounded-full -mt-[5px] -ml-[5px]" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: 驗證**

在瀏覽器切換到日視圖，確認：
- 任務方塊根據時間定位在時間格上
- 全天任務顯示在頂部
- 任務可拖曳移動和調整時長
- 當前時間紅線正確顯示
- 點擊空白時間格可新增任務

**Step 3: Commit**

```bash
git add app/calendar/page.tsx
git commit -m "feat: redesign day view as time-grid layout with drag support"
```

---

## Task 3: 自動捲動到當前時間

**Files:**
- Modify: `app/calendar/page.tsx` (新增 useEffect + ref)

**Step 1: 新增自動捲動邏輯**

在 `CalendarPage` 元件中新增 ref 和 useEffect，讓週視圖和日視圖在載入或切換時自動捲動到當前時間附近（提前 1 小時）：

```typescript
// 在 CalendarPage 中新增
const scrollContainerRef = useRef<HTMLDivElement>(null)

// 自動捲動到當前時間
useEffect(() => {
  if (viewMode === 'day' || viewMode === 'week') {
    // 延遲執行確保 DOM 已渲染
    const timer = setTimeout(() => {
      if (scrollContainerRef.current) {
        const now = new Date()
        const currentHour = now.getHours()
        // 捲動到當前時間前 1 小時的位置，讓使用者能看到上下文
        const scrollTarget = Math.max(0, (currentHour - 1) * 56)
        scrollContainerRef.current.scrollTop = scrollTarget
      }
    }, 100)
    return () => clearTimeout(timer)
  }
}, [viewMode, currentDate])
```

然後在 WeekView 和 DayView 的最外層 `div`（有 `overflow-y-auto` 的那個）加上 `ref={scrollContainerRef}`。

**注意：** WeekView 目前最外層的 `<div>` 在 line 883 已有 `overflow-y-auto`。DayView 改寫後也會有 `overflow-y-auto`。需要把 `scrollContainerRef` 加到這些元素上。

由於 DayView 和 WeekView 都是在 `CalendarPage` 內定義的子函數，它們可以直接使用外部的 ref。

**Step 2: 驗證**

重新載入頁面，確認：
- 週視圖自動捲動到當前時間附近
- 日視圖自動捲動到當前時間附近
- 切換日期後也自動捲動

**Step 3: Commit**

```bash
git add app/calendar/page.tsx
git commit -m "feat: auto-scroll to current time in day and week views"
```

---

## Task 4: 日視圖日期顯示優化

**Files:**
- Modify: `app/calendar/page.tsx:648-662` (TaskCard 中的日期顯示)

**Step 1: 優化 formatTaskDate 函數**

當日期包含時間時（非 00:00），應顯示具體時間而非只顯示日期：

```typescript
const formatTaskDate = (date: Date) => {
  const hasTime = date.getHours() !== 0 || date.getMinutes() !== 0
  if (isToday(date)) {
    return hasTime ? format(date, 'HH:mm') : '今天'
  }
  return hasTime
    ? format(date, 'M/d HH:mm', { locale: zhTW })
    : format(date, 'M/d', { locale: zhTW })
}
```

**Step 2: 修改 TaskCard 日期範圍顯示**

讓 TaskCard 中的日期顯示更智慧：

```typescript
{task.startDate && task.dueDate ? (
  // 如果日期相同且只差時間，只顯示時間範圍
  isSameDay(new Date(task.startDate), new Date(task.dueDate)) ? (
    <>
      {formatTaskDate(new Date(task.startDate))} - {format(new Date(task.dueDate), 'HH:mm')}
    </>
  ) : (
    <>
      {formatTaskDate(new Date(task.startDate))} - {formatTaskDate(new Date(task.dueDate))}
    </>
  )
) : task.dueDate ? (
  <>截止 {formatTaskDate(new Date(task.dueDate))}</>
) : task.startDate ? (
  task.estimatedMinutes ? (
    <>
      {formatTaskDate(new Date(task.startDate))} - {format(addMinutes(new Date(task.startDate), task.estimatedMinutes), 'HH:mm')}
    </>
  ) : (
    <>開始 {formatTaskDate(new Date(task.startDate))}</>
  )
) : null}
```

**Step 3: 驗證**

確認日視圖中全天任務的 TaskCard 正確顯示：
- "08:00 - 09:00" 而非 "今天 - 今天"
- 跨日任務正確顯示 "2/9 - 2/11"

**Step 4: Commit**

```bash
git add app/calendar/page.tsx
git commit -m "fix: improve date/time display in task cards"
```

---

## 修改檔案清單

| 檔案 | Task | 修改內容 |
|------|------|---------|
| `app/calendar/page.tsx` | 1 | 週視圖用 estimatedMinutes 計算方塊高度 |
| `app/calendar/page.tsx` | 2 | 日視圖改為時間格版面 + 拖曳支援 |
| `app/calendar/page.tsx` | 3 | 自動捲動到當前時間 |
| `app/calendar/page.tsx` | 4 | 日期/時間顯示優化 |

---

## 驗證方式

1. 開啟 http://localhost:3000/calendar
2. **週視圖**：確認有 estimatedMinutes 的任務方塊高度正確（30分=半格、60分=一格）
3. **日視圖**：確認任務方塊按時間定位在時間格上，不再是平面列表
4. **日視圖**：拖曳任務可移動時間，底部拖曳可調整時長
5. **自動捲動**：頁面載入後自動捲動到當前時間
6. **時間顯示**：TaskCard 顯示 "08:00 - 09:00" 而非 "今天 - 今天"
