'use client';

import { FitAddon } from '@xterm/addon-fit';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Terminal } from '@xterm/xterm';
import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import '@xterm/xterm/css/xterm.css';

interface ClaudeOptimizedTerminalProps {
  instanceId: string;
  type: 'parent' | 'child';
  socketUrl: string;
  existingSocket?: Socket | null;
  onReady?: () => void;
  onExit?: () => void;
}

// Claude-specific ANSI sequences and patterns
const CLAUDE_PATTERNS = {
  // Status messages that flicker
  statusMessages: /^[\s\x1b\[[\d;]*m]*(Cooking|Reticulating|Pondering|Analyzing|Computing|Thinking|Reading|Writing|Planning)\.\.\./i,
  // Empty prompt lines
  emptyPrompt: /^[\s\x1b\[[\d;]*m]*>[\s\x1b\[[\d;]*m]*$/,
  // Shortcut hints
  shortcuts: /\? for shortcuts/,
  // Progress indicators
  progress: /✳\s+\w+\.{3}\s*\(\d+s\s*·\s*[↑↓]\s*\d+\s*tokens/,
  // Clear line sequences
  clearLine: /\x1b\[[0-9]*K/,
  // Cursor movements
  cursorMove: /\x1b\[[0-9]*[ABCD]/,
  // Save/restore cursor
  cursorSaveRestore: /\x1b\[[78]/,
};

export function ClaudeOptimizedTerminal({
  instanceId,
  type,
  socketUrl,
  existingSocket,
  onReady,
  onExit,
}: ClaudeOptimizedTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [terminal, setTerminal] = useState<Terminal | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const fitAddonRef = useRef<FitAddon | null>(null);
  
  // Claude output processing state
  const outputStateRef = useRef({
    lastLines: [] as string[],
    statusLineY: -1,
    isInProgress: false,
    lastStatusMessage: '',
    consecutiveDuplicates: 0,
  });

  useEffect(() => {
    if (!terminalRef.current) return;

    // Create terminal with Claude-optimized settings
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
      // Optimized for Claude's output
      convertEol: false,
      scrollback: 10000,
      allowProposedApi: true,
      rendererType: 'canvas',
      windowsMode: false,
      // Better performance for rapid updates
      fastScrollModifier: 'shift',
      scrollSensitivity: 1,
      // Handle wide characters properly
      allowTransparency: false,
      drawBoldTextInBrightColors: true,
    });

    // Load addons
    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    const unicodeAddon = new Unicode11Addon();
    
    fitAddonRef.current = fitAddon;
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.loadAddon(unicodeAddon);
    
    // Activate unicode handling
    term.unicode.activeVersion = '11';

    // Open terminal
    term.open(terminalRef.current);
    setTerminal(term);

    // Initial fit
    setTimeout(() => {
      fitAddon.fit();
    }, 0);

    // Handle window resize
    const handleResize = () => {
      fitAddon.fit();
    };
    window.addEventListener('resize', handleResize);

    // Set up terminal input handler
    term.onData((data) => {
      if (socketInstance && socketInstance.connected) {
        socketInstance.emit('input', data);
      }
    });

    // Set up terminal resize handler
    term.onResize(({ cols, rows }) => {
      if (socketInstance && socketInstance.connected) {
        socketInstance.emit('resize', { cols, rows });
      }
    });

    // Create socket connection
    const socketInstance = io(socketUrl, {
      transports: ['websocket'],
    });

    socketInstance.on('connect', () => {
      setIsConnected(true);

      // Create session with Claude-optimized dimensions
      socketInstance.emit('create-session', {
        cols: 120,
        rows: 40, // Taller for better Claude output visibility
        env: {
          CC_INSTANCE_ID: instanceId,
          CC_TYPE: type,
          CLAUDE_OPTIMIZED: 'true',
        },
      });
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
    });

    // Enhanced Claude output processor
    const processClaudeOutput = (rawData: string) => {
      const state = outputStateRef.current;
      
      // Split data into potential segments
      const segments = rawData.split(/(\x1b\[[^m]*m|\x1b\[[0-9]*[ABCDK]|\r|\n)/);
      
      let processedOutput = '';
      let skipNext = false;
      
      for (let i = 0; i < segments.length; i++) {
        if (skipNext) {
          skipNext = false;
          continue;
        }
        
        const segment = segments[i];
        
        // Handle ANSI escape sequences
        if (segment.startsWith('\x1b[')) {
          // Always include ANSI sequences for proper rendering
          processedOutput += segment;
          continue;
        }
        
        // Handle carriage return and newline
        if (segment === '\r' || segment === '\n') {
          processedOutput += segment;
          continue;
        }
        
        // Check for patterns to filter
        const trimmedSegment = segment.replace(/\x1b\[[^m]*m/g, '').trim();
        
        // Skip duplicate empty prompts
        if (CLAUDE_PATTERNS.emptyPrompt.test(trimmedSegment)) {
          const lastLine = state.lastLines[state.lastLines.length - 1] || '';
          if (CLAUDE_PATTERNS.emptyPrompt.test(lastLine)) {
            state.consecutiveDuplicates++;
            if (state.consecutiveDuplicates > 1) {
              continue; // Skip duplicate
            }
          } else {
            state.consecutiveDuplicates = 0;
          }
        }
        
        // Handle status messages more intelligently
        if (CLAUDE_PATTERNS.statusMessages.test(trimmedSegment)) {
          // If we have a previous status message on the same line, clear it
          if (state.isInProgress && state.lastStatusMessage) {
            processedOutput += '\r\x1b[K'; // Clear line
          }
          state.isInProgress = true;
          state.lastStatusMessage = trimmedSegment;
        } else if (state.isInProgress && trimmedSegment) {
          // Non-status content means progress is done
          state.isInProgress = false;
          state.lastStatusMessage = '';
        }
        
        // Skip duplicate shortcut hints
        if (CLAUDE_PATTERNS.shortcuts.test(segment)) {
          const recentShortcut = state.lastLines.slice(-3).some(line => 
            CLAUDE_PATTERNS.shortcuts.test(line)
          );
          if (recentShortcut) {
            continue; // Skip duplicate
          }
        }
        
        processedOutput += segment;
        
        // Track recent lines for duplicate detection
        if (segment.trim()) {
          state.lastLines.push(trimmedSegment);
          if (state.lastLines.length > 10) {
            state.lastLines.shift();
          }
        }
      }
      
      // Write processed output
      if (processedOutput) {
        term.write(processedOutput);
      }
    };

    // Socket event handlers
    socketInstance.on('data', processClaudeOutput);
    socketInstance.on('output', processClaudeOutput);

    socketInstance.on('session-created', (data) => {
      const sessionId = typeof data === 'string' ? data : data?.sessionId || 'unknown';
      
      term.writeln(`${type.toUpperCase()} Claude Code Terminal`);
      term.writeln(`Session: ${sessionId}`);
      term.writeln('━'.repeat(60));
      
      if (type === 'parent') {
        term.writeln('Ready for Claude Code startup...');
        term.write('$ ');
      } else {
        term.writeln('Starting Claude Code instance...');
      }
      
      onReady?.();
    });

    socketInstance.on('session-error', ({ error }: { error: string }) => {
      term.write(`\r\n\x1b[91m[Error: ${error}]\x1b[0m\r\n`);
    });

    socketInstance.on('exit', ({ code, signal }: { code: number | null; signal: string | null }) => {
      const exitMessage = signal
        ? `[Process terminated by signal ${signal}]`
        : `[Process exited with code ${code}]`;
      term.write(`\r\n\x1b[93m${exitMessage}\x1b[0m\r\n`);
      onExit?.();
    });

    socketInstance.on('terminate-cc', ({ instanceId, reason }: { instanceId: string; reason: string }) => {
      term.write(`\r\n\x1b[93m[CC Instance ${instanceId} terminated: ${reason}]\x1b[0m\r\n`);
      onExit?.();
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
      className="h-full w-full bg-[#1a1b26] rounded-lg overflow-hidden cursor-text relative"
      style={{ padding: '8px' }}
    >
      {!isConnected && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg z-10">
          <div className="text-center space-y-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-sm text-muted-foreground">接続中...</p>
          </div>
        </div>
      )}
    </div>
  );
}