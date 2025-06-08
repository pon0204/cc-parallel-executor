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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { Project } from '@/lib/api/client';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';
import {
  ChevronRight,
  Clock,
  FileText,
  FolderOpen,
  GitBranch,
  ListTodo,
  MoreVertical,
  Settings,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

interface ProjectCardProps {
  project: Project;
  onDelete?: (projectId: string, force?: boolean) => void;
}

export function ProjectCard({ project, onDelete }: ProjectCardProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [forceDelete, setForceDelete] = useState(false);

  const statusColor =
    {
      active: 'bg-green-500/10 text-green-500 border-green-500/20',
      inactive: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
      completed: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    }[project.status] || 'bg-gray-500/10 text-gray-500 border-gray-500/20';

  const statusLabel =
    {
      active: 'アクティブ',
      inactive: '非アクティブ',
      completed: '完了',
    }[project.status] || project.status;

  const hasData =
    (project._count?.tasks || 0) +
      (project._count?.requirements || 0) +
      (project._count?.features || 0) >
    0;

  const handleDelete = () => {
    if (onDelete) {
      onDelete(project.id, forceDelete);
      setDeleteDialogOpen(false);
      setForceDelete(false);
    }
  };

  return (
    <Card className="hover:shadow-lg transition-all duration-200 group">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-xl group-hover:text-primary transition-colors">
              {project.name}
            </CardTitle>
            <CardDescription className="mt-2 line-clamp-2">
              {project.description || 'プロジェクトの説明はありません'}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={statusColor}>
              {statusLabel}
            </Badge>
            {onDelete && (
              <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Trash2 className="h-5 w-5 text-destructive" />
                      プロジェクトを削除
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      <strong>{project.name}</strong> を削除しようとしています。
                    </p>

                    {hasData && (
                      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                        <div className="flex items-start gap-2">
                          <div className="text-yellow-500">⚠️</div>
                          <div className="text-sm">
                            <p className="font-medium text-yellow-700 dark:text-yellow-300">
                              このプロジェクトには以下のデータが含まれています：
                            </p>
                            <ul className="mt-2 space-y-1 text-yellow-600 dark:text-yellow-400">
                              {(project._count?.tasks || 0) > 0 && (
                                <li>• {project._count.tasks} 個のタスク</li>
                              )}
                              {(project._count?.requirements || 0) > 0 && (
                                <li>• {project._count.requirements} 個の要件</li>
                              )}
                              {(project._count?.features || 0) > 0 && (
                                <li>• {project._count.features} 個の機能</li>
                              )}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <div className="text-red-500">🚨</div>
                        <div className="text-sm text-red-600 dark:text-red-400">
                          <p className="font-medium">この操作は取り消せません</p>
                          <p className="mt-1">
                            プロジェクトとすべての関連データが完全に削除されます。
                          </p>
                        </div>
                      </div>
                    </div>

                    {hasData && (
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="force-delete"
                          checked={forceDelete}
                          onCheckedChange={setForceDelete}
                        />
                        <label htmlFor="force-delete" className="text-sm">
                          関連データも含めて強制削除する
                        </label>
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                      キャンセル
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleDelete}
                      disabled={hasData && !forceDelete}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      削除する
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Workdir */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FolderOpen className="h-4 w-4" />
          <span className="truncate" title={project.workdir}>
            {project.workdir}
          </span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="space-y-1">
            <div className="text-2xl font-semibold">{project._count?.tasks || 0}</div>
            <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <ListTodo className="h-3 w-3" />
              タスク
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-semibold">{project._count?.requirements || 0}</div>
            <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <FileText className="h-3 w-3" />
              要件
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-semibold">{project._count?.features || 0}</div>
            <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <GitBranch className="h-3 w-3" />
              機能
            </div>
          </div>
        </div>

        {/* Last updated */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>
            {formatDistanceToNow(new Date(project.updatedAt), {
              addSuffix: true,
              locale: ja,
            })}
          </span>
        </div>
      </CardContent>

      <CardFooter>
        <Button asChild className="w-full group">
          <Link href={`/dashboard/${project.id}`}>
            プロジェクトを開く
            <ChevronRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
