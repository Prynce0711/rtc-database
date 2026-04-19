import type { UpsertCriminalCasesResponse } from "@rtc-database/shared";
import { parentPort } from "node:worker_threads";
import { upsertCriminalCases } from "./CriminalCasesActions";

type WorkerRequest = {
  requestId: string;
  payload: unknown;
};

type WorkerResponse = {
  requestId: string;
  response: UpsertCriminalCasesResponse;
};

const buildInvalidMessageResponse = (): UpsertCriminalCasesResponse => ({
  success: false,
  error: "Invalid worker message payload.",
});

if (!parentPort) {
  throw new Error("CriminalCasesWorker must run inside a worker thread.");
}

const port = parentPort;

port.on("message", async (message: unknown) => {
  const request = message as Partial<WorkerRequest>;

  if (
    !request ||
    typeof request !== "object" ||
    typeof request.requestId !== "string"
  ) {
    const fallbackResponse: WorkerResponse = {
      requestId: "unknown",
      response: buildInvalidMessageResponse(),
    };
    port.postMessage(fallbackResponse);
    return;
  }

  try {
    const response = await upsertCriminalCases(request.payload);

    const workerResponse: WorkerResponse = {
      requestId: request.requestId,
      response,
    };
    port.postMessage(workerResponse);
  } catch (error) {
    const messageText =
      error instanceof Error ? error.message : "Unknown worker sync error";

    const workerResponse: WorkerResponse = {
      requestId: request.requestId,
      response: {
        success: false,
        error: messageText,
      },
    };
    port.postMessage(workerResponse);
  }
});
