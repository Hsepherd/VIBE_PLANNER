// Token 估算工具
// 用於估算 OpenAI API 的 token 使用量（當 streaming API 不回傳 usage 時）

/**
 * 估算文字的 token 數量
 * 中文：約 1 字 = 2 tokens
 * 英文：約 4 字母 = 1 token
 */
export const estimateTokens = (text: string): number => {
  if (!text) return 0

  // 計算中文字數
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length
  const otherChars = text.length - chineseChars

  // 中文字元約 2 tokens，其他字元約 4 字母 = 1 token
  const chineseTokens = chineseChars * 2
  const otherTokens = Math.ceil(otherChars / 4)

  return chineseTokens + otherTokens
}

/**
 * 估算訊息陣列的總 token 數量
 * 包含每則訊息的 overhead（role 和格式）
 */
export const estimateMessageTokens = (messages: Array<{ role: string; content: string }>): number => {
  let total = 0
  for (const msg of messages) {
    total += estimateTokens(msg.content)
    total += 4 // 每則訊息的 role 和格式 overhead
  }
  total += 2 // 對話開頭結尾 overhead
  return total
}
