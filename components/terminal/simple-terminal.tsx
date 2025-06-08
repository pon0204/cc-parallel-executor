'use client';

import { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

interface SimpleTerminalProps {
  onConnected?: (sessionId: string) => void;
  onDisconnected?: () => void;
}

export function SimpleTerminal({ onConnected, onDisconnected }: SimpleTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [terminal, setTerminal] = useState<Terminal | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const fitAddonRef = useRef<FitAddon | null>(null);
  const onConnectedRef = useRef(onConnected);
  const onDisconnectedRef = useRef(onDisconnected);
  
  // Update refs when props change
  onConnectedRef.current = onConnected;
  onDisconnectedRef.current = onDisconnected;

  useEffect(() => {
    if (!terminalRef.current) return;

    // Create terminal instance
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#000000',
        foreground: '#ffffff',
        cursor: '#ffffff',
      },
      rows: 24,
      cols: 80,
    });

    // Create addons
    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    
    fitAddonRef.current = fitAddon;

    // Open terminal in the div
    term.open(terminalRef.current);
    fitAddon.fit();

    setTerminal(term);

    // Connect to socket.io (Project Server)
    const socketConnection = io(`http://localhost:${process.env.NEXT_PUBLIC_PROJECT_SERVER_PORT || 8081}`);

    socketConnection.on('connect', () => {
      console.log('Connected to socket server');
      setIsConnected(true);
      
      // Create session using original protocol
      socketConnection.emit('create-session', {
        cols: 80,
        rows: 24
      });
    });

    socketConnection.on('session-created', (data: { sessionId: string } | string) => {
      const sessionId = typeof data === 'object' ? data.sessionId : data;
      console.log('Session created:', sessionId);
      setSessionId(sessionId);
      term.writeln('Terminal session created successfully!');
      term.writeln(`Session ID: ${sessionId}`);
      term.writeln('Type commands and press Enter...');
      term.write('$ ');
      onConnectedRef.current?.(sessionId);
    });

    socketConnection.on('output', (data: string) => {
      term.write(data);
    });

    socketConnection.on('session-closed', (sessionId: string) => {
      term.writeln(`\r\nSession ${sessionId} closed.`);
      setIsConnected(false);
      onDisconnectedRef.current?.();
    });

    socketConnection.on('disconnect', () => {
      console.log('Disconnected from socket server');
      setIsConnected(false);
      term.writeln('\r\nDisconnected from server');
      onDisconnectedRef.current?.();
    });

    // Handle terminal input
    term.onData((data) => {
      if (socketConnection.connected) {
        // Echo the input locally for immediate feedback
        if (data === '\r') {
          term.write('\r\n');
        } else if (data === '\u007f') { // Backspace
          term.write('\b \b');
        } else if (data.charCodeAt(0) >= 32) { // Printable characters
          term.write(data);
        }
        
        socketConnection.emit('input', data);
      }
    });

    // Handle terminal resize
    term.onResize(({ cols, rows }) => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
    });

    setSocket(socketConnection);

    // Cleanup
    return () => {
      term.dispose();
      socketConnection.disconnect();
    };
  }, []); // 依存関係を空にして無限ループを防ぐ

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div 
      ref={terminalRef}
      className="w-full h-96 bg-black rounded-lg p-2 overflow-hidden"
    />
  );
}