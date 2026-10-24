import { create } from "zustand";

interface TimeEntryModalState {
  open: boolean;
  presetTaskId: string | null;
  presetProjectId: string | null;
  openModal: (preset?: { taskId?: string; projectId?: string }) => void;
  close: () => void;
}

export const useTimeEntryModal = create<TimeEntryModalState>((set) => ({
  open: false,
  presetTaskId: null,
  presetProjectId: null,
  openModal: (preset) =>
    set({ open: true, presetTaskId: preset?.taskId ?? null, presetProjectId: preset?.projectId ?? null }),
  close: () => set({ open: false, presetTaskId: null, presetProjectId: null }),
}));
