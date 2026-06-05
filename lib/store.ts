import { create } from 'zustand';
import type { CreateTaskInput, Task } from '@/lib/tasks';

type TasksStatus = 'idle' | 'loading' | 'ready' | 'error';

type AppState = {
  tasks: Task[];
  tasksStatus: TasksStatus;
  tasksError: string | null;
  createModalOpen: boolean;

  fetchTasks: () => Promise<void>;
  createTask: (input: CreateTaskInput) => Promise<Task>;
  openCreateModal: () => void;
  closeCreateModal: () => void;
};

export const useAppStore = create<AppState>((set) => ({
  tasks: [],
  tasksStatus: 'idle',
  tasksError: null,
  createModalOpen: false,

  fetchTasks: async () => {
    set({ tasksStatus: 'loading', tasksError: null });
    try {
      const res = await fetch('/api/tasks');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: { tasks: Task[] } = await res.json();
      set({ tasks: data.tasks, tasksStatus: 'ready' });
    } catch (err) {
      set({
        tasksStatus: 'error',
        tasksError: err instanceof Error ? err.message : String(err),
      });
    }
  },

  createTask: async (input) => {
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      let message = `HTTP ${res.status}`;
      try {
        const body = await res.json();
        if (body?.error) message = body.error;
      } catch {
        // ignore
      }
      throw new Error(message);
    }
    const { task }: { task: Task } = await res.json();
    set((state) => ({ tasks: [...state.tasks, task] }));
    return task;
  },

  openCreateModal: () => set({ createModalOpen: true }),
  closeCreateModal: () => set({ createModalOpen: false }),
}));
