'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FolderOpen, Loader2 } from 'lucide-react';
import { CreateProjectSchema, type CreateProjectInput } from '@/lib/api/client';
import { useCreateProject } from '@/lib/hooks/useProjects';
import { useRouter } from 'next/navigation';

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateProjectDialog({ open, onOpenChange }: CreateProjectDialogProps) {
  const router = useRouter();
  const createProject = useCreateProject();
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CreateProjectInput>({
    resolver: zodResolver(CreateProjectSchema),
    defaultValues: {
      name: '',
      description: '',
      workdir: '',
    },
  });

  const onSubmit = async (data: CreateProjectInput) => {
    try {
      const project = await createProject.mutateAsync(data);
      reset();
      onOpenChange(false);
      router.push(`/dashboard/${project.id}`);
    } catch (error) {
      // Error is handled by the mutation hook
    }
  };

  const handleSelectFolder = () => {
    // Note: ブラウザのセキュリティ制限により、実際のフォルダ選択は制限されています
    // 実装では手動でパスを入力する必要があります
    alert('フォルダパスを直接入力してください。\n例: /Users/username/projects/my-project');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>新規プロジェクト作成</DialogTitle>
            <DialogDescription>
              Claude Codeを起動するプロジェクトを作成します
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">プロジェクト名 *</Label>
              <Input
                id="name"
                placeholder="例: ECサイト開発"
                {...register('name')}
                className={errors.name ? 'border-destructive' : ''}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="workdir">作業ディレクトリ *</Label>
              <div className="flex gap-2">
                <Input
                  id="workdir"
                  placeholder="例: /Users/username/projects/ec-site"
                  {...register('workdir')}
                  className={errors.workdir ? 'border-destructive' : ''}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleSelectFolder}
                  title="フォルダを選択"
                >
                  <FolderOpen className="h-4 w-4" />
                </Button>
              </div>
              {errors.workdir && (
                <p className="text-sm text-destructive">{errors.workdir.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Claude Codeを起動するディレクトリの絶対パスを入力
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">説明（任意）</Label>
              <Textarea
                id="description"
                placeholder="プロジェクトの概要を入力..."
                rows={3}
                {...register('description')}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                reset();
                onOpenChange(false);
              }}
              disabled={createProject.isPending}
            >
              キャンセル
            </Button>
            <Button type="submit" disabled={createProject.isPending}>
              {createProject.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  作成中...
                </>
              ) : (
                '作成'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}