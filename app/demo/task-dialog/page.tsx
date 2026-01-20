'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  X,
  Check,
  Calendar,
  FolderKanban,
  Clock,
  MessageSquare,
  Quote,
  ListTodo,
  FileText,
  ChevronDown,
  Tag,
  RefreshCw,
  StickyNote,
  ChevronRight,
} from 'lucide-react'

// 模擬任務資料
const mockTask = {
  title: '規劃新老師合作門檻與培訓流程',
  priority: 'medium' as const,
  assignee: 'Hsepherd',
  dueDate: '2026/1/8',
  project: '人事管理',
  recurrence: '不重複',
  tags: ['人事管理'],
  groups: ['營運團隊'],
  summary: '針對未來新老師合作，需規劃合理的合作門檻（如教學經驗、專長領域），並設計培訓與產品上架流程，確保新進老師能順利融入團隊並產生營收。',
  notes: '記得先跟 HR 確認目前的合作條款模板，另外要參考競爭對手的分潤比例。',
  steps: [
    { id: 1, text: '設定新老師合作基本條件，如三年以上教學經驗、具備專業技能等。', completed: false },
    { id: 2, text: '設計新老師產品上架流程，先銷售其擅長領域課程。', completed: false },
    { id: 3, text: '規劃後續培訓計畫，協助老師學習系統與行銷。', completed: true },
    { id: 4, text: '設計合作分潤、抽成或固定費用方案。', completed: false },
    { id: 5, text: '撰寫合作SOP，並於招募時說明。', completed: false },
  ],
  context: '會議中討論到新老師進入團隊時，應先讓其銷售自身強項課程，待產生營收後再進行系統培訓。團隊認為強調合作關係與收入穩定性，能吸引具實力的老師加入。',
  quote: '「[01:20:20] Speaker: 那这样就是变成我们就让他的好处。对，我们就做微那个引流，那他一开始就先从他好的地方开始卖的话...」',
}

type NotesPosition = 'right' | 'left' | 'bottom'

const priorityConfig = {
  urgent: { label: '緊急', color: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
  high: { label: '高', color: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
  medium: { label: '中', color: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500' },
  low: { label: '低', color: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
}

const statusConfig = {
  pending: { label: '待處理', color: 'bg-gray-100 text-gray-700' },
  in_progress: { label: '進行中', color: 'bg-blue-100 text-blue-700' },
  completed: { label: '已完成', color: 'bg-green-100 text-green-700' },
}

// ============================================
// 新版本：Notion 風格 + 左右排版
// ============================================
function NotionHorizontalLayout({ notesPosition }: { notesPosition: NotesPosition }) {
  const [steps, setSteps] = useState(mockTask.steps)
  const [notesExpanded, setNotesExpanded] = useState(false)
  const completedCount = steps.filter(s => s.completed).length

  return (
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden">
      {/* Header - 標題區 */}
      <div className="flex items-start justify-between px-8 pt-6 pb-4 border-b bg-gradient-to-r from-gray-50 to-white">
        <div className="flex-1 pr-4">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-3">
            <span className="text-2xl">📌</span>
            {mockTask.title}
          </h2>
        </div>
        <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <X className="h-5 w-5 text-gray-400" />
        </button>
      </div>

      {/* Body - 左右兩欄 */}
      <div className="flex min-h-[480px]">
        {/* 左側：屬性表格 (Notion Style) */}
        <div className="w-72 border-r bg-gray-50/50 p-6">
          <div className="space-y-1">
            {/* 狀態 */}
            <div className="flex items-center py-2.5 hover:bg-gray-100 rounded-lg px-3 -mx-3 cursor-pointer group">
              <span className="text-sm text-gray-500 w-20">狀態</span>
              <div className="flex-1 flex items-center justify-between">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-medium ${statusConfig.in_progress.color}`}>
                  <Clock className="h-3.5 w-3.5" />
                  進行中
                </span>
                <ChevronDown className="h-4 w-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>

            {/* 優先級 */}
            <div className="flex items-center py-2.5 hover:bg-gray-100 rounded-lg px-3 -mx-3 cursor-pointer group">
              <span className="text-sm text-gray-500 w-20">優先級</span>
              <div className="flex-1 flex items-center justify-between">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-medium ${priorityConfig[mockTask.priority].color}`}>
                  <div className={`w-2 h-2 rounded-full ${priorityConfig[mockTask.priority].dot}`} />
                  {priorityConfig[mockTask.priority].label}
                </span>
                <ChevronDown className="h-4 w-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>

            {/* 負責人 */}
            <div className="flex items-center py-2.5 hover:bg-gray-100 rounded-lg px-3 -mx-3 cursor-pointer group">
              <span className="text-sm text-gray-500 w-20">負責人</span>
              <div className="flex-1 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-xs text-white font-medium">H</span>
                  </div>
                  <span className="text-sm">@{mockTask.assignee}</span>
                </div>
                <ChevronDown className="h-4 w-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>

            {/* 截止日期 */}
            <div className="flex items-center py-2.5 hover:bg-gray-100 rounded-lg px-3 -mx-3 cursor-pointer group">
              <span className="text-sm text-gray-500 w-20">截止日期</span>
              <div className="flex-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-sm">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  {mockTask.dueDate}
                </span>
                <ChevronDown className="h-4 w-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>

            {/* 專案 */}
            <div className="flex items-center py-2.5 hover:bg-gray-100 rounded-lg px-3 -mx-3 cursor-pointer group">
              <span className="text-sm text-gray-500 w-20">專案</span>
              <div className="flex-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-sm">
                  <FolderKanban className="h-4 w-4 text-purple-500" />
                  {mockTask.project}
                </span>
                <ChevronDown className="h-4 w-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>

            {/* 重複 */}
            <div className="flex items-center py-2.5 hover:bg-gray-100 rounded-lg px-3 -mx-3 cursor-pointer group">
              <span className="text-sm text-gray-500 w-20">重複</span>
              <div className="flex-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-sm text-gray-600">
                  <RefreshCw className="h-4 w-4 text-gray-400" />
                  {mockTask.recurrence}
                </span>
                <ChevronDown className="h-4 w-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>

            {/* 分隔線 */}
            <div className="border-t my-3" />

            {/* 標籤 */}
            <div className="flex items-start py-2.5 hover:bg-gray-100 rounded-lg px-3 -mx-3 cursor-pointer group">
              <span className="text-sm text-gray-500 w-20 pt-0.5">標籤</span>
              <div className="flex-1">
                <div className="flex flex-wrap gap-1.5">
                  {mockTask.tags.map(tag => (
                    <Badge key={tag} variant="secondary" className="bg-purple-100 text-purple-700 text-xs">
                      {tag}
                      <X className="h-3 w-3 ml-1 cursor-pointer hover:text-purple-900" />
                    </Badge>
                  ))}
                  <button className="text-xs text-gray-400 hover:text-gray-600 px-2 py-0.5">
                    + 新增
                  </button>
                </div>
              </div>
            </div>

            {/* 組別 */}
            <div className="flex items-start py-2.5 hover:bg-gray-100 rounded-lg px-3 -mx-3 cursor-pointer group">
              <span className="text-sm text-gray-500 w-20 pt-0.5">組別</span>
              <div className="flex-1">
                <div className="flex flex-wrap gap-1.5">
                  {mockTask.groups.map(group => (
                    <Badge key={group} variant="secondary" className="bg-blue-100 text-blue-700 text-xs">
                      {group}
                      <X className="h-3 w-3 ml-1 cursor-pointer hover:text-blue-900" />
                    </Badge>
                  ))}
                  <button className="text-xs text-gray-400 hover:text-gray-600 px-2 py-0.5">
                    + 新增
                  </button>
                </div>
              </div>
            </div>

            {/* 備注 - 選項 B：左側屬性區 */}
            {notesPosition === 'left' && (
              <>
                <div className="border-t my-3" />
                <div className="flex items-start py-2.5 hover:bg-gray-100 rounded-lg px-3 -mx-3 cursor-pointer group">
                  <span className="text-sm text-gray-500 w-20 pt-0.5">備注</span>
                  <div className="flex-1">
                    <p className="text-sm text-gray-600 leading-relaxed bg-amber-50 border border-amber-200 rounded-lg p-2">
                      {mockTask.notes}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* 右側：內容區 */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="space-y-5 max-w-2xl">
            {/* 任務摘要 */}
            <section>
              <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <FileText className="h-4 w-4 text-gray-400" />
                任務摘要
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 rounded-lg p-4">
                {mockTask.summary}
              </p>
            </section>

            {/* 備注 - 選項 A：右側內容區 */}
            {notesPosition === 'right' && (
              <section>
                <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <StickyNote className="h-4 w-4 text-amber-500" />
                  備注
                </h3>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {mockTask.notes}
                  </p>
                </div>
              </section>
            )}

            {/* 執行細節 */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <ListTodo className="h-4 w-4 text-gray-400" />
                  執行細節
                </h3>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                  {completedCount}/{steps.length} 完成
                </span>
              </div>
              <div className="space-y-1.5">
                {steps.map((step, idx) => (
                  <div
                    key={step.id}
                    className={`flex items-start gap-3 p-2.5 rounded-lg transition-colors hover:bg-gray-50 ${
                      step.completed ? 'opacity-60' : ''
                    }`}
                  >
                    <Checkbox
                      checked={step.completed}
                      onCheckedChange={(checked) => {
                        setSteps(prev => prev.map(s => s.id === step.id ? { ...s, completed: !!checked } : s))
                      }}
                      className="mt-0.5"
                    />
                    <span className={`flex-1 text-sm ${step.completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                      <span className="text-gray-400 mr-1">{idx + 1}.</span>
                      {step.text}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* 會議脈絡 */}
            <section>
              <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-gray-400" />
                會議脈絡
              </h3>
              <div className="pl-4 border-l-2 border-blue-300 bg-blue-50/50 rounded-r-lg p-4">
                <p className="text-sm text-gray-600 leading-relaxed">{mockTask.context}</p>
              </div>
            </section>

            {/* 原文引用 */}
            <section>
              <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <Quote className="h-4 w-4 text-gray-400" />
                原文引用
              </h3>
              <div className="pl-4 border-l-2 border-gray-300 bg-gray-50 rounded-r-lg p-4">
                <p className="text-sm text-gray-500 italic leading-relaxed">{mockTask.quote}</p>
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* 備注 - 選項 C：底部展開區 */}
      {notesPosition === 'bottom' && (
        <div className="border-t">
          <button
            onClick={() => setNotesExpanded(!notesExpanded)}
            className="w-full flex items-center justify-between px-8 py-3 hover:bg-gray-50 transition-colors"
          >
            <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <StickyNote className="h-4 w-4 text-amber-500" />
              備注
              {mockTask.notes && (
                <span className="text-xs text-gray-400 font-normal">
                  （點擊展開）
                </span>
              )}
            </span>
            <ChevronRight className={`h-4 w-4 text-gray-400 transition-transform ${notesExpanded ? 'rotate-90' : ''}`} />
          </button>
          {notesExpanded && (
            <div className="px-8 pb-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm text-gray-700 leading-relaxed">
                  {mockTask.notes}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer - 操作按鈕 */}
      <div className="flex items-center justify-end gap-3 px-8 py-4 border-t bg-gray-50">
        <Button variant="outline" className="px-6">
          關閉
        </Button>
        <Button className="bg-green-600 hover:bg-green-700 px-6">
          <Check className="h-4 w-4 mr-2" />
          標記為完成
        </Button>
      </div>
    </div>
  )
}

// ============================================
// Main Demo Page
// ============================================
export default function TaskDialogDemoPage() {
  const [notesPosition, setNotesPosition] = useState<NotesPosition>('right')

  const positionOptions: { value: NotesPosition; label: string; desc: string }[] = [
    { value: 'right', label: '選項 A：右側內容區', desc: '作為獨立區塊，空間大' },
    { value: 'left', label: '選項 B：左側屬性區', desc: '與屬性並列，一目了然' },
    { value: 'bottom', label: '選項 C：底部展開區', desc: '點擊展開，不佔空間' },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-slate-100 flex items-center justify-center p-8">
      <div className="w-full max-w-5xl">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            🎨 Task Dialog - 備注位置選擇
          </h1>
          <p className="text-gray-500">
            選擇備注要放在哪個位置
          </p>
        </div>

        {/* Position Selector */}
        <div className="flex justify-center gap-3 mb-6">
          {positionOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => setNotesPosition(opt.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                notesPosition === opt.value
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Current Selection Info */}
        <div className="text-center mb-6">
          <span className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-800 rounded-full text-sm">
            <StickyNote className="h-4 w-4" />
            {positionOptions.find(o => o.value === notesPosition)?.desc}
          </span>
        </div>

        {/* Dialog Preview */}
        <NotionHorizontalLayout notesPosition={notesPosition} />

        {/* Features */}
        <div className="mt-8 grid grid-cols-3 gap-4">
          <div className={`bg-white rounded-xl p-4 shadow-sm border transition-all ${notesPosition === 'right' ? 'ring-2 ring-blue-500' : ''}`}>
            <h3 className="font-semibold text-gray-700 mb-2">📝 選項 A：右側</h3>
            <p className="text-sm text-gray-500">
              備注作為獨立區塊，放在任務摘要下方，空間充足適合長文
            </p>
          </div>
          <div className={`bg-white rounded-xl p-4 shadow-sm border transition-all ${notesPosition === 'left' ? 'ring-2 ring-blue-500' : ''}`}>
            <h3 className="font-semibold text-gray-700 mb-2">📋 選項 B：左側</h3>
            <p className="text-sm text-gray-500">
              備注作為屬性欄位，與其他屬性並列，適合簡短備注
            </p>
          </div>
          <div className={`bg-white rounded-xl p-4 shadow-sm border transition-all ${notesPosition === 'bottom' ? 'ring-2 ring-blue-500' : ''}`}>
            <h3 className="font-semibold text-gray-700 mb-2">⬇️ 選項 C：底部</h3>
            <p className="text-sm text-gray-500">
              點擊展開顯示，不佔空間，適合偶爾使用
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
