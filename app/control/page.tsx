'use client';

import dynamic from 'next/dynamic';

const ModernApiControl = dynamic(() => import('../control-modern'), { 
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        <p className="text-muted-foreground">コントロールパネルを読み込み中...</p>
      </div>
    </div>
  )
});

export default function ControlPage() {
  return <ModernApiControl />;
}