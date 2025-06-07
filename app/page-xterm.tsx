'use client';

import { useEffect, useRef, useState } from 'react';
import io, { Socket } from 'socket.io-client';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

export default function Home() {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [terminal, setTerminal] = useState<Terminal | null>(null);
  const [sessionId, setSessionId] = useState<string>('');
  const [status, setStatus] = useState<string>('Disconnected');

  useEffect(() => {
    // Connect to Socket.IO server
    const newSocket = io('http://localhost:3001');
    setSocket(newSocket);

    // Create terminal
    const term = new Terminal({
      cursorBlink: true,
      theme: {
        background: '#1e1e1e',
        foreground: '#ffffff',
      }
    });
    
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    // Mount terminal
    if (terminalRef.current) {
      term.open(terminalRef.current);
      fitAddon.fit();
    }

    setTerminal(term);

    // Socket event handlers
    newSocket.on('connect', () => {
      console.log('Connected to server');
      setStatus('Connected');
      newSocket.emit('create-session');
    });

    newSocket.on('session-created', (id: string) => {
      console.log('Session created:', id);
      setSessionId(id);
      setStatus('Session Active');
    });

    newSocket.on('output', (data: string) => {
      term.write(data);
    });

    newSocket.on('session-closed', () => {
      setStatus('Session Closed');
      term.write('\r\n[Session ended]\r\n');
    });

    newSocket.on('disconnect', () => {
      setStatus('Disconnected');
    });

    // Terminal input handler
    term.onData((data) => {
      newSocket.emit('input', data);
    });

    // Handle resize
    window.addEventListener('resize', () => {
      fitAddon.fit();
      const { cols, rows } = term;
      newSocket.emit('resize', { cols, rows });
    });

    // Cleanup
    return () => {
      term.dispose();
      newSocket.close();
    };
  }, []);

  return (
    <div style={{ padding: '20px', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <h1>Claude Code Terminal</h1>
      <div style={{ marginBottom: '10px' }}>
        Status: <span style={{ fontWeight: 'bold' }}>{status}</span>
        {sessionId && <span> | Session: {sessionId}</span>}
      </div>
      <div 
        ref={terminalRef} 
        style={{ 
          flex: 1,
          border: '1px solid #333',
          borderRadius: '4px',
          overflow: 'hidden'
        }}
      />
    </div>
  );
}