import type { CCInstance, Project, Task } from '@/lib/api/client';
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface ProjectState {
  // Current project
  currentProject: Project | null;
  setCurrentProject: (project: Project | null) => void;

  // Projects list
  projects: Project[];
  setProjects: (projects: Project[]) => void;
  addProject: (project: Project) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  removeProject: (id: string) => void;

  // Tasks
  tasks: Task[];
  setTasks: (tasks: Task[]) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;

  // CC instances
  ccInstances: CCInstance[];
  setCCInstances: (instances: CCInstance[]) => void;
  addCCInstance: (instance: CCInstance) => void;
  updateCCInstance: (id: string, updates: Partial<CCInstance>) => void;
  removeCCInstance: (id: string) => void;

  // Parent CC
  parentCC: CCInstance | null;
  setParentCC: (instance: CCInstance | null) => void;

  // Child CCs
  childCCs: CCInstance[];
  addChildCC: (instance: CCInstance) => void;
  removeChildCC: (id: string) => void;

  // Clear all
  clearAll: () => void;
}

export const useProjectStore = create<ProjectState>()(
  devtools(
    persist(
      (set) => ({
        // Current project
        currentProject: null,
        setCurrentProject: (project) => set({ currentProject: project }),

        // Projects list
        projects: [],
        setProjects: (projects) => set({ projects }),
        addProject: (project) => set((state) => ({ projects: [...state.projects, project] })),
        updateProject: (id, updates) =>
          set((state) => ({
            projects: state.projects.map((p) => (p.id === id ? { ...p, ...updates } : p)),
            currentProject:
              state.currentProject?.id === id
                ? { ...state.currentProject, ...updates }
                : state.currentProject,
          })),
        removeProject: (id) =>
          set((state) => ({
            projects: state.projects.filter((p) => p.id !== id),
            currentProject: state.currentProject?.id === id ? null : state.currentProject,
          })),

        // Tasks
        tasks: [],
        setTasks: (tasks) => set({ tasks }),
        updateTask: (id, updates) =>
          set((state) => ({
            tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
          })),

        // CC instances
        ccInstances: [],
        setCCInstances: (instances) => set({ ccInstances: instances }),
        addCCInstance: (instance) =>
          set((state) => ({ ccInstances: [...state.ccInstances, instance] })),
        updateCCInstance: (id, updates) =>
          set((state) => ({
            ccInstances: state.ccInstances.map((i) => (i.id === id ? { ...i, ...updates } : i)),
          })),
        removeCCInstance: (id) =>
          set((state) => ({
            ccInstances: state.ccInstances.filter((i) => i.id !== id),
          })),

        // Parent CC
        parentCC: null,
        setParentCC: (instance) => set({ parentCC: instance }),

        // Child CCs
        childCCs: [],
        addChildCC: (instance) => set((state) => ({ childCCs: [...state.childCCs, instance] })),
        removeChildCC: (id) =>
          set((state) => ({
            childCCs: state.childCCs.filter((i) => i.id !== id),
          })),

        // Clear all
        clearAll: () =>
          set({
            currentProject: null,
            projects: [],
            tasks: [],
            ccInstances: [],
            parentCC: null,
            childCCs: [],
          }),
      }),
      {
        name: 'project-store',
        partialize: (state) => ({
          currentProject: state.currentProject,
          // Don't persist other data as it should be fresh from API
        }),
      }
    )
  )
);
