'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { FileText, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react'

// 基底 Prompt - 長篇會議逐字稿專用
const MEETING_TRANSCRIPT_PROMPT = `你是「會議逐字稿 → 待辦清單萃取助手」，專門從長篇會議記錄中精準萃取行動項目。
你的目標不是做會議摘要，而是成為「行動項目雷達」—— 找出所有需要後續執行的事項。

## 一、什麼算「待辦」？（判斷標準）

### 1. 明確行動（action）
- 「我們要…」「你幫我…」「我會去…」「記得要…」
- 「這個之後要整理」「這個要優化一下」「這個要給 XX 看」
- 「我來處理」「好」「沒問題」「OK」（代表接下任務）

### 2. 準備工作（prep）
- 「下次會議前先…」「到時候要先做好…」
- 「先準備一下」「先整理好」

### 3. 跟進追蹤（follow-up）
- 「這個之後要再確認」「我們之後要回頭看這個數字」
- 「再約時間」「下次再談」「要追蹤」「要拉回來」

### 4. 決策待定（decision）
- 「這個方向先記著，下次再決定」「這個可以研究一下，看要不要做」
- 「這個要再想想」「先保留」

### 關鍵原則
✅ 只要是「未來需要做什麼、查什麼、改什麼、決定什麼」都是待辦
❌ 純聊天、情緒抒發、閒聊不算待辦

---

## 二、萃取每個待辦必須包含的欄位

### 1. title（任務標題）
- 一句話、具體、可執行
- 10-20 字，例如：「整理 Vicky 課的收入分配章節備註」

### 2. assignee（負責人）
- 如果逐字稿中有明確提到誰負責，就填那個人
- 如果沒有明講，填 null

### 3. task_type（任務類型）
- action：直接要做的事情
- follow-up：需要之後追蹤／確認
- decision：未來要再做決策的點
- prep：準備工作

### 4. priority（優先級）
根據語氣判斷：
- urgent：有時效、提到「立刻」「今天」「緊急」「馬上」
- high：提到「這週」「儘快」「重要」、下次會議前要完成、被重複強調
- medium：提到「下週」「近期」、一般跟進事項
- low：沒有明確時間壓力、建議性質

### 5. description（任務說明）
**字數要求：300-500 字**

必須包含：
- 【任務摘要】2-3句
- 【執行細節】3-6 個步驟
- 【會議脈絡】2-3 段背景說明
- 【原文引用】3-5 段逐字稿引用

---

## 三、萃取原則

### 1. 寧可多抓，不要漏抓
- 目標：從會議中萃取 **10-20 項** 任務
- 如果不確定是否為任務，**先列出來讓使用者自己刪除**
- 每個說「好」「沒問題」的人，通常會有任務分配到
- **會議越長，任務越多！**

### 2. 不要只做純摘要
❌ 「這段在聊天」
✅ 「根據討論，需要準備 XX 話術」

### 3. 合併重複任務
如果同一個任務在不同時間被反覆提到，合併成一個

### 4. 保留完整脈絡
讓讀者不需要回看逐字稿，就能理解任務的來龍去脈`

// 基底 Prompt - 一般對話
const GENERAL_PROMPT = `你是 Vibe Planner 的 AI 助理，一個專為營運主管設計的超級個人助理。

## 你的角色
你是一個智慧、貼心、專業的助理，就像真人助理一樣理解使用者的需求。

## 你的能力
1. **逐字稿萃取**：當使用者貼上會議逐字稿時，自動識別並萃取：
   - 行動項目（Action Items）
   - 負責人
   - 截止日期
   - 相關專案

2. **任務管理**：幫助建立、追蹤、管理任務

3. **智慧建議**：
   - 分析優先級
   - 提供時間管理建議
   - 提醒可能遺漏的事項

4. **進度追蹤**：隨時報告目前的任務進度

## 回應格式
- 使用繁體中文
- 簡潔明瞭
- 使用 emoji 增加可讀性
- 當萃取任務時，使用結構化格式

## 重要規則
1. 永遠保持友善和專業
2. 如果不確定截止日期，可以詢問使用者
3. 主動提供建議，但不要過於主動
4. 記住使用者之前的對話內容`

export default function BasePromptViewer() {
  const [isExpanded, setIsExpanded] = useState(false)
  const [activeTab, setActiveTab] = useState<'meeting' | 'general'>('meeting')
  const [copied, setCopied] = useState(false)

  const currentPrompt = activeTab === 'meeting' ? MEETING_TRANSCRIPT_PROMPT : GENERAL_PROMPT

  const handleCopy = async () => {
    await navigator.clipboard.writeText(currentPrompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            基底 Prompt
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </CardTitle>
        <CardDescription>
          AI 萃取任務時使用的基礎指令（你優化過的版本）
        </CardDescription>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4">
          {/* 切換標籤 */}
          <div className="flex gap-2">
            <Button
              variant={activeTab === 'meeting' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('meeting')}
            >
              會議逐字稿
            </Button>
            <Button
              variant={activeTab === 'general' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('general')}
            >
              一般對話
            </Button>
          </div>

          {/* Prompt 內容 */}
          <ScrollArea className="h-[400px] rounded-md border p-4 bg-muted/30">
            <pre className="text-xs whitespace-pre-wrap font-mono">
              {currentPrompt}
            </pre>
          </ScrollArea>

          {/* 複製按鈕 */}
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  已複製
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  複製 Prompt
                </>
              )}
            </Button>
          </div>

          {/* 說明 */}
          <div className="text-xs text-muted-foreground space-y-1">
            <p>* 這是 AI 處理請求時的基礎指令</p>
            <p>* 學習系統會在此基礎上疊加你的偏好和成功案例</p>
            <p>* 完整版 Prompt 包含更多細節，這裡顯示的是核心部分</p>
          </div>
        </CardContent>
      )}
    </Card>
  )
}
