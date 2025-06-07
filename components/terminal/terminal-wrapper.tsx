'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

const CCTerminal = dynamic(() => import('./cc-terminal').then(mod => ({ default: mod.CCTerminal })), {
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

export { CCTerminal };