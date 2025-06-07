'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FolderOpen, Clock, ListTodo, FileText, GitBranch, ChevronRight } from 'lucide-react';
import type { Project } from '@/lib/api/client';

interface ProjectCardProps {
  project: Project;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const statusColor = {
    active: 'bg-green-500/10 text-green-500 border-green-500/20',
    inactive: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
    completed: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  }[project.status] || 'bg-gray-500/10 text-gray-500 border-gray-500/20';

  const statusLabel = {
    active: 'アクティブ',
    inactive: '非アクティブ',
    completed: '完了',
  }[project.status] || project.status;

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
          <Badge variant="outline" className={statusColor}>
            {statusLabel}
          </Badge>
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