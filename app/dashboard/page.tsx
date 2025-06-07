'use client';

import { useEffect } from 'react';
import { Plus, FolderOpen, Activity, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useProjects } from '@/lib/hooks/useProjects';
import { ProjectCard } from '@/components/dashboard/project-card';
import { CreateProjectDialog } from '@/components/dashboard/create-project-dialog';
import { useState } from 'react';

export default function DashboardPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { data: projects, isLoading, error } = useProjects();

  const filteredProjects = projects?.filter((project) =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    project.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-semibold text-destructive">エラーが発生しました</h2>
          <p className="text-muted-foreground">{error instanceof Error ? error.message : '不明なエラー'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">CC Parallel Execution System</h1>
              <p className="text-muted-foreground">プロジェクトを選択してClaude Codeを起動</p>
            </div>
            <div className="flex items-center gap-4">
              <Activity className="h-5 w-5 text-green-500" />
              <span className="text-sm text-muted-foreground">
                アクティブ: {projects?.filter(p => p.status === 'active').length || 0}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Actions Bar */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4 flex-1 max-w-md">
            <Input
              placeholder="プロジェクトを検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
          </div>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            新規プロジェクト
          </Button>
        </div>

        {/* Projects Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 bg-secondary/20 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filteredProjects?.length === 0 ? (
          <div className="text-center py-16 space-y-4">
            <FolderOpen className="h-16 w-16 text-muted-foreground mx-auto" />
            <h3 className="text-xl font-semibold">プロジェクトがありません</h3>
            <p className="text-muted-foreground">
              {searchQuery ? '検索条件に一致するプロジェクトが見つかりません' : '新規プロジェクトを作成してください'}
            </p>
            {!searchQuery && (
              <Button onClick={() => setIsCreateOpen(true)} className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                最初のプロジェクトを作成
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects?.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}

        {/* Stats */}
        {projects && projects.length > 0 && (
          <div className="mt-12 border-t pt-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold">{projects.length}</div>
                <div className="text-sm text-muted-foreground">総プロジェクト数</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-500">
                  {projects.filter(p => p.status === 'active').length}
                </div>
                <div className="text-sm text-muted-foreground">アクティブ</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-500">
                  {projects.reduce((sum, p) => sum + (p._count?.tasks || 0), 0)}
                </div>
                <div className="text-sm text-muted-foreground">総タスク数</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-500">
                  {projects.reduce((sum, p) => sum + (p._count?.requirements || 0), 0)}
                </div>
                <div className="text-sm text-muted-foreground">総要件数</div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Create Project Dialog */}
      <CreateProjectDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
    </div>
  );
}