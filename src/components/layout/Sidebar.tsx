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
  Menu,
  X,
} from 'lucide-react'
import { useState, useEffect } from 'react'

const navItems = [
  { href: '/', label: '對話', icon: MessageSquare },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/tasks', label: '任務', icon: CheckSquare },
  { href: '/projects', label: '專案', icon: FolderKanban },
]

// 側邊欄內容元件
function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const tasks = useAppStore((state: AppState) => state.tasks)
  const clearMessages = useAppStore((state: AppState) => state.clearMessages)

  const pendingTasksCount = tasks.filter((t: Task) => t.status === 'pending').length
  const urgentTasksCount = tasks.filter(
    (t: Task) => t.status !== 'completed' && t.priority === 'urgent'
  ).length

  return (
    <>
      {/* Logo */}
      <div className="p-4 border-b">
        <Link href="/" className="flex items-center gap-2" onClick={onNavigate}>
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
            <Link key={item.href} href={item.href} onClick={onNavigate}>
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
          onClick={() => {
            clearMessages()
            onNavigate?.()
          }}
        >
          <Trash2 className="h-4 w-4" />
          清除對話
        </Button>
        <Link href="/settings" onClick={onNavigate}>
          <Button variant="ghost" className="w-full justify-start gap-2 text-muted-foreground">
            <Settings className="h-4 w-4" />
            設定
          </Button>
        </Link>
      </div>
    </>
  )
}

// 手機版漢堡選單按鈕
export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="md:hidden"
      onClick={onClick}
    >
      <Menu className="h-6 w-6" />
    </Button>
  )
}

// 手機版側邊欄（滑出式）
export function MobileSidebar({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) {
  // 防止背景滾動
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <>
      {/* 背景遮罩 */}
      <div
        className="fixed inset-0 bg-black/50 z-40 md:hidden"
        onClick={onClose}
      />

      {/* 側邊欄 */}
      <aside className="fixed left-0 top-0 bottom-0 w-72 bg-background border-r z-50 flex flex-col md:hidden animate-in slide-in-from-left duration-200">
        {/* 關閉按鈕 */}
        <div className="absolute right-2 top-2">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <SidebarContent onNavigate={onClose} />
      </aside>
    </>
  )
}

// 桌面版側邊欄
export default function Sidebar() {
  return (
    <aside className="hidden md:flex w-64 border-r bg-muted/30 flex-col">
      <SidebarContent />
    </aside>
  )
}
