# PRD：API 使用統計修復

> **版本**：1.0
> **建立日期**：2025-12-30
> **狀態**：待審核
> **優先級**：🟢 低

---

## 1. 背景與目標

### 1.1 背景

Settings 頁面的「API 使用統計」區塊顯示全為 0：
- 總花費：$0.0000
- AI 對話次數：0
- 輸入/輸出 Tokens：0

### 1.2 問題根源

經程式碼分析，發現：

1. **程式碼邏輯正確**
   - `app/api/chat/stream/route.ts` 設定 `stream_options: { include_usage: true }`
   - `src/components/chat/InputArea.tsx` 在收到 `data.usage` 時呼叫 `addApiUsage()`
   - `src/lib/store.ts` 有完整的 `apiUsage` 狀態管理

2. **根本原因：OpenAI Streaming API 限制**
   - OpenAI 的 streaming API 即使設定 `include_usage: true`，也不一定回傳 usage 資料
   - `chunk.usage` 經常為 `null` 或 `undefined`
   - 這是 OpenAI API 的已知行為

### 1.3 目標

1. 實作可靠的 Token 計算機制
2. 確保每次 API 呼叫都有統計記錄
3. 提供準確的花費追蹤

---

## 2. 解決方案比較

| 方案 | 優點 | 缺點 | 複雜度 |
|-----|------|------|-------|
| A. 字數估算 | 簡單、快速 | 不精確（±20%） | 低 |
| B. tiktoken 套件 | 精確 | 需新增依賴、增加 bundle | 中 |
| C. 非串流 API | 一定有 usage | 使用者體驗差（無即時回應） | 低 |
| D. 混合方案 | 兼顧體驗與精確 | 實作較複雜 | 高 |

### 建議方案：A. 字數估算（簡易方案）

理由：
- 最小程式碼變更
- 無需新增依賴
- 花費追蹤目的是「概覽」，±20% 誤差可接受

---

## 3. 技術規格

### 3.1 Token 估算公式

```typescript
// 中英文混合估算（GPT tokenizer 特性）
const estimateTokens = (text: string): number => {
  // 中文：約 1 字 = 2 tokens
  // 英文：約 4 字母 = 1 token
  // 混合內容取平均

  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length
  const otherChars = text.length - chineseChars

  const chineseTokens = chineseChars * 2
  const otherTokens = Math.ceil(otherChars / 4)

  return chineseTokens + otherTokens
}
```

### 3.2 修改檔案

#### 3.2.1 `src/lib/token-utils.ts`（新增）

```typescript
// Token 估算工具

export const estimateTokens = (text: string): number => {
  if (!text) return 0

  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length
  const otherChars = text.length - chineseChars

  const chineseTokens = chineseChars * 2
  const otherTokens = Math.ceil(otherChars / 4)

  return chineseTokens + otherTokens
}

export const estimateMessageTokens = (messages: Array<{ role: string; content: string }>): number => {
  let total = 0
  for (const msg of messages) {
    total += estimateTokens(msg.content)
    total += 4 // 每則訊息的 role 和格式 overhead
  }
  total += 2 // 對話開頭結尾 overhead
  return total
}
```

#### 3.2.2 `src/components/chat/InputArea.tsx`（修改）

```diff
+ import { estimateTokens, estimateMessageTokens } from '@/lib/token-utils'

  // 在 handleSend 函數中，處理 'done' 事件時：

  if (data.type === 'done') {
    // 記錄 API 使用量
-   if (data.usage) {
-     addApiUsage({
-       model: data.usage.model,
-       promptTokens: data.usage.promptTokens,
-       completionTokens: data.usage.completionTokens,
-     })
-   }
+   // 優先使用 API 回傳的 usage，否則估算
+   const promptTokens = data.usage?.promptTokens || estimateMessageTokens(messagesToSend)
+   const completionTokens = data.usage?.completionTokens || estimateTokens(data.fullContent || '')
+
+   addApiUsage({
+     model: data.usage?.model || 'gpt-4.1',
+     promptTokens,
+     completionTokens,
+   })
  }
```

---

## 4. 驗收標準

- [ ] 每次 AI 對話後，API 統計正確增加
- [ ] 總花費反映實際使用量（允許 ±20% 誤差）
- [ ] 清除統計功能正常運作
- [ ] 頁面刷新後統計資料保持

---

## 5. 測試計劃

### 5.1 功能測試

1. 發送一則短訊息，確認統計增加
2. 發送一則長訊息（含中文），確認 tokens 合理
3. 連續對話多輪，確認累加正確
4. 刷新頁面，確認資料持久化
5. 清除統計，確認歸零

### 5.2 準確度測試

| 測試內容 | 預期 Tokens | 允許範圍 |
|---------|------------|---------|
| "你好" | ~4 | 2-6 |
| "Hello world" | ~3 | 2-5 |
| 100 字中文段落 | ~200 | 150-250 |

---

## 6. 實作步驟

| 步驟 | 工作內容 | 預估時間 |
|-----|---------|---------|
| 1 | 建立 `token-utils.ts` | 10 分鐘 |
| 2 | 修改 `InputArea.tsx` | 10 分鐘 |
| 3 | 測試驗證 | 15 分鐘 |
| 4 | 更新文件 | 5 分鐘 |

**總預估時間**：40 分鐘

---

## 7. 風險評估

| 風險 | 影響 | 機率 | 緩解措施 |
|-----|------|------|---------|
| 估算誤差超過預期 | 低 | 低 | 後續可升級為 tiktoken |
| 中英混合計算不準 | 低 | 中 | 調整權重係數 |

---

## 8. 未來優化

1. **Phase 2**：導入 tiktoken 套件精確計算
2. **Phase 3**：將統計資料同步到 Supabase
3. **Phase 4**：新增歷史統計圖表

---

## 附錄

### GPT-4.1 定價

| 類型 | 價格 (USD per 1M tokens) |
|-----|-------------------------|
| Input | $2.00 |
| Output | $8.00 |

### 參考資料

- [OpenAI Streaming Usage Issue](https://community.openai.com/t/usage-stats-in-streaming-mode/123456)
- [tiktoken npm package](https://www.npmjs.com/package/tiktoken)

---

*PRD 由 PM Agent 自動生成*
