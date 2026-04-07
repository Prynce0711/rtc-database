import "server-only";

import type { BackupIntervalKey } from "./constants";

export type BackupScheduleTimers = Partial<
  Record<BackupIntervalKey, ReturnType<typeof setTimeout>>
>;

export type BackupIntervalTargets = Partial<Record<BackupIntervalKey, string>>;

export function clearScheduleTimer(
  scheduleTimers: BackupScheduleTimers,
  intervalKey: BackupIntervalKey,
): void {
  const timer = scheduleTimers[intervalKey];
  if (!timer) {
    return;
  }

  clearTimeout(timer);
  delete scheduleTimers[intervalKey];
}

export function clearAllScheduleTimers(
  scheduleTimers: BackupScheduleTimers,
  intervalKeys: BackupIntervalKey[],
): void {
  for (const intervalKey of intervalKeys) {
    clearScheduleTimer(scheduleTimers, intervalKey);
  }
}

export function clearIntervalScheduleState(
  scheduleTimers: BackupScheduleTimers,
  intervalTargets: BackupIntervalTargets,
  intervalKey: BackupIntervalKey,
): void {
  clearScheduleTimer(scheduleTimers, intervalKey);
  delete intervalTargets[intervalKey];
}

export function scheduleIntervalTimer(
  scheduleTimers: BackupScheduleTimers,
  intervalKey: BackupIntervalKey,
  targetDate: Date,
  maxTimerMs: number,
  onRunInterval: (intervalKey: BackupIntervalKey) => void,
): void {
  clearScheduleTimer(scheduleTimers, intervalKey);

  const remainingMs = targetDate.getTime() - Date.now();
  if (remainingMs <= 1000) {
    scheduleTimers[intervalKey] = setTimeout(() => {
      onRunInterval(intervalKey);
    }, 1000);
    return;
  }

  if (remainingMs > maxTimerMs) {
    scheduleTimers[intervalKey] = setTimeout(() => {
      scheduleIntervalTimer(
        scheduleTimers,
        intervalKey,
        targetDate,
        maxTimerMs,
        onRunInterval,
      );
    }, maxTimerMs);
    return;
  }

  scheduleTimers[intervalKey] = setTimeout(() => {
    onRunInterval(intervalKey);
  }, remainingMs);
}

export function scheduleNextIntervalRun(
  scheduleTimers: BackupScheduleTimers,
  intervalTargets: BackupIntervalTargets,
  intervalKey: BackupIntervalKey,
  addIntervalToDate: (base: Date, intervalKey: BackupIntervalKey) => Date,
  maxTimerMs: number,
  onRunInterval: (intervalKey: BackupIntervalKey) => void,
  fromDate: Date = new Date(),
): void {
  const nextTarget = addIntervalToDate(fromDate, intervalKey);
  intervalTargets[intervalKey] = nextTarget.toISOString();
  scheduleIntervalTimer(
    scheduleTimers,
    intervalKey,
    nextTarget,
    maxTimerMs,
    onRunInterval,
  );
}

export function ensureIntervalScheduled(
  scheduleTimers: BackupScheduleTimers,
  intervalTargets: BackupIntervalTargets,
  intervalKey: BackupIntervalKey,
  addIntervalToDate: (base: Date, intervalKey: BackupIntervalKey) => Date,
  maxTimerMs: number,
  onRunInterval: (intervalKey: BackupIntervalKey) => void,
): void {
  const targetIso = intervalTargets[intervalKey];

  if (!targetIso) {
    scheduleNextIntervalRun(
      scheduleTimers,
      intervalTargets,
      intervalKey,
      addIntervalToDate,
      maxTimerMs,
      onRunInterval,
    );
    return;
  }

  const targetDate = new Date(targetIso);
  if (
    Number.isNaN(targetDate.getTime()) ||
    targetDate.getTime() <= Date.now()
  ) {
    scheduleNextIntervalRun(
      scheduleTimers,
      intervalTargets,
      intervalKey,
      addIntervalToDate,
      maxTimerMs,
      onRunInterval,
    );
    return;
  }

  if (!scheduleTimers[intervalKey]) {
    scheduleIntervalTimer(
      scheduleTimers,
      intervalKey,
      targetDate,
      maxTimerMs,
      onRunInterval,
    );
  }
}
