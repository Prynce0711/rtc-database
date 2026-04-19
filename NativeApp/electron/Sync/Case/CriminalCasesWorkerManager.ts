import type { UpsertCriminalCasesResponse } from "@rtc-database/shared";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";
import { upsertCriminalCases } from "./CriminalCasesActions";

type WorkerRequest = {
  requestId: string;
  payload: unknown;
};

type WorkerResponse = {
  requestId: string;
  response: UpsertCriminalCasesResponse;
};

type PendingRequest = {
  resolve: (value: UpsertCriminalCasesResponse) => void;
  reject: (reason?: unknown) => void;
};

let workerInstance: Worker | null = null;
let requestSequence = 0;
const pendingRequests = new Map<string, PendingRequest>();
const shouldUseWorkerThread = !process.env.VITE_DEV_SERVER_URL;

const rejectAllPending = (errorMessage: string) => {
  for (const pending of pendingRequests.values()) {
    pending.resolve({ success: false, error: errorMessage });
  }
  pendingRequests.clear();
};

const resolveWorkerUrl = (): URL => {
  const bundledWorkerUrl = new URL("./CriminalCasesWorker.ts", import.meta.url);

  if (
    bundledWorkerUrl.protocol === "file:" &&
    bundledWorkerUrl.pathname.startsWith("/assets/")
  ) {
    const mainProcessDir = path.dirname(fileURLToPath(import.meta.url));
    const relativeAssetPath = bundledWorkerUrl.pathname.replace(/^\/+/, "");
    const normalizedWorkerPath = path.join(mainProcessDir, relativeAssetPath);
    return pathToFileURL(normalizedWorkerPath);
  }

  return bundledWorkerUrl;
};

const initializeWorker = (): Worker => {
  const worker = new Worker(resolveWorkerUrl());

  worker.on("message", (message: unknown) => {
    const payload = message as Partial<WorkerResponse>;
    if (!payload || typeof payload.requestId !== "string") {
      return;
    }

    const pending = pendingRequests.get(payload.requestId);
    if (!pending) {
      return;
    }

    pendingRequests.delete(payload.requestId);

    if (!payload.response) {
      pending.resolve({
        success: false,
        error: "Worker returned an invalid response.",
      });
      return;
    }

    pending.resolve(payload.response);
  });

  worker.on("error", (error) => {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Criminal sync worker encountered an unknown error.";

    console.error("[sync:criminal] Worker thread error.", error);
    rejectAllPending(errorMessage);
    workerInstance = null;
  });

  worker.on("exit", (code) => {
    if (code !== 0) {
      const errorMessage = `Criminal sync worker exited with code ${code}.`;
      console.error("[sync:criminal] Worker thread exited unexpectedly.", {
        code,
      });
      rejectAllPending(errorMessage);
    }

    workerInstance = null;
  });

  return worker;
};

const getWorker = (): Worker => {
  if (!workerInstance) {
    workerInstance = initializeWorker();
  }

  return workerInstance;
};

export const upsertCriminalCasesInWorker = async (
  payload: unknown,
): Promise<UpsertCriminalCasesResponse> => {
  if (!shouldUseWorkerThread) {
    return upsertCriminalCases(payload);
  }

  const requestId = `sync-${Date.now()}-${requestSequence++}`;

  try {
    const worker = getWorker();

    return await new Promise<UpsertCriminalCasesResponse>((resolve) => {
      pendingRequests.set(requestId, {
        resolve,
        reject: () => {
          resolve({
            success: false,
            error: "Criminal sync worker request failed.",
          });
        },
      });

      const request: WorkerRequest = {
        requestId,
        payload,
      };

      worker.postMessage(request);
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to start worker thread";

    console.warn(
      "[sync:criminal] Falling back to main-thread upsert after worker startup failure.",
      message,
    );

    return upsertCriminalCases(payload);
  }
};

export const disposeCriminalCasesWorker = async (): Promise<void> => {
  if (!workerInstance) {
    return;
  }

  const activeWorker = workerInstance;
  workerInstance = null;

  rejectAllPending("Criminal sync worker was terminated.");
  await activeWorker.terminate();
};
