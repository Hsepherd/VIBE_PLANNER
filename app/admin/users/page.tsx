'use client'

import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/lib/useAuth'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Plus,
  Trash2,
  Edit,
  Loader2,
  Eye,
  EyeOff,
  MoreHorizontal,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Shield,
} from 'lucide-react'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'

interface User {
  id: string
  email: string
  name: string
  createdAt: string
  lastSignInAt: string | null
  emailConfirmedAt: string | null
  isAdmin: boolean
}

type SortField = 'name' | 'email' | 'createdAt' | 'lastSignInAt'
type SortDirection = 'asc' | 'desc'

// 管理員 email（與後端保持一致）
const ADMIN_EMAIL = 'xk4xk4563022@gmail.com'

export default function AdminUsersPage() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // 排序狀態
  const [sortField, setSortField] = useState<SortField>('createdAt')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  // 新增/編輯使用者 Dialog
  const [showDialog, setShowDialog] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [formData, setFormData] = useState({ email: '', password: '', name: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // 刪除確認
  const [deletingUser, setDeletingUser] = useState<User | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // 操作選單
  const [activeMenu, setActiveMenu] = useState<string | null>(null)

  // 檢查權限
  const isAdmin = user?.email === ADMIN_EMAIL

  // 分離管理員和一般使用者，並排序
  const { admins, regularUsers } = useMemo(() => {
    const sortedUsers = [...users].sort((a, b) => {
      let aValue: string | number | null = null
      let bValue: string | number | null = null

      switch (sortField) {
        case 'name':
          aValue = a.name.toLowerCase()
          bValue = b.name.toLowerCase()
          break
        case 'email':
          aValue = a.email.toLowerCase()
          bValue = b.email.toLowerCase()
          break
        case 'createdAt':
          aValue = new Date(a.createdAt).getTime()
          bValue = new Date(b.createdAt).getTime()
          break
        case 'lastSignInAt':
          aValue = a.lastSignInAt ? new Date(a.lastSignInAt).getTime() : 0
          bValue = b.lastSignInAt ? new Date(b.lastSignInAt).getTime() : 0
          break
      }

      if (aValue === null || bValue === null) return 0
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
      return 0
    })

    return {
      admins: sortedUsers.filter(u => u.isAdmin),
      regularUsers: sortedUsers.filter(u => !u.isAdmin),
    }
  }, [users, sortField, sortDirection])

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    } else if (!authLoading && user && !isAdmin) {
      router.push('/')
    }
  }, [user, authLoading, isAdmin, router])

  // 載入使用者列表
  const loadUsers = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const res = await fetch('/api/admin/users')
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || '載入失敗')
      }

      setUsers(data.users)
    } catch (err) {
      setError(err instanceof Error ? err.message : '載入失敗')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (isAdmin) {
      loadUsers()
    }
  }, [isAdmin])

  // 自動隱藏成功訊息
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [successMessage])

  // 處理排序點擊
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  // 排序圖示
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3.5 w-3.5 text-gray-300" />
    }
    return sortDirection === 'asc'
      ? <ArrowUp className="h-3.5 w-3.5 text-gray-600" />
      : <ArrowDown className="h-3.5 w-3.5 text-gray-600" />
  }

  // 開啟新增使用者 Dialog
  const openCreateDialog = () => {
    setEditingUser(null)
    setFormData({ email: '', password: '', name: '' })
    setShowDialog(true)
    setActiveMenu(null)
  }

  // 開啟編輯使用者 Dialog
  const openEditDialog = (user: User) => {
    setEditingUser(user)
    setFormData({ email: user.email, password: '', name: user.name })
    setShowDialog(true)
    setActiveMenu(null)
  }

  // 儲存使用者
  const handleSave = async () => {
    try {
      setIsSaving(true)
      setError(null)

      const url = editingUser
        ? `/api/admin/users/${editingUser.id}`
        : '/api/admin/users'

      const method = editingUser ? 'PATCH' : 'POST'

      // 編輯時只傳有變更的欄位
      const body = editingUser
        ? {
            ...(formData.email !== editingUser.email && { email: formData.email }),
            ...(formData.password && { password: formData.password }),
            ...(formData.name !== editingUser.name && { name: formData.name }),
          }
        : formData

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || '儲存失敗')
      }

      setShowDialog(false)
      setSuccessMessage(editingUser ? '使用者已更新' : '使用者已建立')
      loadUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : '儲存失敗')
    } finally {
      setIsSaving(false)
    }
  }

  // 刪除使用者
  const handleDelete = async () => {
    if (!deletingUser) return

    try {
      setIsDeleting(true)
      const res = await fetch(`/api/admin/users/${deletingUser.id}`, {
        method: 'DELETE',
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || '刪除失敗')
      }

      setDeletingUser(null)
      setSuccessMessage('使用者已刪除')
      loadUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : '刪除失敗')
    } finally {
      setIsDeleting(false)
    }
  }

  // 使用者列表項目元件
  const UserRow = ({ u }: { u: User }) => (
    <div
      className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-gray-50 transition-colors"
    >
      {/* 使用者名稱與頭像 */}
      <div className="col-span-4 flex items-center gap-3">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-medium ${
          u.isAdmin ? 'bg-gray-900' : 'bg-gray-400'
        }`}>
          {u.name.charAt(0).toUpperCase()}
        </div>
        <div className="font-medium text-gray-900">
          {u.name}
        </div>
      </div>

      {/* Email */}
      <div className="col-span-3 text-gray-600 text-sm truncate">
        {u.email}
      </div>

      {/* 建立日期 */}
      <div className="col-span-2 text-gray-500 text-sm">
        {format(new Date(u.createdAt), 'yyyy/M/d', { locale: zhTW })}
      </div>

      {/* 最後登入 */}
      <div className="col-span-2 text-gray-500 text-sm">
        {u.lastSignInAt
          ? format(new Date(u.lastSignInAt), 'M/d HH:mm', { locale: zhTW })
          : '—'
        }
      </div>

      {/* 操作按鈕 */}
      <div className="col-span-1 flex justify-end relative">
        <button
          onClick={() => setActiveMenu(activeMenu === u.id ? null : u.id)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <MoreHorizontal className="h-4 w-4 text-gray-400" />
        </button>

        {/* 下拉選單 */}
        {activeMenu === u.id && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setActiveMenu(null)}
            />
            <div className="absolute right-0 top-10 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-20 min-w-[120px]">
              <button
                onClick={() => openEditDialog(u)}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <Edit className="h-4 w-4" />
                編輯
              </button>
              {!u.isAdmin && (
                <button
                  onClick={() => {
                    setDeletingUser(u)
                    setActiveMenu(null)
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  刪除
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )

  // 載入中或權限檢查
  if (authLoading || !user || !isAdmin) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto bg-white">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* 標題區 */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-semibold text-gray-900">使用者管理</h1>
          <Button
            onClick={openCreateDialog}
            className="bg-gray-900 hover:bg-gray-800 text-white rounded-lg px-4"
          >
            <Plus className="h-4 w-4 mr-2" />
            新增使用者
          </Button>
        </div>

        {/* 錯誤提示 */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)}>
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* 成功訊息 Toast */}
        {successMessage && (
          <div className="fixed bottom-6 right-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2 shadow-lg z-50">
            <svg className="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            {successMessage}
          </div>
        )}

        {isLoading && users.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p>載入中...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* 管理員區塊 */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Shield className="h-5 w-5 text-gray-900" />
                <h2 className="text-lg font-semibold text-gray-900">管理員</h2>
                <span className="text-sm text-gray-400">({admins.length})</span>
              </div>
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                {/* 表頭 */}
                <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50 border-b border-gray-200 text-sm text-gray-500 font-medium">
                  <button
                    onClick={() => handleSort('name')}
                    className="col-span-4 flex items-center gap-1.5 hover:text-gray-700 transition-colors"
                  >
                    名稱 <SortIcon field="name" />
                  </button>
                  <button
                    onClick={() => handleSort('email')}
                    className="col-span-3 flex items-center gap-1.5 hover:text-gray-700 transition-colors"
                  >
                    Email <SortIcon field="email" />
                  </button>
                  <button
                    onClick={() => handleSort('createdAt')}
                    className="col-span-2 flex items-center gap-1.5 hover:text-gray-700 transition-colors"
                  >
                    建立日期 <SortIcon field="createdAt" />
                  </button>
                  <button
                    onClick={() => handleSort('lastSignInAt')}
                    className="col-span-2 flex items-center gap-1.5 hover:text-gray-700 transition-colors"
                  >
                    最後登入 <SortIcon field="lastSignInAt" />
                  </button>
                  <div className="col-span-1"></div>
                </div>

                {/* 管理員列表 */}
                {admins.length === 0 ? (
                  <div className="p-8 text-center text-gray-400">
                    <p>沒有管理員</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {admins.map((u) => (
                      <UserRow key={u.id} u={u} />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 一般使用者區塊 */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-lg font-semibold text-gray-900">一般使用者</h2>
                <span className="text-sm text-gray-400">({regularUsers.length})</span>
              </div>
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                {/* 表頭 */}
                <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50 border-b border-gray-200 text-sm text-gray-500 font-medium">
                  <button
                    onClick={() => handleSort('name')}
                    className="col-span-4 flex items-center gap-1.5 hover:text-gray-700 transition-colors"
                  >
                    名稱 <SortIcon field="name" />
                  </button>
                  <button
                    onClick={() => handleSort('email')}
                    className="col-span-3 flex items-center gap-1.5 hover:text-gray-700 transition-colors"
                  >
                    Email <SortIcon field="email" />
                  </button>
                  <button
                    onClick={() => handleSort('createdAt')}
                    className="col-span-2 flex items-center gap-1.5 hover:text-gray-700 transition-colors"
                  >
                    建立日期 <SortIcon field="createdAt" />
                  </button>
                  <button
                    onClick={() => handleSort('lastSignInAt')}
                    className="col-span-2 flex items-center gap-1.5 hover:text-gray-700 transition-colors"
                  >
                    最後登入 <SortIcon field="lastSignInAt" />
                  </button>
                  <div className="col-span-1"></div>
                </div>

                {/* 一般使用者列表 */}
                {regularUsers.length === 0 ? (
                  <div className="p-8 text-center text-gray-400">
                    <p>沒有一般使用者</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {regularUsers.map((u) => (
                      <UserRow key={u.id} u={u} />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 統計 */}
            <div className="text-sm text-gray-500">
              共 {users.length} 位使用者（{admins.length} 位管理員，{regularUsers.length} 位一般使用者）
            </div>
          </div>
        )}
      </div>

      {/* 新增/編輯 Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">
              {editingUser ? '編輯使用者' : '新增使用者'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">名稱</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="輸入名稱"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Email</label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@example.com"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                密碼
                {editingUser && (
                  <span className="text-gray-400 font-normal ml-2">（留空表示不變更）</span>
                )}
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder={editingUser ? '••••••••' : '至少 6 個字元'}
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowDialog(false)}
                className="px-4"
              >
                取消
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="bg-gray-900 hover:bg-gray-800 text-white px-4"
              >
                {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editingUser ? '更新' : '建立'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 刪除確認 Dialog */}
      <Dialog open={!!deletingUser} onOpenChange={() => setDeletingUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">刪除使用者</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-gray-600">
              確定要刪除 <strong>{deletingUser?.name}</strong> 嗎？
            </p>
            <p className="text-sm text-gray-400 mt-2">
              此操作無法復原，該使用者將無法再登入。
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setDeletingUser(null)}
              className="px-4"
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
              className="px-4"
            >
              {isDeleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              刪除
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
