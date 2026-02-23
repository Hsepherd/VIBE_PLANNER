'use client'

import { useState, useEffect, useCallback } from 'react'
import { meetingNotesApi, type DbMeetingNote, type OrganizedMeetingNotes } from './supabase-api'

// 前端使用的 MeetingNote 類型
export interface MeetingNote {
  id: string
  title: string
  date: Date
  participants: string[]
  rawContent: string
  organized: OrganizedMeetingNotes
  markdown: string
  chatSessionId?: string
  createdAt: Date
  updatedAt: Date
}

// 將 Supabase 資料轉換為前端格式
function dbMeetingNoteToMeetingNote(dbNote: DbMeetingNote): MeetingNote {
  return {
    id: dbNote.id,
    title: dbNote.title,
    date: new Date(dbNote.date),
    participants: dbNote.participants,
    rawContent: dbNote.raw_content,
    organized: dbNote.organized,
    markdown: dbNote.markdown,
    chatSessionId: dbNote.chat_session_id || undefined,
    createdAt: new Date(dbNote.created_at),
    updatedAt: new Date(dbNote.updated_at),
  }
}

// 將前端格式轉換為 Supabase 資料
function meetingNoteToDbMeetingNote(
  note: Omit<MeetingNote, 'id' | 'createdAt' | 'updatedAt'>
): Omit<DbMeetingNote, 'id' | 'created_at' | 'updated_at' | 'user_id'> {
  return {
    title: note.title,
    date: note.date.toISOString().split('T')[0], // 只取日期部分
    participants: note.participants,
    raw_content: note.rawContent,
    organized: note.organized,
    markdown: note.markdown,
    chat_session_id: note.chatSessionId || null,
  }
}

export function useSupabaseMeetingNotes() {
  const [meetingNotes, setMeetingNotes] = useState<MeetingNote[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 載入會議記錄
  const loadMeetingNotes = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      console.log('[useSupabaseMeetingNotes] 開始載入會議記錄...')
      const dbNotes = await meetingNotesApi.getAll()
      console.log('[useSupabaseMeetingNotes] 載入完成，共', dbNotes.length, '筆會議記錄')
      setMeetingNotes(dbNotes.map(dbMeetingNoteToMeetingNote))
    } catch (err) {
      console.error('[useSupabaseMeetingNotes] 載入會議記錄失敗:', err)
      setError(err instanceof Error ? err.message : '載入失敗')
    } finally {
      console.log('[useSupabaseMeetingNotes] 設定 isLoading = false')
      setIsLoading(false)
    }
  }, [])

  // 初始載入
  useEffect(() => {
    loadMeetingNotes()
  }, [loadMeetingNotes])

  // 新增會議記錄
  const addMeetingNote = useCallback(
    async (note: Omit<MeetingNote, 'id' | 'createdAt' | 'updatedAt'>) => {
      try {
        const dbNote = await meetingNotesApi.create(meetingNoteToDbMeetingNote(note))
        const newNote = dbMeetingNoteToMeetingNote(dbNote)
        setMeetingNotes((prev) => [newNote, ...prev])
        return newNote
      } catch (err) {
        console.error('[useSupabaseMeetingNotes] 新增會議記錄失敗:', err)
        throw err
      }
    },
    []
  )

  // 更新會議記錄
  const updateMeetingNote = useCallback(
    async (id: string, updates: Partial<Omit<MeetingNote, 'id' | 'createdAt' | 'updatedAt'>>) => {
      try {
        const dbUpdates: Partial<DbMeetingNote> = {}
        if (updates.title !== undefined) dbUpdates.title = updates.title
        if (updates.date !== undefined) dbUpdates.date = updates.date.toISOString().split('T')[0]
        if (updates.participants !== undefined) dbUpdates.participants = updates.participants
        if (updates.rawContent !== undefined) dbUpdates.raw_content = updates.rawContent
        if (updates.organized !== undefined) dbUpdates.organized = updates.organized
        if (updates.markdown !== undefined) dbUpdates.markdown = updates.markdown
        if (updates.chatSessionId !== undefined) dbUpdates.chat_session_id = updates.chatSessionId || null

        const dbNote = await meetingNotesApi.update(id, dbUpdates)
        const updatedNote = dbMeetingNoteToMeetingNote(dbNote)
        setMeetingNotes((prev) => prev.map((note) => (note.id === id ? updatedNote : note)))
        return updatedNote
      } catch (err) {
        console.error('[useSupabaseMeetingNotes] 更新會議記錄失敗:', err)
        throw err
      }
    },
    []
  )

  // 刪除會議記錄
  const deleteMeetingNote = useCallback(async (id: string) => {
    try {
      await meetingNotesApi.delete(id)
      setMeetingNotes((prev) => prev.filter((note) => note.id !== id))
    } catch (err) {
      console.error('[useSupabaseMeetingNotes] 刪除會議記錄失敗:', err)
      throw err
    }
  }, [])

  // 搜尋會議記錄
  const searchMeetingNotes = useCallback(async (query: string) => {
    try {
      const dbNotes = await meetingNotesApi.search(query)
      return dbNotes.map(dbMeetingNoteToMeetingNote)
    } catch (err) {
      console.error('[useSupabaseMeetingNotes] 搜尋會議記錄失敗:', err)
      throw err
    }
  }, [])

  return {
    meetingNotes,
    isLoading,
    error,
    addMeetingNote,
    updateMeetingNote,
    deleteMeetingNote,
    searchMeetingNotes,
    refresh: loadMeetingNotes,
  }
}
