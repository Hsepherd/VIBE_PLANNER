'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAppStore, type AppState, type Task } from '@/lib/store'
import { useAuth } from '@/lib/useAuth'
import { ChatSessionList } from '@/components/chat/ChatSessionList'
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
import { useState, useEffect, useRef, useCallback } from 'react'

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

  // 清除對話（本地 + 雲端）
  const handleClearMessages = async () => {
    clearMessages()
    onNavigate?.()
    const { conversationsApi } = await import('@/lib/supabase-api')
    try {
      await conversationsApi.clear()
    } catch (error) {
      console.error('清除雲端對話失敗:', error)
    }
  }

  return (
    <>
      {/* Logo */}
      <div className={`p-4 border-b ${collapsed ? 'flex justify-center' : ''}`}>
        <Link href="/" className="flex items-center gap-2" onClick={onNavigate}>
          <img src="/pingu.png" alt="Planner" className="w-8 h-8 rounded-md object-cover" />
          <span className={`font-bold text-lg whitespace-nowrap transition-all duration-200 ${collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>
            Planner
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
          onClick={handleClearMessages}
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

// 桌面版側邊欄內容（不含 Logo，Logo 由父層處理）- Acctual 風格 with fade effect
function SidebarContentWithoutLogo({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname()
  const router = useRouter()
  const tasks = useAppStore((state: AppState) => state.tasks)
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

  // 文字淡入淡出的 class
  const textFadeClass = `transition-opacity duration-300 ${collapsed ? 'opacity-0' : 'opacity-100'}`

  return (
    <>
      {/* 對話列表區塊 */}
      <div className={`flex-1 flex flex-col min-h-0 transition-all duration-300 ${collapsed ? '' : 'border-b'}`}>
        {/* 對話歷史標題 - 收合時隱藏 */}
        <div className={`px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider transition-all duration-300 ${collapsed ? 'h-0 py-0 opacity-0 overflow-hidden' : 'opacity-100'}`}>
          對話歷史
        </div>
        {/* 對話列表 */}
        <div className="flex-1 overflow-y-auto">
          <ChatSessionList collapsed={collapsed} />
        </div>
      </div>

      {/* 導航 - Acctual 風格 */}
      <nav className={`space-y-0.5 border-b transition-all duration-300 py-2 ${collapsed ? 'px-2' : 'px-3'}`}>
        {/* 功能標題 - 收合時隱藏 */}
        {!collapsed && (
          <div className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
            功能
          </div>
        )}
        {navItems.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon

          return (
            <Link key={item.href} href={item.href} title={collapsed ? item.label : undefined}>
              <div
                className={`
                  flex items-center py-2 rounded-lg transition-all duration-300 cursor-pointer
                  ${isActive
                    ? 'bg-muted font-medium text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }
                  ${collapsed ? 'justify-center w-10 h-10 mx-auto px-0' : 'gap-3 px-2'}
                `}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                {!collapsed && (
                  <>
                    <span className="text-sm whitespace-nowrap">{item.label}</span>
                    {item.href === '/tasks' && pendingTasksCount > 0 && (
                      <span className="ml-auto text-xs bg-muted-foreground/20 text-muted-foreground px-1.5 py-0.5 rounded-md">
                        {pendingTasksCount}
                      </span>
                    )}
                  </>
                )}
              </div>
            </Link>
          )
        })}
      </nav>

      {/* 統計 - 簡化，收合時隱藏 */}
      <div className={`space-y-1 transition-all duration-300 overflow-hidden ${collapsed ? 'h-0 opacity-0' : 'px-3 py-2 opacity-100'}`}>
        {urgentTasksCount > 0 && (
          <div className="flex items-center gap-2 text-xs text-red-500 px-3">
            <span>🔴</span>
            <span>{urgentTasksCount} 個緊急</span>
          </div>
        )}
      </div>

      {/* 底部操作 - Acctual 風格 */}
      <div className={`border-t space-y-0.5 transition-all duration-300 py-2 ${collapsed ? 'px-2' : 'px-3'}`}>
        <Link href="/settings" title={collapsed ? '設定' : undefined}>
          <div
            className={`
              flex items-center py-2 rounded-lg transition-all duration-300
              text-muted-foreground hover:text-foreground hover:bg-muted/50 text-sm
              ${collapsed ? 'justify-center w-10 h-10 mx-auto px-0' : 'gap-3 px-2'}
            `}
          >
            <Settings className="h-[18px] w-[18px] shrink-0" />
            {!collapsed && <span className="whitespace-nowrap">設定</span>}
          </div>
        </Link>
        {/* 管理員專屬：使用者管理 */}
        {user?.email === ADMIN_EMAIL && (
          <Link href="/admin/users" title={collapsed ? '使用者管理' : undefined}>
            <div
              className={`
                flex items-center py-2 rounded-lg transition-all duration-300
                text-amber-600 hover:text-amber-700 hover:bg-amber-50 text-sm
                ${collapsed ? 'justify-center w-10 h-10 mx-auto px-0' : 'gap-3 px-2'}
                ${pathname === '/admin/users' ? 'bg-amber-50' : ''}
              `}
            >
              <Shield className="h-[18px] w-[18px] shrink-0" />
              {!collapsed && <span className="whitespace-nowrap">使用者管理</span>}
            </div>
          </Link>
        )}
      </div>

      {/* 使用者資訊和登出 */}
      <div className={`border-t transition-all duration-300 py-2 ${collapsed ? 'px-2' : 'px-3'}`}>
        {/* 使用者資訊 - 收合時隱藏 */}
        {!collapsed && user && (
          <div className="px-2 py-2 mb-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center shrink-0">
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
            flex items-center py-2 rounded-lg transition-all duration-300
            text-muted-foreground hover:text-red-600 hover:bg-red-50 text-sm
            ${collapsed ? 'justify-center w-10 h-10 mx-auto px-0' : 'w-full gap-3 px-2'}
          `}
          onClick={handleSignOut}
          title={collapsed ? '登出' : undefined}
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" />
          {!collapsed && <span className="whitespace-nowrap">登出</span>}
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

// 側邊欄寬度常數
const MIN_WIDTH = 64 // 收合狀態最小寬度
const DEFAULT_WIDTH = 224 // 預設寬度 (w-56 = 14rem = 224px)
const MAX_WIDTH = 400 // 最大寬度

// 桌面版側邊欄
export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const [width, setWidth] = useState(DEFAULT_WIDTH)
  const [isResizing, setIsResizing] = useState(false)
  const sidebarRef = useRef<HTMLElement>(null)

  // 從 localStorage 讀取收合狀態和寬度
  useEffect(() => {
    const savedCollapsed = localStorage.getItem('sidebar-collapsed')
    if (savedCollapsed === 'true') {
      setCollapsed(true)
    }
    const savedWidth = localStorage.getItem('sidebar-width')
    if (savedWidth) {
      const parsedWidth = parseInt(savedWidth, 10)
      if (!isNaN(parsedWidth) && parsedWidth >= MIN_WIDTH && parsedWidth <= MAX_WIDTH) {
        setWidth(parsedWidth)
      }
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

  // 開始拖曳
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  // 拖曳中
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return

      const newWidth = e.clientX
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        // 如果拖曳到接近最小寬度，自動收合
        if (newWidth < 100) {
          setCollapsed(true)
          localStorage.setItem('sidebar-collapsed', 'true')
        } else {
          setCollapsed(false)
          localStorage.setItem('sidebar-collapsed', 'false')
          setWidth(newWidth)
          localStorage.setItem('sidebar-width', String(newWidth))
        }
      }
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      // 防止選取文字
      document.body.style.userSelect = 'none'
      document.body.style.cursor = 'col-resize'
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
  }, [isResizing])

  // 計算實際顯示寬度
  const displayWidth = collapsed ? MIN_WIDTH : width

  return (
    <aside
      ref={sidebarRef}
      style={{ width: displayWidth }}
      className={`
        group/sidebar hidden md:flex border-r bg-background flex-col relative
        ${!isResizing ? 'transition-[width] duration-300 ease-in-out' : ''}
      `}
    >
      {/* 拖曳調整寬度的把手 */}
      {!collapsed && (
        <div
          onMouseDown={handleMouseDown}
          className={`
            absolute right-0 top-0 bottom-0 w-1 cursor-col-resize z-20
            hover:bg-primary/30 transition-colors
            ${isResizing ? 'bg-primary/50' : ''}
          `}
          title="拖曳調整寬度"
        />
      )}

      {/* 頂部：Logo 區域 - Manus 風格 with fade effect */}
      <div className={`h-14 border-b flex items-center group/logo relative transition-all duration-300 ${collapsed ? 'justify-center px-0' : 'px-3'}`}>
        {/* Logo 按鈕區域 - 收合時可點擊展開 */}
        <button
          onClick={collapsed ? toggleCollapsed : undefined}
          className={`w-8 h-8 shrink-0 flex items-center justify-center rounded-md transition-all duration-300 relative ${collapsed ? 'cursor-pointer' : 'cursor-default'}`}
          title={collapsed ? "展開側邊欄" : undefined}
        >
          {/* Logo 圖片 - 收合時 hover 會淡出 */}
          <img
            src="/pingu.png"
            alt="Planner"
            className={`w-8 h-8 rounded-md transition-opacity duration-200 ${collapsed ? 'group-hover/logo:opacity-0' : ''}`}
            style={{ objectFit: 'contain' }}
          />
          {/* 展開箭頭 - 收合時 hover 會淡入 */}
          <ChevronRight
            className={`h-5 w-5 text-muted-foreground hover:text-foreground absolute transition-opacity duration-200 ${collapsed ? 'opacity-0 group-hover/logo:opacity-100' : 'opacity-0 pointer-events-none'}`}
          />
        </button>

        {/* 文字 "Planner" - 展開時淡入，收合時淡出 */}
        <Link
          href="/"
          className={`flex items-center gap-2 ml-2 transition-all duration-300 ${collapsed ? 'hidden' : 'opacity-100'}`}
        >
          <span className="font-semibold text-base whitespace-nowrap">Planner</span>
        </Link>

        {/* 彈性空間 */}
        {!collapsed && <div className="flex-1" />}

        {/* 收合按鈕 - 展開狀態時 hover 顯示 */}
        {!collapsed && (
          <button
            onClick={toggleCollapsed}
            className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-300 opacity-0 group-hover/sidebar:opacity-100"
            title="收合側邊欄"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
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
