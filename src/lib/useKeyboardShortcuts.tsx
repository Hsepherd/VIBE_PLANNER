'use client'

import { useEffect, useCallback, useState, createContext, useContext } from 'react'
import { useRouter } from 'next/navigation'
import { useHotkeys } from 'react-hotkeys-hook'

// 快捷鍵上下文
interface KeyboardShortcutsContextType {
  isEnabled: boolean
  setEnabled: (enabled: boolean) => void
  showHelp: boolean
  setShowHelp: (show: boolean) => void
}

const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextType>({
  isEnabled: true,
  setEnabled: () => {},
  showHelp: false,
  setShowHelp: () => {},
})

export const useKeyboardShortcutsContext = () => useContext(KeyboardShortcutsContext)

// 快捷鍵定義
export const shortcuts = {
  // 全局操作
  global: [
    { key: 'mod+k', label: '⌘K', description: '開啟搜尋' },
    { key: 'shift+?', label: '?', description: '顯示快捷鍵說明' },
    { key: 'escape', label: 'ESC', description: '關閉對話框' },
  ],
  // 導航 (G + 字母)
  navigation: [
    { key: 'g t', label: 'G T', description: '前往任務列表' },
    { key: 'g d', label: 'G D', description: '前往 Dashboard' },
    { key: 'g c', label: 'G C', description: '前往行事曆' },
    { key: 'g h', label: 'G H', description: '前往首頁' },
    { key: 'g p', label: 'G P', description: '前往專案' },
    { key: 'g a', label: 'G A', description: '前往數據分析' },
    { key: 'g s', label: 'G S', description: '前往設定' },
  ],
  // 任務操作
  tasks: [
    { key: 'n', label: 'N', description: '新增任務' },
    { key: 'e', label: 'E', description: '編輯選中任務' },
    { key: 'delete', label: 'Del', description: '刪除選中任務' },
    { key: 'enter', label: 'Enter', description: '開啟任務詳情' },
    { key: 'c', label: 'C', description: '完成選中任務' },
  ],
  // 列表導航
  list: [
    { key: 'j', label: 'J', description: '選擇下一個' },
    { key: 'k', label: 'K', description: '選擇上一個' },
    { key: 'mod+a', label: '⌘A', description: '全選' },
  ],
}

interface UseKeyboardShortcutsOptions {
  onNewTask?: () => void
  onEditTask?: () => void
  onDeleteTask?: () => void
  onCompleteTask?: () => void
  onOpenTask?: () => void
  onSelectNext?: () => void
  onSelectPrev?: () => void
  onSelectAll?: () => void
}

export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions = {}) {
  const router = useRouter()
  const [isEnabled, setEnabled] = useState(true)
  const [showHelp, setShowHelp] = useState(false)

  // 檢查是否在輸入框中
  const isInputFocused = useCallback(() => {
    const activeElement = document.activeElement
    if (!activeElement) return false
    const tagName = activeElement.tagName.toLowerCase()
    const isEditable = activeElement.getAttribute('contenteditable') === 'true'
    return tagName === 'input' || tagName === 'textarea' || isEditable
  }, [])

  // 導航快捷鍵
  useHotkeys('g t', () => {
    if (!isInputFocused() && isEnabled) router.push('/tasks')
  }, { preventDefault: true })

  useHotkeys('g d', () => {
    if (!isInputFocused() && isEnabled) router.push('/dashboard')
  }, { preventDefault: true })

  useHotkeys('g c', () => {
    if (!isInputFocused() && isEnabled) router.push('/calendar')
  }, { preventDefault: true })

  useHotkeys('g h', () => {
    if (!isInputFocused() && isEnabled) router.push('/')
  }, { preventDefault: true })

  useHotkeys('g p', () => {
    if (!isInputFocused() && isEnabled) router.push('/projects')
  }, { preventDefault: true })

  useHotkeys('g a', () => {
    if (!isInputFocused() && isEnabled) router.push('/analytics')
  }, { preventDefault: true })

  useHotkeys('g s', () => {
    if (!isInputFocused() && isEnabled) router.push('/settings')
  }, { preventDefault: true })

  // 任務操作快捷鍵
  useHotkeys('n', () => {
    if (!isInputFocused() && isEnabled && options.onNewTask) {
      options.onNewTask()
    }
  }, { preventDefault: true })

  useHotkeys('e', () => {
    if (!isInputFocused() && isEnabled && options.onEditTask) {
      options.onEditTask()
    }
  }, { preventDefault: true })

  useHotkeys('delete, backspace', () => {
    if (!isInputFocused() && isEnabled && options.onDeleteTask) {
      options.onDeleteTask()
    }
  }, { preventDefault: true })

  useHotkeys('c', () => {
    if (!isInputFocused() && isEnabled && options.onCompleteTask) {
      options.onCompleteTask()
    }
  }, { preventDefault: true })

  useHotkeys('enter', () => {
    if (!isInputFocused() && isEnabled && options.onOpenTask) {
      options.onOpenTask()
    }
  }, { preventDefault: true })

  // 列表導航快捷鍵
  useHotkeys('j', () => {
    if (!isInputFocused() && isEnabled && options.onSelectNext) {
      options.onSelectNext()
    }
  }, { preventDefault: true })

  useHotkeys('k', () => {
    if (!isInputFocused() && isEnabled && options.onSelectPrev) {
      options.onSelectPrev()
    }
  }, { preventDefault: true })

  useHotkeys('mod+a', () => {
    if (!isInputFocused() && isEnabled && options.onSelectAll) {
      options.onSelectAll()
    }
  }, { preventDefault: true })

  // 顯示快捷鍵說明
  useHotkeys('shift+/', () => {
    if (!isInputFocused() && isEnabled) {
      setShowHelp(prev => !prev)
    }
  }, { preventDefault: true })

  return {
    isEnabled,
    setEnabled,
    showHelp,
    setShowHelp,
    shortcuts,
  }
}

// 快捷鍵說明元件
export function KeyboardShortcutsHelp({
  open,
  onClose
}: {
  open: boolean
  onClose: () => void
}) {
  // ESC 關閉
  useHotkeys('escape', () => {
    if (open) onClose()
  }, { enableOnFormTags: true })

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      {/* 背景遮罩 */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 說明面板 */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-white rounded-xl shadow-2xl p-6 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">快捷鍵說明</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <kbd className="px-2 py-1 rounded bg-gray-100 text-sm">ESC</kbd>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-8">
          {/* 全局操作 */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 mb-3">全局操作</h3>
            <div className="space-y-2">
              {shortcuts.global.map((shortcut) => (
                <div key={shortcut.key} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{shortcut.description}</span>
                  <kbd className="px-2 py-1 rounded bg-gray-100 text-xs font-mono">{shortcut.label}</kbd>
                </div>
              ))}
            </div>
          </div>

          {/* 導航 */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 mb-3">頁面導航</h3>
            <div className="space-y-2">
              {shortcuts.navigation.map((shortcut) => (
                <div key={shortcut.key} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{shortcut.description}</span>
                  <kbd className="px-2 py-1 rounded bg-gray-100 text-xs font-mono">{shortcut.label}</kbd>
                </div>
              ))}
            </div>
          </div>

          {/* 任務操作 */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 mb-3">任務操作</h3>
            <div className="space-y-2">
              {shortcuts.tasks.map((shortcut) => (
                <div key={shortcut.key} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{shortcut.description}</span>
                  <kbd className="px-2 py-1 rounded bg-gray-100 text-xs font-mono">{shortcut.label}</kbd>
                </div>
              ))}
            </div>
          </div>

          {/* 列表導航 */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 mb-3">列表導航</h3>
            <div className="space-y-2">
              {shortcuts.list.map((shortcut) => (
                <div key={shortcut.key} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{shortcut.description}</span>
                  <kbd className="px-2 py-1 rounded bg-gray-100 text-xs font-mono">{shortcut.label}</kbd>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t text-center text-sm text-gray-400">
          按 <kbd className="px-1.5 py-0.5 rounded bg-gray-100 text-xs">?</kbd> 隨時顯示此說明
        </div>
      </div>
    </div>
  )
}
