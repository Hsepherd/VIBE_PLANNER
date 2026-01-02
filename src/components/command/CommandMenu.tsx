'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Command } from 'cmdk'
import {
  Search,
  Home,
  LayoutDashboard,
  CheckSquare,
  Calendar,
  FolderKanban,
  BarChart3,
  Settings,
  Plus,
  FileText,
  User,
  Clock,
  Tag,
} from 'lucide-react'
import { useSupabaseTasks, type Task } from '@/lib/useSupabaseTasks'

// 頁面導航項目
const navigationItems = [
  { id: 'home', label: '首頁', icon: Home, href: '/', keywords: ['home', 'chat', '對話', '聊天'] },
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard', keywords: ['dashboard', '儀表板', '總覽'] },
  { id: 'tasks', label: '任務列表', icon: CheckSquare, href: '/tasks', keywords: ['tasks', '任務', '待辦'] },
  { id: 'calendar', label: '行事曆', icon: Calendar, href: '/calendar', keywords: ['calendar', '行事曆', '日曆'] },
  { id: 'projects', label: '專案', icon: FolderKanban, href: '/projects', keywords: ['projects', '專案'] },
  { id: 'analytics', label: '數據分析', icon: BarChart3, href: '/analytics', keywords: ['analytics', '分析', '統計'] },
  { id: 'settings', label: '設定', icon: Settings, href: '/settings', keywords: ['settings', '設定', '偏好'] },
]

// 快速操作項目
const quickActions = [
  { id: 'new-task', label: '新增任務', icon: Plus, action: 'new-task', keywords: ['new', 'add', '新增', '建立'] },
]

interface CommandMenuProps {
  onNewTask?: () => void
}

export default function CommandMenu({ onNewTask }: CommandMenuProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const router = useRouter()
  const { tasks } = useSupabaseTasks()

  // 監聽 Cmd+K / Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
      // ESC 關閉
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  // 處理選擇
  const handleSelect = useCallback((value: string) => {
    setOpen(false)
    setSearch('')

    // 導航
    const navItem = navigationItems.find(item => item.id === value)
    if (navItem) {
      router.push(navItem.href)
      return
    }

    // 快速操作
    if (value === 'new-task' && onNewTask) {
      onNewTask()
      return
    }

    // 任務導航
    if (value.startsWith('task-')) {
      router.push('/tasks')
      return
    }
  }, [router, onNewTask])

  // 過濾任務
  const filteredTasks = tasks
    .filter(task => {
      if (!search) return true
      const searchLower = search.toLowerCase()
      return (
        task.title.toLowerCase().includes(searchLower) ||
        task.assignee?.toLowerCase().includes(searchLower) ||
        task.groupName?.toLowerCase().includes(searchLower) ||
        task.tags?.some(tag => tag.toLowerCase().includes(searchLower))
      )
    })
    .slice(0, 10) // 最多顯示 10 筆

  // 取得任務狀態顏色
  const getStatusColor = (status: Task['status']) => {
    switch (status) {
      case 'completed': return 'text-green-500'
      case 'in_progress': return 'text-blue-500'
      case 'on_hold': return 'text-yellow-500'
      default: return 'text-gray-400'
    }
  }

  // 取得優先級顏色
  const getPriorityColor = (priority: Task['priority']) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-700'
      case 'high': return 'bg-orange-100 text-orange-700'
      case 'medium': return 'bg-yellow-100 text-yellow-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      {/* 背景遮罩 */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      {/* Command 面板 */}
      <div className="fixed left-1/2 top-[20%] -translate-x-1/2 w-full max-w-xl">
        <Command
          className="rounded-xl border shadow-2xl bg-white overflow-hidden"
          shouldFilter={false}
        >
          {/* 搜尋輸入框 */}
          <div className="flex items-center border-b px-4">
            <Search className="mr-2 h-4 w-4 shrink-0 text-gray-400" />
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="搜尋任務、頁面或操作..."
              className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-gray-400"
              autoFocus
            />
            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-gray-100 px-1.5 font-mono text-[10px] font-medium text-gray-500">
              ESC
            </kbd>
          </div>

          <Command.List className="max-h-[400px] overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-gray-500">
              找不到結果
            </Command.Empty>

            {/* 快速操作 */}
            <Command.Group heading="快速操作" className="px-2 py-1.5 text-xs font-medium text-gray-500">
              {quickActions.map((action) => (
                <Command.Item
                  key={action.id}
                  value={action.id}
                  onSelect={handleSelect}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm cursor-pointer hover:bg-gray-100 aria-selected:bg-gray-100"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-100 text-blue-600">
                    <action.icon className="h-4 w-4" />
                  </div>
                  <span className="font-medium">{action.label}</span>
                  <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-gray-100 px-1.5 font-mono text-[10px] font-medium text-gray-500">
                    N
                  </kbd>
                </Command.Item>
              ))}
            </Command.Group>

            {/* 頁面導航 */}
            <Command.Group heading="頁面導航" className="px-2 py-1.5 text-xs font-medium text-gray-500">
              {navigationItems.map((item) => (
                <Command.Item
                  key={item.id}
                  value={item.id}
                  onSelect={handleSelect}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm cursor-pointer hover:bg-gray-100 aria-selected:bg-gray-100"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-100 text-gray-600">
                    <item.icon className="h-4 w-4" />
                  </div>
                  <span>{item.label}</span>
                </Command.Item>
              ))}
            </Command.Group>

            {/* 任務搜尋結果 */}
            {filteredTasks.length > 0 && (
              <Command.Group heading="任務" className="px-2 py-1.5 text-xs font-medium text-gray-500">
                {filteredTasks.map((task) => (
                  <Command.Item
                    key={task.id}
                    value={`task-${task.id}`}
                    onSelect={handleSelect}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm cursor-pointer hover:bg-gray-100 aria-selected:bg-gray-100"
                  >
                    <div className={`flex h-8 w-8 items-center justify-center rounded-md bg-gray-50 ${getStatusColor(task.status)}`}>
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{task.title}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${getPriorityColor(task.priority)}`}>
                          {task.priority === 'urgent' ? '緊急' :
                           task.priority === 'high' ? '高' :
                           task.priority === 'medium' ? '中' : '低'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                        {task.assignee && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {task.assignee}
                          </span>
                        )}
                        {task.dueDate && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(task.dueDate).toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                        {task.groupName && (
                          <span className="flex items-center gap-1">
                            <Tag className="h-3 w-3" />
                            {task.groupName}
                          </span>
                        )}
                      </div>
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>

          {/* 底部提示 */}
          <div className="border-t px-4 py-2.5 text-xs text-gray-400 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">↑↓</kbd>
                導航
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">Enter</kbd>
                選擇
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">ESC</kbd>
                關閉
              </span>
            </div>
            <span>⌘K 開啟搜尋</span>
          </div>
        </Command>
      </div>
    </div>
  )
}
