import { google, calendar_v3 } from 'googleapis'
import { getAuthenticatedClient, refreshAccessToken } from './google'

// 任務類型定義
interface Task {
  id: string
  title: string
  description?: string
  status: 'pending' | 'in_progress' | 'completed' | 'on_hold'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  dueDate?: string
  startDate?: string
  google_event_id?: string
}

// Google Calendar 事件類型
interface CalendarEvent {
  id: string
  summary: string
  description?: string
  start: string
  end: string
  status?: string
}

// 取得 Google Calendar API 實例
export function getCalendarClient(accessToken: string, refreshToken?: string) {
  const auth = getAuthenticatedClient(accessToken, refreshToken)
  return google.calendar({ version: 'v3', auth })
}

// 列出使用者的行事曆
export async function listCalendars(accessToken: string, refreshToken?: string) {
  const calendar = getCalendarClient(accessToken, refreshToken)
  const response = await calendar.calendarList.list()
  return response.data.items || []
}

// 取得行事曆事件
export async function getCalendarEvents(
  accessToken: string,
  refreshToken?: string,
  calendarId: string = 'primary',
  timeMin?: string,
  timeMax?: string
): Promise<CalendarEvent[]> {
  const calendar = getCalendarClient(accessToken, refreshToken)

  const params: calendar_v3.Params$Resource$Events$List = {
    calendarId,
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 100,
  }

  if (timeMin) params.timeMin = timeMin
  if (timeMax) params.timeMax = timeMax

  const response = await calendar.events.list(params)
  const events = response.data.items || []

  return events.map(event => ({
    id: event.id || '',
    summary: event.summary || '',
    description: event.description || undefined,
    start: event.start?.dateTime || event.start?.date || '',
    end: event.end?.dateTime || event.end?.date || '',
    status: event.status || undefined,
  }))
}

// 建立 Google Calendar 事件（從任務）
export async function createCalendarEvent(
  accessToken: string,
  refreshToken: string | undefined,
  task: Task,
  calendarId: string = 'primary'
): Promise<string | null> {
  const calendar = getCalendarClient(accessToken, refreshToken)

  // 計算事件時間
  const startDate = task.startDate || task.dueDate
  if (!startDate) return null

  const startDateTime = new Date(startDate)
  let endDateTime: Date

  // 如果有明確的結束時間（dueDate）且晚於開始時間，使用它
  if (task.dueDate && task.startDate && new Date(task.dueDate) > new Date(task.startDate)) {
    endDateTime = new Date(task.dueDate)
  } else {
    // 否則預設為開始時間 + 1 小時
    endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000)
  }

  // 建立事件
  const event: calendar_v3.Schema$Event = {
    summary: `[${getPriorityEmoji(task.priority)}] ${task.title}`,
    description: formatTaskDescription(task),
    start: {
      dateTime: startDateTime.toISOString(),
      timeZone: 'Asia/Taipei',
    },
    end: {
      dateTime: endDateTime.toISOString(),
      timeZone: 'Asia/Taipei',
    },
    colorId: getColorIdByPriority(task.priority),
    extendedProperties: {
      private: {
        vibePlannerTaskId: task.id,
        vibePlannerStatus: task.status,
      },
    },
  }

  const response = await calendar.events.insert({
    calendarId,
    requestBody: event,
  })

  return response.data.id || null
}

// 更新 Google Calendar 事件
export async function updateCalendarEvent(
  accessToken: string,
  refreshToken: string | undefined,
  eventId: string,
  task: Task,
  calendarId: string = 'primary'
): Promise<boolean> {
  const calendar = getCalendarClient(accessToken, refreshToken)

  // 計算事件時間
  const startDate = task.startDate || task.dueDate
  if (!startDate) return false

  const startDateTime = new Date(startDate)
  let endDateTime: Date

  // 如果有明確的結束時間（dueDate）且晚於開始時間，使用它
  if (task.dueDate && task.startDate && new Date(task.dueDate) > new Date(task.startDate)) {
    endDateTime = new Date(task.dueDate)
  } else {
    // 否則預設為開始時間 + 1 小時
    endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000)
  }

  const event: calendar_v3.Schema$Event = {
    summary: `[${getPriorityEmoji(task.priority)}] ${task.title}`,
    description: formatTaskDescription(task),
    start: {
      dateTime: startDateTime.toISOString(),
      timeZone: 'Asia/Taipei',
    },
    end: {
      dateTime: endDateTime.toISOString(),
      timeZone: 'Asia/Taipei',
    },
    colorId: getColorIdByPriority(task.priority),
    extendedProperties: {
      private: {
        vibePlannerTaskId: task.id,
        vibePlannerStatus: task.status,
      },
    },
  }

  try {
    await calendar.events.update({
      calendarId,
      eventId,
      requestBody: event,
    })
    return true
  } catch (error) {
    console.error('更新 Google Calendar 事件失敗:', error)
    return false
  }
}

// 刪除 Google Calendar 事件
export async function deleteCalendarEvent(
  accessToken: string,
  refreshToken: string | undefined,
  eventId: string,
  calendarId: string = 'primary'
): Promise<boolean> {
  const calendar = getCalendarClient(accessToken, refreshToken)

  try {
    await calendar.events.delete({
      calendarId,
      eventId,
    })
    return true
  } catch (error) {
    console.error('刪除 Google Calendar 事件失敗:', error)
    return false
  }
}

// 輔助函數：取得優先級 emoji
function getPriorityEmoji(priority: Task['priority']): string {
  switch (priority) {
    case 'urgent':
      return '🔴'
    case 'high':
      return '🟠'
    case 'medium':
      return '🟡'
    case 'low':
      return '🟢'
    default:
      return '⚪'
  }
}

// 輔助函數：根據優先級取得 Google Calendar 顏色 ID
function getColorIdByPriority(priority: Task['priority']): string {
  // Google Calendar 顏色 ID:
  // 1: Lavender, 2: Sage, 3: Grape, 4: Flamingo, 5: Banana
  // 6: Tangerine, 7: Peacock, 8: Graphite, 9: Blueberry, 10: Basil, 11: Tomato
  switch (priority) {
    case 'urgent':
      return '11' // Tomato (紅色)
    case 'high':
      return '6' // Tangerine (橘色)
    case 'medium':
      return '5' // Banana (黃色)
    case 'low':
      return '10' // Basil (綠色)
    default:
      return '8' // Graphite (灰色)
  }
}

// 輔助函數：格式化任務描述
function formatTaskDescription(task: Task): string {
  const lines = [
    `📋 Vibe Planner 任務`,
    ``,
    `狀態: ${getStatusLabel(task.status)}`,
    `優先級: ${getPriorityLabel(task.priority)}`,
  ]

  if (task.description) {
    lines.push(``, `---`, ``, task.description)
  }

  lines.push(``, `🔗 此事件由 Vibe Planner 同步`)

  return lines.join('\n')
}

function getStatusLabel(status: Task['status']): string {
  switch (status) {
    case 'pending':
      return '待處理'
    case 'in_progress':
      return '進行中'
    case 'completed':
      return '已完成'
    case 'on_hold':
      return '暫停'
    default:
      return status
  }
}

function getPriorityLabel(priority: Task['priority']): string {
  switch (priority) {
    case 'urgent':
      return '緊急'
    case 'high':
      return '高'
    case 'medium':
      return '中'
    case 'low':
      return '低'
    default:
      return priority
  }
}
