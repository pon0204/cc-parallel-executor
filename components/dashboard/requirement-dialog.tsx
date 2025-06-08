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
import type { Requirement } from '@/lib/api/client';
import { FileText, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

interface RequirementDialogProps {
  projectId: string;
  requirement?: Requirement;
  onSave: (requirement: Partial<Requirement>) => Promise<void>;
  trigger?: ReactNode;
}

const requirementTypes = [
  { value: 'functional', label: '機能要件' },
  { value: 'non_functional', label: '非機能要件' },
  { value: 'business', label: 'ビジネス要件' },
  { value: 'technical', label: '技術要件' },
  { value: 'ui_ux', label: 'UI/UX要件' },
  { value: 'security', label: 'セキュリティ要件' },
  { value: 'performance', label: 'パフォーマンス要件' },
];

const statusOptions = [
  { value: 'draft', label: 'ドラフト' },
  { value: 'review', label: 'レビュー中' },
  { value: 'approved', label: '承認済み' },
  { value: 'implemented', label: '実装済み' },
  { value: 'rejected', label: '却下' },
];

export function RequirementDialog({
  projectId,
  requirement,
  onSave,
  trigger,
}: RequirementDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    type: 'functional',
    title: '',
    content: '',
    priority: 5,
    status: 'draft',
  });

  // Reset form when dialog opens/closes or requirement changes
  useEffect(() => {
    if (requirement) {
      setFormData({
        type: requirement.type,
        title: requirement.title,
        content: requirement.content,
        priority: requirement.priority,
        status: requirement.status,
      });
    } else {
      setFormData({
        type: 'functional',
        title: '',
        content: '',
        priority: 5,
        status: 'draft',
      });
    }
  }, [requirement, open]);

  const handleSave = async () => {
    if (!formData.title.trim() || !formData.content.trim()) {
      return;
    }

    setLoading(true);
    try {
      await onSave({
        ...formData,
        projectId: requirement ? undefined : projectId,
      });
      setOpen(false);
    } catch (error) {
      console.error('Failed to save requirement:', error);
    } finally {
      setLoading(false);
    }
  };

  const defaultTrigger = (
    <Button>
      <Plus className="h-4 w-4 mr-2" />
      要件を追加
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger || defaultTrigger}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {requirement ? '要件を編集' : '新しい要件を作成'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Type and Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">タイプ</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {requirementTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
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

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">タイトル</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="要件のタイトルを入力..."
            />
          </div>

          {/* Content */}
          <div className="space-y-2">
            <Label htmlFor="content">内容</Label>
            <Textarea
              id="content"
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder="要件の詳細な内容を入力..."
              className="min-h-[120px]"
            />
          </div>

          {/* Priority */}
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

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              キャンセル
            </Button>
            <Button
              onClick={handleSave}
              disabled={loading || !formData.title.trim() || !formData.content.trim()}
            >
              {loading ? '保存中...' : requirement ? '更新' : '作成'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
