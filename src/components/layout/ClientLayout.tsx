'use client'

import { useState } from 'react'
import Sidebar, { MobileSidebar, MobileMenuButton } from './Sidebar'

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  return (
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
            <span className="text-xl">🎯</span>
            <span className="font-semibold">Vibe Planner</span>
          </div>
        </header>

        {/* 頁面內容 */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {children}
        </div>
      </main>
    </div>
  )
}
