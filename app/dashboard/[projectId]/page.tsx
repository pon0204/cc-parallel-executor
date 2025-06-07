'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, Upload, Play, FolderOpen, ListTodo, FileText, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProject, useProjectTasks } from '@/lib/hooks/useProjects';
import { useProjectStore } from '@/lib/stores/project.store';
import { TerminalTabs } from '@/components/terminal/terminal-tabs';
import { TaskUploadDialog } from '@/components/dashboard/task-upload-dialog';
import { api } from '@/lib/api/client';
import { toast } from '@/components/ui/use-toast';
import io, { Socket } from 'socket.io-client';

export default function ProjectDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  
  const { data: project, isLoading, error } = useProject(projectId);
  const { data: tasks, isLoading: tasksLoading } = useProjectTasks(projectId);
  const setCurrentProject = useProjectStore((state) => state.setCurrentProject);
  const parentCC = useProjectStore((state) => state.parentCC);
  const setParentCC = useProjectStore((state) => state.setParentCC);
  const addChildCC = useProjectStore((state) => state.addChildCC);
  
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isStartingCC, setIsStartingCC] = useState(false);
  const [isStartingChildCC, setIsStartingChildCC] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [claudeStarted, setClaudeStarted] = useState(false);

  useEffect(() => {
    if (project) {
      setCurrentProject(project);
    }
  }, [project, setCurrentProject]);

  // Socket.IOイベントハンドラーの設定
  const setupSocketEvents = (socket: Socket) => {
    socket.on('connect', () => {
      console.log('Connected to CC server, socket ID:', socket.id);
    });

    socket.on('cc:parent-ready', (data: { instanceId: string; sessionId?: string; project?: any }) => {
      console.log('Parent CC ready:', data);
      
      // Create and store parent CC instance
      const parentInstance = {
        id: data.instanceId,
        name: `Parent CC - ${project?.name || 'Unknown'}`,
        type: 'parent' as const,
        status: 'running' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastHeartbeat: new Date().toISOString(),
      };
      setParentCC(parentInstance);
      
      // Auto-start Claude Code after parent CC is ready
      if (!claudeStarted) {
        setClaudeStarted(true);
        
        // Wait for terminal to be fully initialized, then start Claude
        setTimeout(() => {
          console.log('Sending claude command to terminal...');
          socket.emit('input', 'claude\n');
          
          // Send ultrathink welcome message after Claude starts
          setTimeout(() => {
            console.log('Sending ultrathink welcome message...');
            const welcomeMessage = `ultrathink

プロジェクト「${project?.name || 'Project'}」の親Claude Codeが起動しました。

プロジェクトディレクトリ: ${project?.workdir || 'Unknown'}
タスク数: ${tasks?.length || 0}

開発者とタスクについて対話してください。
`;
            socket.emit('input', welcomeMessage);
          }, 5000);
        }, 3000); // Give terminal more time to initialize
      }
      
      toast({
        title: '親CCが起動しました！',
        description: `インスタンス: ${data.instanceId}`,
      });
      setIsStartingCC(false);
    });

    // Listen for terminal session creation to trigger Claude startup
    socket.on('session-created', ({ sessionId }: { sessionId: string }) => {
      console.log('Terminal session created:', sessionId, 'Claude started:', claudeStarted, 'Parent CC exists:', !!parentCC);
      
      // Only start Claude once and only when parent CC exists
      if (!claudeStarted && parentCC && parentCC.type === 'parent') {
        console.log('Starting Claude Code for parent CC...');
        setClaudeStarted(true);
        
        // Auto-start Claude Code in the terminal after session is ready
        setTimeout(() => {
          console.log('Sending claude command to terminal...');
          socket.emit('input', 'claude\n');
          
          // Send ultrathink welcome message after Claude starts
          setTimeout(() => {
            console.log('Sending ultrathink welcome message...');
            const welcomeMessage = `ultrathink

プロジェクト「${project?.name || 'Project'}」の親Claude Codeが起動しました。

プロジェクトディレクトリ: ${project?.workdir || 'Unknown'}
タスク数: ${tasks?.length || 0}

開発者とタスクについて対話してください。
`;
            socket.emit('input', welcomeMessage);
          }, 5000);
        }, 2000);
      }
    });

    socket.on('cc:error', (error: { message: string; error?: string }) => {
      console.error('CC Error:', error);
      toast({
        title: 'CCエラー',
        description: error.message + (error.error ? ` (${error.error})` : ''),
        variant: 'destructive',
      });
      setIsStartingCC(false);
      setIsStartingChildCC(false);
    });

    socket.on('cc:child-ready', (data: { instanceId: string; task?: any; worktreePath?: string }) => {
      console.log('Child CC ready:', data);
      
      // Create and store child CC instance
      const childInstance = {
        id: data.instanceId,
        name: `Child CC - ${data.task?.name || 'Task'}`,
        type: 'child' as const,
        status: 'running' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastHeartbeat: new Date().toISOString(),
        worktreePath: data.worktreePath,
      };
      addChildCC(childInstance);
      
      toast({
        title: '子CCが起動しました！',
        description: `インスタンス: ${data.instanceId}${data.worktreePath ? `\nWorktree: ${data.worktreePath}` : ''}`,
      });
      setIsStartingChildCC(false);
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });
  };

  const handleStartParentCC = async () => {
    if (!project) {
      toast({
        title: 'エラー',
        description: 'プロジェクトが利用できません',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      setIsStartingCC(true);
      setClaudeStarted(false); // Reset Claude started flag
      
      // 新しいSocket接続を強制的に作成
      if (socket) {
        socket.disconnect();
      }
      
      const newSocket = io('http://localhost:3001');
      setSocket(newSocket);
      
      // イベントハンドラーを設定
      setupSocketEvents(newSocket);
      
      // 接続完了を待つ
      await new Promise<void>((resolve, reject) => {
        const onConnect = () => {
          console.log('Socket connected successfully');
          resolve();
        };
        const onConnectError = (error: any) => {
          console.error('Socket connection error:', error);
          reject(error);
        };
        
        newSocket.on('connect', onConnect);
        newSocket.on('connect_error', onConnectError);
        
        // タイムアウト
        setTimeout(() => {
          newSocket.off('connect', onConnect);
          newSocket.off('connect_error', onConnectError);
          reject(new Error('Socket connection timeout'));
        }, 5000);
      });
      
      // CCデータを準備
      const ccData = {
        instanceId: `cc-${Date.now()}`,
        projectId: project.id,
        workdir: project.workdir,
        options: {
          cols: 120,
          rows: 30
        }
      };
      
      console.log('=== FRONTEND SENDING ===');
      console.log('Socket ID:', newSocket.id);
      console.log('Socket connected:', newSocket.connected);
      console.log('CC Data object:', ccData);
      console.log('CC Data JSON:', JSON.stringify(ccData, null, 2));
      
      // Socket.IOでデータを送信
      console.log('Emitting cc:create-parent event...');
      newSocket.emit('cc:create-parent', ccData);
      console.log('Event emitted successfully');
      
      toast({
        title: '親CC起動中...',
        description: 'ターミナルでClaude Codeを起動しています',
      });
      
    } catch (error) {
      console.error('CC startup error:', error);
      toast({
        title: 'エラー',
        description: error instanceof Error ? error.message : '親CCの起動に失敗しました',
        variant: 'destructive',
      });
    } finally {
      setIsStartingCC(false);
    }
  };

  const handleStartChildCC = async () => {
    if (!project || !parentCC) {
      toast({
        title: 'エラー',
        description: '親CCが起動していません',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsStartingChildCC(true);

      try {
        // Fetch available tasks from the project
        const response = await fetch(`/api/projects/${project.id}/tasks`);
        const tasks = await response.json();
        
        if (!tasks || tasks.length === 0) {
          toast({
            title: 'タスクがありません',
            description: 'このプロジェクトには実行可能なタスクがありません',
            variant: 'destructive',
          });
          return;
        }

        // Select the first pending task
        const availableTask = tasks.find((task: any) => task.status === 'pending');
        if (!availableTask) {
          toast({
            title: '実行可能なタスクがありません',
            description: '全てのタスクが完了または実行中です',
            variant: 'destructive',
          });
          return;
        }

        // Use existing socket or create new one
        let currentSocket = socket;
        if (!currentSocket || !currentSocket.connected) {
          currentSocket = io('http://localhost:3001');
          setSocket(currentSocket);
          setupSocketEvents(currentSocket);
          
          await new Promise<void>((resolve, reject) => {
            const onConnect = () => resolve();
            const onConnectError = (error: any) => reject(error);
            
            currentSocket.on('connect', onConnect);
            currentSocket.on('connect_error', onConnectError);
            
            setTimeout(() => {
              currentSocket.off('connect', onConnect);
              currentSocket.off('connect_error', onConnectError);
              reject(new Error('Socket connection timeout'));
            }, 5000);
          });
        }

        const childCCData = {
          parentInstanceId: parentCC.id,
          taskId: availableTask.id,
          instruction: availableTask.instruction || `タスク「${availableTask.name}」を実行してください。`,
        };

        console.log('Starting child CC with task:', availableTask.name);
      } catch (fetchError) {
        console.error('Failed to fetch tasks:', fetchError);
        
        // Fallback to demo task
        const sampleInstruction = `以下のタスクを実行してください：

プロジェクト「${project.name}」の機能改善を行ってください。
- コードの品質向上
- パフォーマンスの最適化  
- ユーザビリティの改善

worktreeで独立した環境で作業を行い、完了後は結果を報告してください。`;

        // Use existing socket or create new one
        let currentSocket = socket;
        if (!currentSocket || !currentSocket.connected) {
          currentSocket = io('http://localhost:3001');
          setSocket(currentSocket);
          setupSocketEvents(currentSocket);
          
          await new Promise<void>((resolve, reject) => {
            const onConnect = () => resolve();
            const onConnectError = (error: any) => reject(error);
            
            currentSocket.on('connect', onConnect);
            currentSocket.on('connect_error', onConnectError);
            
            setTimeout(() => {
              currentSocket.off('connect', onConnect);
              currentSocket.off('connect_error', onConnectError);
              reject(new Error('Socket connection timeout'));
            }, 5000);
          });
        }

        const childCCData = {
          parentInstanceId: parentCC.id,
          taskId: `demo-task-${Date.now()}`, // Demo task ID
          instruction: sampleInstruction,
        };
      }

      console.log('Starting child CC with data:', childCCData);
      currentSocket.emit('cc:create-child', childCCData);

      toast({
        title: '子CC起動中...',
        description: '新しいworktreeで子Claude Codeを起動しています',
      });

    } catch (error) {
      console.error('Child CC startup error:', error);
      toast({
        title: 'エラー',
        description: error instanceof Error ? error.message : '子CCの起動に失敗しました',
        variant: 'destructive',
      });
    } finally {
      setIsStartingChildCC(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">プロジェクトを読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-semibold text-destructive">エラーが発生しました</h2>
          <p className="text-muted-foreground">
            {error instanceof Error ? error.message : 'プロジェクトが見つかりません'}
          </p>
          <Button onClick={() => router.push('/dashboard')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            ダッシュボードに戻る
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/dashboard')}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                戻る
              </Button>
              <div className="border-l pl-4">
                <h1 className="text-xl font-bold">{project.name}</h1>
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <FolderOpen className="h-3 w-3" />
                  {project.workdir}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setIsUploadOpen(true)}
              >
                <Upload className="h-4 w-4 mr-2" />
                タスク定義をアップロード
              </Button>
              {!parentCC && (
                <Button
                  onClick={handleStartParentCC}
                  disabled={isStartingCC}
                >
                  <Play className="h-4 w-4 mr-2" />
                  {isStartingCC ? '起動中...' : '親CCを起動'}
                </Button>
              )}
              {parentCC && (
                <Button
                  onClick={handleStartChildCC}
                  disabled={isStartingChildCC}
                  variant="outline"
                >
                  <Users className="h-4 w-4 mr-2" />
                  {isStartingChildCC ? '起動中...' : '子CCを起動'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-6">
        <Tabs defaultValue="terminal" className="h-full">
          <div className="flex items-center justify-between mb-4">
            <TabsList>
              <TabsTrigger value="terminal">ターミナル</TabsTrigger>
              <TabsTrigger value="overview">概要</TabsTrigger>
            </TabsList>
            
            {/* Quick Stats */}
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <ListTodo className="h-4 w-4 text-muted-foreground" />
                <span>{tasks?.length || 0} タスク</span>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span>0 要件</span>
              </div>
            </div>
          </div>

          <TabsContent value="terminal" className="flex-1">
            <TerminalTabs projectId={project.id} parentSocket={socket} />
          </TabsContent>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Project Info */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">プロジェクト情報</h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">ステータス:</span>
                    <span className="ml-2 capitalize">{project.status}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">作成日:</span>
                    <span className="ml-2">
                      {new Date(project.createdAt).toLocaleDateString('ja-JP')}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">更新日:</span>
                    <span className="ml-2">
                      {new Date(project.updatedAt).toLocaleDateString('ja-JP')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-4 md:col-span-2">
                <h3 className="text-lg font-semibold">説明</h3>
                <p className="text-sm text-muted-foreground">
                  {project.description || 'プロジェクトの説明はありません'}
                </p>
              </div>
            </div>

            {/* Tasks Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">タスク</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsUploadOpen(true)}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  タスク定義をアップロード
                </Button>
              </div>
              {tasksLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : !tasks || tasks.length === 0 ? (
                <div className="text-center py-8 border rounded-lg">
                  <ListTodo className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">タスクがまだ登録されていません</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    YAMLファイルをアップロードしてタスクを登録してください
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {tasks.map((task: any) => (
                    <div key={task.id} className="border rounded-lg p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">{task.name}</h4>
                        <div className="flex items-center gap-2">
                          <Badge variant={
                            task.status === 'completed' ? 'success' :
                            task.status === 'running' ? 'default' :
                            task.status === 'failed' ? 'destructive' :
                            'secondary'
                          }>
                            {task.status}
                          </Badge>
                          <Badge variant="warning">
                            優先度: {task.priority}
                          </Badge>
                        </div>
                      </div>
                      {task.description && (
                        <p className="text-sm text-muted-foreground">{task.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>タイプ: {task.taskType}</span>
                        <span>作成: {new Date(task.createdAt).toLocaleDateString('ja-JP')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Task Upload Dialog */}
      <TaskUploadDialog
        open={isUploadOpen}
        onOpenChange={setIsUploadOpen}
        projectId={project.id}
      />
    </div>
  );
}