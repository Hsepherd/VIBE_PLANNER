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
  Calendar,
  Settings,
  Trash2,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useState, useEffect } from 'react'

const navItems = [
  { href: '/', label: '對話', icon: MessageSquare },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/tasks', label: '任務', icon: CheckSquare },
  { href: '/calendar', label: '行事曆', icon: Calendar },
  { href: '/projects', label: '專案', icon: FolderKanban },
]

// 側邊欄內容元件
function SidebarContent({ onNavigate, collapsed = false }: { onNavigate?: () => void; collapsed?: boolean }) {
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
      <div className={`p-4 border-b ${collapsed ? 'flex justify-center' : ''}`}>
        <Link href="/" className="flex items-center gap-2" onClick={onNavigate}>
          <span className="text-2xl">🎯</span>
          <span className={`font-bold text-lg whitespace-nowrap transition-all duration-200 ${collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>
            Vibe Planner
          </span>
        </Link>
      </div>

      {/* 導航 */}
      <nav className={`flex-1 ${collapsed ? 'p-2' : 'p-4'} space-y-1`}>
        {navItems.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon

          return (
            <Link key={item.href} href={item.href} onClick={onNavigate} title={collapsed ? item.label : undefined}>
              <Button
                variant={isActive ? 'secondary' : 'ghost'}
                className={`w-full transition-all duration-200 ${collapsed ? 'justify-center px-2' : 'justify-start gap-2'}`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className={`whitespace-nowrap transition-all duration-200 ${collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>
                  {item.label}
                </span>
                {!collapsed && item.href === '/tasks' && pendingTasksCount > 0 && (
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
      <div className={`border-t space-y-2 transition-all duration-200 overflow-hidden ${collapsed ? 'p-0 h-0 opacity-0' : 'p-4 opacity-100'}`}>
        {urgentTasksCount > 0 && (
          <div className="flex items-center gap-2 text-sm text-destructive whitespace-nowrap">
            <span className="text-lg">🔴</span>
            <span>{urgentTasksCount} 個緊急任務</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-sm text-muted-foreground whitespace-nowrap">
          <span className="text-lg">📋</span>
          <span>{pendingTasksCount} 個待辦任務</span>
        </div>
      </div>

      {/* 底部操作 */}
      <div className={`${collapsed ? 'p-2' : 'p-4'} border-t space-y-2`}>
        <Button
          variant="ghost"
          className={`w-full transition-all duration-200 ${collapsed ? 'justify-center px-2' : 'justify-start gap-2'} text-muted-foreground`}
          onClick={() => {
            clearMessages()
            onNavigate?.()
          }}
          title={collapsed ? '清除對話' : undefined}
        >
          <Trash2 className="h-4 w-4 shrink-0" />
          <span className={`whitespace-nowrap transition-all duration-200 ${collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>
            清除對話
          </span>
        </Button>
        <Link href="/settings" onClick={onNavigate} title={collapsed ? '設定' : undefined}>
          <Button variant="ghost" className={`w-full transition-all duration-200 ${collapsed ? 'justify-center px-2' : 'justify-start gap-2'} text-muted-foreground`}>
            <Settings className="h-4 w-4 shrink-0" />
            <span className={`whitespace-nowrap transition-all duration-200 ${collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>
              設定
            </span>
          </Button>
        </Link>
      </div>
    </>
  )
}

// 桌面版側邊欄內容（不含 Logo，Logo 由父層處理）
function SidebarContentWithoutLogo({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname()
  const tasks = useAppStore((state: AppState) => state.tasks)
  const clearMessages = useAppStore((state: AppState) => state.clearMessages)

  const pendingTasksCount = tasks.filter((t: Task) => t.status === 'pending').length
  const urgentTasksCount = tasks.filter(
    (t: Task) => t.status !== 'completed' && t.priority === 'urgent'
  ).length

  return (
    <>
      {/* 導航 */}
      <nav className={`flex-1 ${collapsed ? 'p-2' : 'p-4'} space-y-1`}>
        {navItems.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon

          return (
            <Link key={item.href} href={item.href} title={collapsed ? item.label : undefined}>
              <Button
                variant={isActive ? 'secondary' : 'ghost'}
                className={`w-full transition-all duration-200 ${collapsed ? 'justify-center px-2' : 'justify-start gap-2'}`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className={`whitespace-nowrap transition-all duration-200 ${collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>
                  {item.label}
                </span>
                {!collapsed && item.href === '/tasks' && pendingTasksCount > 0 && (
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
      <div className={`border-t space-y-2 transition-all duration-200 overflow-hidden ${collapsed ? 'p-0 h-0 opacity-0' : 'p-4 opacity-100'}`}>
        {urgentTasksCount > 0 && (
          <div className="flex items-center gap-2 text-sm text-destructive whitespace-nowrap">
            <span className="text-lg">🔴</span>
            <span>{urgentTasksCount} 個緊急任務</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-sm text-muted-foreground whitespace-nowrap">
          <span className="text-lg">📋</span>
          <span>{pendingTasksCount} 個待辦任務</span>
        </div>
      </div>

      {/* 底部操作 */}
      <div className={`${collapsed ? 'p-2' : 'p-4'} border-t space-y-2`}>
        <Button
          variant="ghost"
          className={`w-full transition-all duration-200 ${collapsed ? 'justify-center px-2' : 'justify-start gap-2'} text-muted-foreground`}
          onClick={() => clearMessages()}
          title={collapsed ? '清除對話' : undefined}
        >
          <Trash2 className="h-4 w-4 shrink-0" />
          <span className={`whitespace-nowrap transition-all duration-200 ${collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>
            清除對話
          </span>
        </Button>
        <Link href="/settings" title={collapsed ? '設定' : undefined}>
          <Button variant="ghost" className={`w-full transition-all duration-200 ${collapsed ? 'justify-center px-2' : 'justify-start gap-2'} text-muted-foreground`}>
            <Settings className="h-4 w-4 shrink-0" />
            <span className={`whitespace-nowrap transition-all duration-200 ${collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>
              設定
            </span>
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
  const [collapsed, setCollapsed] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)

  // 從 localStorage 讀取收合狀態
  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed')
    if (saved === 'true') {
      setCollapsed(true)
    }
  }, [])

  // 儲存收合狀態
  const toggleCollapsed = () => {
    setIsAnimating(true)
    const newState = !collapsed
    setCollapsed(newState)
    localStorage.setItem('sidebar-collapsed', String(newState))
    // 動畫結束後重置狀態
    setTimeout(() => setIsAnimating(false), 300)
  }

  return (
    <aside
      className={`
        hidden md:flex border-r bg-muted/30 flex-col relative
        transition-[width] duration-300 ease-in-out
        ${collapsed ? 'w-16' : 'w-64'}
      `}
    >
      {/* 展開/收合按鈕 - 固定在右邊線上置中 */}
      <button
        onClick={toggleCollapsed}
        className="absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-6 h-6 bg-background border rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shadow-sm"
        title={collapsed ? "展開側邊欄" : "收合側邊欄"}
      >
        {collapsed ? (
          <ChevronRight className="h-3 w-3" />
        ) : (
          <ChevronLeft className="h-3 w-3" />
        )}
      </button>

      {/* 頂部：Logo */}
      <div className="p-3 border-b flex items-center justify-center">
        <Link href="/" className={collapsed ? "" : "flex items-center gap-2"}>
          <span className="font-bold text-lg">Hz</span>
          {!collapsed && (
            <span className="text-sm text-muted-foreground">Planner</span>
          )}
        </Link>
      </div>

      {/* 側邊欄內容，加上 fade 效果 */}
      <div className={`
        flex-1 flex flex-col overflow-hidden
        transition-opacity duration-200
        ${isAnimating ? 'opacity-80' : 'opacity-100'}
      `}>
        <SidebarContentWithoutLogo collapsed={collapsed} />
      </div>
    </aside>
  )
}
