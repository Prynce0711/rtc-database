import "server-only";

import { Queue, QueueEvents } from "bullmq";
import { redisConnection } from "../../redis";
import {
  ExcelQueueData,
  ExcelUploadActionResult,
  QUEUE_NAME,
} from "./ExcelWorkerUtils";

const excelQueue = new Queue<
  ExcelQueueData,
  ExcelUploadActionResult,
  typeof QUEUE_NAME
>(QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
  },
});

const excelQueueEvents = new QueueEvents(QUEUE_NAME, {
  connection: redisConnection,
});

export function getExcelQueueEvents(): QueueEvents {
  return excelQueueEvents;
}

export async function addExcelJob(data: ExcelQueueData) {
  return excelQueue.add(QUEUE_NAME, data);
}

export async function getWorkersCount(): Promise<number> {
  return excelQueue.getWorkersCount();
}
