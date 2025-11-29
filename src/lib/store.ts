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

// 任務類型
export interface Task {
  id: string
  title: string
  description?: string
  status: 'pending' | 'in_progress' | 'completed'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  dueDate?: Date
  assignee?: string
  projectId?: string
  project?: string  // 專案名稱（從 AI 萃取）
  createdAt: Date
  updatedAt: Date
  completedAt?: Date
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

  // 專案
  projects: Project[]
  addProject: (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateProject: (id: string, updates: Partial<Project>) => void
  deleteProject: (id: string) => void

  // API 使用量
  apiUsage: ApiUsageRecord[]
  addApiUsage: (usage: { model: string; promptTokens: number; completionTokens: number }) => void
  clearApiUsage: () => void

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
  addPendingTaskGroup: (tasks: ExtractedTask[], sourceContext?: string) => void
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
}

// AI 萃取任務的類型
export interface ExtractedTask {
  title: string
  description?: string
  due_date?: string
  assignee?: string
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  project?: string
  group?: string  // 任務組別：電訪組、業務組、行政組、客服組、行銷組、財務組
}

// 待確認任務群組（每次萃取是一個群組）
export interface PendingTaskGroup {
  id: string
  timestamp: Date
  tasks: ExtractedTask[]
  sourceContext?: string  // 來源逐字稿片段
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

      // 專案
      projects: [],
      addProject: (project) =>
        set((state) => ({
          projects: [
            ...state.projects,
            {
              ...project,
              id: generateId(),
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        })),
      updateProject: (id, updates) =>
        set((state) => ({
          projects: state.projects.map((project) =>
            project.id === id
              ? { ...project, ...updates, updatedAt: new Date() }
              : project
          ),
        })),
      deleteProject: (id) =>
        set((state) => ({
          projects: state.projects.filter((project) => project.id !== id),
        })),

      // API 使用量
      apiUsage: [],
      addApiUsage: ({ model, promptTokens, completionTokens }) =>
        set((state) => {
          const pricing = PRICING[model as keyof typeof PRICING] || PRICING['gpt-4.1']
          const cost =
            (promptTokens / 1_000_000) * pricing.input +
            (completionTokens / 1_000_000) * pricing.output

          return {
            apiUsage: [
              ...state.apiUsage,
              {
                id: generateId(),
                timestamp: new Date(),
                model,
                promptTokens,
                completionTokens,
                totalTokens: promptTokens + completionTokens,
                cost,
              },
            ],
          }
        }),
      clearApiUsage: () => set({ apiUsage: [] }),

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
      addPendingTaskGroup: (tasks, sourceContext) =>
        set((state) => ({
          pendingTaskGroups: [
            ...state.pendingTaskGroups,
            {
              id: generateId(),
              timestamp: new Date(),
              tasks,
              sourceContext,
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
      clearPendingTasks: () => set({ pendingTasks: [], pendingTaskGroups: [] }),

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
    }),
    {
      name: 'vibe-planner-storage',
      partialize: (state) => ({
        messages: state.messages,
        tasks: state.tasks,
        projects: state.projects,
        apiUsage: state.apiUsage,
        processedTaskGroups: state.processedTaskGroups,
      }),
    }
  )
)
