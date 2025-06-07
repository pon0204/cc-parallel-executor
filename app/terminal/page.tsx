'use client';

import { useEffect, useRef, useState } from 'react';
import io, { Socket } from 'socket.io-client';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Terminal as TerminalIcon, 
  Rocket, 
  Play,
  Home,
  RefreshCw,
  Circle,
  Sparkles
} from 'lucide-react';
import Link from 'next/link';

export default function TerminalPage() {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [terminal, setTerminal] = useState<Terminal | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [status, setStatus] = useState<string>('未接続');
  const [sessionId, setSessionId] = useState<string>('');
  
  useEffect(() => {
    if (!terminalRef.current) return;
    
    // xterm.jsターミナルを作成
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Consolas, Monaco, "Courier New", monospace',
      theme: {
        background: '#020817',
        foreground: '#e0e7ff',
        cursor: '#e0e7ff',
        cursorAccent: '#020817',
        selection: 'rgba(255, 255, 255, 0.3)',
        black: '#000000',
        red: '#ff5555',
        green: '#50fa7b',
        yellow: '#f1fa8c',
        blue: '#bd93f9',
        magenta: '#ff79c6',
        cyan: '#8be9fd',
        white: '#bfbfbf',
        brightBlack: '#4d4d4d',
        brightRed: '#ff6e67',
        brightGreen: '#5af78e',
        brightYellow: '#f4f99d',
        brightBlue: '#caa9fa',
        brightMagenta: '#ff92d0',
        brightCyan: '#9aedfe',
        brightWhite: '#e6e6e6'
      },
      allowTransparency: true,
      scrollback: 10000
    });
    
    // アドオンを追加
    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    
    // ターミナルを開く
    term.open(terminalRef.current);
    fitAddon.fit();
    
    // Socket.IOに接続
    const newSocket = io('http://localhost:3001');
    
    newSocket.on('connect', () => {
      console.log('サーバーに接続しました');
      setStatus('接続済み');
      
      // ターミナルセッションを作成
      const dims = { cols: term.cols, rows: term.rows };
      newSocket.emit('create-terminal', dims);
    });
    
    newSocket.on('terminal-ready', (id: string) => {
      console.log('ターミナル準備完了:', id);
      setSessionId(id);
      setStatus('アクティブ');
      term.focus();
    });
    
    newSocket.on('data', (data: string) => {
      term.write(data);
    });
    
    newSocket.on('exit', (code: number) => {
      setStatus(`終了 (コード: ${code})`);
      term.write(`\r\n[プロセスがコード ${code} で終了しました]\r\n`);
    });
    
    newSocket.on('error', (error: string) => {
      console.error('ソケットエラー:', error);
      term.write(`\r\n[エラー: ${error}]\r\n`);
    });
    
    newSocket.on('disconnect', () => {
      setStatus('切断');
      term.write('\r\n[サーバーから切断されました]\r\n');
    });
    
    // ターミナルの入力をサーバーに送信
    term.onData((data: string) => {
      if (newSocket.connected) {
        newSocket.emit('data', data);
      }
    });
    
    // リサイズ処理
    const handleResize = () => {
      fitAddon.fit();
      if (newSocket.connected) {
        newSocket.emit('resize', { cols: term.cols, rows: term.rows });
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    setTerminal(term);
    setSocket(newSocket);
    
    // クリーンアップ
    return () => {
      window.removeEventListener('resize', handleResize);
      term.dispose();
      newSocket.close();
    };
  }, []);

  const launchClaude = () => {
    if (socket && socket.connected && terminal) {
      socket.emit('data', 'claude\n');
      terminal.focus();
    }
  };

  const launchWithPrompt = () => {
    if (socket && socket.connected && terminal) {
      socket.emit('data', 'claude\n');
      setTimeout(() => {
        const prompt = 'シンプルなPythonのHello Worldプログラムを作成してください';
        socket.emit('data', prompt + '\n');
      }, 3000);
      terminal.focus();
    }
  };

  const refreshSession = () => {
    if (socket) {
      socket.disconnect();
      socket.connect();
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'アクティブ':
        return 'success';
      case '接続済み':
        return 'warning';
      case '切断':
      case status.startsWith('終了'):
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
                  <TerminalIcon className="w-6 h-6" />
                  Claude Code ターミナル
                </CardTitle>
                <CardDescription>
                  インタラクティブなClaude Codeセッション
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Badge variant={getStatusColor() as any} className="gap-1">
                  <Circle className="w-2 h-2 fill-current" />
                  {status}
                </Badge>
                {sessionId && (
                  <span className="text-sm text-muted-foreground">
                    セッション: {sessionId}
                  </span>
                )}
              </div>
              
              <div className="flex gap-2">
                <Button
                  onClick={refreshSession}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  再接続
                </Button>
                <Button
                  onClick={launchClaude}
                  size="sm"
                  className="gap-2"
                  disabled={status !== 'アクティブ'}
                >
                  <Rocket className="w-4 h-4" />
                  Claude起動
                </Button>
                <Button
                  onClick={launchWithPrompt}
                  variant="secondary"
                  size="sm"
                  className="gap-2"
                  disabled={status !== 'アクティブ'}
                >
                  <Sparkles className="w-4 h-4" />
                  自動プロンプト付き起動
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ターミナル */}
        <Card className="overflow-hidden">
          <div 
            ref={terminalRef}
            className="w-full h-[600px] bg-black rounded-lg"
          />
        </Card>

        {/* ヘルプ */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">使い方</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="space-y-2">
                <div className="font-medium">基本コマンド</div>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• <code className="bg-muted px-1 rounded">ls</code> - ファイル一覧</li>
                  <li>• <code className="bg-muted px-1 rounded">pwd</code> - 現在のディレクトリ</li>
                  <li>• <code className="bg-muted px-1 rounded">claude</code> - Claude Code起動</li>
                </ul>
              </div>
              <div className="space-y-2">
                <div className="font-medium">ショートカット</div>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• <kbd className="bg-muted px-1 rounded text-xs">Ctrl+C</kbd> - 処理を中断</li>
                  <li>• <kbd className="bg-muted px-1 rounded text-xs">Ctrl+D</kbd> - セッション終了</li>
                  <li>• <kbd className="bg-muted px-1 rounded text-xs">Ctrl+L</kbd> - 画面クリア</li>
                </ul>
              </div>
              <div className="space-y-2">
                <div className="font-medium">Claude Codeコマンド</div>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• <code className="bg-muted px-1 rounded">/help</code> - ヘルプ表示</li>
                  <li>• <code className="bg-muted px-1 rounded">/status</code> - 状態確認</li>
                  <li>• <code className="bg-muted px-1 rounded">/clear</code> - 履歴クリア</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}