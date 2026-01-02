'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { shortcuts, KeyboardShortcutsHelp } from '@/lib/useKeyboardShortcuts'

export default function KeyboardShortcutsProvider({
  children
}: {
  children: React.ReactNode
}) {
  const [showHelp, setShowHelp] = useState(false)
  const router = useRouter()
  const lastKeyRef = useRef<string>('')
  const lastKeyTimeRef = useRef<number>(0)

  // 檢查是否在輸入框中
  const isInputFocused = useCallback(() => {
    const activeElement = document.activeElement
    if (!activeElement) return false
    const tagName = activeElement.tagName.toLowerCase()
    const isEditable = activeElement.getAttribute('contenteditable') === 'true'
    return tagName === 'input' || tagName === 'textarea' || isEditable
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 忽略輸入框中的按鍵
      if (isInputFocused()) return

      const now = Date.now()
      const key = e.key.toLowerCase()

      // 處理 ? (shift+/)
      if (e.shiftKey && e.key === '?') {
        e.preventDefault()
        setShowHelp(prev => !prev)
        return
      }

      // 處理 ESC
      if (e.key === 'Escape') {
        setShowHelp(false)
        return
      }

      // 處理 G 開頭的組合鍵 (g + 字母)
      if (lastKeyRef.current === 'g' && now - lastKeyTimeRef.current < 1000) {
        e.preventDefault()
        switch (key) {
          case 't':
            router.push('/tasks')
            break
          case 'd':
            router.push('/dashboard')
            break
          case 'c':
            router.push('/calendar')
            break
          case 'h':
            router.push('/')
            break
          case 'p':
            router.push('/projects')
            break
          case 'a':
            router.push('/analytics')
            break
          case 's':
            router.push('/settings')
            break
        }
        lastKeyRef.current = ''
        return
      }

      // 記錄按鍵用於組合鍵
      if (key === 'g') {
        lastKeyRef.current = 'g'
        lastKeyTimeRef.current = now
        return
      }

      // 重置組合鍵狀態
      lastKeyRef.current = ''
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isInputFocused, router])

  return (
    <>
      {children}
      <KeyboardShortcutsHelp
        open={showHelp}
        onClose={() => setShowHelp(false)}
      />
    </>
  )
}
