"use client";

import { getCriminalCases } from "@/app/components/Case/Criminal/CriminalCasesActions";
import {
  IPC_CHANNELS,
  type UpsertSingleCriminalCasePayload,
  type UpsertSingleCriminalCaseResponse,
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

type SyncProviderProps = {
  children: ReactNode;
};

type SyncContextType = {
  syncSingleCriminalCase: () => Promise<void>;
};

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export const useSync = (): SyncContextType => {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error("useSync must be used inside SyncProvider");
  }

  return context;
};

const SyncProvider = ({ children }: SyncProviderProps) => {
  const { data: session } = useSession();
  const syncedUserIdRef = useRef<string | null>(null);

  const syncSingleCriminalCase = useCallback(async () => {
    if (typeof window === "undefined") {
      return;
    }

    const ipc = window.ipcRenderer;
    if (!ipc || typeof ipc.invoke !== "function") {
      console.log("[sync-provider] Electron bridge not found. Skipping sync.");
      return;
    }

    console.log(
      "[sync-provider] Electron detected. Starting one-case sync test.",
    );

    try {
      const result = await getCriminalCases({ page: 1, pageSize: 1 });
      if (!result.success) {
        console.warn(
          "[sync-provider] Failed to fetch criminal case for sync:",
          result.error,
        );
        return;
      }

      const caseData = result.result.items[0];
      if (!caseData) {
        console.warn("[sync-provider] No criminal case available to sync.");
        return;
      }

      console.log("[sync-provider] Pulled one case from webserver actions.", {
        id: caseData.id,
        caseNumber: caseData.caseNumber,
      });

      const payload: UpsertSingleCriminalCasePayload = {
        source: "webserver",
        sentAt: new Date().toISOString(),
        caseData,
      };

      console.log("[sync-provider] Sending case to Electron over IPC.", {
        channel: IPC_CHANNELS.UPSERT_SINGLE_CRIMINAL_CASE,
        id: caseData.id,
        caseNumber: caseData.caseNumber,
      });

      const response = (await ipc.invoke(
        IPC_CHANNELS.UPSERT_SINGLE_CRIMINAL_CASE,
        payload,
      )) as UpsertSingleCriminalCaseResponse;

      if (!response?.success) {
        console.warn(
          "[sync-provider] Electron sync returned failure.",
          response?.error,
        );
        return;
      }

      console.log("[sync-provider] Electron sync completed.", response.result);
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

    void syncSingleCriminalCase();
  }, [session?.user?.id, syncSingleCriminalCase]);

  const contextValue = useMemo<SyncContextType>(
    () => ({
      syncSingleCriminalCase,
    }),
    [syncSingleCriminalCase],
  );

  return (
    <SyncContext.Provider value={contextValue}>{children}</SyncContext.Provider>
  );
};

export default SyncProvider;
