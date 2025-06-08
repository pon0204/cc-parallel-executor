'use client';

import { ActiveCCTerminals } from '@/components/dashboard/active-cc-terminals';
import { RequirementDialog } from '@/components/dashboard/requirement-dialog';
import { RequirementTable } from '@/components/dashboard/requirement-table';
import { TaskDialog } from '@/components/dashboard/task-dialog';
import { TaskTable } from '@/components/dashboard/task-table';
import { ChildCCNotification } from '@/components/notifications/child-cc-notification';
import { ChildCCStatusBadge } from '@/components/notifications/child-cc-status-badge';
import type { ClaudeState } from '@/components/notifications/child-cc-status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/use-toast';
import { type Requirement, type Task, api } from '@/lib/api/client';
import { useProject } from '@/lib/hooks/useProjects';
import { useProjectStore } from '@/lib/stores/project.store';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  FileText,
  FolderOpen,
  ListTodo,
  Plus,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import io from 'socket.io-client';
import type { Socket } from 'socket.io-client';

export default function ProjectDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const queryClient = useQueryClient();

  const { data: project, isLoading, error } = useProject(projectId);
  const setCurrentProject = useProjectStore((state) => state.setCurrentProject);
  const parentCC = useProjectStore((state) => state.parentCC);
  const setParentCC = useProjectStore((state) => state.setParentCC);
  const addChildCC = useProjectStore((state) => state.addChildCC);

  const [isStartingChildCC, setIsStartingChildCC] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [childCCStates, setChildCCStates] = useState<Record<string, ClaudeState>>({});
  const [focusedTerminalId, setFocusedTerminalId] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Task | undefined>();
  const [editingRequirement, setEditingRequirement] = useState<Requirement | undefined>();

  // Fetch tasks and requirements
  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: () => api.tasks.listByProject(projectId),
    enabled: !!projectId,
  });

  const { data: requirements, isLoading: requirementsLoading } = useQuery({
    queryKey: ['requirements', projectId],
    queryFn: () => api.requirements.listByProject(projectId),
    enabled: !!projectId,
  });

  // Mutations for tasks
  const createTaskMutation = useMutation({
    mutationFn: api.tasks.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      toast({ title: 'タスクを作成しました' });
    },
    onError: (error) => {
      toast({ title: 'エラー', description: 'タスクの作成に失敗しました', variant: 'destructive' });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Task> }) => api.tasks.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      toast({ title: 'タスクを更新しました' });
    },
    onError: (error) => {
      toast({ title: 'エラー', description: 'タスクの更新に失敗しました', variant: 'destructive' });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: api.tasks.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      toast({ title: 'タスクを削除しました' });
    },
    onError: (error) => {
      toast({ title: 'エラー', description: 'タスクの削除に失敗しました', variant: 'destructive' });
    },
  });

  const updateTaskStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.tasks.updateStatus(id, status as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      toast({ title: 'タスクステータスを更新しました' });
    },
    onError: (error) => {
      toast({
        title: 'エラー',
        description: 'ステータスの更新に失敗しました',
        variant: 'destructive',
      });
    },
  });

  // Mutations for requirements
  const createRequirementMutation = useMutation({
    mutationFn: api.requirements.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requirements', projectId] });
      toast({ title: '要件を作成しました' });
    },
    onError: (error) => {
      toast({ title: 'エラー', description: '要件の作成に失敗しました', variant: 'destructive' });
    },
  });

  const updateRequirementMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Requirement> }) =>
      api.requirements.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requirements', projectId] });
      toast({ title: '要件を更新しました' });
    },
    onError: (error) => {
      toast({ title: 'エラー', description: '要件の更新に失敗しました', variant: 'destructive' });
    },
  });

  const deleteRequirementMutation = useMutation({
    mutationFn: api.requirements.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requirements', projectId] });
      toast({ title: '要件を削除しました' });
    },
    onError: (error) => {
      toast({ title: 'エラー', description: '要件の削除に失敗しました', variant: 'destructive' });
    },
  });

  // 子CCターミナルにフォーカスを当てる関数
  const handleFocusTerminal = (instanceId: string) => {
    setFocusedTerminalId(instanceId);
  };

  useEffect(() => {
    if (project) {
      setCurrentProject(project);
    }
  }, [project, setCurrentProject]);

  // Socket.IO connection
  useEffect(() => {
    const newSocket = io(process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:8081', {
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      console.log('Socket.IO connected');
      setSocket(newSocket);
    });

    newSocket.on('disconnect', () => {
      console.log('Socket.IO disconnected');
      setSocket(null);
    });

    newSocket.on('child-cc-created', (data) => {
      console.log('Child CC created:', data);
      addChildCC(data.instance);
      setChildCCStates((prev) => ({
        ...prev,
        [data.instance.id]: { status: 'starting', lastUpdate: new Date() },
      }));

      toast({
        title: '子CCインスタンスが作成されました',
        description: `タスク: ${data.taskName}`,
      });
    });

    newSocket.on('child-cc-status', (data) => {
      console.log('Child CC status update:', data);
      setChildCCStates((prev) => ({
        ...prev,
        [data.instanceId]: {
          status: data.status,
          lastUpdate: new Date(),
          taskName: data.taskName,
          output: data.output,
        },
      }));
    });

    return () => {
      newSocket.disconnect();
    };
  }, [addChildCC]);


  // Handler functions
  const handleTaskSave = async (taskData: Partial<Task>) => {
    if (editingTask) {
      await updateTaskMutation.mutateAsync({ id: editingTask.id, data: taskData });
      setEditingTask(undefined);
    } else {
      await createTaskMutation.mutateAsync(taskData as any);
    }
  };

  const handleTaskStatusChange = async (taskId: string, status: string) => {
    await updateTaskStatusMutation.mutateAsync({ id: taskId, status });
  };

  const handleTaskExecute = async (taskId: string) => {
    const task = tasks?.find((t) => t.id === taskId);
    if (!task || !project) {
      toast({
        title: 'エラー',
        description: 'タスクが見つかりません',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsStartingChildCC(true);

      // Create child CC instance using MCP
      const instruction = `タスク: ${task.name}\n\n${task.instruction}\n\nプロジェクト: ${project.name}\n作業ディレクトリ: ${project.workdir}`;

      // This will be handled by MCP tools when available
      toast({
        title: '子CCインスタンスを起動中...',
        description: `タスク: ${task.name}`,
      });

      // Start the child CC via API
      const childInstance = await api.cc.createChild({
        projectId: project.id,
        taskId: task.id,
        instruction: instruction,
        parentInstanceId: parentCC?.id || 'default',
      });

      // Update task status to running
      await updateTaskStatusMutation.mutateAsync({ id: taskId, status: 'running' });

      toast({
        title: '子CCインスタンスが起動しました',
        description: `タスク: ${task.name}`,
      });
    } catch (error) {
      console.error('Failed to execute task with child CC:', error);
      toast({
        title: 'エラー',
        description: '子CCの起動に失敗しました',
        variant: 'destructive',
      });
    } finally {
      setIsStartingChildCC(false);
    }
  };

  const handleRequirementSave = async (requirementData: Partial<Requirement>) => {
    if (editingRequirement) {
      await updateRequirementMutation.mutateAsync({
        id: editingRequirement.id,
        data: requirementData,
      });
      setEditingRequirement(undefined);
    } else {
      await createRequirementMutation.mutateAsync(requirementData as any);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
        <h1 className="text-2xl font-bold text-destructive">プロジェクトが見つかりません</h1>
        <p className="text-muted-foreground">
          指定されたプロジェクトは存在しないか、アクセスできません。
        </p>
        <Button onClick={() => router.push('/dashboard')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          ダッシュボードに戻る
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              戻る
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{project.name}</h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FolderOpen className="h-4 w-4" />
                {project.workdir}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <ChildCCNotification />

      {/* Content */}
      <div className="flex flex-col h-[calc(100vh-80px)]">
        <Tabs defaultValue="overview" className="flex-1 flex flex-col">
          <div className="border-b px-6 py-2">
            <div className="flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="overview">概要</TabsTrigger>
                <TabsTrigger value="tasks">タスク</TabsTrigger>
                <TabsTrigger value="requirements">要件</TabsTrigger>
              </TabsList>

              {/* Quick Stats */}
              <div className="flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <ListTodo className="h-4 w-4 text-muted-foreground" />
                  <span>{tasks?.length || 0} タスク</span>
                </div>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span>{requirements?.length || 0} 要件</span>
                </div>
              </div>
            </div>
          </div>

          <TabsContent value="overview" className="p-6 space-y-6">
            {/* Active Claude Code Terminals */}
            <ActiveCCTerminals projectId={project.id} project={project} parentSocket={socket} />
          </TabsContent>

          <TabsContent value="tasks" className="p-6">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">タスク管理</h2>
                <TaskDialog
                  projectId={projectId}
                  task={editingTask}
                  onSave={handleTaskSave}
                  trigger={
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      タスクを追加
                    </Button>
                  }
                />
              </div>

              {tasksLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : !tasks || tasks.length === 0 ? (
                <div className="text-center py-12 border rounded-lg border-dashed">
                  <ListTodo className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">タスクがありません</h3>
                  <p className="text-muted-foreground mb-4">
                    新しいタスクを作成してください
                  </p>
                  <div className="flex justify-center gap-2">
                    <TaskDialog
                      projectId={projectId}
                      onSave={handleTaskSave}
                      trigger={
                        <Button>
                          <Plus className="h-4 w-4 mr-2" />
                          タスクを作成
                        </Button>
                      }
                    />
                  </div>
                </div>
              ) : (
                <TaskTable
                  tasks={tasks}
                  onEdit={(task) => setEditingTask(task)}
                  onDelete={(taskId) => deleteTaskMutation.mutate(taskId)}
                  onStatusChange={handleTaskStatusChange}
                  onExecute={handleTaskExecute}
                />
              )}
            </div>
          </TabsContent>

          <TabsContent value="requirements" className="p-6">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">要件管理</h2>
                <RequirementDialog
                  projectId={projectId}
                  requirement={editingRequirement}
                  onSave={handleRequirementSave}
                  trigger={
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      要件を追加
                    </Button>
                  }
                />
              </div>

              {requirementsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : !requirements || requirements.length === 0 ? (
                <div className="text-center py-12 border rounded-lg border-dashed">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">要件がありません</h3>
                  <p className="text-muted-foreground mb-4">
                    プロジェクトの要件を定義して管理を開始しましょう
                  </p>
                  <RequirementDialog
                    projectId={projectId}
                    onSave={handleRequirementSave}
                    trigger={
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        要件を作成
                      </Button>
                    }
                  />
                </div>
              ) : (
                <RequirementTable
                  requirements={requirements}
                  onEdit={(requirement) => setEditingRequirement(requirement)}
                  onDelete={(requirementId) => deleteRequirementMutation.mutate(requirementId)}
                />
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Child CC Status Display */}
      {Object.keys(childCCStates).length > 0 && (
        <div className="fixed bottom-4 right-4 space-y-2 z-50">
          {Object.entries(childCCStates).map(([instanceId, state]) => (
            <ChildCCStatusBadge
              key={instanceId}
              instanceId={instanceId}
              state={state}
              onFocus={() => handleFocusTerminal(instanceId)}
            />
          ))}
        </div>
      )}

      {/* Dialogs */}

      {editingTask && (
        <TaskDialog
          projectId={projectId}
          task={editingTask}
          onSave={handleTaskSave}
          open={!!editingTask}
          onOpenChange={(open) => !open && setEditingTask(undefined)}
        />
      )}

      {editingRequirement && (
        <RequirementDialog
          projectId={projectId}
          requirement={editingRequirement}
          onSave={handleRequirementSave}
          open={!!editingRequirement}
          onOpenChange={(open) => !open && setEditingRequirement(undefined)}
        />
      )}
    </div>
  );
}
