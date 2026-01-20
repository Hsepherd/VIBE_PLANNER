/**
 * 自然語言日期解析工具
 * 將中文日期表達轉換為 YYYY-MM-DD 格式
 */

export interface DateRange {
  startDate: string  // YYYY-MM-DD
  endDate: string    // YYYY-MM-DD
  description: string // 人類可讀的描述
}

/**
 * 取得今天的日期（本地時區）
 */
function getToday(): Date {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return now
}

/**
 * 格式化日期為 YYYY-MM-DD
 */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

/**
 * 取得本週的開始和結束（週一到週日）
 */
function getThisWeek(): DateRange {
  const today = getToday()
  const dayOfWeek = today.getDay()
  // 週日是 0，我們要週一開始
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const monday = new Date(today)
  monday.setDate(today.getDate() + mondayOffset)

  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  return {
    startDate: formatDate(monday),
    endDate: formatDate(sunday),
    description: '本週（週一至週日）',
  }
}

/**
 * 取得下週的開始和結束
 */
function getNextWeek(): DateRange {
  const today = getToday()
  const dayOfWeek = today.getDay()
  const mondayOffset = dayOfWeek === 0 ? 1 : 8 - dayOfWeek
  const monday = new Date(today)
  monday.setDate(today.getDate() + mondayOffset)

  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  return {
    startDate: formatDate(monday),
    endDate: formatDate(sunday),
    description: '下週（週一至週日）',
  }
}

/**
 * 取得本週剩餘天數
 */
function getThisWeekRemaining(): DateRange {
  const today = getToday()
  const dayOfWeek = today.getDay()
  const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek
  const sunday = new Date(today)
  sunday.setDate(today.getDate() + daysUntilSunday)

  return {
    startDate: formatDate(today),
    endDate: formatDate(sunday),
    description: '本週剩餘時間',
  }
}

/**
 * 取得這個週末
 */
function getThisWeekend(): DateRange {
  const today = getToday()
  const dayOfWeek = today.getDay()
  // 計算到週六的天數
  const daysUntilSaturday = dayOfWeek <= 6 ? 6 - dayOfWeek : 0
  const saturday = new Date(today)
  saturday.setDate(today.getDate() + daysUntilSaturday)

  const sunday = new Date(saturday)
  sunday.setDate(saturday.getDate() + 1)

  return {
    startDate: formatDate(saturday),
    endDate: formatDate(sunday),
    description: '這週末',
  }
}

/**
 * 取得下個週末
 */
function getNextWeekend(): DateRange {
  const thisWeekend = getThisWeekend()
  const saturday = new Date(thisWeekend.startDate)
  saturday.setDate(saturday.getDate() + 7)

  const sunday = new Date(saturday)
  sunday.setDate(saturday.getDate() + 1)

  return {
    startDate: formatDate(saturday),
    endDate: formatDate(sunday),
    description: '下週末',
  }
}

/**
 * 取得本月剩餘天數
 */
function getThisMonthRemaining(): DateRange {
  const today = getToday()
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0)

  return {
    startDate: formatDate(today),
    endDate: formatDate(lastDay),
    description: '本月剩餘時間',
  }
}

/**
 * 取得下個月
 */
function getNextMonth(): DateRange {
  const today = getToday()
  const firstDay = new Date(today.getFullYear(), today.getMonth() + 1, 1)
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 2, 0)

  return {
    startDate: formatDate(firstDay),
    endDate: formatDate(lastDay),
    description: '下個月',
  }
}

/**
 * 取得未來 N 天
 */
function getNextNDays(n: number): DateRange {
  const today = getToday()
  const endDate = new Date(today)
  endDate.setDate(today.getDate() + n - 1)

  return {
    startDate: formatDate(today),
    endDate: formatDate(endDate),
    description: `未來 ${n} 天`,
  }
}

/**
 * 取得明天
 */
function getTomorrow(): DateRange {
  const today = getToday()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)

  return {
    startDate: formatDate(tomorrow),
    endDate: formatDate(tomorrow),
    description: '明天',
  }
}

/**
 * 取得後天
 */
function getDayAfterTomorrow(): DateRange {
  const today = getToday()
  const dayAfter = new Date(today)
  dayAfter.setDate(today.getDate() + 2)

  return {
    startDate: formatDate(dayAfter),
    endDate: formatDate(dayAfter),
    description: '後天',
  }
}

/**
 * 解析自然語言日期表達
 */
export function parseDateExpression(expression: string): DateRange | null {
  const normalized = expression.toLowerCase().trim()

  // 今天
  if (/今天|今日|today/i.test(normalized)) {
    const today = getToday()
    return {
      startDate: formatDate(today),
      endDate: formatDate(today),
      description: '今天',
    }
  }

  // 明天
  if (/明天|明日|tomorrow/i.test(normalized)) {
    return getTomorrow()
  }

  // 後天
  if (/後天|后天/i.test(normalized)) {
    return getDayAfterTomorrow()
  }

  // 本週/這週
  if (/本週|這週|这周|本周|this\s*week/i.test(normalized)) {
    if (/剩餘|剩余|remaining/i.test(normalized)) {
      return getThisWeekRemaining()
    }
    return getThisWeek()
  }

  // 下週/下周
  if (/下週|下周|next\s*week/i.test(normalized)) {
    return getNextWeek()
  }

  // 這週末/本週末
  if (/這週末|这周末|本週末|本周末|this\s*weekend/i.test(normalized)) {
    return getThisWeekend()
  }

  // 下週末/下周末
  if (/下週末|下周末|next\s*weekend/i.test(normalized)) {
    return getNextWeekend()
  }

  // 本月/這個月
  if (/本月|這個月|这个月|this\s*month/i.test(normalized)) {
    return getThisMonthRemaining()
  }

  // 下個月
  if (/下個月|下个月|next\s*month/i.test(normalized)) {
    return getNextMonth()
  }

  // 未來 N 天
  const daysMatch = normalized.match(/(?:未來|未来|接下來|接下来|next)\s*(\d+)\s*(?:天|日|days?)/i)
  if (daysMatch) {
    const days = parseInt(daysMatch[1], 10)
    if (days > 0 && days <= 365) {
      return getNextNDays(days)
    }
  }

  // N 週內
  const weeksMatch = normalized.match(/(\d+)\s*(?:週|周|weeks?)\s*(?:內|内|within)?/i)
  if (weeksMatch) {
    const weeks = parseInt(weeksMatch[1], 10)
    if (weeks > 0 && weeks <= 52) {
      return getNextNDays(weeks * 7)
    }
  }

  // 嘗試解析 YYYY-MM-DD 格式
  const dateMatch = normalized.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (dateMatch) {
    const dateStr = dateMatch[0]
    return {
      startDate: dateStr,
      endDate: dateStr,
      description: dateStr,
    }
  }

  // 嘗試解析 MM/DD 或 M月D日
  const monthDayMatch = normalized.match(/(\d{1,2})[\/月](\d{1,2})[日]?/)
  if (monthDayMatch) {
    const month = parseInt(monthDayMatch[1], 10)
    const day = parseInt(monthDayMatch[2], 10)
    const year = new Date().getFullYear()
    const dateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
    return {
      startDate: dateStr,
      endDate: dateStr,
      description: `${month}月${day}日`,
    }
  }

  return null
}

/**
 * 從用戶訊息中提取日期範圍
 * 用於 AI 理解排程指令
 */
export function extractDateRangeFromMessage(message: string): DateRange | null {
  // 常見的排程日期表達模式
  const patterns = [
    /排到(?:這週|本週|这周|本周)/i,
    /排到(?:下週|下周)/i,
    /排到(?:明天|後天)/i,
    /排到(?:本月|這個月)/i,
    /排到(?:下個月)/i,
    /排(?:未來|接下來)\s*\d+\s*天/i,
    /(?:這週|本週|下週|下周|明天|後天|本月).*?排/i,
  ]

  for (const pattern of patterns) {
    if (pattern.test(message)) {
      // 嘗試從訊息中提取日期表達
      const expressions = [
        '下週', '下周', 'next week',
        '本週', '這週', '这周', 'this week',
        '明天', '明日', 'tomorrow',
        '後天', '后天',
        '這週末', '本週末', '这周末',
        '下週末', '下周末',
        '本月', '這個月',
        '下個月',
      ]

      for (const expr of expressions) {
        if (message.includes(expr)) {
          return parseDateExpression(expr)
        }
      }

      // 檢查「未來 N 天」模式
      const daysMatch = message.match(/(?:未來|未来|接下來|接下来)\s*(\d+)\s*(?:天|日)/i)
      if (daysMatch) {
        return parseDateExpression(`未來 ${daysMatch[1]} 天`)
      }
    }
  }

  return null
}

/**
 * 取得日期範圍的人類可讀描述
 */
export function getDateRangeDescription(startDate: string, endDate: string): string {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const today = getToday()

  const formatShort = (date: Date) => {
    return `${date.getMonth() + 1}/${date.getDate()}`
  }

  const isSameDay = startDate === endDate

  if (isSameDay) {
    if (startDate === formatDate(today)) {
      return '今天'
    }
    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)
    if (startDate === formatDate(tomorrow)) {
      return '明天'
    }
    return formatShort(start)
  }

  return `${formatShort(start)} - ${formatShort(end)}`
}
