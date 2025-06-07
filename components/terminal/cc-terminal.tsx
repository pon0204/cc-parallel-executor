'use client';

import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { io, Socket } from 'socket.io-client';
import '@xterm/xterm/css/xterm.css';

interface CCTerminalProps {
  instanceId: string;
  type: 'parent' | 'child';
  socketUrl: string;
  existingSocket?: Socket | null;
  onReady?: () => void;
  onExit?: () => void;
}

export function CCTerminal({ instanceId, type, socketUrl, existingSocket, onReady, onExit }: CCTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [terminal, setTerminal] = useState<Terminal | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [sessionInitialized, setSessionInitialized] = useState(false);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Create terminal instance
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1a1b26',
        foreground: '#a9b1d6',
        cursor: '#c0caf5',
        black: '#15161e',
        red: '#f7768e',
        green: '#9ece6a',
        yellow: '#e0af68',
        blue: '#7aa2f7',
        magenta: '#bb9af7',
        cyan: '#7dcfff',
        white: '#a9b1d6',
        brightBlack: '#414868',
        brightRed: '#f7768e',
        brightGreen: '#9ece6a',
        brightYellow: '#e0af68',
        brightBlue: '#7aa2f7',
        brightMagenta: '#bb9af7',
        brightCyan: '#7dcfff',
        brightWhite: '#c0caf5',
      },
    });

    // Add addons
    const fitAddon = new FitAddon();
    fitAddonRef.current = fitAddon;
    term.loadAddon(fitAddon);

    const webLinksAddon = new WebLinksAddon();
    term.loadAddon(webLinksAddon);

    // Open terminal
    term.open(terminalRef.current);
    setTerminal(term);

    // Fit terminal to container
    setTimeout(() => {
      fitAddon.fit();
    }, 0);

    // Handle window resize
    const handleResize = () => {
      fitAddon.fit();
    };
    window.addEventListener('resize', handleResize);

    // Socket connection - use existing socket for parent CC
    const socketInstance = existingSocket && existingSocket.connected 
      ? existingSocket 
      : io(socketUrl, {
          transports: ['websocket'],
        });

    if (!existingSocket || !existingSocket.connected) {
      socketInstance.on('connect', () => {
        console.log(`Connected to socket: ${socketInstance.id} for ${type} CC: ${instanceId}`);
        setIsConnected(true);

        // Create new terminal session for all CC types
        socketInstance.emit('create-session', {
          cols: 120,
          rows: 30,
          env: {
            CC_INSTANCE_ID: instanceId,
            CC_TYPE: type,
          },
        });
      });
    } else {
      // Use existing connected socket and ensure terminal session exists
      console.log(`Using existing socket: ${socketInstance.id} for ${type} CC: ${instanceId}`);
      setIsConnected(true);
      
      // For parent CC using existing socket, we still need to ensure terminal session exists
      if (type === 'parent') {
        setTimeout(() => {
          socketInstance.emit('create-session', {
            cols: 120,
            rows: 30,
            env: {
              CC_INSTANCE_ID: instanceId,
              CC_TYPE: type,
            },
          });
        }, 100);
      }
    }

    socketInstance.on('disconnect', () => {
      console.log('Disconnected from socket');
      setIsConnected(false);
    });

    // Terminal data events
    socketInstance.on('data', (data: string) => {
      term.write(data);
    });

    socketInstance.on('output', (data: string) => {
      term.write(data);
    });

    socketInstance.on('session-created', ({ sessionId }: { sessionId: string }) => {
      console.log(`Terminal session created: ${sessionId}`);
      
      // Show initial prompt for parent CC only once
      if (type === 'parent' && !sessionInitialized) {
        setSessionInitialized(true);
        term.writeln(`${type.toUpperCase()} CC Terminal Session: ${sessionId}`);
        term.writeln('Ready for Claude Code startup...');
        term.write('$ ');
      }
      
      onReady?.();
    });

    socketInstance.on('session-error', ({ error }: { error: string }) => {
      term.write(`\r\n[Terminal Error: ${error}]\r\n`);
    });

    socketInstance.on('exit', ({ code, signal }: { code: number | null; signal: string | null }) => {
      const exitMessage = signal 
        ? `[Process terminated by signal ${signal}]`
        : `[Process exited with code ${code}]`;
      term.write(`\r\n${exitMessage}\r\n`);
      onExit?.();
    });

    // CC-specific events
    socketInstance.on('cc:parent-ready', ({ project }: any) => {
      console.log('Parent CC ready for project:', project);
    });

    socketInstance.on('cc:child-ready', ({ task }: any) => {
      console.log('Child CC ready for task:', task);
    });

    // Send terminal input to server
    term.onData((data) => {
      if (isConnected) {
        // Echo the input locally for immediate feedback
        if (data === '\r') {
          term.write('\r\n');
        } else if (data === '\u007f') { // Backspace
          term.write('\b \b');
        } else if (data.charCodeAt(0) >= 32) { // Printable characters
          term.write(data);
        }
        
        socketInstance.emit('input', data);
      }
    });

    // Handle terminal resize
    term.onResize(({ cols, rows }) => {
      if (isConnected) {
        socketInstance.emit('resize', { cols, rows });
      }
    });

    setSocket(socketInstance);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      term.dispose();
      socketInstance.disconnect();
    };
  }, [instanceId, type, socketUrl, onReady, onExit]);

  // Focus terminal when clicked
  const handleClick = () => {
    terminal?.focus();
  };

  return (
    <div
      ref={terminalRef}
      onClick={handleClick}
      className="h-full w-full bg-[#1a1b26] rounded-lg overflow-hidden cursor-text"
      style={{ padding: '8px' }}
    >
      {!isConnected && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg">
          <div className="text-center space-y-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-sm text-muted-foreground">接続中...</p>
          </div>
        </div>
      )}
    </div>
  );
}