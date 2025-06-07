'use client';

import { useEffect, useRef, useState } from 'react';
import io, { Socket } from 'socket.io-client';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';

interface Task {
  id: string;
  name: string;
  prompt: string;
  status: 'pending' | 'running' | 'completed' | 'error';
}

const predefinedTasks: Task[] = [
  {
    id: '1',
    name: 'Create Python Script',
    prompt: 'Create a Python script that calculates fibonacci numbers',
    status: 'pending'
  },
  {
    id: '2',
    name: 'Build React Component',
    prompt: 'Create a React component for a todo list with TypeScript',
    status: 'pending'
  },
  {
    id: '3',
    name: 'Write Unit Tests',
    prompt: 'Write unit tests for a calculator function using Jest',
    status: 'pending'
  }
];

export default function TerminalMultiple() {
  const terminalRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const [terminals, setTerminals] = useState<{ [key: string]: Terminal }>({});
  const [sockets, setSockets] = useState<{ [key: string]: Socket }>({});
  const [tasks, setTasks] = useState<Task[]>(predefinedTasks);
  
  const createTerminalSession = (taskId: string) => {
    const terminalEl = terminalRefs.current[taskId];
    if (!terminalEl) return;
    
    // xterm.jsターミナルを作成
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 12,
      fontFamily: 'Consolas, "Courier New", monospace',
      theme: {
        background: '#1a1a1a',
        foreground: '#00ff00',
      },
      scrollback: 10000
    });
    
    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    
    term.open(terminalEl);
    fitAddon.fit();
    
    // Socket.IOに接続
    const socket = io('http://localhost:3001');
    
    socket.on('connect', () => {
      console.log(`Connected to server for task ${taskId}`);
      const dims = { cols: term.cols, rows: term.rows };
      socket.emit('create-terminal', dims);
    });
    
    socket.on('terminal-ready', (sessionId: string) => {
      console.log(`Terminal ready for task ${taskId}:`, sessionId);
      
      // タスクを実行
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        setTasks(prev => prev.map(t => 
          t.id === taskId ? { ...t, status: 'running' } : t
        ));
        
        // Claude Codeを起動
        socket.emit('data', 'claude\n');
        
        // プロンプトを自動送信
        setTimeout(() => {
          socket.emit('data', task.prompt + '\n');
        }, 3000);
      }
    });
    
    socket.on('data', (data: string) => {
      term.write(data);
    });
    
    socket.on('exit', (code: number) => {
      term.write(`\r\n[Process exited with code ${code}]\r\n`);
      setTasks(prev => prev.map(t => 
        t.id === taskId ? { ...t, status: code === 0 ? 'completed' : 'error' } : t
      ));
    });
    
    term.onData((data: string) => {
      if (socket.connected) {
        socket.emit('data', data);
      }
    });
    
    setTerminals(prev => ({ ...prev, [taskId]: term }));
    setSockets(prev => ({ ...prev, [taskId]: socket }));
  };
  
  const runTask = (taskId: string) => {
    createTerminalSession(taskId);
  };
  
  const runAllTasks = () => {
    tasks.forEach((task, index) => {
      // 各タスクを少し遅延させて開始（サーバーへの負荷を分散）
      setTimeout(() => {
        runTask(task.id);
      }, index * 1000);
    });
  };
  
  return (
    <div style={{ 
      padding: '20px', 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      backgroundColor: '#0a0a0a',
      color: '#ffffff'
    }}>
      <h1 style={{ fontSize: '24px', marginBottom: '10px' }}>Claude Code Parallel Execution</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={runAllTasks}
          style={{
            padding: '10px 20px',
            backgroundColor: '#8b5cf6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '16px',
            cursor: 'pointer',
            marginRight: '10px'
          }}
        >
          Run All Tasks in Parallel
        </button>
      </div>
      
      <div style={{ 
        flex: 1,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: '20px',
        overflow: 'auto'
      }}>
        {tasks.map(task => (
          <div key={task.id} style={{ 
            border: '1px solid #333',
            borderRadius: '8px',
            padding: '10px',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '10px'
            }}>
              <h3 style={{ margin: 0 }}>{task.name}</h3>
              <span style={{
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '12px',
                backgroundColor: 
                  task.status === 'pending' ? '#64748b' :
                  task.status === 'running' ? '#3b82f6' :
                  task.status === 'completed' ? '#10b981' : '#ef4444',
                color: 'white'
              }}>
                {task.status}
              </span>
            </div>
            
            <div style={{ 
              fontSize: '12px', 
              color: '#888',
              marginBottom: '10px'
            }}>
              {task.prompt}
            </div>
            
            <div 
              ref={el => terminalRefs.current[task.id] = el}
              style={{ 
                flex: 1,
                minHeight: '300px',
                backgroundColor: '#1a1a1a',
                borderRadius: '4px',
                overflow: 'hidden'
              }}
            />
            
            {task.status === 'pending' && (
              <button
                onClick={() => runTask(task.id)}
                style={{
                  marginTop: '10px',
                  padding: '6px 12px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Run Task
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}