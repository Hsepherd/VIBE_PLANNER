'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Calendar,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Unlink,
} from 'lucide-react'
import { toast } from 'sonner'

interface GoogleCalendarSettings {
  connected: boolean
  email?: string
  syncEnabled: boolean
  syncDirection: 'to_google' | 'from_google' | 'bidirectional'
  lastSyncAt?: string
}

export default function GoogleCalendarConnect() {
  const searchParams = useSearchParams()
  const [settings, setSettings] = useState<GoogleCalendarSettings>({
    connected: false,
    syncEnabled: false,
    syncDirection: 'to_google',
  })
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  // 讀取連接狀態
  useEffect(() => {
    fetchSettings()
  }, [])

  // 處理 OAuth 回調結果
  useEffect(() => {
    const success = searchParams.get('success')
    const error = searchParams.get('error')

    if (success === 'google_connected') {
      toast.success('Google Calendar 連接成功！')
      fetchSettings()
    } else if (error) {
      const errorMessages: Record<string, string> = {
        google_auth_failed: 'Google 授權失敗',
        missing_params: '缺少必要參數',
        invalid_state: '無效的狀態參數',
        no_access_token: '無法取得存取權杖',
        save_failed: '儲存設定失敗',
        callback_failed: '回調處理失敗',
      }
      toast.error(errorMessages[error] || '連接失敗')
    }
  }, [searchParams])

  // 取得設定
  const fetchSettings = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/settings/google-calendar')
      if (response.ok) {
        const data = await response.json()
        setSettings(data)
      }
    } catch (error) {
      console.error('取得設定失敗:', error)
    } finally {
      setLoading(false)
    }
  }

  // 連接 Google Calendar
  const handleConnect = () => {
    window.location.href = '/api/auth/google'
  }

  // 斷開連接
  const handleDisconnect = async () => {
    try {
      setDisconnecting(true)
      const response = await fetch('/api/settings/google-calendar', {
        method: 'DELETE',
      })
      if (response.ok) {
        setSettings({
          connected: false,
          syncEnabled: false,
          syncDirection: 'to_google',
        })
        toast.success('已斷開 Google Calendar 連接')
      } else {
        toast.error('斷開連接失敗')
      }
    } catch (error) {
      console.error('斷開連接失敗:', error)
      toast.error('斷開連接失敗')
    } finally {
      setDisconnecting(false)
    }
  }

  // 更新同步設定
  const updateSyncSettings = async (
    syncEnabled: boolean,
    syncDirection: GoogleCalendarSettings['syncDirection']
  ) => {
    try {
      const response = await fetch('/api/settings/google-calendar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncEnabled, syncDirection }),
      })
      if (response.ok) {
        setSettings(prev => ({ ...prev, syncEnabled, syncDirection }))
        toast.success('設定已更新')
      } else {
        toast.error('更新設定失敗')
      }
    } catch (error) {
      console.error('更新設定失敗:', error)
      toast.error('更新設定失敗')
    }
  }

  // 手動同步
  const handleManualSync = async () => {
    try {
      setSyncing(true)
      const response = await fetch('/api/calendar/sync', {
        method: 'POST',
      })
      if (response.ok) {
        const data = await response.json()
        toast.success(`同步完成：${data.synced} 個任務`)
        fetchSettings()
      } else {
        toast.error('同步失敗')
      }
    } catch (error) {
      console.error('同步失敗:', error)
      toast.error('同步失敗')
    } finally {
      setSyncing(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Google Calendar
          </CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Google Calendar
        </CardTitle>
        <CardDescription>
          將任務同步到 Google 行事曆
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 連接狀態 */}
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <div className="flex items-center gap-3">
            {settings.connected ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <div>
                  <p className="font-medium text-green-700 dark:text-green-300">
                    已連接
                  </p>
                  {settings.email && (
                    <p className="text-sm text-muted-foreground">
                      {settings.email}
                    </p>
                  )}
                </div>
              </>
            ) : (
              <>
                <XCircle className="h-5 w-5 text-muted-foreground" />
                <p className="text-muted-foreground">尚未連接</p>
              </>
            )}
          </div>
          {settings.connected ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              disabled={disconnecting}
            >
              {disconnecting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Unlink className="h-4 w-4 mr-2" />
              )}
              斷開連接
            </Button>
          ) : (
            <Button onClick={handleConnect}>
              <Calendar className="h-4 w-4 mr-2" />
              連接 Google Calendar
            </Button>
          )}
        </div>

        {/* 同步設定（僅在已連接時顯示） */}
        {settings.connected && (
          <>
            {/* 啟用同步 */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="sync-enabled">自動同步</Label>
                <p className="text-sm text-muted-foreground">
                  自動將任務同步到 Google Calendar
                </p>
              </div>
              <Switch
                id="sync-enabled"
                checked={settings.syncEnabled}
                onCheckedChange={(checked) =>
                  updateSyncSettings(checked, settings.syncDirection)
                }
              />
            </div>

            {/* 同步方向 */}
            <div className="space-y-2">
              <Label>同步方向</Label>
              <Select
                value={settings.syncDirection}
                onValueChange={(value) =>
                  updateSyncSettings(
                    settings.syncEnabled,
                    value as GoogleCalendarSettings['syncDirection']
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="to_google">
                    Vibe Planner → Google Calendar
                  </SelectItem>
                  <SelectItem value="from_google">
                    Google Calendar → Vibe Planner
                  </SelectItem>
                  <SelectItem value="bidirectional">
                    雙向同步
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 最後同步時間 */}
            {settings.lastSyncAt && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>上次同步：</span>
                <span>
                  {new Date(settings.lastSyncAt).toLocaleString('zh-TW')}
                </span>
              </div>
            )}

            {/* 手動同步按鈕 */}
            <Button
              variant="outline"
              className="w-full"
              onClick={handleManualSync}
              disabled={syncing}
            >
              {syncing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              立即同步
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
