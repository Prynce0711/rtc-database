import { NextResponse } from "next/server";
import { deleteReceiveLog } from "../../../components/Case/Petition/Petition";

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const url = new URL(req.url);
    const parts = url.pathname.split("/");
    const idStr = parts[parts.length - 1];
    const id = Number(idStr);
    if (!id)
      return NextResponse.json(
        { success: false, error: "Invalid id" },
        { status: 400 },
      );
    const res = await deleteReceiveLog(id);
    if (!res.success)
      return NextResponse.json(
        { success: false, error: res.error || "Delete failed" },
        { status: 500 },
      );
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete API error:", err);
    return NextResponse.json(
      { success: false, error: "Delete failed" },
      { status: 500 },
    );
  }
}
