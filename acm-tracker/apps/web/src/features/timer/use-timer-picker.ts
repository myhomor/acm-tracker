import { create } from "zustand";

interface TimerPickerState {
  open: boolean;
  openPicker: () => void;
  close: () => void;
}

export const useTimerPicker = create<TimerPickerState>((set) => ({
  open: false,
  openPicker: () => set({ open: true }),
  close: () => set({ open: false }),
}));
