'use client'

// 標籤管理（使用 localStorage）

const STORAGE_KEY = 'vibe-planner-tags'

// 預設標籤列表
const DEFAULT_TAGS = [
  { name: '會議', color: 'blue' },
  { name: '開發', color: 'green' },
  { name: '設計', color: 'purple' },
  { name: '文件', color: 'yellow' },
  { name: '緊急', color: 'red' },
  { name: '研究', color: 'cyan' },
]

export interface Tag {
  name: string
  color: string
}

// 標籤顏色對應 Tailwind 類別
export const TAG_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  blue: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-300 dark:border-blue-700' },
  green: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', border: 'border-green-300 dark:border-green-700' },
  purple: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-300 dark:border-purple-700' },
  yellow: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-300', border: 'border-yellow-300 dark:border-yellow-700' },
  red: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300', border: 'border-red-300 dark:border-red-700' },
  cyan: { bg: 'bg-cyan-100 dark:bg-cyan-900/30', text: 'text-cyan-700 dark:text-cyan-300', border: 'border-cyan-300 dark:border-cyan-700' },
  orange: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-300 dark:border-orange-700' },
  pink: { bg: 'bg-pink-100 dark:bg-pink-900/30', text: 'text-pink-700 dark:text-pink-300', border: 'border-pink-300 dark:border-pink-700' },
  gray: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-700 dark:text-gray-300', border: 'border-gray-300 dark:border-gray-600' },
}

// 取得所有標籤
export function getTags(): Tag[] {
  if (typeof window === 'undefined') return DEFAULT_TAGS

  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) {
    // 初始化預設標籤
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_TAGS))
    return DEFAULT_TAGS
  }

  try {
    return JSON.parse(stored)
  } catch {
    return DEFAULT_TAGS
  }
}

// 新增標籤
export function addTag(name: string, color: string = 'gray'): Tag[] {
  const tags = getTags()
  const trimmedName = name.trim()

  if (!trimmedName || tags.some(t => t.name === trimmedName)) {
    return tags
  }

  const updated = [...tags, { name: trimmedName, color }]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  return updated
}

// 刪除標籤
export function removeTag(name: string): Tag[] {
  const tags = getTags()
  const updated = tags.filter(t => t.name !== name)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  return updated
}

// 更新標籤顏色
export function updateTagColor(name: string, color: string): Tag[] {
  const tags = getTags()
  const updated = tags.map(t => t.name === name ? { ...t, color } : t)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  return updated
}

// 根據標籤名稱取得顏色
export function getTagColor(tagName: string): { bg: string; text: string; border: string } {
  const tags = getTags()
  const tag = tags.find(t => t.name === tagName)
  const colorKey = tag?.color || 'gray'
  return TAG_COLORS[colorKey] || TAG_COLORS.gray
}
