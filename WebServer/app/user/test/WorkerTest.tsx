"use client";

import { useEffect, useMemo, useState } from "react";
import { createWorkerBatch, getWorkerBatchProgress } from "./TestActions";

type BatchMeta = {
  batchId: string;
  total: number;
  jobIds: string[];
  payloadSizeBytes: number;
  mainThreadWrites: number;
  mainThreadInsertedIds: number[];
};

type CreateWorkerBatchOptions = {
  payloadSizeBytes?: number;
  workerExtraDelayMs?: number;
  mainThreadWrites?: number;
  mainThreadWriteDelayMs?: number;
};

const MB_1 = 1024 * 1024;
const MB_10 = 10 * MB_1;

const formatBytes = (bytes: number): string => {
  if (bytes >= MB_1) {
    return `${(bytes / MB_1).toFixed(2)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  }
  return `${bytes} B`;
};

type QueueJobProgressSnapshot = {
  id: string;
  name: string;
  status: string;
  progress: number;
  attemptsMade: number;
  message: string;
  failedReason?: string;
  returnValue?: string;
};

type QueueBatchProgressSnapshot = {
  batchId: string;
  total: number;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  overallProgress: number;
  done: boolean;
  jobs: QueueJobProgressSnapshot[];
  queueCounts: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  };
};

const WorkerTest = () => {
  const [taskMessage, setTaskMessage] = useState("Queue test task");
  const [batchMeta, setBatchMeta] = useState<BatchMeta | null>(null);
  const [progress, setProgress] = useState<QueueBatchProgressSnapshot | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const hasBatch = Boolean(batchMeta && batchMeta.jobIds.length > 0);

  const completionText = useMemo(() => {
    if (!progress) {
      return "0/0";
    }
    return `${progress.completed + progress.failed}/${progress.total}`;
  }, [progress]);

  const refreshProgress = async (
    currentBatch: BatchMeta,
    showLoading = true,
  ) => {
    if (showLoading) {
      setRefreshing(true);
    }

    try {
      const result = await getWorkerBatchProgress(
        currentBatch.batchId,
        currentBatch.jobIds,
      );

      if (!result.success) {
        setMessage({
          type: "error",
          text: result.error || "Unable to read queue progress",
        });
        return;
      }

      setProgress(result.result);

      if (result.result.done) {
        setMessage({
          type: result.result.failed > 0 ? "error" : "success",
          text:
            result.result.failed > 0
              ? `Batch complete with ${result.result.failed} failed task(s).`
              : "Batch complete. All tasks finished successfully.",
        });
      }
    } finally {
      if (showLoading) {
        setRefreshing(false);
      }
    }
  };

  const startBatch = async (
    count: number,
    options: CreateWorkerBatchOptions = {},
  ) => {
    setLoading(true);
    setMessage(null);

    try {
      const createResult = await createWorkerBatch(
        count,
        taskMessage.trim() || "Queue test task",
        options,
      );

      if (!createResult.success) {
        setMessage({
          type: "error",
          text: createResult.error || "Failed to queue tasks",
        });
        return;
      }

      setBatchMeta(createResult.result);
      setMessage({
        type: "success",
        text:
          `Queued ${createResult.result.total} worker task(s). ` +
          `Main-thread inserts: ${createResult.result.mainThreadWrites}. ` +
          `Payload per write: ${formatBytes(createResult.result.payloadSizeBytes)}.`,
      });

      await refreshProgress(createResult.result, false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!batchMeta || !progress || progress.done) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refreshProgress(batchMeta, false);
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [batchMeta, progress]);

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <h1 className="text-3xl font-bold">Worker Queue Test</h1>

        {message && (
          <div
            className={`rounded p-4 ${
              message.type === "success"
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="text-xl font-bold">Queue Controls</h2>
          <p className="mt-1 text-sm text-gray-600">
            Run worker writes only, or run a collision test where the same
            server action also writes on the main thread while worker tasks
            write.
          </p>

          <div className="mt-4 space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Task Message Prefix
              </label>
              <input
                className="w-full rounded border px-3 py-2"
                value={taskMessage}
                onChange={(e) => setTaskMessage(e.target.value)}
                placeholder="Queue test task"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
                type="button"
                disabled={loading}
                onClick={() => void startBatch(1)}
              >
                Add 1 Task
              </button>
              <button
                className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
                type="button"
                disabled={loading}
                onClick={() => void startBatch(2)}
              >
                Add 2 Tasks (Same Time)
              </button>
              <button
                className="rounded bg-amber-600 px-4 py-2 text-white disabled:opacity-50"
                type="button"
                disabled={loading}
                onClick={() =>
                  void startBatch(2, {
                    payloadSizeBytes: MB_10,
                    mainThreadWrites: 2,
                    mainThreadWriteDelayMs: 5200,
                    workerExtraDelayMs: 4000,
                  })
                }
              >
                Collision Test (Main + Worker, 10MB)
              </button>
              <button
                className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
                type="button"
                disabled={loading}
                onClick={() => void startBatch(5)}
              >
                Add 5 Tasks
              </button>
              <button
                className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
                type="button"
                disabled={loading}
                onClick={() => void startBatch(10)}
              >
                Add 10 Tasks
              </button>
              <button
                className="rounded bg-green-600 px-4 py-2 text-white disabled:opacity-50"
                type="button"
                disabled={!hasBatch || refreshing}
                onClick={() => batchMeta && void refreshProgress(batchMeta)}
              >
                {refreshing ? "Refreshing..." : "Refresh Progress"}
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="text-xl font-bold">Batch Progress</h2>

          {!progress ? (
            <p className="mt-3 text-sm text-gray-600">
              No batch started yet. Queue some tasks to see progress.
            </p>
          ) : (
            <>
              <p className="mt-3 text-sm text-gray-600">
                Batch ID: {progress.batchId}
              </p>
              {batchMeta && (
                <p className="mt-1 text-xs text-gray-500">
                  Payload: {formatBytes(batchMeta.payloadSizeBytes)} per write,
                  main-thread inserts: {batchMeta.mainThreadWrites}
                  {batchMeta.mainThreadInsertedIds.length > 0 &&
                    ` (row ids: ${batchMeta.mainThreadInsertedIds.join(", ")})`}
                </p>
              )}

              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                <div className="rounded border p-3 text-sm">
                  <div className="text-gray-500">Done</div>
                  <div className="font-semibold">{completionText}</div>
                </div>
                <div className="rounded border p-3 text-sm">
                  <div className="text-gray-500">Waiting</div>
                  <div className="font-semibold">{progress.waiting}</div>
                </div>
                <div className="rounded border p-3 text-sm">
                  <div className="text-gray-500">Active</div>
                  <div className="font-semibold">{progress.active}</div>
                </div>
                <div className="rounded border p-3 text-sm">
                  <div className="text-gray-500">Completed</div>
                  <div className="font-semibold">{progress.completed}</div>
                </div>
                <div className="rounded border p-3 text-sm">
                  <div className="text-gray-500">Failed</div>
                  <div className="font-semibold">{progress.failed}</div>
                </div>
              </div>

              <div className="mt-4 space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span>Overall Progress</span>
                  <span>{progress.overallProgress}%</span>
                </div>
                <progress
                  className="progress progress-primary w-full"
                  max={100}
                  value={progress.overallProgress}
                />
              </div>

              <p className="mt-3 text-xs text-gray-500">
                Queue totals: waiting {progress.queueCounts.waiting}, active{" "}
                {progress.queueCounts.active}, completed{" "}
                {progress.queueCounts.completed}, failed{" "}
                {progress.queueCounts.failed}, delayed{" "}
                {progress.queueCounts.delayed}
              </p>
            </>
          )}
        </div>

        {progress && (
          <div className="overflow-hidden rounded-lg bg-white shadow">
            <div className="border-b px-6 py-4">
              <h2 className="text-xl font-bold">Task Details</h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 text-left text-sm">
                  <tr>
                    <th className="px-4 py-3">Job ID</th>
                    <th className="px-4 py-3">Message</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Progress</th>
                    <th className="px-4 py-3">Attempts</th>
                  </tr>
                </thead>
                <tbody>
                  {progress.jobs.map((job) => (
                    <tr key={job.id} className="border-t text-sm">
                      <td className="px-4 py-3 font-mono">{job.id}</td>
                      <td className="px-4 py-3">{job.message || "-"}</td>
                      <td className="px-4 py-3">{job.status}</td>
                      <td className="px-4 py-3">{job.progress}%</td>
                      <td className="px-4 py-3">{job.attemptsMade}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkerTest;
