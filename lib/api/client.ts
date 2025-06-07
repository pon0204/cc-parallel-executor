import { z } from 'zod';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081/api';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new ApiError(
        error.error || `API request failed: ${response.statusText}`,
        response.status,
        error.details
      );
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return null as unknown as T;
    }

    return response.json();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      error instanceof Error ? error.message : 'Network error',
      0
    );
  }
}

// Project schemas
export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  workdir: z.string(),
  status: z.string(),
  configJson: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  _count: z.object({
    tasks: z.number(),
    requirements: z.number(),
    features: z.number(),
  }).optional(),
});

export type Project = z.infer<typeof ProjectSchema>;

export const CreateProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  workdir: z.string().min(1),
});

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;

// Task schemas
export const TaskSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  parentTaskId: z.string().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  status: z.enum(['pending', 'queued', 'running', 'completed', 'failed']),
  priority: z.number(),
  assignedTo: z.string().nullable(),
  taskType: z.string(),
  inputData: z.string().nullable(),
  outputData: z.string().nullable(),
  instruction: z.string().nullable(),
  worktreePath: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
});

export type Task = z.infer<typeof TaskSchema>;

// CC Instance schemas
export const CCInstanceSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['parent', 'child']),
  status: z.enum(['idle', 'running', 'stopped', 'error']),
  worktreePath: z.string().nullable(),
  parentInstanceId: z.string().nullable(),
  processId: z.string().nullable(),
  socketId: z.string().nullable(),
  createdAt: z.string(),
  lastHeartbeat: z.string().nullable(),
});

export type CCInstance = z.infer<typeof CCInstanceSchema>;

// API client
export const api = {
  // Projects
  projects: {
    list: () => fetchApi<Project[]>('/projects'),
    get: (id: string) => fetchApi<Project>(`/projects/${id}`),
    create: (data: CreateProjectInput) => 
      fetchApi<Project>('/projects', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<CreateProjectInput>) =>
      fetchApi<Project>(`/projects/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      fetchApi<void>(`/projects/${id}`, {
        method: 'DELETE',
      }),
  },

  // Tasks
  tasks: {
    listByProject: (projectId: string) => 
      fetchApi<Task[]>(`/tasks/project/${projectId}`),
    get: (id: string) => 
      fetchApi<Task>(`/tasks/${id}`),
    uploadYaml: (projectId: string, content: string) =>
      fetchApi<{ message: string; taskCount: number }>(`/tasks/upload/${projectId}`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      }),
    updateStatus: (id: string, status: Task['status']) =>
      fetchApi<Task>(`/tasks/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    getReady: (projectId: string) =>
      fetchApi<Task[]>(`/tasks/ready/${projectId}`),
  },

  // CC instances
  cc: {
    list: () => fetchApi<CCInstance[]>('/cc'),
    get: (id: string) => fetchApi<CCInstance>(`/cc/${id}`),
    createParent: (projectId: string, name?: string) =>
      fetchApi<CCInstance>('/cc/parent', {
        method: 'POST',
        body: JSON.stringify({ projectId, name }),
      }),
    createChild: (data: {
      parentInstanceId: string;
      taskId: string;
      name?: string;
    }) =>
      fetchApi<CCInstance>('/cc/child', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    updateStatus: (id: string, status: CCInstance['status']) =>
      fetchApi<CCInstance>(`/cc/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    heartbeat: (id: string) =>
      fetchApi<{ success: boolean; lastHeartbeat: string }>(`/cc/${id}/heartbeat`, {
        method: 'POST',
      }),
  },
};