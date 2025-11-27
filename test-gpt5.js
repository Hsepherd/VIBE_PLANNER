const fs = require('fs');
const path = require('path');

// 手動讀取 .env.local
const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const apiKey = envContent.match(/OPENAI_API_KEY=(.+)/)?.[1]?.trim();

const OpenAI = require('openai');
const openai = new OpenAI({ apiKey });

async function testGPT5() {
  console.log('測試 GPT-5...\n');

  // 測試 1：簡單請求（增加 max_completion_tokens）
  console.log('=== 測試 1：簡單請求 ===');
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-5',
      messages: [
        { role: 'user', content: '請回答：1+1=?' }
      ],
      max_completion_tokens: 500,
    });

    console.log('回應：', response.choices[0].message.content);
    console.log('推理 tokens：', response.usage?.completion_tokens_details?.reasoning_tokens);
    console.log('總 tokens：', response.usage?.total_tokens);
  } catch (error) {
    console.log('錯誤：', error.message);
  }

  // 測試 2：JSON 輸出
  console.log('\n=== 測試 2：JSON 輸出 ===');
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-5',
      messages: [
        { role: 'user', content: '請用 JSON 格式回答：今天有什麼待辦事項？\n回傳格式：{"tasks": [{"title": "任務名稱"}]}' }
      ],
      max_completion_tokens: 1000,
    });

    console.log('回應：', response.choices[0].message.content);
    console.log('推理 tokens：', response.usage?.completion_tokens_details?.reasoning_tokens);
  } catch (error) {
    console.log('錯誤：', error.message);
  }

  // 測試 3：會議萃取（簡單版本）
  console.log('\n=== 測試 3：會議任務萃取 ===');
  try {
    const transcript = `
小明：下週三要把報告交給客戶。
小華：好，我來負責準備數據部分。
小明：記得要包含上季度的比較圖表。
`;
    const response = await openai.chat.completions.create({
      model: 'gpt-5',
      messages: [
        { role: 'user', content: `請從以下會議逐字稿萃取任務：\n${transcript}\n\n請用 JSON 格式回傳：{"tasks": [{"title": "任務", "assignee": "負責人", "due_date": "日期"}]}` }
      ],
      max_completion_tokens: 2000,
    });

    console.log('回應：', response.choices[0].message.content);
    console.log('推理 tokens：', response.usage?.completion_tokens_details?.reasoning_tokens);
  } catch (error) {
    console.log('錯誤：', error.message);
  }
}

testGPT5();
