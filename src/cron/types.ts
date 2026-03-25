// --- Schedule ---

export type CronScheduleAt = { kind: 'at'; at: string };
export type CronScheduleEvery = { kind: 'every'; everyMs: number; anchorMs?: number };
export type CronScheduleCron = { kind: 'cron'; expr: string; tz?: string };

export type CronSchedule = CronScheduleAt | CronScheduleEvery | CronScheduleCron;

// --- Active Hours ---

export type ActiveHours = {
  start: string;   // "HH:MM" (e.g., "09:30")
  end: string;     // "HH:MM" (e.g., "16:00")
  timezone?: string; // IANA timezone (default: America/New_York)
  daysOfWeek?: number[]; // 0=Sun..6=Sat (default: [1,2,3,4,5])
};

// --- Fulfillment ---

export type FulfillmentMode = 'keep' | 'once' | 'ask';

// --- Payload ---

export type CronPayload = {
  message: string;
  model?: string;
  modelProvider?: string;
};

// --- Job State ---

export type CronJobState = {
  nextRunAtMs?: number;
  lastRunAtMs?: number;
  lastRunStatus?: 'ok' | 'error' | 'suppressed';
  lastError?: string;
  lastDurationMs?: number;
  consecutiveErrors: number;
  scheduleErrorCount: number;
};

// --- Job ---

export type CronJob = {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  createdAtMs: number;
  updatedAtMs: number;
  schedule: CronSchedule;
  payload: CronPayload;
  fulfillment: FulfillmentMode;
  activeHours?: ActiveHours;
  state: CronJobState;
};

// --- Store ---

export type CronStore = {
  version: 1;
  jobs: CronJob[];
};
