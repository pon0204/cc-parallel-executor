'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Upload, FileText, Loader2 } from 'lucide-react';
import { api } from '@/lib/api/client';
import { toast } from '@/components/ui/use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface TaskUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

export function TaskUploadDialog({ open, onOpenChange, projectId }: TaskUploadDialogProps) {
  const [yamlContent, setYamlContent] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const queryClient = useQueryClient();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setYamlContent(e.target?.result as string);
      };
      reader.readAsText(file);
    }
  };

  const handleUpload = async () => {
    if (!yamlContent.trim()) {
      toast({
        title: 'エラー',
        description: 'YAMLファイルの内容を入力してください',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsUploading(true);
      const result = await api.tasks.uploadYaml(projectId, yamlContent);
      
      toast({
        title: 'タスクをアップロードしました',
        description: `${result.taskCount}個のタスクが登録されました`,
      });

      // Refresh project data
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });

      setYamlContent('');
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'エラー',
        description: error instanceof Error ? error.message : 'タスクのアップロードに失敗しました',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>タスク定義をアップロード</DialogTitle>
          <DialogDescription>
            YAML形式のタスク定義ファイルをアップロードしてください
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>YAMLファイル</Label>
            <div className="flex items-center gap-2">
              <input
                type="file"
                accept=".yaml,.yml"
                onChange={handleFileSelect}
                className="hidden"
                id="yaml-file-input"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => document.getElementById('yaml-file-input')?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                ファイルを選択
              </Button>
              {yamlContent && (
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  ファイルが選択されました
                </span>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="yaml-content">YAML内容</Label>
            <Textarea
              id="yaml-content"
              placeholder={`project:
  id: "proj-001"
  name: "ECサイトリニューアル"

tasks:
  - id: "task-001"
    name: "ユーザー認証API実装"
    type: "development"
    priority: 10
    instruction: |
      ultrathink
      ユーザー認証APIを実装してください...`}
              value={yamlContent}
              onChange={(e) => setYamlContent(e.target.value)}
              rows={12}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              タスク定義のYAML形式については、docs/task-structure.yaml を参照してください
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setYamlContent('');
              onOpenChange(false);
            }}
            disabled={isUploading}
          >
            キャンセル
          </Button>
          <Button onClick={handleUpload} disabled={isUploading || !yamlContent.trim()}>
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                アップロード中...
              </>
            ) : (
              'アップロード'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}