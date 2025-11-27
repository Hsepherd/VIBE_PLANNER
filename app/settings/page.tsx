'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useAppStore, type AppState, type ApiUsageRecord } from '@/lib/store'
import { Trash2, Download, AlertTriangle, DollarSign, Cloud, CheckCircle2 } from 'lucide-react'
import { useState } from 'react'

export default function SettingsPage() {
  const clearMessages = useAppStore((state: AppState) => state.clearMessages)
  const tasks = useAppStore((state: AppState) => state.tasks)
  const projects = useAppStore((state: AppState) => state.projects)
  const messages = useAppStore((state: AppState) => state.messages)
  const apiUsage = useAppStore((state: AppState) => state.apiUsage)
  const clearApiUsage = useAppStore((state: AppState) => state.clearApiUsage)

  const [showConfirm, setShowConfirm] = useState(false)
  const [showClearUsageConfirm, setShowClearUsageConfirm] = useState(false)

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
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 space-y-6 max-w-2xl">
        <h1 className="text-2xl font-bold">⚙️ 設定</h1>

        {/* 雲端同步狀態 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cloud className="h-5 w-5" />
              雲端同步
            </CardTitle>
            <CardDescription>
              資料自動同步到雲端
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950 rounded-lg">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm text-green-700 dark:text-green-300">
                自動同步已啟用
              </span>
            </div>
          </CardContent>
        </Card>

        {/* API 花費統計 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              API 使用統計
            </CardTitle>
            <CardDescription>
              AI 助理使用量追蹤
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
                <p className="text-sm text-muted-foreground">AI 對話次數</p>
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
              匯出或清除你的資料
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
              版本：1.0.0
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
