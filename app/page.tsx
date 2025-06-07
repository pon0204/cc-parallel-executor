'use client';

import dynamic from 'next/dynamic';

// xterm.jsはサーバーサイドレンダリングに対応していないため、動的インポートを使用
const Terminal = dynamic(() => import('./terminal'), { 
  ssr: false,
  loading: () => <div style={{ padding: '20px', color: '#fff' }}>Loading terminal...</div>
});

export default function Home() {
  return <Terminal />;
}