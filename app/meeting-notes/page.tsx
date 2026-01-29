'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useSupabaseMeetingNotes, type MeetingNote } from '@/lib/useSupabaseMeetingNotes'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import {
  FileText,
  Calendar,
  Users,
  Search,
  Loader2,
  RefreshCw,
  Trash2,
  MessageSquare,
  X,
} from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MeetingNotesMarkdown } from '@/components/meeting-notes/MeetingNotesMarkdown'

export default function MeetingNotesPage() {
  const {
    meetingNotes,
    isLoading,
    error,
    deleteMeetingNote,
    searchMeetingNotes,
    refresh,
  } = useSupabaseMeetingNotes()

  const [selectedNote, setSelectedNote] = useState<MeetingNote | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<MeetingNote[] | null>(null)
  const [isSearching, setIsSearching] = useState(false)

  // 執行搜尋
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults(null)
      return
    }

    try {
      setIsSearching(true)
      const results = await searchMeetingNotes(searchQuery)
      setSearchResults(results)
    } catch (err) {
      console.error('搜尋失敗:', err)
    } finally {
      setIsSearching(false)
    }
  }

  // 清除搜尋
  const clearSearch = () => {
    setSearchQuery('')
    setSearchResults(null)
  }

  // 刪除會議記錄
  const handleDelete = async (id: string) => {
    if (!confirm('確定要刪除這筆會議記錄嗎？')) return

    try {
      await deleteMeetingNote(id)
      if (selectedNote?.id === id) {
        setSelectedNote(null)
      }
    } catch (err) {
      console.error('刪除失敗:', err)
      alert('刪除失敗，請稍後再試')
    }
  }

  // 顯示的會議記錄列表
  const displayNotes = searchResults || meetingNotes

  return (
    <div className="h-screen flex flex-col">
      {/* 標題列 */}
      <div className="flex items-center justify-between p-6 border-b">
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6" />
          <h1 className="text-2xl font-bold">會議記錄</h1>
          {searchResults && (
            <Badge variant="secondary">
              找到 {searchResults.length} 筆結果
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            重新整理
          </Button>
        </div>
      </div>

      {/* 搜尋列 */}
      <div className="p-6 border-b bg-muted/30">
        <div className="flex gap-2 max-w-2xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜尋會議標題或內容..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-9 pr-9"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSearch}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <Button onClick={handleSearch} disabled={isSearching}>
            {isSearching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* 內容區域 */}
      <div className="flex-1 overflow-hidden p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">載入中...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-destructive mb-4">載入失敗：{error}</p>
              <Button variant="outline" onClick={refresh}>
                重試
              </Button>
            </div>
          </div>
        ) : displayNotes.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md">
              <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">
                {searchResults ? '沒有找到相關會議記錄' : '還沒有會議記錄'}
              </h3>
              <p className="text-muted-foreground mb-4">
                {searchResults
                  ? '試試其他關鍵字或清除搜尋條件'
                  : '在對話頁面使用會議記錄整理功能，會自動儲存到這裡'}
              </p>
              {searchResults && (
                <Button variant="outline" onClick={clearSearch}>
                  清除搜尋
                </Button>
              )}
            </div>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-6">
              {displayNotes.map((note) => (
                <Card
                  key={note.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => setSelectedNote(note)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-lg line-clamp-2">
                        {note.title}
                      </CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(note.id)
                        }}
                        className="shrink-0 h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      {/* 日期 */}
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>{format(note.date, 'yyyy-MM-dd', { locale: zhTW })}</span>
                      </div>

                      {/* 參與者 */}
                      {note.participants.length > 0 && (
                        <div className="flex items-start gap-2 text-muted-foreground">
                          <Users className="h-4 w-4 mt-0.5" />
                          <span className="line-clamp-1">
                            {note.participants.join('、')}
                          </span>
                        </div>
                      )}

                      {/* 摘要統計 */}
                      <div className="flex flex-wrap gap-2 pt-2">
                        {note.organized.discussionPoints.length > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {note.organized.discussionPoints.length} 個討論要點
                          </Badge>
                        )}
                        {note.organized.decisions.length > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {note.organized.decisions.length} 項決議
                          </Badge>
                        )}
                        {note.organized.actionItems.length > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {note.organized.actionItems.length} 個待辦
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* 會議記錄詳細對話框 */}
      <Dialog open={!!selectedNote} onOpenChange={(open) => !open && setSelectedNote(null)}>
        <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col p-0">
          {/* 標題區域 - 添加背景色 */}
          <DialogHeader className="px-6 py-4 border-b bg-muted/30">
            <DialogTitle className="text-2xl font-bold">{selectedNote?.title}</DialogTitle>
            <DialogDescription className="flex flex-wrap items-center gap-3 pt-2 text-sm">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                {selectedNote && format(selectedNote.date, 'yyyy年MM月dd日', { locale: zhTW })}
              </span>
              {selectedNote && selectedNote.participants.length > 0 && (
                <span className="flex items-center gap-1.5">
                  <Users className="h-4 w-4" />
                  {selectedNote.participants.join('、')}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {/* 內容區域 - 增加內邊距 */}
          <ScrollArea className="flex-1 px-6 py-4">
            {selectedNote && (
              <MeetingNotesMarkdown
                content={selectedNote.markdown}
                className="pb-4"
              />
            )}
          </ScrollArea>

          {/* 底部操作區 - 添加背景色 */}
          <div className="flex justify-between items-center px-6 py-4 border-t bg-muted/30">
            <Button variant="outline" disabled>
              <MessageSquare className="h-4 w-4 mr-2" />
              提問功能（開發中）
            </Button>
            <Button onClick={() => setSelectedNote(null)}>
              關閉
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
