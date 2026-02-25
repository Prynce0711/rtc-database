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
    return NextResponse.json({ success: true, result: res.result });
  } catch (err) {
    console.error("List error:", err);
    return NextResponse.json(
      { success: false, error: "List failed" },
      { status: 500 },
    );
  }
}
