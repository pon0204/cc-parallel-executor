'use client';

import { useState } from 'react';

interface Task {
  id: string;
  name: string;
  prompt: string;
}

interface Session {
  sessionId: string;
  taskId?: string;
  status: string;
  output?: any[];
}

const predefinedTasks: Task[] = [
  {
    id: 'task1',
    name: 'Python Fibonacci',
    prompt: 'Write a Python function to calculate fibonacci numbers recursively and iteratively'
  },
  {
    id: 'task2',
    name: 'React Todo Component',
    prompt: 'Create a React component for a todo list with add, delete, and toggle functionality'
  },
  {
    id: 'task3',
    name: 'SQL Analysis',
    prompt: 'Write SQL queries to analyze customer orders and find top customers by revenue'
  },
  {
    id: 'task4',
    name: 'API Design',
    prompt: 'Design a RESTful API for a blog platform with posts, comments, and users'
  }
];

export default function ApiControl() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [outputs, setOutputs] = useState<{ [key: string]: string[] }>({});

  // 単一セッションを作成
  const createSession = async (prompt: string, taskId?: string) => {
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, cols: 100, rows: 30 })
      });
      
      const data = await response.json();
      const newSession: Session = {
        sessionId: data.sessionId,
        taskId,
        status: 'created'
      };
      
      setSessions(prev => [...prev, newSession]);
      
      // 出力を定期的に取得
      startOutputPolling(data.sessionId);
      
      return data.sessionId;
    } catch (error) {
      console.error('Failed to create session:', error);
    }
  };

  // バッチ実行
  const runBatch = async () => {
    setLoading(true);
    try {
      const tasks = predefinedTasks.map(task => ({
        id: task.id,
        prompt: task.prompt
      }));
      
      const response = await fetch('/api/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks })
      });
      
      const data = await response.json();
      
      // 各セッションの出力を監視
      data.results.forEach((result: any) => {
        if (result.sessionId) {
          const newSession: Session = {
            sessionId: result.sessionId,
            taskId: result.taskId,
            status: 'running'
          };
          setSessions(prev => [...prev, newSession]);
          startOutputPolling(result.sessionId);
        }
      });
    } catch (error) {
      console.error('Batch execution failed:', error);
    } finally {
      setLoading(false);
    }
  };

  // 出力を定期的に取得
  const startOutputPolling = (sessionId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/sessions/${sessionId}/output`);
        if (!response.ok) {
          clearInterval(pollInterval);
          return;
        }
        
        const data = await response.json();
        
        // 出力を更新
        if (data.output && data.output.length > 0) {
          setOutputs(prev => ({
            ...prev,
            [sessionId]: data.output.map((o: any) => o.data)
          }));
        }
        
        // セッションの状態を確認
        const statusResponse = await fetch(`/api/sessions/${sessionId}`);
        const statusData = await statusResponse.json();
        
        setSessions(prev => prev.map(s => 
          s.sessionId === sessionId ? { ...s, status: statusData.status } : s
        ));
        
        // セッションが終了したらポーリングを停止
        if (statusData.status === 'exited') {
          clearInterval(pollInterval);
        }
      } catch (error) {
        console.error('Polling error:', error);
        clearInterval(pollInterval);
      }
    }, 2000); // 2秒ごとに更新
  };

  // セッションを終了
  const terminateSession = async (sessionId: string) => {
    try {
      await fetch(`/api/sessions/${sessionId}`, {
        method: 'DELETE'
      });
      
      setSessions(prev => prev.filter(s => s.sessionId !== sessionId));
      setOutputs(prev => {
        const newOutputs = { ...prev };
        delete newOutputs[sessionId];
        return newOutputs;
      });
    } catch (error) {
      console.error('Failed to terminate session:', error);
    }
  };

  // すべてのセッションをクリア
  const clearAllSessions = async () => {
    for (const session of sessions) {
      await terminateSession(session.sessionId);
    }
  };

  return (
    <div style={{
      padding: '20px',
      backgroundColor: '#0a0a0a',
      color: '#ffffff',
      minHeight: '100vh'
    }}>
      <h1>Claude Code API Control Panel</h1>
      
      <div style={{ marginBottom: '30px' }}>
        <h2>Quick Actions</h2>
        
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <button
            onClick={runBatch}
            disabled={loading}
            style={{
              padding: '10px 20px',
              backgroundColor: '#8b5cf6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1
            }}
          >
            {loading ? 'Running...' : 'Run All Tasks (Parallel)'}
          </button>
          
          <button
            onClick={clearAllSessions}
            style={{
              padding: '10px 20px',
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Clear All Sessions
          </button>
        </div>
        
        <div style={{ marginBottom: '20px' }}>
          <h3>Custom Prompt</h3>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Enter your prompt..."
              style={{
                flex: 1,
                padding: '8px',
                backgroundColor: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: '4px',
                color: '#fff'
              }}
            />
            <button
              onClick={() => customPrompt && createSession(customPrompt)}
              disabled={!customPrompt}
              style={{
                padding: '8px 16px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: customPrompt ? 'pointer' : 'not-allowed',
                opacity: customPrompt ? 1 : 0.5
              }}
            >
              Run Custom
            </button>
          </div>
        </div>
        
        <div>
          <h3>Predefined Tasks</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '10px' }}>
            {predefinedTasks.map(task => (
              <div
                key={task.id}
                style={{
                  padding: '15px',
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #333',
                  borderRadius: '6px'
                }}
              >
                <h4 style={{ margin: '0 0 10px 0' }}>{task.name}</h4>
                <p style={{ fontSize: '14px', color: '#888', margin: '0 0 10px 0' }}>
                  {task.prompt}
                </p>
                <button
                  onClick={() => createSession(task.prompt, task.id)}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Run This Task
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <div>
        <h2>Active Sessions ({sessions.length})</h2>
        
        {sessions.length === 0 ? (
          <p style={{ color: '#888' }}>No active sessions</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {sessions.map(session => {
              const task = predefinedTasks.find(t => t.id === session.taskId);
              const output = outputs[session.sessionId] || [];
              
              return (
                <div
                  key={session.sessionId}
                  style={{
                    padding: '20px',
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #333',
                    borderRadius: '8px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div>
                      <h3 style={{ margin: 0 }}>{task?.name || 'Custom Task'}</h3>
                      <p style={{ margin: '5px 0', fontSize: '14px', color: '#888' }}>
                        Session: {session.sessionId}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <span style={{
                        padding: '4px 12px',
                        borderRadius: '4px',
                        fontSize: '14px',
                        backgroundColor: 
                          session.status === 'running' ? '#3b82f6' :
                          session.status === 'exited' ? '#10b981' : '#64748b',
                        color: 'white'
                      }}>
                        {session.status}
                      </span>
                      <button
                        onClick={() => terminateSession(session.sessionId)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '14px'
                        }}
                      >
                        Terminate
                      </button>
                    </div>
                  </div>
                  
                  <div style={{
                    backgroundColor: '#000',
                    padding: '10px',
                    borderRadius: '4px',
                    maxHeight: '200px',
                    overflow: 'auto',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    whiteSpace: 'pre-wrap'
                  }}>
                    {output.length > 0 ? (
                      output.slice(-20).join('')
                    ) : (
                      <span style={{ color: '#666' }}>Waiting for output...</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}