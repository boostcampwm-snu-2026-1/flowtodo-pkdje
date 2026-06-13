import { create } from 'zustand';
import type { CreateTaskInput, Task, UpdateTaskInput } from '@/lib/tasks';

type TasksStatus = 'idle' | 'loading' | 'ready' | 'error';

export type Toast = {
  id: string;
  message: string;
  kind: 'info' | 'error';
};

type AppState = {
  tasks: Task[];
  tasksStatus: TasksStatus;
  tasksError: string | null;
  createModalOpen: boolean;
  selectedTaskId: string | null;
  toasts: Toast[];

  fetchTasks: () => Promise<void>;
  createTask: (input: CreateTaskInput) => Promise<Task>;
  updateTask: (id: string, patch: UpdateTaskInput) => Promise<Task>;
  deleteTask: (id: string) => Promise<void>;
  openCreateModal: () => void;
  closeCreateModal: () => void;
  selectTask: (id: string | null) => void;
  showToast: (
    message: string,
    kind?: 'info' | 'error',
    durationMs?: number,
  ) => void;
  dismissToast: (id: string) => void;
};

export const useAppStore = create<AppState>((set) => ({
  tasks: [],
  tasksStatus: 'idle',
  tasksError: null,
  createModalOpen: false,
  selectedTaskId: null,
  toasts: [],

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

  updateTask: async (id, patch) => {
    const res = await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
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
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? task : t)),
    }));
    return task;
  },

  deleteTask: async (id) => {
    const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
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
    // cascade detach 결과를 클라이언트에 반영하기 위해 다시 받아온다
    await useAppStore.getState().fetchTasks();
    set({ selectedTaskId: null });
  },

  openCreateModal: () => set({ createModalOpen: true }),
  closeCreateModal: () => set({ createModalOpen: false }),
  selectTask: (id) => set({ selectedTaskId: id }),

  showToast: (message, kind = 'error', durationMs = 2400) => {
    const id = `t_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    set((state) => ({
      toasts: [...state.toasts, { id, message, kind }],
    }));
    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        useAppStore.getState().dismissToast(id);
      }, durationMs);
    }
  },
  dismissToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));
