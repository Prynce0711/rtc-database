import { Queue, Worker } from "bullmq";
import { prisma } from "../prisma";
import { redisConnection } from "../redis";

const QUEUE_NAME: string = "testQueue";
const MAX_EXTRA_DELAY_MS = 60000;

const clampInt = (value: number, min: number, max: number): number =>
  Math.min(Math.max(Math.floor(value), min), max);

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

export const testQueue = new Queue(QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
  },
});

const worker = new Worker(
  QUEUE_NAME, // this is the queue name, the first string parameter we provided for Queue()
  async (job) => {
    const data = job?.data as {
      batchId?: string;
      index?: number;
      total?: number;
      message?: string;
      persistToDb?: boolean;
      payload?: string;
      workerExtraDelayMs?: number;
    };
    const label = data.message ?? `Queue task #${data.index ?? "?"}`;
    const payload = typeof data.payload === "string" ? data.payload : "";
    const workerExtraDelayMs = clampInt(
      typeof data.workerExtraDelayMs === "number" ? data.workerExtraDelayMs : 0,
      0,
      MAX_EXTRA_DELAY_MS,
    );

    // Simulate a 3-second task while reporting progress to the UI.
    await job.updateProgress(0);
    await sleep(1000);
    await job.updateProgress(33);
    await sleep(1000);
    await job.updateProgress(67);

    if (workerExtraDelayMs > 0) {
      await sleep(workerExtraDelayMs);
      await job.updateProgress(80);
    }

    let createdRowId: number | null = null;
    if (data.persistToDb !== false) {
      const created = await prisma.test.create({
        data: {
          test:
            `[WORKER] ${label} | batch=${data.batchId ?? "n/a"} | index=${data.index ?? "n/a"} | payloadBytes=${payload.length}\n` +
            payload,
        },
      });
      createdRowId = created.id;
    }

    await sleep(1000);
    await job.updateProgress(100);

    console.log(
      `[excelQueue] Completed ${label} (${data.index ?? "?"}/${data.total ?? "?"})`,
    );

    return {
      ok: true,
      batchId: data.batchId ?? null,
      testRowId: createdRowId,
      message: `${label} completed`,
      finishedAt: new Date().toISOString(),
    };
  },
  {
    connection: redisConnection,
    concurrency: 5,
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
);

export default worker;
