"use client";

import { syncCriminalCases } from "@/app/components/Case/Criminal/CriminalCasesActions";
import {
  BATCH_SIZE,
  IPC_CHANNELS,
  type UpsertCriminalCasesPayload,
  type UpsertCriminalCasesResponse,
} from "@rtc-database/shared";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { useSession } from "../authClient";
import {
  updateLastSyncedAtForDevice,
  upsertSyncStateForDevice,
} from "./SyncActions";

type SyncProviderProps = {
  children: ReactNode;
};

type SyncContextType = {
  syncCriminalCases: () => Promise<void>;
};

const SyncContext = createContext<SyncContextType | undefined>(undefined);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const extractDeviceId = (value: unknown): string | null => {
  if (!isRecord(value) || value.success !== true) {
    return null;
  }

  if (!isRecord(value.result) || typeof value.result.deviceId !== "string") {
    return null;
  }

  return value.result.deviceId;
};

export const useSync = (): SyncContextType => {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error("useSync must be used inside SyncProvider");
  }

  return context;
};

type IpcInvokeBridge = {
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
};

const IPC_UPSERT_CHUNK_SIZE = 250;

const yieldToUiThread = async (): Promise<void> => {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
};

async function runCriminalSyncPhase(
  ipc: IpcInvokeBridge,
  phase: "full" | "catchup",
  fromUpdatedAt: Date | undefined,
  syncStart: Date,
): Promise<{ success: boolean; phaseSyncedCount: number }> {
  let cursor: { updatedAt: Date; id: number } | undefined;
  let phaseSyncedCount = 0;

  console.log("[sync-provider] Starting criminal sync phase.", {
    phase,
    batchSize: BATCH_SIZE,
    fromUpdatedAt: fromUpdatedAt?.toISOString() ?? null,
    syncStart: syncStart.toISOString(),
  });

  while (true) {
    const batchResult = await syncCriminalCases({
      syncStart,
      fromUpdatedAt,
      cursor,
    });

    if (!batchResult.success) {
      console.warn(
        "[sync-provider] Failed to fetch criminal case batch for sync:",
        batchResult.error,
      );
      return { success: false, phaseSyncedCount };
    }

    const batch = batchResult.result;
    if (batch.length === 0) {
      break;
    }

    for (
      let startIndex = 0;
      startIndex < batch.length;
      startIndex += IPC_UPSERT_CHUNK_SIZE
    ) {
      const ipcChunk = batch.slice(
        startIndex,
        startIndex + IPC_UPSERT_CHUNK_SIZE,
      );
      const casesData: UpsertCriminalCasesPayload["casesData"] = ipcChunk;

      const payload: UpsertCriminalCasesPayload = {
        source: "webserver",
        sentAt: new Date().toISOString(),
        casesData,
      };

      const response = (await ipc.invoke(
        IPC_CHANNELS.UPSERT_CRIMINAL_CASES,
        payload,
      )) as UpsertCriminalCasesResponse;

      if (!response?.success) {
        console.warn(
          "[sync-provider] Electron batch sync returned failure.",
          response?.error,
        );
        return { success: false, phaseSyncedCount };
      }

      phaseSyncedCount += response.result?.syncedCount ?? ipcChunk.length;

      const hasMoreIpcChunks =
        startIndex + IPC_UPSERT_CHUNK_SIZE < batch.length;
      if (hasMoreIpcChunks) {
        await yieldToUiThread();
      }
    }

    const last = batch[batch.length - 1];
    if (!last.criminalCase.updatedAt) {
      console.warn(
        "[sync-provider] Last synced record is missing updatedAt; stopping sync to avoid unsafe pagination.",
      );
      return { success: false, phaseSyncedCount };
    }

    cursor = {
      updatedAt: last.criminalCase.updatedAt,
      id: last.criminalCase.id,
    };

    console.log("[sync-provider] Synced criminal case batch.", {
      phase,
      batchCount: batch.length,
      phaseSyncedCount,
      cursorId: cursor.id,
      cursorUpdatedAt: cursor.updatedAt.toISOString(),
    });

    if (batch.length < BATCH_SIZE) {
      break;
    }
  }

  return { success: true, phaseSyncedCount };
}

async function syncCriminalCasesForDevice(
  ipc: IpcInvokeBridge,
  deviceId: string,
  previousLastSyncedAt: Date | null | undefined,
): Promise<void> {
  const fullSyncStart = new Date();

  const fullPhaseResult = await runCriminalSyncPhase(
    ipc,
    "full",
    previousLastSyncedAt ?? undefined,
    fullSyncStart,
  );
  if (!fullPhaseResult.success) {
    return;
  }

  const catchupSyncStart = new Date();
  const catchupPhaseResult = await runCriminalSyncPhase(
    ipc,
    "catchup",
    fullSyncStart,
    catchupSyncStart,
  );
  if (!catchupPhaseResult.success) {
    return;
  }

  const syncedCount =
    fullPhaseResult.phaseSyncedCount + catchupPhaseResult.phaseSyncedCount;

  const updateSyncResult = await updateLastSyncedAtForDevice({
    deviceId,
    lastSyncedAt: catchupSyncStart,
  });

  if (!updateSyncResult.success) {
    console.warn(
      "[sync-provider] Synced records but failed to update lastSyncedAt:",
      updateSyncResult.error,
    );
    return;
  }

  console.log("[sync-provider] Criminal sync completed.", {
    syncedCount,
    fullPhaseSyncedCount: fullPhaseResult.phaseSyncedCount,
    catchupPhaseSyncedCount: catchupPhaseResult.phaseSyncedCount,
    lastSyncedAt: catchupSyncStart.toISOString(),
  });
}

const SyncProvider = ({ children }: SyncProviderProps) => {
  const { data: session } = useSession();
  const syncedUserIdRef = useRef<string | null>(null);

  const syncCriminalCasesForCurrentDevice = useCallback(async () => {
    if (typeof window === "undefined") {
      return;
    }

    const ipc = window.ipcRenderer;
    if (!ipc || typeof ipc.invoke !== "function") {
      console.log("[sync-provider] Electron bridge not found. Skipping sync.");
      return;
    }

    try {
      const deviceIdResponse = await ipc.invoke(
        IPC_CHANNELS.SESSION_GET_DEVICE_ID,
      );
      const deviceId = extractDeviceId(deviceIdResponse);
      if (!deviceId) {
        console.warn("[sync-provider] Failed to get device ID from Electron.");
        return;
      }

      const syncStateResult = await upsertSyncStateForDevice(deviceId);
      if (!syncStateResult.success) {
        console.warn(
          "[sync-provider] Failed to upsert sync state for device:",
          syncStateResult.error,
        );
        return;
      }

      await syncCriminalCasesForDevice(
        ipc,
        deviceId,
        syncStateResult.result.lastSyncedAt,
      );
    } catch (error) {
      console.error("[sync-provider] Unexpected sync error.", error);
    }
  }, []);

  useEffect(() => {
    const userId =
      typeof session?.user?.id === "string" ? session.user.id : null;

    if (!userId) {
      return;
    }

    if (syncedUserIdRef.current === userId) {
      return;
    }

    syncedUserIdRef.current = userId;

    console.log(
      "[sync-provider] Triggering one-time sync for authenticated user.",
      {
        userId,
      },
    );

    void syncCriminalCasesForCurrentDevice();
  }, [session?.user?.id, syncCriminalCasesForCurrentDevice]);

  const contextValue = useMemo<SyncContextType>(
    () => ({
      syncCriminalCases: syncCriminalCasesForCurrentDevice,
    }),
    [syncCriminalCasesForCurrentDevice],
  );

  return (
    <SyncContext.Provider value={contextValue}>{children}</SyncContext.Provider>
  );
};

export default SyncProvider;
