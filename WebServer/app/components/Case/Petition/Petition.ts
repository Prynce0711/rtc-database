"use server";

import fs from "fs/promises";
import path from "path";
import ActionResult from "../../ActionResult";
import { ReceiveLog } from "./PetitionRecord";
import { PetitionLogSchema } from "./PetitionSchema";

const DATA_DIR = path.resolve(process.cwd(), "WebServer", "data");
const DATA_FILE = path.join(DATA_DIR, "receiveLogs.json");

async function ensureDataFile() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.access(DATA_FILE).catch(async () => {
      await fs.writeFile(DATA_FILE, JSON.stringify([]), "utf8");
    });
  } catch (e) {
    console.error("Error ensuring data file:", e);
  }
}

async function readDataFile(): Promise<ReceiveLog[]> {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_FILE, "utf8");
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("Error parsing receive logs file:", e);
    return [];
  }
}

async function writeDataFile(logs: ReceiveLog[]) {
  await ensureDataFile();
  await fs.writeFile(DATA_FILE, JSON.stringify(logs, null, 2), "utf8");
}

export async function getReceiveLogs(): Promise<ActionResult<ReceiveLog[]>> {
  try {
    const logs = await readDataFile();
    return { success: true, result: logs };
  } catch (error) {
    console.error("Error fetching receive logs:", error);
    return { success: false, error: "Error fetching receive logs" };
  }
}

export async function createReceiveLog(
  data: Record<string, unknown>,
): Promise<ActionResult<ReceiveLog>> {
  try {
    const parsed = PetitionLogSchema.safeParse(data);
    if (!parsed.success) {
      throw new Error(`Invalid data: ${parsed.error.message}`);
    }
    const logs = await readDataFile();
    const nextId =
      logs.length > 0 ? Math.max(...logs.map((l) => l.id || 0)) + 1 : 1;
    const newLog: ReceiveLog = {
      id: nextId,
      receiptNo: String(parsed.data.receiptNo || ""),
      dateReceived: parsed.data.dateReceived as unknown as Date | string,
      timeReceived: (parsed.data as any).timeReceived ?? null,
      caseNumber: String(parsed.data.caseNumber || ""),
      documentType: String(parsed.data.documentType || ""),
      party: String(parsed.data.party || ""),
      receivedBy: String(parsed.data.receivedBy || ""),
      branch: String(parsed.data.branch || ""),
      remarks: (parsed.data as any).remarks ?? null,
    };
    logs.unshift(newLog);
    await writeDataFile(logs);
    return { success: true, result: newLog };
  } catch (error) {
    console.error("Error creating receive log:", error);
    return { success: false, error: "Error creating receive log" };
  }
}

export async function updateReceiveLog(
  id: number,
  data: Record<string, unknown>,
): Promise<ActionResult<ReceiveLog>> {
  try {
    const parsed = PetitionLogSchema.safeParse(data);
    if (!parsed.success) {
      throw new Error(`Invalid data: ${parsed.error.message}`);
    }
    const logs = await readDataFile();
    const idx = logs.findIndex((l) => l.id === id);
    if (idx === -1) return { success: false, error: "Not found" };
    const updated: ReceiveLog = {
      id,
      receiptNo: String(parsed.data.receiptNo || ""),
      dateReceived: parsed.data.dateReceived as unknown as Date | string,
      timeReceived: (parsed.data as any).timeReceived ?? null,
      caseNumber: String(parsed.data.caseNumber || ""),
      documentType: String(parsed.data.documentType || ""),
      party: String(parsed.data.party || ""),
      receivedBy: String(parsed.data.receivedBy || ""),
      branch: String(parsed.data.branch || ""),
      remarks: (parsed.data as any).remarks ?? null,
    };
    logs[idx] = updated;
    await writeDataFile(logs);
    return { success: true, result: updated };
  } catch (error) {
    console.error("Error updating receive log:", error);
    return { success: false, error: "Error updating receive log" };
  }
}

export async function deleteReceiveLog(
  id: number,
): Promise<ActionResult<void>> {
  try {
    const logs = await readDataFile();
    const next = logs.filter((l) => l.id !== id);
    await writeDataFile(next);
    return { success: true, result: undefined };
  } catch (error) {
    console.error("Error deleting receive log:", error);
    return { success: false, error: "Error deleting receive log" };
  }
}
