/**
 * 重新萃取會議記錄任務 API
 * 使用更新的 AI prompt 重新解析會議內容，正確分離負責人和組別
 */

import { NextRequest, NextResponse } from 'next/server'
import { organizeMeetingNotes } from '@/lib/ai-functions/handlers/organizeMeetingNotes'
import { createClient } from '@/lib/supabase-server'

// 任務類型定義
interface ActionItem {
  task: string
  description?: string
  assignee?: string
  group?: string
  dueDate?: string
  startDate?: string
}

export async function POST(request: NextRequest) {
  try {
    const { meetingNoteId } = await request.json()

    if (!meetingNoteId) {
      return NextResponse.json({ error: '缺少會議記錄 ID' }, { status: 400 })
    }

    // 取得 Supabase client 和使用者
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '未登入' }, { status: 401 })
    }

    // 直接查詢會議記錄
    const { data: meetingNote, error: fetchError } = await supabase
      .from('meeting_notes')
      .select('*')
      .eq('id', meetingNoteId)
      .single()

    if (fetchError || !meetingNote) {
      return NextResponse.json({ error: '找不到會議記錄' }, { status: 404 })
    }

    // 重新使用 AI 整理會議內容
    const { organized, markdown } = await organizeMeetingNotes({
      rawContent: meetingNote.raw_content,
      meetingTitle: meetingNote.title,
    })

    // 刪除現有關聯任務
    const { data: existingTasks } = await supabase
      .from('tasks')
      .select('id')
      .eq('meeting_note_id', meetingNoteId)

    if (existingTasks && existingTasks.length > 0) {
      const taskIds = existingTasks.map(t => t.id)
      await supabase.from('tasks').delete().in('id', taskIds)
    }

    // 建立新任務（直接在這裡實作，避免客戶端模組問題）
    const now = new Date().toISOString()
    const today = new Date().toISOString().split('T')[0]

    const tasksToInsert = organized.actionItems.map((item: ActionItem) => ({
      id: crypto.randomUUID(),
      title: item.task,
      description: item.description || null,
      notes: null,
      assignee: item.assignee || null,
      due_date: item.dueDate ? new Date(item.dueDate).toISOString() : null,
      start_date: item.startDate ? new Date(item.startDate).toISOString() : new Date(today).toISOString(),
      status: 'pending',
      priority: 'medium',
      project_id: null,
      tags: null,
      group_name: item.group || null,
      user_id: user.id,
      meeting_note_id: meetingNoteId,
      recurrence_type: 'none',
      recurrence_config: null,
      parent_task_id: null,
      is_recurring_instance: false,
      estimated_minutes: null,
      task_type: null,
      created_at: now,
      updated_at: now,
      completed_at: null,
    }))

    const { data: newTasks, error: insertError } = await supabase
      .from('tasks')
      .insert(tasksToInsert)
      .select()

    if (insertError) {
      throw new Error(`建立任務失敗: ${insertError.message}`)
    }

    // 更新會議記錄的 organized 內容
    await supabase
      .from('meeting_notes')
      .update({
        organized: organized,
        markdown: markdown,
      })
      .eq('id', meetingNoteId)

    return NextResponse.json({
      success: true,
      message: '任務已重新萃取',
      tasksCount: newTasks?.length || 0,
      organized,
    })
  } catch (error) {
    console.error('Regenerate tasks error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '重新萃取失敗' },
      { status: 500 }
    )
  }
}
