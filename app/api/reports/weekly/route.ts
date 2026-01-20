import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import {
  calculateWeeklyReport,
  generateSummaryCards,
  generateDailyBarChartData,
  generatePriorityChartData,
} from '@/lib/reports/calculations'

/**
 * GET /api/reports/weekly
 * 取得週報表資料
 *
 * Query Parameters:
 * - weekStart: YYYY-MM-DD (optional, 預設為本週一)
 * - compare: boolean (optional, 是否包含上週資料以計算趨勢)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 驗證使用者身份
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { success: false, error: '未授權' },
        { status: 401 }
      )
    }

    // 取得查詢參數
    const { searchParams } = new URL(request.url)
    const weekStartParam = searchParams.get('weekStart')
    const compare = searchParams.get('compare') === 'true'

    // 本地時區日期格式化函數
    const formatLocalDate = (date: Date): string => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    // 計算週的開始日期
    let weekStart: Date
    if (weekStartParam) {
      // 使用本地時區解析日期
      const [year, month, day] = weekStartParam.split('-').map(Number)
      weekStart = new Date(year, month - 1, day)
    } else {
      // 預設為本週一
      const today = new Date()
      const dayOfWeek = today.getDay()
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
      weekStart = new Date(today)
      weekStart.setDate(today.getDate() + mondayOffset)
    }
    weekStart.setHours(0, 0, 0, 0)

    // 計算週日
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)

    // 如果需要比較，也取得上週範圍
    const prevWeekStart = new Date(weekStart)
    prevWeekStart.setDate(weekStart.getDate() - 7)
    const prevWeekEnd = new Date(prevWeekStart)
    prevWeekEnd.setDate(prevWeekStart.getDate() + 6)

    // 查詢範圍（包含上週以便計算趨勢）- 使用本地時區
    const queryStart = compare
      ? formatLocalDate(prevWeekStart)
      : formatLocalDate(weekStart)
    const queryEnd = formatLocalDate(weekEnd)

    // 查詢任務
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select(
        `
        id,
        title,
        status,
        priority,
        estimated_minutes,
        start_date,
        completed_at,
        project_id,
        projects:project_id (
          id,
          name
        )
      `
      )
      .gte('start_date', queryStart)
      .lte('start_date', queryEnd + 'T23:59:59')
      .order('start_date', { ascending: true })

    if (error) {
      console.error('[API] 查詢任務失敗:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    // 格式化任務資料
    const formattedTasks = (tasks || []).map((task) => {
      const projectData = task.projects as unknown
      let projectName = '無專案'
      if (projectData && typeof projectData === 'object') {
        if (Array.isArray(projectData) && projectData.length > 0) {
          projectName = projectData[0]?.name || '無專案'
        } else if ('name' in projectData) {
          projectName = (projectData as { name: string }).name
        }
      }

      return {
        id: task.id,
        title: task.title,
        status: task.status as 'pending' | 'in_progress' | 'completed' | 'cancelled',
        priority: task.priority as 'low' | 'medium' | 'high' | 'urgent',
        estimatedMinutes: task.estimated_minutes,
        scheduledStart: task.start_date,
        scheduledEnd: task.start_date, // 簡化處理
        completedAt: task.completed_at,
        projectId: task.project_id,
        projectName,
      }
    })

    // 計算本週報表
    const weeklyReport = calculateWeeklyReport(weekStart, formattedTasks)

    // 計算上週報表（如果需要比較）
    let previousWeekReport = undefined
    if (compare) {
      const prevStart = formatLocalDate(prevWeekStart)
      const prevEnd = formatLocalDate(prevWeekEnd)
      const prevWeekTasks = formattedTasks.filter((task) => {
        if (!task.scheduledStart) return false
        const taskDate = task.scheduledStart.split('T')[0]
        return taskDate >= prevStart && taskDate <= prevEnd
      })
      previousWeekReport = calculateWeeklyReport(prevWeekStart, prevWeekTasks)
    }

    // 產生摘要卡片
    const summaryCards = generateSummaryCards(weeklyReport, previousWeekReport)

    // 產生圖表資料
    const dailyChartData = generateDailyBarChartData(weeklyReport.dailyStats)
    const priorityChartData = generatePriorityChartData(weeklyReport.tasksByPriority)

    return NextResponse.json({
      success: true,
      report: weeklyReport,
      summaryCards,
      charts: {
        daily: dailyChartData,
        priority: priorityChartData,
      },
      previousReport: previousWeekReport,
    })
  } catch (error) {
    console.error('[API] 未預期錯誤:', error)
    return NextResponse.json(
      { success: false, error: '伺服器內部錯誤' },
      { status: 500 }
    )
  }
}
