import { NextResponse } from "next/server";
import {
  createReceiveLog,
  updateReceiveLog,
} from "../../../components/Case/Petition/Petition";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rows = Array.isArray(body) ? body : [body];
    const results: any[] = [];
    for (const r of rows) {
      const id = (r as any).id ?? 0;
      if (id && id > 0) {
        const res = await updateReceiveLog(Number(id), r);
        if (res.success && res.result) results.push(res.result);
      } else {
        const res = await createReceiveLog(r);
        if (res.success && res.result) results.push(res.result);
      }
    }
    return NextResponse.json({ success: true, result: results });
  } catch (err) {
    console.error("Create API error:", err);
    return NextResponse.json(
      { success: false, error: "Create failed" },
      { status: 500 },
    );
  }
}
