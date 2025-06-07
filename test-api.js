// APIテストスクリプト
import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3001/api';

// 単一セッションのテスト
async function testSingleSession() {
  console.log('=== Testing Single Session ===');
  
  // セッションを作成
  const response = await fetch(`${API_BASE}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: 'Write a function to calculate factorial in Python',
      cols: 80,
      rows: 24
    })
  });
  
  const data = await response.json();
  console.log('Session created:', data);
  
  // 5秒待ってから出力を取得
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // 出力を確認
  const outputResponse = await fetch(`${API_BASE}/sessions/${data.sessionId}/output`);
  const outputData = await outputResponse.json();
  console.log('Output lines:', outputData.totalLines);
  console.log('First few outputs:', outputData.output.slice(0, 5));
  
  return data.sessionId;
}

// 並列実行のテスト
async function testParallelExecution() {
  console.log('\n=== Testing Parallel Execution ===');
  
  const tasks = [
    {
      id: 'task1',
      prompt: 'Create a Python function to check if a number is prime'
    },
    {
      id: 'task2',
      prompt: 'Write a JavaScript function to reverse a string'
    },
    {
      id: 'task3',
      prompt: 'Create a SQL query to find top 5 customers by order amount'
    }
  ];
  
  // バッチAPIを使用
  const response = await fetch(`${API_BASE}/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tasks })
  });
  
  const data = await response.json();
  console.log('Batch sessions created:', data);
  
  // 10秒待ってから各セッションの状態を確認
  await new Promise(resolve => setTimeout(resolve, 10000));
  
  for (const result of data.results) {
    if (result.sessionId) {
      const statusResponse = await fetch(`${API_BASE}/sessions/${result.sessionId}`);
      const statusData = await statusResponse.json();
      console.log(`\nTask ${result.taskId} status:`, statusData.status);
      
      const outputResponse = await fetch(`${API_BASE}/sessions/${result.sessionId}/output`);
      const outputData = await outputResponse.json();
      console.log(`Output lines: ${outputData.totalLines}`);
    }
  }
}

// プログラム的にセッションを制御
async function testProgrammaticControl() {
  console.log('\n=== Testing Programmatic Control ===');
  
  // セッションを作成（プロンプトなし）
  const response = await fetch(`${API_BASE}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cols: 80,
      rows: 24
    })
  });
  
  const data = await response.json();
  const sessionId = data.sessionId;
  console.log('Empty session created:', sessionId);
  
  // 手動でコマンドを送信
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // lsコマンドを送信
  await fetch(`${API_BASE}/sessions/${sessionId}/input`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: 'ls\n' })
  });
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Claudeを起動
  await fetch(`${API_BASE}/sessions/${sessionId}/input`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: 'claude\n' })
  });
  
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // プロンプトを送信
  await fetch(`${API_BASE}/sessions/${sessionId}/input`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: 'What is 2+2?\n' })
  });
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // 出力を確認
  const outputResponse = await fetch(`${API_BASE}/sessions/${sessionId}/output`);
  const outputData = await outputResponse.json();
  console.log('Total output lines:', outputData.totalLines);
  
  // セッションを終了
  await fetch(`${API_BASE}/sessions/${sessionId}`, {
    method: 'DELETE'
  });
  console.log('Session terminated');
}

// メイン実行
async function main() {
  try {
    // 単一セッションテスト
    await testSingleSession();
    
    // 並列実行テスト
    await testParallelExecution();
    
    // プログラム制御テスト
    await testProgrammaticControl();
    
    // すべてのセッションを確認
    const allSessionsResponse = await fetch(`${API_BASE}/sessions`);
    const allSessions = await allSessionsResponse.json();
    console.log('\n=== All Sessions ===');
    console.log('Total sessions:', allSessions.total);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// 実行
main();