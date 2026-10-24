export const TIMER_SESSION = Symbol("TIMER_SESSION");

export interface ActiveTimerView {
  taskId: string;
  taskCode: string;
  taskTitle: string;
  projectName: string;
  ratePerHour: number;
  startedAt: string;
}

export interface TimerSessionPort {
  findActive(memberId: string): Promise<ActiveTimerView | null>;
  create(memberId: string, taskId: string): Promise<void>;
  clear(memberId: string): Promise<number>;
  taskExists(taskId: string): Promise<boolean>;
}
