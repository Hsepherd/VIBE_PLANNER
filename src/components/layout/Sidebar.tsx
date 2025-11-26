'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAppStore, type AppState, type Task } from '@/lib/store'
import {
  MessageSquare,
  LayoutDashboard,
  CheckSquare,
  FolderKanban,
  Settings,
  Trash2,
} from 'lucide-react'

const navItems = [
  { href: '/', label: '對話', icon: MessageSquare },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/tasks', label: '任務', icon: CheckSquare },
  { href: '/projects', label: '專案', icon: FolderKanban },
]

export default function Sidebar() {
  const pathname = usePathname()
  const tasks = useAppStore((state: AppState) => state.tasks)
  const clearMessages = useAppStore((state: AppState) => state.clearMessages)

  const pendingTasksCount = tasks.filter((t: Task) => t.status === 'pending').length
  const urgentTasksCount = tasks.filter(
    (t: Task) => t.status !== 'completed' && t.priority === 'urgent'
  ).length

  return (
    <aside className="w-64 border-r bg-muted/30 flex flex-col">
      {/* Logo */}
      <div className="p-4 border-b">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl">🎯</span>
          <span className="font-bold text-lg">Vibe Planner</span>
        </Link>
      </div>

      {/* 導航 */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon

          return (
            <Link key={item.href} href={item.href}>
              <Button
                variant={isActive ? 'secondary' : 'ghost'}
                className="w-full justify-start gap-2"
              >
                <Icon className="h-4 w-4" />
                {item.label}
                {item.href === '/tasks' && pendingTasksCount > 0 && (
                  <Badge variant="secondary" className="ml-auto">
                    {pendingTasksCount}
                  </Badge>
                )}
              </Button>
            </Link>
          )
        })}
      </nav>

      {/* 統計 */}
      <div className="p-4 border-t space-y-2">
        {urgentTasksCount > 0 && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <span className="text-lg">🔴</span>
            <span>{urgentTasksCount} 個緊急任務</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="text-lg">📋</span>
          <span>{pendingTasksCount} 個待辦任務</span>
        </div>
      </div>

      {/* 底部操作 */}
      <div className="p-4 border-t space-y-2">
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-muted-foreground"
          onClick={clearMessages}
        >
          <Trash2 className="h-4 w-4" />
          清除對話
        </Button>
        <Link href="/settings">
          <Button variant="ghost" className="w-full justify-start gap-2 text-muted-foreground">
            <Settings className="h-4 w-4" />
            設定
          </Button>
        </Link>
      </div>
    </aside>
  )
}
