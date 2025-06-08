'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { Task } from '@/lib/api/client';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';
import {
  AlertCircle,
  Bot,
  CheckCircle,
  Clock,
  ListTodo,
  Pencil,
  PlayCircle,
  StopCircle,
  Trash2,
  XCircle,
} from 'lucide-react';

interface TaskCardProps {
  task: Task;
  onEdit?: (task: Task) => void;
  onDelete?: (taskId: string) => void;
  onStatusChange?: (taskId: string, status: string) => void;
  onExecute?: (taskId: string) => void;
}

export function TaskCard({ task, onEdit, onDelete, onStatusChange, onExecute }: TaskCardProps) {
  const priorityColor =
    {
      1: 'bg-red-500/10 text-red-500 border-red-500/20',
      2: 'bg-red-500/10 text-red-500 border-red-500/20',
      3: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
      4: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
      5: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
      6: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
      7: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      8: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      9: 'bg-green-500/10 text-green-500 border-green-500/20',
      10: 'bg-green-500/10 text-green-500 border-green-500/20',
    }[task.priority] || 'bg-gray-500/10 text-gray-500 border-gray-500/20';

  const statusColor =
    {
      PENDING: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
      QUEUED: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
      RUNNING: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      COMPLETED: 'bg-green-500/10 text-green-500 border-green-500/20',
      FAILED: 'bg-red-500/10 text-red-500 border-red-500/20',
      pending: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
      queued: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
      running: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      completed: 'bg-green-500/10 text-green-500 border-green-500/20',
      failed: 'bg-red-500/10 text-red-500 border-red-500/20',
    }[task.status] || 'bg-gray-500/10 text-gray-500 border-gray-500/20';

  const statusLabel =
    {
      PENDING: '待機中',
      QUEUED: 'キュー中',
      RUNNING: '実行中',
      COMPLETED: '完了',
      FAILED: '失敗',
      pending: '待機中',
      queued: 'キュー中',
      running: '実行中',
      completed: '完了',
      failed: '失敗',
    }[task.status] || task.status;

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return <Clock className="h-3 w-3" />;
      case 'queued':
        return <ListTodo className="h-3 w-3" />;
      case 'running':
        return <PlayCircle className="h-3 w-3" />;
      case 'completed':
        return <CheckCircle className="h-3 w-3" />;
      case 'failed':
        return <XCircle className="h-3 w-3" />;
      default:
        return <Clock className="h-3 w-3" />;
    }
  };

  const canStart = ['pending', 'PENDING'].includes(task.status);
  const canStop = ['running', 'RUNNING', 'queued', 'QUEUED'].includes(task.status);
  const canComplete = ['running', 'RUNNING'].includes(task.status);
  const canExecute = ['pending', 'PENDING'].includes(task.status) && task.instruction;

  return (
    <Card className="hover:shadow-lg transition-all duration-200 group">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-2">
            <CardTitle className="text-lg group-hover:text-primary transition-colors">
              {task.name}
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={statusColor}>
                {getStatusIcon(task.status)}
                <span className="ml-1">{statusLabel}</span>
              </Badge>
              <Badge variant="outline">{task.taskType || 'general'}</Badge>
              <Badge variant="outline" className={priorityColor}>
                <AlertCircle className="h-3 w-3 mr-1" />P{task.priority}
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {task.description && (
          <CardDescription className="line-clamp-3 mb-4">{task.description}</CardDescription>
        )}

        {task.instruction && (
          <div className="bg-muted/50 rounded-md p-3 mb-4">
            <p className="text-sm font-medium mb-1">実行指示:</p>
            <p className="text-sm text-muted-foreground line-clamp-2">{task.instruction}</p>
          </div>
        )}

        {/* Duration info */}
        {task.estimatedDurationMinutes && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <Clock className="h-3 w-3" />
            <span>予想時間: {task.estimatedDurationMinutes}分</span>
          </div>
        )}

        {/* Last updated */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>
            {formatDistanceToNow(new Date(task.updatedAt), {
              addSuffix: true,
              locale: ja,
            })}
          </span>
        </div>
      </CardContent>

      <CardFooter className="gap-2">
        <div className="flex gap-2 flex-wrap flex-1">
          {/* Execute with Child CC button */}
          {onExecute && canExecute && (
            <Button
              variant="default"
              size="sm"
              onClick={() => onExecute(task.id)}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              <Bot className="h-4 w-4 mr-1" />
              子CC実行
            </Button>
          )}

          {/* Status change buttons */}
          {onStatusChange && canStart && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onStatusChange(task.id, 'running')}
              className="text-blue-600 hover:text-blue-600"
            >
              <PlayCircle className="h-4 w-4 mr-1" />
              開始
            </Button>
          )}
          {onStatusChange && canComplete && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onStatusChange(task.id, 'completed')}
              className="text-green-600 hover:text-green-600"
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              完了
            </Button>
          )}
          {onStatusChange && canStop && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onStatusChange(task.id, 'pending')}
              className="text-orange-600 hover:text-orange-600"
            >
              <StopCircle className="h-4 w-4 mr-1" />
              停止
            </Button>
          )}
        </div>

        <div className="flex gap-2">
          {onEdit && (
            <Button variant="outline" size="sm" onClick={() => onEdit(task)}>
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDelete(task.id)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
