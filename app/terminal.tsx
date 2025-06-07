'use client';

import { useEffect, useRef, useState } from 'react';
import io, { Socket } from 'socket.io-client';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { AttachAddon } from 'xterm-addon-attach';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';

export default function TerminalPage() {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [terminal, setTerminal] = useState<Terminal | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [status, setStatus] = useState<string>('Disconnected');
  const [sessionId, setSessionId] = useState<string>('');
  
  useEffect(() => {
    if (!terminalRef.current) return;
    
    // xterm.jsターミナルを作成
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Consolas, "Courier New", monospace',
      theme: {
        background: '#1a1a1a',
        foreground: '#00ff00',
        cursor: '#00ff00',
        cursorAccent: '#000000',
        selection: 'rgba(255, 255, 255, 0.3)',
        black: '#000000',
        red: '#ff0000',
        green: '#00ff00',
        yellow: '#ffff00',
        blue: '#0000ff',
        magenta: '#ff00ff',
        cyan: '#00ffff',
        white: '#ffffff',
        brightBlack: '#808080',
        brightRed: '#ff8080',
        brightGreen: '#80ff80',
        brightYellow: '#ffff80',
        brightBlue: '#8080ff',
        brightMagenta: '#ff80ff',
        brightCyan: '#80ffff',
        brightWhite: '#ffffff'
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
      console.log('Connected to server');
      setStatus('Connected');
      
      // ターミナルセッションを作成
      const dims = { cols: term.cols, rows: term.rows };
      newSocket.emit('create-terminal', dims);
    });
    
    newSocket.on('terminal-ready', (id: string) => {
      console.log('Terminal ready:', id);
      setSessionId(id);
      setStatus('Terminal Active');
      term.focus();
    });
    
    newSocket.on('data', (data: string) => {
      term.write(data);
    });
    
    newSocket.on('exit', (code: number) => {
      setStatus(`Exited (${code})`);
      term.write(`\r\n[Process exited with code ${code}]\r\n`);
    });
    
    newSocket.on('error', (error: string) => {
      console.error('Socket error:', error);
      term.write(`\r\n[Error: ${error}]\r\n`);
    });
    
    newSocket.on('disconnect', () => {
      setStatus('Disconnected');
      term.write('\r\n[Disconnected from server]\r\n');
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
  
  return (
    <div style={{ 
      padding: '20px', 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      backgroundColor: '#0a0a0a',
      color: '#ffffff'
    }}>
      <h1 style={{ fontSize: '24px', marginBottom: '10px' }}>Claude Code Terminal</h1>
      
      <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '20px' }}>
        <div>
          Status: <span style={{ 
            fontWeight: 'bold', 
            color: status === 'Terminal Active' ? '#4ade80' : 
                   status === 'Connected' ? '#fbbf24' : '#f87171' 
          }}>
            {status}
          </span>
        </div>
        {sessionId && <div>Session: {sessionId}</div>}
        
        <button
          onClick={() => {
            if (socket && socket.connected && terminal) {
              socket.emit('data', 'claude\n');
              terminal.focus();
            }
          }}
          style={{
            marginLeft: 'auto',
            padding: '8px 16px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            cursor: 'pointer',
            transition: 'background-color 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
        >
          Launch Claude Code
        </button>
      </div>
      
      <div 
        ref={terminalRef}
        style={{ 
          flex: 1,
          border: '1px solid #333',
          borderRadius: '8px',
          overflow: 'hidden',
          backgroundColor: '#1a1a1a'
        }}
      />
      
      <div style={{ 
        marginTop: '10px', 
        fontSize: '12px', 
        color: '#888',
        textAlign: 'center'
      }}>
        Press Ctrl+C to interrupt • Click terminal to focus
      </div>
    </div>
  );
}