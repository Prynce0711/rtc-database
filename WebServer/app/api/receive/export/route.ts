import { NextResponse } from "next/server";
import { getReceiveLogs } from "../../../components/Case/Petition/Petition";

export async function GET() {
  try {
    const res = await getReceiveLogs();
    if (!res.success)
      return NextResponse.json(
        { success: false, error: res.error || "Failed to read logs" },
        { status: 500 },
      );
    const logs = res.result || [];
    const headers = [
      "id",
      "receiptNo",
      "dateReceived",
      "timeReceived",
      "caseNumber",
      "documentType",
      "party",
      "receivedBy",
      "branch",
      "remarks",
    ];
    const csvRows = [headers.join(",")];
    for (const l of logs) {
      const row = headers.map((h) => {
        const val = (l as any)[h] ?? "";
        const s = typeof val === "string" ? val : String(val);
        // escape quotes and commas
        if (s.includes(",") || s.includes('"') || s.includes("\n")) {
          return '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
      });
      csvRows.push(row.join(","));
    }
    const csv = csvRows.join("\n");
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=petition-logs.csv",
      },
    });
  } catch (err) {
    console.error("Export error:", err);
    return NextResponse.json(
      { success: false, error: "Export failed" },
      { status: 500 },
    );
  }
}
