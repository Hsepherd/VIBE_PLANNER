'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Brain, Trash2, RefreshCw } from 'lucide-react'
import {
  getLearningStats,
  getAllPreferences,
  resetAllLearning,
  type UserPreference,
  type LearningStats,
} from '@/lib/preferences'

export default function LearningStatus() {
  const [stats, setStats] = useState<LearningStats | null>(null)
  const [preferences, setPreferences] = useState<UserPreference[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  // 載入學習狀態
  const loadData = async () => {
    setIsLoading(true)
    try {
      const [statsData, prefsData] = await Promise.all([
        getLearningStats(),
        getAllPreferences(),
      ])
      setStats(statsData)
      setPreferences(prefsData)
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

  // 格式化類別名稱
  const formatCategory = (category: string) => {
    const labels: Record<string, string> = {
      priority: '優先級',
      assignee: '負責人',
      project: '專案',
      filter: '過濾',
      style: '風格',
    }
    return labels[category] || category
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          AI 學習狀態
        </CardTitle>
        <CardDescription>
          AI 會根據你的使用習慣自動學習並優化
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 學習進度 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">學習進度</span>
            <span className="font-medium">{stats?.learningProgress || 0}%</span>
          </div>
          <Progress value={stats?.learningProgress || 0} className="h-2" />
          <p className="text-xs text-muted-foreground">
            已分析 {stats?.totalExamples || 0} 個範例，學習了 {preferences.length} 條規則
          </p>
        </div>

        {/* 回饋統計 */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-xl font-bold text-green-500">
              {stats?.thumbsUp || 0}
            </p>
            <p className="text-xs text-muted-foreground">👍 正面回饋</p>
          </div>
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-xl font-bold text-red-500">
              {stats?.thumbsDown || 0}
            </p>
            <p className="text-xs text-muted-foreground">👎 負面回饋</p>
          </div>
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-xl font-bold">
              {preferences.filter(p => p.isActive).length}
            </p>
            <p className="text-xs text-muted-foreground">啟用規則</p>
          </div>
        </div>

        {/* 已學習的規則 */}
        {preferences.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">已學習的規則</p>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {preferences.slice(0, 10).map((pref) => (
                <div
                  key={pref.id}
                  className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Badge variant="outline" className="text-xs shrink-0">
                      {formatCategory(pref.category)}
                    </Badge>
                    <span className="truncate">
                      「{pref.pattern}」→ {pref.action}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0 ml-2">
                    {Math.round(pref.confidence * 100)}%
                  </span>
                </div>
              ))}
            </div>
            {preferences.length > 10 && (
              <p className="text-xs text-muted-foreground text-center">
                還有 {preferences.length - 10} 條規則...
              </p>
            )}
          </div>
        )}

        {/* 空狀態 */}
        {preferences.length === 0 && (stats?.totalExamples || 0) === 0 && (
          <div className="text-center py-4 text-muted-foreground">
            <p className="text-sm">還沒有學習資料</p>
            <p className="text-xs mt-1">
              開始使用任務萃取功能，AI 會自動學習你的偏好
            </p>
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
              disabled={preferences.length === 0 && (stats?.totalExamples || 0) === 0}
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
