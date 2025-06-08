'use client';

import { CCTerminal } from '@/components/terminal/terminal-wrapper';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { type CCInstance, type Project, api } from '@/lib/api/client';
import { useProjectStore } from '@/lib/stores/project.store';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Bot,
  Crown,
  Maximize2,
  Minimize2,
  Play,
  Plus,
  RotateCcw,
  Square,
  Terminal,
  Trash2,
  Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Socket } from 'socket.io-client';

interface ActiveCCTerminalsProps {
  projectId: string;
  project: Project;
  parentSocket?: Socket | null;
}

export function ActiveCCTerminals({ projectId, project, parentSocket }: ActiveCCTerminalsProps) {
  const [expandedTerminals, setExpandedTerminals] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isStartingCC, setIsStartingCC] = useState(false);
  const [terminalHeight, setTerminalHeight] = useState<'normal' | 'tall' | 'full'>('tall');
  const queryClient = useQueryClient();

  // Get CC instances (temporarily showing all instances until we fix project filtering)
  const { data: ccInstances, isLoading } = useQuery({
    queryKey: ['cc-instances', projectId],
    queryFn: () => api.cc.list(), // Remove projectId filtering for now
    refetchInterval: 5000, // Update every 5 seconds
  });

  // Start parent CC mutation
  const startParentCCMutation = useMutation({
    mutationFn: () => api.cc.createParent(projectId, `Parent CC - ${project.name}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cc-instances', projectId] });
      toast({
        title: '親Claude Codeが起動しました',
        description: 'ターミナルでClaude Codeと対話できます',
      });
    },
    onError: (error) => {
      toast({
        title: 'エラー',
        description: '親Claude Codeの起動に失敗しました',
        variant: 'destructive',
      });
    },
    onSettled: () => {
      setIsStartingCC(false);
    },
  });

  const handleStartParentCC = () => {
    setIsStartingCC(true);
    startParentCCMutation.mutate();
  };

  // Filter active instances (running or idle parent/child CCs)
  const activeInstances =
    ccInstances?.filter((instance) => ['running', 'idle'].includes(instance.status)) || [];

  const parentInstances = activeInstances.filter((instance) => instance.type === 'parent');
  const childInstances = activeInstances.filter((instance) => instance.type === 'child');

  const toggleTerminalExpansion = (instanceId: string) => {
    const newExpanded = new Set(expandedTerminals);
    if (newExpanded.has(instanceId)) {
      newExpanded.delete(instanceId);
    } else {
      newExpanded.add(instanceId);
    }
    setExpandedTerminals(newExpanded);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'idle':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'stopped':
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
      case 'error':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Play className="h-3 w-3" />;
      case 'idle':
        return <Square className="h-3 w-3" />;
      case 'stopped':
        return <Square className="h-3 w-3" />;
      case 'error':
        return <RotateCcw className="h-3 w-3" />;
      default:
        return <Square className="h-3 w-3" />;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            アクティブなClaude Code
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (activeInstances.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            Claude Code コントロール
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 space-y-6">
            <div className="space-y-4">
              <Zap className="h-16 w-16 text-muted-foreground mx-auto" />
              <div>
                <h3 className="text-xl font-semibold">Claude Codeを開始</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  このプロジェクトでClaude Codeを起動して、AIペアプログラミングを開始しましょう
                </p>
              </div>
            </div>
            <div className="flex justify-center gap-3">
              <Button
                onClick={handleStartParentCC}
                disabled={isStartingCC}
                size="lg"
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                <Crown className="h-5 w-5 mr-2" />
                {isStartingCC ? '起動中...' : '親Claude Codeを起動'}
              </Button>
            </div>
            <div className="text-xs text-muted-foreground">
              <p>起動後、このエリアにターミナルが表示されます</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="h-5 w-5" />
          <h2 className="text-xl font-semibold">アクティブなClaude Code</h2>
          <Badge variant="secondary">{activeInstances.length}個</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={terminalHeight}
            onValueChange={(value) => setTerminalHeight(value as 'normal' | 'tall' | 'full')}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">標準</SelectItem>
              <SelectItem value="tall">縦長</SelectItem>
              <SelectItem value="full">フルサイズ</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
          >
            {viewMode === 'grid' ? (
              <Minimize2 className="h-4 w-4 mr-2" />
            ) : (
              <Maximize2 className="h-4 w-4 mr-2" />
            )}
            {viewMode === 'grid' ? 'リスト表示' : 'グリッド表示'}
          </Button>
        </div>
      </div>

      {/* Parent CC Instances */}
      {parentInstances.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium flex items-center gap-2">
            <Crown className="h-4 w-4 text-yellow-500" />
            親Claude Code
          </h3>
          <div
            className={viewMode === 'grid' ? 'grid grid-cols-1 lg:grid-cols-2 gap-4' : 'space-y-4'}
          >
            {parentInstances.map((instance) => (
              <TerminalCard
                key={instance.id}
                instance={instance}
                isExpanded={expandedTerminals.has(instance.id)}
                onToggleExpansion={() => toggleTerminalExpansion(instance.id)}
                parentSocket={parentSocket}
                getStatusColor={getStatusColor}
                getStatusIcon={getStatusIcon}
                viewMode={viewMode}
                terminalHeightSetting={terminalHeight}
              />
            ))}
          </div>
        </div>
      )}

      {/* Child CC Instances */}
      {childInstances.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium flex items-center gap-2">
            <Bot className="h-4 w-4 text-purple-500" />
            子Claude Code
          </h3>
          <div
            className={
              viewMode === 'grid'
                ? 'grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4'
                : 'space-y-4'
            }
          >
            {childInstances.map((instance) => (
              <TerminalCard
                key={instance.id}
                instance={instance}
                isExpanded={expandedTerminals.has(instance.id)}
                onToggleExpansion={() => toggleTerminalExpansion(instance.id)}
                getStatusColor={getStatusColor}
                getStatusIcon={getStatusIcon}
                viewMode={viewMode}
                terminalHeightSetting={terminalHeight}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface TerminalCardProps {
  instance: CCInstance;
  isExpanded: boolean;
  onToggleExpansion: () => void;
  parentSocket?: Socket | null;
  getStatusColor: (status: string) => string;
  getStatusIcon: (status: string) => React.ReactNode;
  viewMode: 'grid' | 'list';
  terminalHeightSetting: 'normal' | 'tall' | 'full';
}

function TerminalCard({
  instance,
  isExpanded,
  onToggleExpansion,
  parentSocket,
  getStatusColor,
  getStatusIcon,
  viewMode,
  terminalHeightSetting,
}: TerminalCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const queryClient = useQueryClient();

  const getTerminalHeight = () => {
    if (viewMode === 'list') {
      return isExpanded ? 'h-[600px]' : 'h-32';
    }

    // グリッドビューの高さ設定
    if (isExpanded) {
      switch (terminalHeightSetting) {
        case 'normal':
          return 'h-96'; // 384px
        case 'tall':
          return 'h-[800px]'; // 800px（元の2倍以上）
        case 'full':
          return 'h-[1000px]'; // 1000px
      }
    } else {
      switch (terminalHeightSetting) {
        case 'normal':
          return 'h-48'; // 192px
        case 'tall':
          return 'h-64'; // 256px
        case 'full':
          return 'h-80'; // 320px
      }
    }
  };

  const terminalHeight = getTerminalHeight();

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {instance.type === 'parent' ? (
              <Crown className="h-4 w-4 text-yellow-500" />
            ) : (
              <Bot className="h-4 w-4 text-purple-500" />
            )}
            <CardTitle className="text-sm font-medium truncate">{instance.name}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={getStatusColor(instance.status)}>
              {getStatusIcon(instance.status)}
              <span className="ml-1 capitalize">{instance.status}</span>
            </Badge>
            <Button variant="ghost" size="sm" onClick={onToggleExpansion} className="h-6 w-6 p-0">
              {isExpanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
            </Button>
            {instance.type === 'child' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDeleteDialog(true)}
                className="h-6 w-6 p-0 hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className={`transition-all duration-300 ${terminalHeight}`}>
          <CCTerminal
            instanceId={instance.id}
            type={instance.type as 'parent' | 'child'}
            socketUrl={process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:8081'}
            existingSocket={instance.type === 'parent' ? parentSocket : undefined}
          />
        </div>
      </CardContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>子CCを終了しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              この操作により、子CC「{instance.name}」のプロセスが終了します。
              実行中のタスクがある場合は、進行状況が失われる可能性があります。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                try {
                  await api.cc.stop(instance.id);
                  toast({
                    title: '子CCを終了しました',
                    description: `${instance.name} のプロセスを終了しました。`,
                  });
                  queryClient.invalidateQueries({ queryKey: ['cc-instances'] });
                } catch (error) {
                  toast({
                    title: 'エラー',
                    description: '子CCの終了に失敗しました',
                    variant: 'destructive',
                  });
                }
              }}
            >
              終了
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
