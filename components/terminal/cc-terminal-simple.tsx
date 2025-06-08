'use client';

import { FitAddon } from '@xterm/addon-fit';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Terminal } from '@xterm/xterm';
import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import '@xterm/xterm/css/xterm.css';

interface CCTerminalProps {
  instanceId: string;
  type: 'parent' | 'child';
  socketUrl: string;
  existingSocket?: Socket | null;
  onReady?: () => void;
  onExit?: () => void;
}

export function CCTerminal({
  instanceId,
  type,
  socketUrl,
  existingSocket,
  onReady,
  onExit,
}: CCTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [terminal, setTerminal] = useState<Terminal | null>(null);
  const [_socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [sessionInitialized, setSessionInitialized] = useState(false);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Create terminal instance with settings optimized for Claude Code
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
      // xterm settings for Claude Code compatibility
      convertEol: true,
      scrollback: 10000,
      allowProposedApi: true,
      allowTransparency: false,
      drawBoldTextInBrightColors: true,
      rendererType: 'canvas',
    });

    // Add addons
    const fitAddon = new FitAddon();
    fitAddonRef.current = fitAddon;
    term.loadAddon(fitAddon);

    const webLinksAddon = new WebLinksAddon();
    term.loadAddon(webLinksAddon);
    
    // Unicode addon for better character support
    const unicodeAddon = new Unicode11Addon();
    term.loadAddon(unicodeAddon);
    unicodeAddon.activate(term);

    // Open terminal
    term.open(terminalRef.current);
    setTerminal(term);

    // Fit terminal to container
    setTimeout(() => {
      fitAddon.fit();
      // Send initial size to PTY
      if (socketInstance && socketInstance.connected) {
        socketInstance.emit('resize', { cols: term.cols, rows: term.rows });
      }
    }, 0);

    // Handle window resize and container resize
    const handleResize = () => {
      // Store previous size
      const prevCols = term.cols;
      const prevRows = term.rows;
      
      // Fit terminal
      fitAddon.fit();
      
      // Only send resize if size actually changed
      if ((term.cols !== prevCols || term.rows !== prevRows) && socketInstance && socketInstance.connected) {
        console.log(`Terminal resized: ${prevCols}x${prevRows} -> ${term.cols}x${term.rows}`);
        socketInstance.emit('resize', { cols: term.cols, rows: term.rows });
      }
    };
    window.addEventListener('resize', handleResize);
    
    // Also observe container size changes
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(terminalRef.current);
    resizeObserverRef.current = resizeObserver;

    // Set up terminal data handler immediately
    term.onData((data) => {
      // Store data for sending when connected
      if (socketInstance && socketInstance.connected) {
        socketInstance.emit('input', data);
      }
    });

    // Handle special key combinations
    term.attachCustomKeyEventHandler((event) => {
      // Shift+Enter for inserting a newline without sending
      if (event.shiftKey && event.key === 'Enter') {
        // Send a literal newline character
        if (socketInstance && socketInstance.connected) {
          socketInstance.emit('input', '\n');
        }
        return false; // Prevent default Enter behavior
      }
      // Let other keys be handled normally
      return true;
    });

    // Set up terminal resize handler immediately
    term.onResize(({ cols, rows }) => {
      if (socketInstance && socketInstance.connected) {
        socketInstance.emit('resize', { cols, rows });
      }
    });

    // Always create a new socket connection for simplicity
    const socketInstance = io(socketUrl, {
      transports: ['websocket'],
    });

    socketInstance.on('connect', () => {
      setIsConnected(true);

      // Ensure terminal is fitted before creating session
      fitAddon.fit();
      
      // Create new terminal session with current terminal size
      socketInstance.emit('create-session', {
        cols: term.cols,
        rows: term.rows,
        env: {
          CC_INSTANCE_ID: instanceId,
          CC_TYPE: type,
        },
      });
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
    });

    // Terminal data events - raw passthrough for Claude Code
    socketInstance.on('data', (data: string) => {
      term.write(data);
    });

    socketInstance.on('output', (data: string) => {
      term.write(data);
    });

    socketInstance.on('session-created', (data) => {
      const sessionId = typeof data === 'string' ? data : data?.sessionId || 'unknown';

      // Immediately send current terminal size after session creation
      setTimeout(() => {
        fitAddon.fit();
        socketInstance.emit('resize', { cols: term.cols, rows: term.rows });
      }, 100);

      // Show initial prompt for parent CC only once
      if (type === 'parent' && !sessionInitialized) {
        setSessionInitialized(true);
        term.writeln(`${type.toUpperCase()} CC Terminal Session: ${sessionId}`);
        term.writeln('Ready for Claude Code startup...');
        term.write('$ ');
      } else if (type === 'child') {
        term.writeln(`${type.toUpperCase()} CC Terminal Session: ${sessionId}`);
        term.writeln('Starting Claude Code...');
      }

      onReady?.();
    });

    socketInstance.on('session-error', ({ error }: { error: string }) => {
      term.write(`\r\n[Terminal Error: ${error}]\r\n`);
    });

    socketInstance.on(
      'exit',
      ({ code, signal }: { code: number | null; signal: string | null }) => {
        const exitMessage = signal
          ? `[Process terminated by signal ${signal}]`
          : `[Process exited with code ${code}]`;
        term.write(`\r\n${exitMessage}\r\n`);
        onExit?.();
      }
    );

    // Handle CC termination from server
    socketInstance.on(
      'terminate-cc',
      ({ instanceId, reason }: { instanceId: string; reason: string }) => {
        term.write(`\r\n[CC Instance ${instanceId} terminated: ${reason}]\r\n`);
        onExit?.();
      }
    );

    setSocket(socketInstance);
    
    // Store socket instance for resize handler  
    // socketInstance is already available in closure

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
      term.dispose();
      socketInstance.disconnect();
    };
  }, [instanceId, type, socketUrl, onReady, onExit]);

  // Focus terminal when clicked
  const handleClick = () => {
    terminal?.focus();
  };

  return (
    <div className="flex flex-col h-full">
      <div
        ref={terminalRef}
        onClick={handleClick}
        className="flex-1 w-full bg-[#1a1b26] rounded-t-lg overflow-hidden cursor-text relative"
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
      <div className="bg-muted/50 px-3 py-1.5 rounded-b-lg border-t text-xs text-muted-foreground flex items-center gap-2">
        <span>💡</span>
        <span>
          <kbd className="px-1.5 py-0.5 text-xs bg-background border rounded">Shift+Enter</kbd> で改行を挿入
        </span>
        <span className="text-muted-foreground/50">•</span>
        <span>
          <kbd className="px-1.5 py-0.5 text-xs bg-background border rounded">Enter</kbd> で送信
        </span>
      </div>
    </div>
  );
}