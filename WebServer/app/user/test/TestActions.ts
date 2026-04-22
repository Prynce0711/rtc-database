"use server";

import { excelQueue } from "@/app/lib/workers/excel.worker";
import { ActionResult } from "@rtc-database/shared";
import { CaseType } from "@rtc-database/shared/prisma/client";
import { validateSession } from "../../lib/authActions";
import { deleteGarageFile } from "../../lib/garageActions";
import { prisma } from "../../lib/prisma";
import Roles from "../../lib/Roles";

export async function deleteAllCases(
  caseType: CaseType,
): Promise<ActionResult<void>> {
  try {
    const sessionValidation = await validateSession([Roles.ADMIN]);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    await prisma.case.deleteMany({
      where: {
        caseType,
      },
    });

    return { success: true, result: undefined };
  } catch (error) {
    console.error("Error deleting cases:", error);
    return { success: false, error: "Error deleting cases" };
  }
}

export async function deleteAllNotarial(): Promise<ActionResult<void>> {
  try {
    const sessionValidation = await validateSession([Roles.ADMIN]);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const filesToCheck = await prisma.notarial.findMany({
      where: {
        fileId: {
          not: null,
        },
      },
      select: {
        fileId: true,
        file: {
          select: {
            id: true,
            key: true,
          },
        },
      },
    });

    await prisma.notarial.deleteMany({});

    const uniqueFiles = new Map<number, string>();
    for (const entry of filesToCheck) {
      if (entry.fileId && entry.file) {
        uniqueFiles.set(entry.fileId, entry.file.key);
      }
    }

    for (const [fileId, key] of uniqueFiles) {
      const [notarialCountRaw, chatMessageCountRaw] = await Promise.all([
        prisma.notarial.count({ where: { fileId } }),
        prisma.chatMessage.count({ where: { fileId } }),
      ]);

      const notarialCount =
        typeof notarialCountRaw === "bigint"
          ? Number(notarialCountRaw)
          : notarialCountRaw;
      const chatMessageCount =
        typeof chatMessageCountRaw === "bigint"
          ? Number(chatMessageCountRaw)
          : chatMessageCountRaw;

      if (notarialCount === 0 && chatMessageCount === 0) {
        await deleteGarageFile(key);
      }
    }

    return { success: true, result: undefined };
  } catch (error) {
    console.error("Error deleting notarial entries:", error);
    return { success: false, error: "Error deleting notarial entries" };
  }
}

export async function deleteAllSpecialProceedings(): Promise<
  ActionResult<void>
> {
  try {
    const sessionValidation = await validateSession([Roles.ADMIN]);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    await prisma.case.deleteMany({
      where: {
        caseType: CaseType.SCA,
      },
    });

    return { success: true, result: undefined };
  } catch (error) {
    console.error("Error deleting special proceedings:", error);
    return { success: false, error: "Error deleting special proceedings" };
  }
}

export async function createWorker(
  message: string,
): Promise<ActionResult<void>> {
  const result = await createWorkerBatch(1, message);
  if (!result.success) {
    return { success: false, error: result.error || "Error creating worker" };
  }

  return { success: true, result: undefined };
}

type QueueWorkerBatchResult = {
  batchId: string;
  total: number;
  jobIds: string[];
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

export async function createWorkerBatch(
  count: number,
  message = "Queue test task",
): Promise<ActionResult<QueueWorkerBatchResult>> {
  try {
    const safeCount = Math.min(Math.max(Math.floor(count), 1), 50);
    const batchId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const jobs = await Promise.all(
      Array.from({ length: safeCount }, (_, index) => {
        const data = {
          batchId,
          index: index + 1,
          total: safeCount,
          message: `${message} #${index + 1}`,
        };
        return excelQueue.add("sampleJob", data);
      }),
    );

    return {
      success: true,
      result: {
        batchId,
        total: safeCount,
        jobIds: jobs.map((job) => String(job.id)),
      },
    };
  } catch (error) {
    console.error("Error creating worker batch:", error);
    return { success: false, error: "Error creating worker batch" };
  }
}

const asProgressNumber = (progress: unknown): number => {
  if (typeof progress === "number") {
    return progress;
  }

  if (
    progress &&
    typeof progress === "object" &&
    "percentage" in progress &&
    typeof progress.percentage === "number"
  ) {
    return progress.percentage;
  }

  return 0;
};

const toReturnValueString = (value: unknown): string | undefined => {
  if (typeof value === "undefined") {
    return undefined;
  }

  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return "[unserializable return value]";
  }
};

export async function getWorkerBatchProgress(
  batchId: string,
  jobIds: string[],
): Promise<ActionResult<QueueBatchProgressSnapshot>> {
  try {
    if (!jobIds.length) {
      return { success: false, error: "No job ids provided" };
    }

    const jobs = await Promise.all(
      jobIds.map(async (jobId): Promise<QueueJobProgressSnapshot> => {
        const job = await excelQueue.getJob(jobId);
        if (!job) {
          return {
            id: jobId,
            name: "sampleJob",
            status: "missing",
            progress: 0,
            attemptsMade: 0,
            message: "Job not found",
          };
        }

        const state = await job.getState();
        const progress = Math.max(
          0,
          Math.min(100, Math.round(asProgressNumber(job.progress))),
        );

        return {
          id: String(job.id),
          name: job.name,
          status: state,
          progress,
          attemptsMade: job.attemptsMade,
          message:
            typeof job.data?.message === "string" ? job.data.message : "",
          failedReason: job.failedReason ?? undefined,
          returnValue: toReturnValueString(job.returnvalue),
        };
      }),
    );

    const completed = jobs.filter((job) => job.status === "completed").length;
    const failed = jobs.filter((job) => job.status === "failed").length;
    const active = jobs.filter((job) => job.status === "active").length;
    const waiting = Math.max(0, jobs.length - completed - failed - active);

    const overallProgress =
      jobs.length === 0
        ? 0
        : Math.round(
            jobs.reduce((sum, job) => {
              if (job.status === "completed" || job.status === "failed") {
                return sum + 100;
              }
              return sum + job.progress;
            }, 0) / jobs.length,
          );

    const counts = await excelQueue.getJobCounts(
      "waiting",
      "active",
      "completed",
      "failed",
      "delayed",
    );

    return {
      success: true,
      result: {
        batchId,
        total: jobs.length,
        waiting,
        active,
        completed,
        failed,
        overallProgress,
        done: completed + failed === jobs.length,
        jobs,
        queueCounts: {
          waiting: counts.waiting,
          active: counts.active,
          completed: counts.completed,
          failed: counts.failed,
          delayed: counts.delayed,
        },
      },
    };
  } catch (error) {
    console.error("Error reading worker batch progress:", error);
    return { success: false, error: "Error reading worker batch progress" };
  }
}
