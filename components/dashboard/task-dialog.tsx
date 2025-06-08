'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { Task } from '@/lib/api/client';
import { ListTodo, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';

interface TaskDialogProps {
  projectId: string;
  task?: Task;
  onSave: (task: Partial<Task>) => Promise<void>;
  trigger?: React.ReactNode;
}

const taskTypes = [
  { value: 'general', label: '一般' },
  { value: 'development', label: '開発' },
  { value: 'testing', label: 'テスト' },
  { value: 'documentation', label: 'ドキュメント' },
  { value: 'review', label: 'レビュー' },
  { value: 'deployment', label: 'デプロイ' },
  { value: 'maintenance', label: 'メンテナンス' },
  { value: 'research', label: '調査' },
];

const statusOptions = [
  { value: 'pending', label: '待機中' },
  { value: 'queued', label: 'キュー中' },
  { value: 'running', label: '実行中' },
  { value: 'completed', label: '完了' },
  { value: 'failed', label: '失敗' },
];

export function TaskDialog({ projectId, task, onSave, trigger }: TaskDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    taskType: 'general',
    priority: 5,
    status: 'pending',
    instruction: '',
    estimatedDurationMinutes: '',
    mcpEnabled: true,
    ultrathinkProtocol: true,
  });

  // Reset form when dialog opens/closes or task changes
  useEffect(() => {
    if (task) {
      setFormData({
        name: task.name,
        description: task.description || '',
        taskType: task.taskType || 'general',
        priority: task.priority,
        status: task.status.toLowerCase(),
        instruction: task.instruction || '',
        estimatedDurationMinutes: task.estimatedDurationMinutes?.toString() || '',
        mcpEnabled: task.mcpEnabled ?? true,
        ultrathinkProtocol: task.ultrathinkProtocol ?? true,
      });
    } else {
      setFormData({
        name: '',
        description: '',
        taskType: 'general',
        priority: 5,
        status: 'pending',
        instruction: '',
        estimatedDurationMinutes: '',
        mcpEnabled: true,
        ultrathinkProtocol: true,
      });
    }
  }, [task, open]);

  const handleSave = async () => {
    if (!formData.name.trim()) {
      return;
    }

    setLoading(true);
    try {
      const saveData: any = {
        ...formData,
        projectId: task ? undefined : projectId,
        estimatedDurationMinutes: formData.estimatedDurationMinutes
          ? Number.parseInt(formData.estimatedDurationMinutes)
          : undefined,
      };

      await onSave(saveData);
      setOpen(false);
    } catch (error) {
      console.error('Failed to save task:', error);
    } finally {
      setLoading(false);
    }
  };

  const defaultTrigger = (
    <Button>
      <Plus className="h-4 w-4 mr-2" />
      タスクを追加
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger || defaultTrigger}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListTodo className="h-5 w-5" />
            {task ? 'タスクを編集' : '新しいタスクを作成'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">タスク名</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="タスクの名前を入力..."
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">説明</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="タスクの説明を入力..."
              className="min-h-[80px]"
            />
          </div>

          {/* Type, Priority, Status */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="taskType">タイプ</Label>
              <Select
                value={formData.taskType}
                onValueChange={(value) => setFormData({ ...formData, taskType: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {taskTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">優先度</Label>
              <Select
                value={formData.priority.toString()}
                onValueChange={(value) =>
                  setFormData({ ...formData, priority: Number.parseInt(value) })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((priority) => (
                    <SelectItem key={priority} value={priority.toString()}>
                      {priority} - {priority <= 3 ? '高' : priority <= 7 ? '中' : '低'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">ステータス</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Instruction */}
          <div className="space-y-2">
            <Label htmlFor="instruction">実行指示</Label>
            <Textarea
              id="instruction"
              value={formData.instruction}
              onChange={(e) => setFormData({ ...formData, instruction: e.target.value })}
              placeholder="タスクの詳細な実行指示を入力..."
              className="min-h-[100px]"
            />
          </div>

          {/* Estimated Duration */}
          <div className="space-y-2">
            <Label htmlFor="estimatedDuration">予想実行時間（分）</Label>
            <Input
              id="estimatedDuration"
              type="number"
              value={formData.estimatedDurationMinutes}
              onChange={(e) =>
                setFormData({ ...formData, estimatedDurationMinutes: e.target.value })
              }
              placeholder="例: 30"
              min="1"
            />
          </div>

          {/* MCP and Ultrathink Options */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="mcpEnabled">MCP有効</Label>
              <Select
                value={formData.mcpEnabled.toString()}
                onValueChange={(value) =>
                  setFormData({ ...formData, mcpEnabled: value === 'true' })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">有効</SelectItem>
                  <SelectItem value="false">無効</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ultrathinkProtocol">Ultrathinkプロトコル</Label>
              <Select
                value={formData.ultrathinkProtocol.toString()}
                onValueChange={(value) =>
                  setFormData({ ...formData, ultrathinkProtocol: value === 'true' })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">有効</SelectItem>
                  <SelectItem value="false">無効</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleSave} disabled={loading || !formData.name.trim()}>
              {loading ? '保存中...' : task ? '更新' : '作成'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
