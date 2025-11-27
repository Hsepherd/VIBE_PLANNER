'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAppStore, type AppState, type Task } from '@/lib/store'
import { useAuth } from '@/lib/useAuth'
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
  LogOut,
  User,
  Users,
  Shield,
} from 'lucide-react'

// 管理員 email（與後端保持一致）
const ADMIN_EMAIL = 'xk4xk4563022@gmail.com'
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

// 桌面版側邊欄內容（不含 Logo，Logo 由父層處理）- Acctual 風格
function SidebarContentWithoutLogo({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname()
  const router = useRouter()
  const tasks = useAppStore((state: AppState) => state.tasks)
  const clearMessages = useAppStore((state: AppState) => state.clearMessages)
  const { user, signOut } = useAuth()

  const pendingTasksCount = tasks.filter((t: Task) => t.status === 'pending').length
  const urgentTasksCount = tasks.filter(
    (t: Task) => t.status !== 'completed' && t.priority === 'urgent'
  ).length

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  // 取得使用者顯示名稱
  const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || '使用者'
  const userEmail = user?.email || ''

  return (
    <>
      {/* 導航 - Acctual 風格 */}
      <nav className={`flex-1 ${collapsed ? 'px-2 py-3' : 'px-3 py-3'} space-y-0.5`}>
        {navItems.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon

          return (
            <Link key={item.href} href={item.href} title={collapsed ? item.label : undefined}>
              <div
                className={`
                  flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 cursor-pointer
                  ${isActive
                    ? 'bg-muted font-medium text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }
                  ${collapsed ? 'justify-center px-2' : ''}
                `}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                {!collapsed && (
                  <span className="text-sm">{item.label}</span>
                )}
                {!collapsed && item.href === '/tasks' && pendingTasksCount > 0 && (
                  <span className="ml-auto text-xs bg-muted-foreground/20 text-muted-foreground px-1.5 py-0.5 rounded-md">
                    {pendingTasksCount}
                  </span>
                )}
              </div>
            </Link>
          )
        })}
      </nav>

      {/* 統計 - 簡化 */}
      <div className={`space-y-1 transition-all duration-200 overflow-hidden ${collapsed ? 'p-0 h-0 opacity-0' : 'px-3 py-2 opacity-100'}`}>
        {urgentTasksCount > 0 && (
          <div className="flex items-center gap-2 text-xs text-red-500 px-3">
            <span>🔴</span>
            <span>{urgentTasksCount} 個緊急</span>
          </div>
        )}
      </div>

      {/* 底部操作 - Acctual 風格 */}
      <div className={`${collapsed ? 'px-2 py-3' : 'px-3 py-3'} border-t space-y-0.5`}>
        <button
          className={`
            w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200
            text-muted-foreground hover:text-foreground hover:bg-muted/50 text-sm
            ${collapsed ? 'justify-center px-2' : ''}
          `}
          onClick={() => clearMessages()}
          title={collapsed ? '清除對話' : undefined}
        >
          <Trash2 className="h-[18px] w-[18px] shrink-0" />
          {!collapsed && <span>清除對話</span>}
        </button>
        <Link href="/settings" title={collapsed ? '設定' : undefined}>
          <div
            className={`
              w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200
              text-muted-foreground hover:text-foreground hover:bg-muted/50 text-sm
              ${collapsed ? 'justify-center px-2' : ''}
            `}
          >
            <Settings className="h-[18px] w-[18px] shrink-0" />
            {!collapsed && <span>設定</span>}
          </div>
        </Link>
        {/* 管理員專屬：使用者管理 */}
        {user?.email === ADMIN_EMAIL && (
          <Link href="/admin/users" title={collapsed ? '使用者管理' : undefined}>
            <div
              className={`
                w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200
                text-amber-600 hover:text-amber-700 hover:bg-amber-50 text-sm
                ${collapsed ? 'justify-center px-2' : ''}
                ${pathname === '/admin/users' ? 'bg-amber-50' : ''}
              `}
            >
              <Shield className="h-[18px] w-[18px] shrink-0" />
              {!collapsed && <span>使用者管理</span>}
            </div>
          </Link>
        )}
      </div>

      {/* 使用者資訊和登出 */}
      <div className={`${collapsed ? 'px-2 py-3' : 'px-3 py-3'} border-t`}>
        {/* 使用者資訊 */}
        {!collapsed && user && (
          <div className="px-3 py-2 mb-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                <User className="h-4 w-4 text-gray-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{displayName}</p>
                <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
              </div>
            </div>
          </div>
        )}
        {/* 登出按鈕 */}
        <button
          className={`
            w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200
            text-muted-foreground hover:text-red-600 hover:bg-red-50 text-sm
            ${collapsed ? 'justify-center px-2' : ''}
          `}
          onClick={handleSignOut}
          title={collapsed ? '登出' : undefined}
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" />
          {!collapsed && <span>登出</span>}
        </button>
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
        hidden md:flex border-r bg-background flex-col relative
        transition-[width] duration-300 ease-in-out
        ${collapsed ? 'w-16' : 'w-56'}
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

      {/* 頂部：Logo - Acctual 風格 */}
      <div className="p-4 border-b flex items-center">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-black rounded-md flex items-center justify-center">
            <span className="text-white font-bold text-sm">Hz</span>
          </div>
          {!collapsed && (
            <span className="font-semibold text-base">Planner</span>
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
