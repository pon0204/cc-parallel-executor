'use client';

import dynamic from 'next/dynamic';

const ParallelModern = dynamic(() => import('../parallel-modern'), { 
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        <p className="text-muted-foreground">並列実行環境を準備中...</p>
      </div>
    </div>
  )
});

export default function ParallelPage() {
  return <ParallelModern />;
}