import { Queue, Worker } from "bullmq";
import Redis from "ioredis";
const connection = new Redis(
  process.env.REDIS_URL || "redis://localhost:6379",
  {
    maxRetriesPerRequest: null,
  },
);

const QUEUE_NAME: string = "excelQueue";

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

export const excelQueue = new Queue(QUEUE_NAME, {
  connection,
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
    };
    const label = data.message ?? `Queue task #${data.index ?? "?"}`;

    // Simulate a 3-second task while reporting progress to the UI.
    await job.updateProgress(0);
    await sleep(1000);
    await job.updateProgress(33);
    await sleep(1000);
    await job.updateProgress(67);
    await sleep(1000);
    await job.updateProgress(100);

    console.log(
      `[excelQueue] Completed ${label} (${data.index ?? "?"}/${data.total ?? "?"})`,
    );

    return {
      ok: true,
      batchId: data.batchId ?? null,
      message: `${label} completed`,
      finishedAt: new Date().toISOString(),
    };
  },
  {
    connection,
    concurrency: 5,
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
);

export default worker;
