import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { Providers } from '@/lib/providers';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'CC Parallel Execution System',
  description: 'Claude Code並列実行システム',
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="ja" className="dark">
      <body>
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
