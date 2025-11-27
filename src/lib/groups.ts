'use client'

// 組別管理模組
const STORAGE_KEY = 'vibe-planner-groups'

// 預設組別
const DEFAULT_GROUPS = [
  { name: '行銷組', color: 'blue' },
  { name: '電訪組', color: 'green' },
  { name: '營運組', color: 'purple' },
  { name: '教練組', color: 'orange' },
  { name: '業務組', color: 'cyan' },
  { name: '客服組', color: 'pink' },
]

export interface Group {
  name: string
  color: string
}

// 組別顏色配置
export const GROUP_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  blue: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
  green: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' },
  purple: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' },
  orange: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' },
  cyan: { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-200' },
  red: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' },
  yellow: { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-200' },
  pink: { bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-200' },
  indigo: { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200' },
  gray: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200' },
}

// 取得所有組別
export function getGroups(): Group[] {
  if (typeof window === 'undefined') return DEFAULT_GROUPS

  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_GROUPS))
    return DEFAULT_GROUPS
  }

  try {
    return JSON.parse(stored)
  } catch {
    return DEFAULT_GROUPS
  }
}

// 新增組別
export function addGroup(name: string, color: string = 'gray'): Group[] {
  const groups = getGroups()
  if (groups.some(g => g.name === name)) {
    return groups // 已存在
  }
  const newGroups = [...groups, { name, color }]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(newGroups))
  return newGroups
}

// 刪除組別
export function removeGroup(name: string): Group[] {
  const groups = getGroups().filter(g => g.name !== name)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(groups))
  return groups
}

// 取得組別顏色
export function getGroupColor(groupName: string): { bg: string; text: string; border: string } {
  const groups = getGroups()
  const group = groups.find(g => g.name === groupName)
  if (group && GROUP_COLORS[group.color]) {
    return GROUP_COLORS[group.color]
  }
  return GROUP_COLORS.gray
}
