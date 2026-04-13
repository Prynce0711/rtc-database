"use client";

import { type ReactNode, useEffect, useMemo, useRef } from "react";
import { useSession } from "../lib/authClient";

type SessionProviderProps = {
  children: ReactNode;
};

type ElectronSessionUser = {
  id: string;
  name: string;
  role: string;
  status?: string;
  branch?: string;
  darkMode?: boolean;
};

const ELECTRON_SESSION_SYNC_CHANNEL = "session:sync-user-minimal";

const SessionProvider = ({ children }: SessionProviderProps) => {
  const { data: session } = useSession();
  const lastSyncedPayloadRef = useRef<string>("");

  const minimalSessionUser = useMemo<ElectronSessionUser | null>(() => {
    const user = session?.user;
    if (!user) {
      return null;
    }

    const id = typeof user?.id === "string" ? user.id.trim() : "";
    const name = typeof user?.name === "string" ? user.name.trim() : "";

    if (!id || !name) {
      return null;
    }

    const role =
      typeof user.role === "string" && user.role.trim().length > 0
        ? user.role.trim()
        : "user";

    const minimalUser: ElectronSessionUser = {
      id,
      name,
      role,
    };

    if (typeof user.status === "string" && user.status.trim().length > 0) {
      minimalUser.status = user.status.trim();
    }

    if (typeof user.branch === "string" && user.branch.trim().length > 0) {
      minimalUser.branch = user.branch.trim();
    }

    if (typeof user.darkMode === "boolean") {
      minimalUser.darkMode = user.darkMode;
    }

    return minimalUser;
  }, [session]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const ipc = window.ipcRenderer;
    if (!ipc || typeof ipc.invoke !== "function") {
      return;
    }

    const serializedPayload = JSON.stringify(minimalSessionUser);
    if (serializedPayload === lastSyncedPayloadRef.current) {
      return;
    }

    lastSyncedPayloadRef.current = serializedPayload;

    void ipc
      .invoke(ELECTRON_SESSION_SYNC_CHANNEL, { user: minimalSessionUser })
      .catch((error: unknown) => {
        console.warn(
          "[session-sync] Failed to sync session user to Electron.",
          error,
        );
      });
  }, [minimalSessionUser]);

  return <>{children}</>;
};

export default SessionProvider;
