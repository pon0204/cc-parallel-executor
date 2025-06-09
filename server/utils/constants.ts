/**
 * アプリケーション全体で使用される定数とEnum
 */

// タスクステータス
export const TaskStatus = {
  PENDING: 'PENDING',
  QUEUED: 'QUEUED', 
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const;

export type TaskStatusType = typeof TaskStatus[keyof typeof TaskStatus];

// CCインスタンスのタイプ
export const CCInstanceType = {
  PARENT: 'PARENT',
  CHILD: 'CHILD',
} as const;

export type CCInstanceTypeType = typeof CCInstanceType[keyof typeof CCInstanceType];

// CCインスタンスのステータス
export const CCInstanceStatus = {
  IDLE: 'IDLE',
  RUNNING: 'RUNNING', 
  STOPPED: 'STOPPED',
  ERROR: 'ERROR',
} as const;

export type CCInstanceStatusType = typeof CCInstanceStatus[keyof typeof CCInstanceStatus];

// タスクタイプ（依存関係分析で使用）
export const TaskType = {
  SETUP: 'setup',
  DATABASE: 'database',
  BACKEND: 'backend',
  FRONTEND: 'frontend',
  TEST: 'test',
  DEPLOY: 'deploy',
  GENERAL: 'general',
} as const;

export type TaskTypeType = typeof TaskType[keyof typeof TaskType];

// 要件タイプ
export const RequirementType = {
  FUNCTIONAL: 'functional',
  NON_FUNCTIONAL: 'non_functional',
  BUSINESS: 'business',
  TECHNICAL: 'technical',
  UI_UX: 'ui_ux',
} as const;

export type RequirementTypeType = typeof RequirementType[keyof typeof RequirementType];

// 要件ステータス
export const RequirementStatus = {
  DRAFT: 'draft',
  REVIEW: 'review',
  APPROVED: 'approved',
  IMPLEMENTED: 'implemented',
  REJECTED: 'rejected',
} as const;

export type RequirementStatusType = typeof RequirementStatus[keyof typeof RequirementStatus];

// プロジェクトステータス
export const ProjectStatus = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  ARCHIVED: 'archived',
} as const;

export type ProjectStatusType = typeof ProjectStatus[keyof typeof ProjectStatus];

// 依存関係タイプ
export const DependencyType = {
  DEPENDS_ON: 'depends_on',
  BLOCKS: 'blocks',
  RELATES_TO: 'relates_to',
} as const;

export type DependencyTypeType = typeof DependencyType[keyof typeof DependencyType];

// ログレベル
export const LogLevel = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
} as const;

export type LogLevelType = typeof LogLevel[keyof typeof LogLevel];

// 実行フェーズステータス
export const ExecutionPhaseStatus = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export type ExecutionPhaseStatusType = typeof ExecutionPhaseStatus[keyof typeof ExecutionPhaseStatus];

// デフォルト設定値
export const DEFAULT_CONFIG = {
  // ポート設定
  PORTS: {
    NEXT: 8080,
    PROJECT_SERVER: 8081,
    MCP_SERVER: 8082,
  },
  
  // 並列実行設定
  PARALLEL_EXECUTION: {
    MAX_PARALLEL_CC: 5,
    DEFAULT_TIMEOUT_SECONDS: 300,
    SESSION_TIMEOUT_SECONDS: 3600,
  },
  
  // タスク設定
  TASK: {
    DEFAULT_PRIORITY: 5,
    MIN_PRIORITY: 1,
    MAX_PRIORITY: 10,
  },
  
  // Git Worktree設定
  GIT: {
    WORKTREE_BASE_PATH: './worktrees',
    DEFAULT_BRANCH: 'main',
  },
  
  // ログ設定
  LOGGING: {
    DEFAULT_LEVEL: 'info',
    DEFAULT_DIR: './logs',
    MAX_FILE_SIZE: '20m',
    MAX_FILES: '14d',
  },
} as const;

// HTTPステータスコード（よく使うもの）
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
} as const;

// WebSocketイベント名
export const SOCKET_EVENTS = {
  // ターミナル関連
  CREATE_SESSION: 'create-session',
  INPUT: 'input',
  OUTPUT: 'output',
  RESIZE: 'resize',
  TERMINATE: 'terminate',
  
  // CC関連
  CC_CREATE_PARENT: 'cc:create-parent',
  CC_CREATE_CHILD: 'cc:create-child',
  CC_PARENT_READY: 'cc:parent-ready',
  CC_CHILD_STATUS: 'cc:child-status',
  CC_ERROR: 'cc:error',
  
  // ultrathink関連
  ULTRATHINK_SEND: 'ultrathink:send',
  ULTRATHINK_RESPONSE: 'ultrathink:response',
  
  // 一般
  CONNECT: 'connection',
  DISCONNECT: 'disconnect',
  ERROR: 'error',
} as const;

// 型安全なステータス検証関数
export function isValidTaskStatus(status: string): status is TaskStatusType {
  return Object.values(TaskStatus).includes(status as TaskStatusType);
}

export function isValidCCInstanceStatus(status: string): status is CCInstanceStatusType {
  return Object.values(CCInstanceStatus).includes(status as CCInstanceStatusType);
}

export function isValidTaskType(type: string): type is TaskTypeType {
  return Object.values(TaskType).includes(type as TaskTypeType);
}

// 便利な配列形式の定数
export const TASK_STATUS_ARRAY = Object.values(TaskStatus);
export const CC_INSTANCE_STATUS_ARRAY = Object.values(CCInstanceStatus);
export const TASK_TYPE_ARRAY = Object.values(TaskType);
export const REQUIREMENT_TYPE_ARRAY = Object.values(RequirementType);

// タスクタイプごとの優先順位（依存関係分析用）
export const TASK_TYPE_PRIORITY = {
  [TaskType.SETUP]: 1,
  [TaskType.DATABASE]: 2,
  [TaskType.BACKEND]: 3,
  [TaskType.FRONTEND]: 3,
  [TaskType.TEST]: 4,
  [TaskType.DEPLOY]: 5,
  [TaskType.GENERAL]: 3,
} as const;