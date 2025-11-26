'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useAppStore, type AppState, type ApiUsageRecord } from '@/lib/store'
import { useSupabaseSync } from '@/lib/useSupabaseSync'
import { Trash2, Download, AlertTriangle, DollarSign, Cloud, CloudUpload, CloudDownload, RefreshCw, CheckCircle2, XCircle, Loader2, Eye, EyeOff } from 'lucide-react'
import { useState, useEffect } from 'react'

export default function SettingsPage() {
  const clearMessages = useAppStore((state: AppState) => state.clearMessages)
  const tasks = useAppStore((state: AppState) => state.tasks)
  const projects = useAppStore((state: AppState) => state.projects)
  const messages = useAppStore((state: AppState) => state.messages)
  const apiUsage = useAppStore((state: AppState) => state.apiUsage)
  const clearApiUsage = useAppStore((state: AppState) => state.clearApiUsage)

  const [showConfirm, setShowConfirm] = useState(false)
  const [showClearUsageConfirm, setShowClearUsageConfirm] = useState(false)
  const [isConnected, setIsConnected] = useState<boolean | null>(null)
  const [showApiKey, setShowApiKey] = useState(false)
  const [showSupabaseUrl, setShowSupabaseUrl] = useState(false)

  // Supabase URL (前端可用)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''

  // 隱藏敏感資訊的函數
  const maskUrl = (url: string) => {
    if (!url) return '未設定'
    const match = url.match(/^(https:\/\/)([^.]+)(\.supabase\.co.*)$/)
    if (match) {
      const prefix = match[2].substring(0, 3)
      return `${match[1]}${prefix}***${match[3]}`
    }
    return url.substring(0, 15) + '***'
  }

  // API 設定狀態
  const [openaiConfig, setOpenaiConfig] = useState<{
    configured: boolean
    masked: string
    full: string
  }>({ configured: false, masked: '載入中...', full: '' })

  // 載入 OpenAI API Key（需要從後端取得）
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const res = await fetch('/api/config')
        if (res.ok) {
          const data = await res.json()
          setOpenaiConfig(data.openai)
        }
      } catch (err) {
        console.error('載入設定失敗:', err)
        setOpenaiConfig({ configured: false, masked: '無法載入', full: '' })
      }
    }
    loadConfig()
  }, [])

  // Supabase 同步 hook
  const {
    syncStatus,
    lastSyncTime,
    error: syncError,
    uploadToSupabase,
    downloadFromSupabase,
    checkConnection,
  } = useSupabaseSync()

  // 檢查 Supabase 連線狀態
  useEffect(() => {
    checkConnection().then(setIsConnected)
  }, [checkConnection])

  // 計算總花費和 token
  const totalCost = apiUsage.reduce((sum: number, record: ApiUsageRecord) => sum + record.cost, 0)
  const totalTokens = apiUsage.reduce((sum: number, record: ApiUsageRecord) => sum + record.totalTokens, 0)
  const totalPromptTokens = apiUsage.reduce((sum: number, record: ApiUsageRecord) => sum + record.promptTokens, 0)
  const totalCompletionTokens = apiUsage.reduce((sum: number, record: ApiUsageRecord) => sum + record.completionTokens, 0)

  // 匯出資料
  const handleExport = () => {
    const data = {
      tasks,
      projects,
      messages,
      exportedAt: new Date().toISOString(),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vibe-planner-backup-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // 清除所有資料
  const handleClearAll = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('vibe-planner-storage')
      window.location.reload()
    }
  }

  return (
    <ScrollArea className="flex-1">
      <div className="p-6 space-y-6 max-w-2xl">
        <h1 className="text-2xl font-bold">⚙️ 設定</h1>

        {/* API 設定 */}
        <Card>
          <CardHeader>
            <CardTitle>API 設定</CardTitle>
            <CardDescription>
              設定 OpenAI 和 Supabase 的 API 金鑰
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">OpenAI API Key</label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={showApiKey ? openaiConfig.full : openaiConfig.masked}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowApiKey(!showApiKey)}
                  title={showApiKey ? '隱藏' : '顯示'}
                  disabled={!openaiConfig.configured}
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                請在 .env.local 檔案中設定 OPENAI_API_KEY
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Supabase URL</label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={showSupabaseUrl ? supabaseUrl : maskUrl(supabaseUrl)}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowSupabaseUrl(!showSupabaseUrl)}
                  title={showSupabaseUrl ? '隱藏' : '顯示'}
                  disabled={!supabaseUrl}
                >
                  {showSupabaseUrl ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                請在 .env.local 檔案中設定 NEXT_PUBLIC_SUPABASE_URL
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 雲端同步 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cloud className="h-5 w-5" />
              雲端同步
            </CardTitle>
            <CardDescription>
              將資料同步到 Supabase 雲端資料庫
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 連線狀態 */}
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                {isConnected === null ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : isConnected ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
                <span className="text-sm">
                  {isConnected === null
                    ? '檢查連線中...'
                    : isConnected
                    ? 'Supabase 已連線'
                    : 'Supabase 未連線'}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => checkConnection().then(setIsConnected)}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

            {/* 同步狀態 */}
            {syncStatus !== 'idle' && (
              <div
                className={`p-3 rounded-lg text-sm ${
                  syncStatus === 'syncing'
                    ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                    : syncStatus === 'success'
                    ? 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300'
                    : 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300'
                }`}
              >
                {syncStatus === 'syncing' && (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    同步中...
                  </span>
                )}
                {syncStatus === 'success' && (
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    同步成功！
                    {lastSyncTime && (
                      <span className="text-xs opacity-70">
                        ({lastSyncTime.toLocaleTimeString()})
                      </span>
                    )}
                  </span>
                )}
                {syncStatus === 'error' && (
                  <span className="flex items-center gap-2">
                    <XCircle className="h-4 w-4" />
                    同步失敗：{syncError}
                  </span>
                )}
              </div>
            )}

            {/* 同步按鈕 */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={uploadToSupabase}
                disabled={!isConnected || syncStatus === 'syncing'}
              >
                <CloudUpload className="h-4 w-4 mr-2" />
                上傳到雲端
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={downloadFromSupabase}
                disabled={!isConnected || syncStatus === 'syncing'}
              >
                <CloudDownload className="h-4 w-4 mr-2" />
                從雲端下載
              </Button>
            </div>

            {/* 說明 */}
            <div className="text-xs text-muted-foreground space-y-1">
              <p><strong>上傳到雲端：</strong>將本機資料同步至 Supabase（會覆蓋雲端資料）</p>
              <p><strong>從雲端下載：</strong>從 Supabase 下載資料到本機（會覆蓋本機資料）</p>
            </div>

            {/* 未連線提示 */}
            {isConnected === false && (
              <div className="p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg text-sm text-yellow-700 dark:text-yellow-300">
                <p className="font-medium mb-1">請先設定 Supabase：</p>
                <ol className="list-decimal list-inside space-y-1 text-xs">
                  <li>在 Supabase 建立專案</li>
                  <li>執行 supabase/schema.sql 建立資料表</li>
                  <li>在 .env.local 設定 URL 和 API Key</li>
                </ol>
              </div>
            )}
          </CardContent>
        </Card>

        {/* API 花費統計 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              API 花費統計
            </CardTitle>
            <CardDescription>
              追蹤 OpenAI API 的使用量與費用
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 費用摘要 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-muted rounded-lg text-center">
                <p className="text-3xl font-bold text-primary">
                  ${totalCost.toFixed(4)}
                </p>
                <p className="text-sm text-muted-foreground">總花費 (USD)</p>
              </div>
              <div className="p-4 bg-muted rounded-lg text-center">
                <p className="text-3xl font-bold">
                  {apiUsage.length}
                </p>
                <p className="text-sm text-muted-foreground">API 呼叫次數</p>
              </div>
            </div>

            {/* Token 統計 */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">輸入 Tokens</span>
                <span>{totalPromptTokens.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">輸出 Tokens</span>
                <span>{totalCompletionTokens.toLocaleString()}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-sm font-medium">
                <span>總 Tokens</span>
                <span>{totalTokens.toLocaleString()}</span>
              </div>
            </div>

            {/* 價格說明 */}
            <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg text-xs">
              <p className="font-medium mb-1">GPT-4.1 Mini 價格：</p>
              <p className="text-muted-foreground">
                輸入：$0.40 / 1M tokens • 輸出：$1.60 / 1M tokens
              </p>
            </div>

            {/* 清除按鈕 */}
            <div className="flex justify-end">
              {showClearUsageConfirm ? (
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      clearApiUsage()
                      setShowClearUsageConfirm(false)
                    }}
                  >
                    確認清除
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowClearUsageConfirm(false)}
                  >
                    取消
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowClearUsageConfirm(true)}
                  disabled={apiUsage.length === 0}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  清除統計
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 資料管理 */}
        <Card>
          <CardHeader>
            <CardTitle>資料管理</CardTitle>
            <CardDescription>
              匯出、匯入或清除你的資料
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">匯出資料</p>
                <p className="text-sm text-muted-foreground">
                  下載所有任務、專案和對話記錄
                </p>
              </div>
              <Button variant="outline" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                匯出
              </Button>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">清除對話</p>
                <p className="text-sm text-muted-foreground">
                  清除所有對話記錄（保留任務和專案）
                </p>
              </div>
              <Button variant="outline" onClick={clearMessages}>
                <Trash2 className="h-4 w-4 mr-2" />
                清除對話
              </Button>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-destructive">清除所有資料</p>
                <p className="text-sm text-muted-foreground">
                  刪除所有任務、專案和對話記錄（無法復原）
                </p>
              </div>
              {showConfirm ? (
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    onClick={handleClearAll}
                  >
                    確認刪除
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowConfirm(false)}
                  >
                    取消
                  </Button>
                </div>
              ) : (
                <Button
                  variant="destructive"
                  onClick={() => setShowConfirm(true)}
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  清除全部
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 統計 */}
        <Card>
          <CardHeader>
            <CardTitle>使用統計</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold">{tasks.length}</p>
                <p className="text-sm text-muted-foreground">任務</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{projects.length}</p>
                <p className="text-sm text-muted-foreground">專案</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{messages.length}</p>
                <p className="text-sm text-muted-foreground">對話</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 關於 */}
        <Card>
          <CardHeader>
            <CardTitle>關於</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm">
              <strong>Vibe Planner</strong> - AI 驅動的個人超級助理
            </p>
            <p className="text-sm text-muted-foreground">
              版本：1.0.0 (MVP)
            </p>
            <p className="text-sm text-muted-foreground">
              技術：Next.js 14 + GPT-4.1 Mini + Supabase
            </p>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  )
}
