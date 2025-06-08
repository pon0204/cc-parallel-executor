'use client';

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Grid2X2, Maximize2, Terminal } from 'lucide-react';
import { CCTerminal } from './terminal-wrapper';
import { useProjectStore } from '@/lib/stores/project.store';
import type { Socket } from 'socket.io-client';

interface TerminalTabsProps {
  projectId: string;
  parentSocket?: Socket | null;
  focusedTerminalId?: string | null;
  onTerminalFocus?: (instanceId: string) => void;
}

export function TerminalTabs({ parentSocket, focusedTerminalId }: TerminalTabsProps) {
  const parentCC = useProjectStore((state) => state.parentCC);
  const childCCs = useProjectStore((state) => state.childCCs);
  const [activeTab, setActiveTab] = useState('parent');
  const [viewMode, setViewMode] = useState<'tabs' | 'grid'>('tabs');

  // フォーカスされたターミナルIDが変更されたらタブを切り替える
  useEffect(() => {
    if (focusedTerminalId) {
      setActiveTab(focusedTerminalId);
    }
  }, [focusedTerminalId]);

  // 親CCがない場合のメッセージ
  if (!parentCC) {
    return (
      <div className="flex items-center justify-center h-[600px] border rounded-lg bg-secondary/20">
        <div className="text-center space-y-4">
          <Terminal className="h-12 w-12 text-muted-foreground mx-auto" />
          <div>
            <h3 className="text-lg font-semibold">親CCが起動していません</h3>
            <p className="text-sm text-muted-foreground mt-2">
              上部の「親CCを起動」ボタンをクリックしてください
            </p>
          </div>
        </div>
      </div>
    );
  }

  // タブモード
  if (viewMode === 'tabs') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">ターミナル</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewMode('grid')}
            disabled={childCCs.length === 0}
          >
            <Grid2X2 className="h-4 w-4 mr-2" />
            分割表示
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="parent" className="flex items-center gap-2">
              親CC
              <Badge variant="secondary" className="ml-2">
                Controller
              </Badge>
            </TabsTrigger>
            {childCCs.map((child, index) => (
              <TabsTrigger
                key={child.id}
                value={`child-${child.id}`}
                className="flex items-center gap-2"
              >
                子CC-{index + 1}
                {child.status === 'running' && (
                  <Badge variant="default" className="ml-2">
                    実行中
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="parent" className="mt-4">
            <CCTerminal
              instanceId={parentCC.id}
              type="parent"
              socketUrl={process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:8081'}
              existingSocket={parentSocket}
            />
          </TabsContent>

          {childCCs.map((child) => (
            <TabsContent key={child.id} value={`child-${child.id}`} className="mt-4">
              <CCTerminal
                instanceId={child.id}
                type="child"
                socketUrl={process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:8081'}
              />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    );
  }

  // グリッドモード（分割表示）
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">ターミナル（分割表示）</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setViewMode('tabs')}
        >
          <Maximize2 className="h-4 w-4 mr-2" />
          タブ表示
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Parent CC */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium">親CC</h3>
            <Badge variant="secondary">Controller</Badge>
          </div>
          <div className="h-[400px]">
            <CCTerminal
              instanceId={parentCC.id}
              type="parent"
              socketUrl={process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:8081'}
              existingSocket={parentSocket}
            />
          </div>
        </div>

        {/* Child CCs */}
        {childCCs.slice(0, 3).map((child, index) => (
          <div key={child.id} className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium">子CC-{index + 1}</h3>
              {child.status === 'running' && (
                <Badge variant="default">実行中</Badge>
              )}
            </div>
            <div className="h-[400px]">
              <CCTerminal
                instanceId={child.id}
                type="child"
                socketUrl={process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:8081'}
              />
            </div>
          </div>
        ))}

        {/* Empty slots */}
        {childCCs.length === 0 && (
          <div className="h-[400px] border-2 border-dashed rounded-lg flex items-center justify-center">
            <p className="text-sm text-muted-foreground">
              子CCが起動されると表示されます
            </p>
          </div>
        )}
      </div>

      {childCCs.length > 3 && (
        <p className="text-sm text-muted-foreground text-center">
          他 {childCCs.length - 3} 個の子CCが実行中です。タブ表示で確認してください。
        </p>
      )}
    </div>
  );
}