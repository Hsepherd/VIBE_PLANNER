'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/useAuth'
import { Loader2 } from 'lucide-react'

// 公開路徑（不需要登入）
const publicPaths = ['/login', '/signup', '/auth/callback']

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const [isReady, setIsReady] = useState(false)

  const isPublicPath = publicPaths.some(path => pathname.startsWith(path))

  useEffect(() => {
    if (isLoading) return

    // 沒登入且不在公開頁面 -> 導向登入
    if (!user && !isPublicPath) {
      router.replace('/login')
      return
    }

    // 已登入且在登入頁 -> 導向首頁
    if (user && (pathname === '/login' || pathname === '/signup')) {
      router.replace('/')
      return
    }

    setIsReady(true)
  }, [user, isLoading, isPublicPath, pathname, router])

  // 載入中
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">載入中...</p>
        </div>
      </div>
    )
  }

  // 公開頁面直接顯示
  if (isPublicPath) {
    return <>{children}</>
  }

  // 需要登入但還沒準備好（給 3 秒超時，避免卡住）
  if (!isReady || !user) {
    // 超時保護：3 秒後強制導向登入頁
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        if (!user) {
          window.location.href = '/login'
        }
      }, 3000)
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">驗證中...</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
