'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Terminal as TerminalIcon, Home, Play, Square, Loader2 } from 'lucide-react';
import Link from 'next/link';

const SimpleTerminal = dynamic(() => import('@/components/terminal/simple-terminal').then(mod => ({ default: mod.SimpleTerminal })), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-96 bg-black rounded-lg">
      <div className="flex items-center space-x-2 text-white">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>ターミナル起動中...</span>
      </div>
    </div>
  ),
});

export default function TestTerminalPage() {
  const [isConnected, setIsConnected] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');

  const handleConnected = (newSessionId: string) => {
    setIsConnected(true);
    setSessionId(newSessionId);
  };

  const handleDisconnected = () => {
    setIsConnected(false);
    setSessionId('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      {/* Header */}
      <div className="border-b border-slate-700/50 bg-slate-900/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/">
                <Button variant="ghost" size="sm">
                  <Home className="h-4 w-4 mr-2" />
                  ホーム
                </Button>
              </Link>
              <div className="flex items-center space-x-2">
                <TerminalIcon className="h-6 w-6 text-blue-400" />
                <h1 className="text-xl font-bold">Terminal Test</h1>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Badge variant={isConnected ? "default" : "destructive"}>
                {isConnected ? "接続中" : "切断"}
              </Badge>
              {sessionId && (
                <Badge variant="outline" className="text-xs">
                  Session: {String(sessionId).substring(0, 8)}...
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid gap-6">
          {/* Terminal Controls */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <TerminalIcon className="h-5 w-5" />
                <span>Terminal Controls</span>
              </CardTitle>
              <CardDescription>
                server-simple.js (child_process.spawn) を使用したターミナルテスト
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-gray-400">
                ターミナルは自動的に接続されます。コマンドを直接入力してください。
              </div>
            </CardContent>
          </Card>

          {/* Terminal */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle>Terminal Output</CardTitle>
              <CardDescription>
                Port 3001で動作するserver-simple.jsに接続
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SimpleTerminal 
                onConnected={handleConnected}
                onDisconnected={handleDisconnected}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}