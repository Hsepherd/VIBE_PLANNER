'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Brain, Trash2, RefreshCw, Clock, Sparkles, MessageSquare, CheckCircle2, XCircle, Lightbulb } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { getLearningSystemStats, resetAllLearning } from '@/lib/few-shot-learning'

interface LearningSystemStats {
  totalConversations: number
  totalInstructions: number
  averageQuality: number
  positiveRate: number
  topInstructions: string[]
  recentLearnings: Array<{
    type: 'conversation' | 'instruction'
    content: string
    time: Date
  }>
}

export default function LearningStatus() {
  const [stats, setStats] = useState<LearningSystemStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  // 載入學習狀態
  const loadData = async () => {
    setIsLoading(true)
    try {
      console.log('開始載入 AI 學習狀態...')
      const data = await getLearningSystemStats()
      console.log('學習統計:', data)
      setStats(data)
    } catch (error) {
      console.error('載入學習狀態失敗:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // 重置學習
  const handleReset = async () => {
    try {
      await resetAllLearning()
      setShowResetConfirm(false)
      await loadData()
    } catch (error) {
      console.error('重置學習失敗:', error)
    }
  }

  // 格式化時間
  const formatTime = (date: Date) => {
    return formatDistanceToNow(date, { addSuffix: true, locale: zhTW })
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI 學習狀態
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  const hasData = (stats?.totalConversations || 0) > 0 || (stats?.totalInstructions || 0) > 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          AI 學習狀態
        </CardTitle>
        <CardDescription>
          AI 會從你的對話、指令和回饋中學習，持續優化萃取結果
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 學習摘要 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-2xl font-bold text-primary">
              {stats?.totalConversations || 0}
            </p>
            <p className="text-xs text-muted-foreground">對話學習</p>
          </div>
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-2xl font-bold text-blue-500">
              {stats?.totalInstructions || 0}
            </p>
            <p className="text-xs text-muted-foreground">學習指令</p>
          </div>
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-2xl font-bold text-green-500">
              {stats?.positiveRate || 0}%
            </p>
            <p className="text-xs text-muted-foreground">滿意度</p>
          </div>
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-2xl font-bold text-amber-500">
              {stats?.averageQuality || 0}%
            </p>
            <p className="text-xs text-muted-foreground">平均品質</p>
          </div>
        </div>

        {/* 已學習的指令 */}
        {stats?.topInstructions && stats.topInstructions.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium flex items-center gap-1.5">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              已學習的偏好
            </p>
            <div className="space-y-2">
              {stats.topInstructions.map((instruction, index) => (
                <div
                  key={index}
                  className="flex items-start gap-2 p-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg"
                >
                  <Sparkles className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <span className="text-sm">{instruction}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 最近學習紀錄 */}
        {stats?.recentLearnings && stats.recentLearnings.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">最近學習紀錄</p>
            <div className="space-y-2">
              {stats.recentLearnings.map((learning, index) => (
                <div
                  key={index}
                  className={`flex items-start gap-2 p-2 rounded-lg ${
                    learning.type === 'instruction'
                      ? 'bg-blue-50 dark:bg-blue-950/30'
                      : 'bg-green-50 dark:bg-green-950/30'
                  }`}
                >
                  {learning.type === 'instruction' ? (
                    <MessageSquare className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          learning.type === 'instruction'
                            ? 'bg-blue-100 dark:bg-blue-900 border-blue-200'
                            : 'bg-green-100 dark:bg-green-900 border-green-200'
                        }`}
                      >
                        {learning.type === 'instruction' ? '指令' : '對話'}
                      </Badge>
                      <span className="text-sm truncate">{learning.content}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatTime(learning.time)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 空狀態 */}
        {!hasData && (
          <div className="text-center py-4 text-muted-foreground">
            <Brain className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">還沒有學習資料</p>
            <p className="text-xs mt-1">
              開始使用任務萃取功能，AI 會自動學習你的偏好
            </p>
            <div className="mt-3 text-xs space-y-1">
              <p>AI 會學習：</p>
              <ul className="list-disc list-inside text-left max-w-xs mx-auto">
                <li>你的對話指令（例如「標題要精簡」）</li>
                <li>你確認/拒絕的任務</li>
                <li>你的回饋和修正</li>
              </ul>
            </div>
          </div>
        )}

        {/* 重置按鈕 */}
        <div className="flex justify-end pt-2">
          {showResetConfirm ? (
            <div className="flex gap-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleReset}
              >
                確認重置
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowResetConfirm(false)}
              >
                取消
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowResetConfirm(true)}
              disabled={!hasData}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              重置學習
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
