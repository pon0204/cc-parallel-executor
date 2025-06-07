import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type CreateProjectInput } from '@/lib/api/client';
import { useProjectStore } from '@/lib/stores/project.store';
import { toast } from '@/components/ui/use-toast';

export function useProjects() {
  const setProjects = useProjectStore((state) => state.setProjects);

  return useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const projects = await api.projects.list();
      setProjects(projects);
      return projects;
    },
  });
}

export function useProject(id: string | null) {
  return useQuery({
    queryKey: ['project', id],
    queryFn: () => api.projects.get(id!),
    enabled: !!id,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  const addProject = useProjectStore((state) => state.addProject);

  return useMutation({
    mutationFn: (data: CreateProjectInput) => api.projects.create(data),
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      addProject(project);
      toast({
        title: 'プロジェクトを作成しました',
        description: project.name,
      });
    },
    onError: (error) => {
      toast({
        title: 'エラー',
        description: error instanceof Error ? error.message : 'プロジェクトの作成に失敗しました',
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  const updateProject = useProjectStore((state) => state.updateProject);

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateProjectInput> }) =>
      api.projects.update(id, data),
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project', project.id] });
      updateProject(project.id, project);
      toast({
        title: 'プロジェクトを更新しました',
        description: project.name,
      });
    },
    onError: (error) => {
      toast({
        title: 'エラー',
        description: error instanceof Error ? error.message : 'プロジェクトの更新に失敗しました',
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  const removeProject = useProjectStore((state) => state.removeProject);

  return useMutation({
    mutationFn: (id: string) => api.projects.delete(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      removeProject(id);
      toast({
        title: 'プロジェクトを削除しました',
      });
    },
    onError: (error) => {
      toast({
        title: 'エラー',
        description: error instanceof Error ? error.message : 'プロジェクトの削除に失敗しました',
        variant: 'destructive',
      });
    },
  });
}

export function useProjectTasks(projectId: string | null) {
  return useQuery({
    queryKey: ['project-tasks', projectId],
    queryFn: async () => {
      // Use Next.js API route, not the external API server
      const response = await fetch(`/api/projects/${projectId}/tasks`);
      if (!response.ok) {
        throw new Error('Failed to fetch tasks');
      }
      return response.json();
    },
    enabled: !!projectId,
  });
}