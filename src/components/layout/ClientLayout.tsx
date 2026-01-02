'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar, { MobileSidebar, MobileMenuButton } from './Sidebar'
import { AuthProvider } from '@/components/AuthProvider'
import { ChatSessionProvider } from '@/lib/ChatSessionContext'
import { AutoSync } from '@/components/AutoSync'
import { Toaster } from '@/components/ui/sonner'
import CommandMenu from '@/components/command/CommandMenu'
import KeyboardShortcutsProvider from '@/components/KeyboardShortcutsProvider'

// 公開頁面不需要顯示側邊欄
const publicPaths = ['/login', '/signup', '/auth/callback']

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const pathname = usePathname()

  const isPublicPath = publicPaths.some(path => pathname.startsWith(path))

  // 公開頁面（登入、註冊）不顯示側邊欄
  if (isPublicPath) {
    return (
      <AuthProvider>
        {children}
      </AuthProvider>
    )
  }

  return (
    <AuthProvider>
      <ChatSessionProvider>
        <AutoSync />
        <Toaster position="bottom-right" richColors closeButton />
        <CommandMenu />
        <KeyboardShortcutsProvider>
        <div className="flex h-screen">
          {/* 桌面版側邊欄 */}
          <Sidebar />

          {/* 手機版側邊欄 */}
          <MobileSidebar
            isOpen={isMobileMenuOpen}
            onClose={() => setIsMobileMenuOpen(false)}
          />

          {/* 主內容區 */}
          <main className="flex-1 flex flex-col min-w-0">
            {/* 手機版頂部導航欄 */}
            <header className="md:hidden flex items-center gap-3 p-3 border-b bg-background">
              <MobileMenuButton onClick={() => setIsMobileMenuOpen(true)} />
              <div className="flex items-center gap-2">
                <img src="/pingu.png" alt="Planner" className="w-7 h-7 rounded-md object-cover" />
                <span className="font-semibold">Planner</span>
              </div>
            </header>

            {/* 頁面內容 */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {children}
            </div>
          </main>
        </div>
        </KeyboardShortcutsProvider>
      </ChatSessionProvider>
    </AuthProvider>
  )
}
