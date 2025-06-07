export interface Task {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  status: 'pending' | 'queued' | 'running' | 'completed' | 'failed';
  priority: number;
  taskType: string;
  instruction?: string;
  worktreePath?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChildCCOptions {
  parentInstanceId: string;
  taskId: string;
  instruction: string;
  projectWorkdir: string;
  worktreeName?: string;
}

export interface ChildCCResult {
  instanceId: string;
  worktreePath: string;
  status: 'created' | 'failed';
  message: string;
}

export interface CCInstance {
  id: string;
  name: string;
  type: 'parent' | 'child';
  status: 'idle' | 'running' | 'stopped' | 'error';
  worktreePath?: string;
  parentInstanceId?: string;
  processId?: string;
  createdAt: string;
  lastHeartbeat?: string;
}