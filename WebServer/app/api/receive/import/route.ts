import { NextResponse } from "next/server";

import * as XLSX from "xlsx";

import { createReceiveLog } from "../../../components/Case/Petition/Petition";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const f = form.get("file") as File | null;
    if (!f)
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 },
      );

    const maxSize = 5 * 1024 * 1024; // 5 MB
    if (f.size > maxSize)
      return NextResponse.json(
        { success: false, error: "File too large (max 5MB)" },
        { status: 400 },
      );

    const name = (f as File).name || "";
    const ext = name.split(".").pop()?.toLowerCase() || "";
    if (!["xlsx", "xls"].includes(ext)) {
      return NextResponse.json(
        { success: false, error: "Only Excel files (.xlsx/.xls) are allowed" },
        { status: 400 },
      );
    }

    const buffer = await f.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(buffer), { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(
      workbook.Sheets[sheetName],
      { defval: "" },
    );

    const created: any[] = [];
    for (const r of rows) {
      const payload: Record<string, unknown> = {
        receiptNo: (r["TitleNo"] ??
          r["Receipt No"] ??
          r["receiptNo"] ??
          r["receiptNo"] ??
          "") as string,
        dateReceived: (r["Date Received"] ??
          r["dateReceived"] ??
          r["Date"] ??
          "") as string,
        timeReceived: (r["Time"] ?? "") as string,
        caseNumber: (r["Case No"] ?? r["caseNumber"] ?? "") as string,
        documentType: (r["Nature"] ??
          r["documentType"] ??
          r["Content"] ??
          "") as string,
        party: (r["Petitioners"] ?? r["party"] ?? r["Party"] ?? "") as string,
        receivedBy: (r["Received By"] ?? r["receivedBy"] ?? "") as string,
        branch: (r["Branch No"] ??
          r["RaffledToBranch"] ??
          r["branch"] ??
          "") as string,
        remarks: (r["Remarks"] ?? r["Notes"] ?? "") as string,
      };
      const res = await createReceiveLog(payload);
      if (res.success && res.result) created.push(res.result);
    }

    return NextResponse.json({ success: true, result: created });
  } catch (err) {
    console.error("Import error:", err);
    return NextResponse.json(
      { success: false, error: "Import failed" },
      { status: 500 },
    );
  }
}
