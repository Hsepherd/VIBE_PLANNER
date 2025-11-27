'use client'

// 團隊成員管理（使用 localStorage）

const STORAGE_KEY = 'vibe-planner-team-members'

// 預設成員列表
const DEFAULT_MEMBERS = [
  'Hsepherd',
  'Karen',
  'Kelly',
  'Vicky',
  'Orange',
]

// 取得所有成員
export function getTeamMembers(): string[] {
  if (typeof window === 'undefined') return DEFAULT_MEMBERS

  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) {
    // 初始化預設成員
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_MEMBERS))
    return DEFAULT_MEMBERS
  }

  try {
    return JSON.parse(stored)
  } catch {
    return DEFAULT_MEMBERS
  }
}

// 新增成員
export function addTeamMember(name: string): string[] {
  const members = getTeamMembers()
  const trimmedName = name.trim()

  if (!trimmedName || members.includes(trimmedName)) {
    return members
  }

  const updated = [...members, trimmedName]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  return updated
}

// 刪除成員
export function removeTeamMember(name: string): string[] {
  const members = getTeamMembers()
  const updated = members.filter(m => m !== name)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  return updated
}

// 編輯成員名稱
export function editTeamMember(oldName: string, newName: string): string[] {
  const members = getTeamMembers()
  const trimmedNewName = newName.trim()

  if (!trimmedNewName || (members.includes(trimmedNewName) && oldName !== trimmedNewName)) {
    return members
  }

  const updated = members.map(m => m === oldName ? trimmedNewName : m)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  return updated
}
