// Server URL configuration
export const PROJECT_SERVER_URL = process.env.PROJECT_SERVER_URL || 'http://localhost:8081';

export interface Task {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  status: 'PENDING' | 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  priority: number;
  taskType: string;
  instruction?: string;
  worktreePath?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChildCCOptions {
  projectId: string;
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
  type: 'PARENT' | 'CHILD';
  status: 'IDLE' | 'RUNNING' | 'STOPPED' | 'ERROR';
  worktreePath?: string;
  processId?: string;
  createdAt: string;
  lastHeartbeat?: string;
}
