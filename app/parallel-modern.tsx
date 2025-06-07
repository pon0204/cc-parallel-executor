'use client';

import { useEffect, useRef, useState } from 'react';
import io, { Socket } from 'socket.io-client';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Play, 
  Trash2, 
  Terminal as TerminalIcon, 
  Rocket, 
  Code2, 
  Database, 
  FileCode2,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Home,
  PlayCircle
} from 'lucide-react';
import Link from 'next/link';

interface Task {
  id: string;
  name: string;
  prompt: string;
  icon: React.ReactNode;
  color: string;
}

interface TerminalSession {
  terminal: Terminal;
  socket: Socket;
  status: 'pending' | 'running' | 'completed' | 'error';
}

const predefinedTasks: Task[] = [
  {
    id: '1',
    name: 'Python フィボナッチ',
    prompt: 'フィボナッチ数列を計算するPython関数を作成してください',
    icon: <Code2 className="w-4 h-4" />,
    color: 'from-blue-500 to-cyan-500'
  },
  {
    id: '2',
    name: 'React TODOリスト',
    prompt: 'TypeScriptでReactのTODOリストコンポーネントを作成してください',
    icon: <FileCode2 className="w-4 h-4" />,
    color: 'from-purple-500 to-pink-500'
  },
  {
    id: '3',
    name: 'ユニットテスト',
    prompt: 'Jestを使用して計算機関数のユニットテストを書いてください',
    icon: <CheckCircle2 className="w-4 h-4" />,
    color: 'from-green-500 to-emerald-500'
  },
  {
    id: '4',
    name: 'SQL分析',
    prompt: '顧客の注文データを分析するSQLクエリを作成してください',
    icon: <Database className="w-4 h-4" />,
    color: 'from-orange-500 to-red-500'
  }
];

export default function ParallelModern() {
  const terminalRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const [sessions, setSessions] = useState<{ [key: string]: TerminalSession }>({});
  const [isRunning, setIsRunning] = useState(false);
  
  const createTerminalSession = (taskId: string) => {
    const terminalEl = terminalRefs.current[taskId];
    if (!terminalEl || sessions[taskId]) return;
    
    // xterm.jsターミナルを作成
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 12,
      fontFamily: 'Consolas, Monaco, "Courier New", monospace',
      theme: {
        background: '#020817',
        foreground: '#e0e7ff',
      },
      scrollback: 10000,
      cols: 80,
      rows: 20
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
      console.log(`タスク ${taskId} のサーバーに接続`);
      const dims = { cols: term.cols, rows: term.rows };
      socket.emit('create-terminal', dims);
    });
    
    socket.on('terminal-ready', (sessionId: string) => {
      console.log(`タスク ${taskId} のターミナル準備完了:`, sessionId);
      
      // タスクを実行
      const task = predefinedTasks.find(t => t.id === taskId);
      if (task) {
        setSessions(prev => ({
          ...prev,
          [taskId]: { ...prev[taskId], status: 'running' }
        }));
        
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
      term.write(`\r\n[プロセスがコード ${code} で終了しました]\r\n`);
      setSessions(prev => ({
        ...prev,
        [taskId]: { 
          ...prev[taskId], 
          status: code === 0 ? 'completed' : 'error' 
        }
      }));
    });
    
    term.onData((data: string) => {
      if (socket.connected) {
        socket.emit('data', data);
      }
    });
    
    setSessions(prev => ({
      ...prev,
      [taskId]: { terminal: term, socket, status: 'pending' }
    }));
  };
  
  const runTask = (taskId: string) => {
    createTerminalSession(taskId);
  };
  
  const runAllTasks = () => {
    setIsRunning(true);
    predefinedTasks.forEach((task, index) => {
      setTimeout(() => {
        runTask(task.id);
      }, index * 1000);
    });
    
    setTimeout(() => {
      setIsRunning(false);
    }, predefinedTasks.length * 1000);
  };
  
  const clearAllSessions = () => {
    Object.entries(sessions).forEach(([taskId, session]) => {
      if (session.terminal) {
        session.terminal.dispose();
      }
      if (session.socket) {
        session.socket.disconnect();
      }
    });
    setSessions({});
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Loader2 className="w-4 h-4 animate-spin" />;
      case 'completed':
        return <CheckCircle2 className="w-4 h-4" />;
      case 'error':
        return <XCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "success" => {
    switch (status) {
      case 'running':
        return 'default';
      case 'completed':
        return 'success';
      case 'error':
        return 'destructive';
      default:
        return 'secondary';
    }
  };
  
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* ヘッダー */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Rocket className="w-6 h-6" />
                  Claude Code 並列実行デモ
                </CardTitle>
                <CardDescription>
                  複数のClaude Codeインスタンスを同時に実行
                </CardDescription>
              </div>
              <Button variant="ghost" size="icon" asChild>
                <Link href="/">
                  <Home className="w-4 h-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Button
                onClick={runAllTasks}
                disabled={isRunning}
                size="lg"
                className="gap-2"
              >
                {isRunning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    実行中...
                  </>
                ) : (
                  <>
                    <PlayCircle className="w-4 h-4" />
                    全タスクを並列実行
                  </>
                )}
              </Button>
              
              {Object.keys(sessions).length > 0 && (
                <Button
                  onClick={clearAllSessions}
                  variant="destructive"
                  size="lg"
                  className="gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  全セッションをクリア
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
        
        {/* タスクグリッド */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {predefinedTasks.map(task => {
            const session = sessions[task.id];
            
            return (
              <Card key={task.id} className="overflow-hidden">
                <div className={`h-2 bg-gradient-to-r ${task.color}`} />
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      {task.icon}
                      {task.name}
                    </CardTitle>
                    {session && (
                      <Badge variant={getStatusVariant(session.status)} className="gap-1">
                        {getStatusIcon(session.status)}
                        {session.status}
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-sm">
                    {task.prompt}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div 
                    ref={el => terminalRefs.current[task.id] = el}
                    className="h-[300px] bg-black"
                  />
                  {!session && (
                    <div className="p-4">
                      <Button
                        onClick={() => runTask(task.id)}
                        className="w-full gap-2"
                        variant="outline"
                      >
                        <Play className="w-4 h-4" />
                        このタスクを実行
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
        
        {/* 説明 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">並列実行について</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              このデモでは、4つの異なるClaude Codeインスタンスが同時に起動し、
              それぞれ異なるプログラミングタスクを並列で実行します。
              各ターミナルは独立したセッションとして動作し、
              お互いに干渉することなく作業を進めることができます。
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}