import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// 訊息類型
export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  metadata?: {
    tasksExtracted?: string[]
    imageUrl?: string
  }
}

// 任務類型（用於排程）
export type TaskType = 'focus' | 'background'

// 處理模式類型
export type ProcessingMode = 'extractTasks' | 'organizeMeetingNotes'

// 任務類型
export interface Task {
  id: string
  title: string
  description?: string
  status: 'pending' | 'in_progress' | 'completed' | 'on_hold'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  startDate?: Date
  dueDate?: Date
  assignee?: string
  projectId?: string
  project?: string  // 專案名稱（從 AI 萃取）
  createdAt: Date
  updatedAt: Date
  completedAt?: Date
  // AI 排程欄位
  estimatedMinutes?: number   // 預估時間（分鐘）
  taskType?: TaskType         // 任務類型：focus（專注）或 background（背景）
}

// 專案類型
export interface Project {
  id: string
  name: string
  description?: string
  status: 'active' | 'completed' | 'archived'
  progress: number
  createdAt: Date
  updatedAt: Date
}

// API 使用記錄類型
export interface ApiUsageRecord {
  id: string
  timestamp: Date
  model: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  cost: number // USD
}

// GPT-4.1 價格 (per 1M tokens)
// 參考: https://openai.com/api/pricing/
const PRICING = {
  'gpt-4.1': {
    input: 2.00,   // $2.00 per 1M input tokens
    output: 8.00,  // $8.00 per 1M output tokens
  },
  'gpt-4o': {
    input: 2.50,   // $2.50 per 1M input tokens
    output: 10.00, // $10.00 per 1M output tokens
  },
} as const

// 應用程式狀態
export interface AppState {
  // 訊息
  messages: Message[]
  addMessage: (message: Omit<Message, 'id' | 'timestamp'> | Message) => void
  setMessages: (messages: Message[]) => void
  clearMessages: () => void

  // 任務
  tasks: Task[]
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateTask: (id: string, updates: Partial<Task>) => void
  deleteTask: (id: string) => void
  completeTask: (id: string) => void

  // 專案（同步到 Supabase）
  projects: Project[]
  addProject: (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>
  deleteProject: (id: string) => Promise<void>

  // API 使用量
  apiUsage: ApiUsageRecord[]
  addApiUsage: (usage: { model: string; promptTokens: number; completionTokens: number }) => Promise<void>
  loadApiUsage: () => Promise<void>
  clearApiUsage: () => Promise<void>

  // UI 狀態
  isLoading: boolean
  setIsLoading: (loading: boolean) => void

  // Streaming 狀態
  streamingContent: string
  setStreamingContent: (content: string) => void
  appendStreamingContent: (content: string) => void
  clearStreamingContent: () => void

  // 待確認任務群組（每次萃取是獨立群組）
  pendingTaskGroups: PendingTaskGroup[]
  addPendingTaskGroup: (tasks: ExtractedTask[], sourceContext?: string, duplicateWarnings?: string[]) => void
  updatePendingTaskGroup: (groupId: string, tasks: ExtractedTask[]) => void
  updatePendingTask: (groupId: string, taskIndex: number, updates: Partial<ExtractedTask>) => void
  removePendingTaskGroup: (groupId: string) => void
  clearPendingTaskGroups: () => void

  // 向下相容（舊版）
  pendingTasks: ExtractedTask[]
  setPendingTasks: (tasks: ExtractedTask[]) => void
  clearPendingTasks: () => void

  // 已處理任務歷史（保留在對話中顯示）
  processedTaskGroups: ProcessedTaskGroup[]
  addProcessedTaskGroup: (tasks: ProcessedTask[], sourceContext?: string) => void
  updateTaskFeedback: (groupId: string, taskIndex: number, feedback: 'positive' | 'negative') => void
  clearProcessedTaskGroups: () => void

  // AI 學習偏好
  lastInputContext: string  // 最後一次輸入的上下文（用於學習）
  setLastInputContext: (context: string) => void

  // 待確認任務分類（批次更新專案）
  pendingCategorizations: PendingCategorizationGroup | null
  setPendingCategorizations: (group: PendingCategorizationGroup | null) => void
  updateCategorizationSelection: (taskId: string, selected: boolean) => void
  clearPendingCategorizations: () => void

  // 待確認任務更新（AI 修改現有任務）
  pendingTaskUpdate: PendingTaskUpdate | null
  setPendingTaskUpdate: (update: PendingTaskUpdate | null) => void
  clearPendingTaskUpdate: () => void

  // 待確認任務搜尋（讓用戶選擇要更新哪個任務）
  pendingTaskSearch: PendingTaskSearch | null
  setPendingTaskSearch: (search: PendingTaskSearch | null) => void
  selectTaskForUpdate: (taskId: string, taskTitle: string) => void  // 選擇要更新的任務
  clearPendingTaskSearch: () => void

  // 待確認排程預覽
  pendingSchedulePreview: PendingSchedulePreview | null
  setPendingSchedulePreview: (preview: PendingSchedulePreview | null) => void
  clearPendingSchedulePreview: () => void

  // 待顯示的會議記錄
  pendingMeetingNotes: PendingMeetingNotes | null
  setPendingMeetingNotes: (notes: PendingMeetingNotes | null) => void
  clearPendingMeetingNotes: () => void

  // 處理模式選擇
  processingModes: ProcessingMode[]
  setProcessingModes: (modes: ProcessingMode[]) => void
  toggleProcessingMode: (mode: ProcessingMode) => void
}

// AI 萃取任務的類型
export interface ExtractedTask {
  title: string
  description?: string
  start_date?: string  // 開始日期
  due_date?: string    // 截止日期
  assignee?: string
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  project?: string
  group?: string  // 任務組別：電訪組、業務組、行政組、客服組、行銷組、財務組
  recurrence_type?: 'none' | 'daily' | 'weekly' | 'monthly'  // 例行性任務類型
  // 注意：task_type 在 AI 萃取中用於 action/follow-up/decision 分類
  // 排程用的 estimated_minutes 和 task_type (focus/background) 在 S-005 中由另一個 AI 流程設定
}

// 待確認任務群組（每次萃取是一個群組）
export interface PendingTaskGroup {
  id: string
  timestamp: Date
  tasks: ExtractedTask[]
  sourceContext?: string  // 來源逐字稿片段
  duplicateWarnings?: string[]  // 被過濾掉的重複任務警告
}

// 已處理任務的狀態
export interface ProcessedTask extends ExtractedTask {
  status: 'added' | 'skipped'  // 加入或略過
  feedback?: 'positive' | 'negative'  // 使用者回饋
}

// 已處理任務群組（一次萃取的結果）
export interface ProcessedTaskGroup {
  id: string
  timestamp: Date
  tasks: ProcessedTask[]
  sourceContext?: string  // 來源上下文（逐字稿片段）
}

// 任務分類建議（用於批次更新專案）
export interface TaskCategorizationItem {
  task_id: string
  task_title: string
  current_project: string | null
  suggested_project: string
  reason: string
  selected: boolean  // 使用者是否選擇套用此分類
}

// 待確認分類群組
export interface PendingCategorizationGroup {
  id: string
  timestamp: Date
  categorizations: TaskCategorizationItem[]
  suggested_projects: Array<{ name: string; description?: string }>
}

// 待確認任務更新（用於 AI 更新現有任務）
export interface PendingTaskUpdate {
  id: string
  timestamp: Date
  task_id: string
  task_title: string
  updates: {
    title?: string
    description?: string
    due_date?: string
    priority?: 'low' | 'medium' | 'high' | 'urgent'
    assignee?: string
    project?: string
  }
  reason: string  // AI 說明為什麼要這樣更新
}

// 任務搜尋結果中的單一任務
export interface TaskSearchResult {
  task_id: string
  task_title: string
  task_project: string | null
  task_assignee: string | null
  task_due_date: string | null
  match_reason: string  // AI 說明為什麼這個任務符合
}

// 待確認任務搜尋（讓用戶選擇要更新哪個任務）
export interface PendingTaskSearch {
  id: string
  timestamp: Date
  search_query: string  // 用戶原本說的話
  matched_tasks: TaskSearchResult[]  // 匹配到的任務列表
  intended_updates: {  // 用戶想要做的更新
    description?: string
    title?: string
    due_date?: string
    priority?: 'low' | 'medium' | 'high' | 'urgent'
    assignee?: string
    project?: string
  }
  update_reason: string  // AI 說明要怎麼更新
  // 用戶選擇後的狀態
  selectedTaskId?: string  // 用戶選擇的任務 ID
  selectedTaskTitle?: string  // 用戶選擇的任務標題
}

// 排程預覽中的任務
export interface ScheduledTaskItem {
  taskId: string
  taskTitle: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  dueDate: string | null
  startTime: string
  endTime: string
  estimatedMinutes: number
  taskType: 'focus' | 'background'
  confidence: 'high' | 'medium' | 'low'
  slotDate: string
  reasoning: string
}

// 未能排程的任務
export interface UnscheduledTaskItem {
  taskId: string
  taskTitle: string
  reason: string
}

// 衝突資訊（S-010）
export interface ConflictInfo {
  taskId: string
  taskTitle: string
  taskStart: string
  taskEnd: string
  conflictingEvent: {
    title: string
    start: string
    end: string
  }
  overlapMinutes: number
  conflictType: 'full_overlap' | 'partial_start' | 'partial_end' | 'task_contains_event' | 'event_contains_task'
}

export interface ConflictCheckResult {
  hasConflicts: boolean
  conflicts: ConflictInfo[]
  conflictCount: number
  totalOverlapMinutes: number
}

// 待確認排程預覽
export interface PendingSchedulePreview {
  id: string
  timestamp: Date
  scheduledTasks: ScheduledTaskItem[]
  unscheduledTasks: UnscheduledTaskItem[]
  summary: {
    totalTasksProcessed: number
    successfullyScheduled: number
    failedToSchedule: number
    totalMinutesScheduled: number
    daysSpanned: number
  }
  // S-010: 衝突資訊
  conflictCheck?: ConflictCheckResult
  conflictSummary?: string
}

// 整理後的會議記錄
export interface OrganizedMeetingNotes {
  title: string
  date: string
  participants: string[]
  discussionPoints: { topic: string; details: string }[]
  decisions: string[]
  actionItems: { task: string; assignee?: string; dueDate?: string }[]
  nextSteps: string[]
}

// 待顯示的會議記錄
export interface PendingMeetingNotes {
  id: string
  timestamp: Date
  organized: OrganizedMeetingNotes
  markdown: string
}

// 生成 UUID
const generateId = () => crypto.randomUUID()

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // 訊息
      messages: [],
      addMessage: (message) =>
        set((state) => ({
          messages: [
            ...state.messages,
            {
              ...message,
              // 如果已有 id 和 timestamp 就使用，否則生成新的
              id: 'id' in message && message.id ? message.id : generateId(),
              timestamp: 'timestamp' in message && message.timestamp ? message.timestamp : new Date(),
            },
          ],
        })),
      setMessages: (messages) => set({ messages }),
      clearMessages: () => set({ messages: [] }),

      // 任務
      tasks: [],
      addTask: (task) =>
        set((state) => ({
          tasks: [
            ...state.tasks,
            {
              ...task,
              id: generateId(),
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        })),
      updateTask: (id, updates) =>
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === id
              ? { ...task, ...updates, updatedAt: new Date() }
              : task
          ),
        })),
      deleteTask: (id) =>
        set((state) => ({
          tasks: state.tasks.filter((task) => task.id !== id),
        })),
      completeTask: (id) =>
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === id
              ? {
                  ...task,
                  status: 'completed' as const,
                  completedAt: new Date(),
                  updatedAt: new Date(),
                }
              : task
          ),
        })),

      // 專案（同步到 Supabase）
      projects: [],
      addProject: async (project) => {
        const newProject = {
          ...project,
          id: generateId(),
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        // 先更新本地狀態
        set((state) => ({
          projects: [...state.projects, newProject],
        }))
        // 同步到 Supabase
        try {
          const { projectsApi } = await import('./supabase-api')
          await projectsApi.create({
            name: project.name,
            description: project.description || null,
            status: project.status,
            progress: project.progress,
          })
          console.log('[Store] 專案已同步到 Supabase:', project.name)
        } catch (err) {
          console.error('[Store] 專案同步失敗:', err)
        }
      },
      updateProject: async (id, updates) => {
        // 先更新本地狀態
        set((state) => ({
          projects: state.projects.map((project) =>
            project.id === id
              ? { ...project, ...updates, updatedAt: new Date() }
              : project
          ),
        }))
        // 同步到 Supabase
        try {
          const { projectsApi } = await import('./supabase-api')
          await projectsApi.update(id, updates as Record<string, unknown>)
        } catch (err) {
          console.error('[Store] 專案更新同步失敗:', err)
        }
      },
      deleteProject: async (id) => {
        // 先更新本地狀態
        set((state) => ({
          projects: state.projects.filter((project) => project.id !== id),
        }))
        // 同步到 Supabase
        try {
          const { projectsApi } = await import('./supabase-api')
          await projectsApi.delete(id)
        } catch (err) {
          console.error('[Store] 專案刪除同步失敗:', err)
        }
      },

      // API 使用量
      apiUsage: [],
      addApiUsage: async ({ model, promptTokens, completionTokens }) => {
        const pricing = PRICING[model as keyof typeof PRICING] || PRICING['gpt-4.1']
        const cost =
          (promptTokens / 1_000_000) * pricing.input +
          (completionTokens / 1_000_000) * pricing.output

        const newRecord = {
          id: generateId(),
          timestamp: new Date(),
          model,
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
          cost,
        }

        // 更新本地狀態
        set((state) => ({
          apiUsage: [...state.apiUsage, newRecord],
        }))

        // 同步到 Supabase
        try {
          const { apiUsageApi } = await import('./supabase-api')
          await apiUsageApi.create({
            model,
            prompt_tokens: promptTokens,
            completion_tokens: completionTokens,
            total_tokens: promptTokens + completionTokens,
            cost,
          })
        } catch (error) {
          console.error('同步 API 使用量失敗:', error)
        }
      },
      loadApiUsage: async () => {
        try {
          const { apiUsageApi } = await import('./supabase-api')
          const records = await apiUsageApi.getAll()
          const localRecords = records.map((r) => ({
            id: r.id,
            timestamp: new Date(r.created_at),
            model: r.model,
            promptTokens: r.prompt_tokens,
            completionTokens: r.completion_tokens,
            totalTokens: r.total_tokens,
            cost: Number(r.cost),
          }))
          set({ apiUsage: localRecords })
        } catch (error) {
          console.error('載入 API 使用量失敗:', error)
        }
      },
      clearApiUsage: async () => {
        set({ apiUsage: [] })
        try {
          const { apiUsageApi } = await import('./supabase-api')
          await apiUsageApi.clear()
        } catch (error) {
          console.error('清除 API 使用量失敗:', error)
        }
      },

      // UI 狀態
      isLoading: false,
      setIsLoading: (loading) => set({ isLoading: loading }),

      // Streaming 狀態
      streamingContent: '',
      setStreamingContent: (content) => set({ streamingContent: content }),
      appendStreamingContent: (content) => set((state) => ({
        streamingContent: state.streamingContent + content
      })),
      clearStreamingContent: () => set({ streamingContent: '' }),

      // 待確認任務群組
      pendingTaskGroups: [],
      addPendingTaskGroup: (tasks, sourceContext, duplicateWarnings) =>
        set((state) => ({
          pendingTaskGroups: [
            ...state.pendingTaskGroups,
            {
              id: generateId(),
              timestamp: new Date(),
              tasks,
              sourceContext,
              duplicateWarnings,
            },
          ],
        })),
      updatePendingTaskGroup: (groupId, tasks) =>
        set((state) => ({
          pendingTaskGroups: tasks.length > 0
            ? state.pendingTaskGroups.map((group) =>
                group.id === groupId ? { ...group, tasks } : group
              )
            : state.pendingTaskGroups.filter((group) => group.id !== groupId),
        })),
      updatePendingTask: (groupId, taskIndex, updates) =>
        set((state) => ({
          pendingTaskGroups: state.pendingTaskGroups.map((group) =>
            group.id === groupId
              ? {
                  ...group,
                  tasks: group.tasks.map((task, i) =>
                    i === taskIndex ? { ...task, ...updates } : task
                  ),
                }
              : group
          ),
        })),
      removePendingTaskGroup: (groupId) =>
        set((state) => ({
          pendingTaskGroups: state.pendingTaskGroups.filter((group) => group.id !== groupId),
        })),
      clearPendingTaskGroups: () => set({ pendingTaskGroups: [] }),

      // 向下相容（舊版，已棄用）
      pendingTasks: [],
      setPendingTasks: (tasks) => set({ pendingTasks: tasks }),
      // 清除所有待確認任務和已處理任務歷史（用於切換/建立對話時）
      clearPendingTasks: () => set({ pendingTasks: [], pendingTaskGroups: [], processedTaskGroups: [], pendingCategorizations: null }),

      // 已處理任務歷史
      processedTaskGroups: [],
      addProcessedTaskGroup: (tasks, sourceContext) =>
        set((state) => ({
          processedTaskGroups: [
            ...state.processedTaskGroups,
            {
              id: generateId(),
              timestamp: new Date(),
              tasks,
              sourceContext,
            },
          ],
        })),
      updateTaskFeedback: (groupId, taskIndex, feedback) =>
        set((state) => ({
          processedTaskGroups: state.processedTaskGroups.map((group) =>
            group.id === groupId
              ? {
                  ...group,
                  tasks: group.tasks.map((task, i) =>
                    i === taskIndex ? { ...task, feedback } : task
                  ),
                }
              : group
          ),
        })),
      clearProcessedTaskGroups: () => set({ processedTaskGroups: [] }),

      // AI 學習偏好
      lastInputContext: '',
      setLastInputContext: (context) => set({ lastInputContext: context }),

      // 待確認任務分類
      pendingCategorizations: null,
      setPendingCategorizations: (group) => set({ pendingCategorizations: group }),
      updateCategorizationSelection: (taskId, selected) =>
        set((state) => ({
          pendingCategorizations: state.pendingCategorizations
            ? {
                ...state.pendingCategorizations,
                categorizations: state.pendingCategorizations.categorizations.map((item) =>
                  item.task_id === taskId ? { ...item, selected } : item
                ),
              }
            : null,
        })),
      clearPendingCategorizations: () => set({ pendingCategorizations: null }),

      // 待確認任務更新
      pendingTaskUpdate: null,
      setPendingTaskUpdate: (update) => set({ pendingTaskUpdate: update }),
      clearPendingTaskUpdate: () => set({ pendingTaskUpdate: null }),

      // 待確認任務搜尋
      pendingTaskSearch: null,
      setPendingTaskSearch: (search) => set({ pendingTaskSearch: search }),
      selectTaskForUpdate: (taskId, taskTitle) =>
        set((state) => ({
          pendingTaskSearch: state.pendingTaskSearch
            ? {
                ...state.pendingTaskSearch,
                selectedTaskId: taskId,
                selectedTaskTitle: taskTitle,
              }
            : null,
        })),
      clearPendingTaskSearch: () => set({ pendingTaskSearch: null }),

      // 待確認排程預覽
      pendingSchedulePreview: null,
      setPendingSchedulePreview: (preview) => set({ pendingSchedulePreview: preview }),
      clearPendingSchedulePreview: () => set({ pendingSchedulePreview: null }),

      // 待顯示的會議記錄
      pendingMeetingNotes: null,
      setPendingMeetingNotes: (notes) => set({ pendingMeetingNotes: notes }),
      clearPendingMeetingNotes: () => set({ pendingMeetingNotes: null }),

      // 處理模式選擇（預設兩者都啟用）
      processingModes: ['extractTasks', 'organizeMeetingNotes'],
      setProcessingModes: (modes) => set({ processingModes: modes }),
      toggleProcessingMode: (mode) => set((state) => {
        const current = state.processingModes
        if (current.includes(mode)) {
          // 移除模式（但至少保留一個）
          const newModes = current.filter(m => m !== mode)
          return { processingModes: newModes.length > 0 ? newModes : current }
        } else {
          // 添加模式
          return { processingModes: [...current, mode] }
        }
      }),
    }),
    {
      name: 'vibe-planner-storage',
      partialize: (state) => ({
        // messages 不再持久化，由 ChatSessionContext 管理
        tasks: state.tasks,
        projects: state.projects,
        apiUsage: state.apiUsage,
        processedTaskGroups: state.processedTaskGroups,
        pendingTaskGroups: state.pendingTaskGroups,
      }),
    }
  )
)
