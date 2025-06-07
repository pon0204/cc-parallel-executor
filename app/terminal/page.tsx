'use client';

import dynamic from 'next/dynamic';

const TerminalModern = dynamic(() => import('../terminal-modern'), { 
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        <p className="text-muted-foreground">ターミナルを準備中...</p>
      </div>
    </div>
  )
});

export default function TerminalPage() {
  return <TerminalModern />;
}