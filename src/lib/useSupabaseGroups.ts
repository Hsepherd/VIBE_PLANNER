'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from './supabase-client'
import { useAuth } from './useAuth'

// 組別介面
export interface Group {
  id: string
  name: string
  color: string
  user_id: string
  created_at: string
}

// 可用的組別顏色
const GROUP_COLORS = ['blue', 'green', 'purple', 'orange', 'pink', 'cyan', 'yellow', 'red', 'indigo', 'gray']

// 根據名稱生成顏色
function getGroupColor(name: string): string {
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return GROUP_COLORS[hash % GROUP_COLORS.length]
}

// 建立 Supabase client 單例，避免每次 render 重新建立
const supabase = createClient()

/**
 * 從 Supabase 取得使用者的所有組別
 * 從 tasks 表中查詢不重複的 group_name
 */
export function useSupabaseGroups() {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const { user } = useAuth()

  const fetchGroups = useCallback(async () => {
    if (!user) {
      setGroups([])
      setLoading(false)
      setError(null)
      return
    }

    try {
      setError(null)
      // 從 tasks 表中取得所有不重複的 group_name
      const { data, error: fetchError } = await supabase
        .from('tasks')
        .select('group_name')
        .eq('user_id', user.id)
        .not('group_name', 'is', null)

      if (fetchError) throw fetchError

      // 整理成唯一的群組列表
      const groupNames = data?.map(t => t.group_name).filter(Boolean) || []
      const uniqueGroups = Array.from(new Set(groupNames))
      const groupList: Group[] = uniqueGroups.map((name) => ({
        id: `group-${name}`,
        name: name as string,
        color: getGroupColor(name as string),
        user_id: user.id,
        created_at: new Date().toISOString(),
      }))

      setGroups(groupList)
    } catch (err) {
      console.error('載入群組失敗:', err)
      setError(err instanceof Error ? err : new Error('Unknown error'))
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchGroups()
  }, [fetchGroups])

  return { groups, loading, error, refresh: fetchGroups }
}
