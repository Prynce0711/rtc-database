"use client";

import { useEffect, useState } from "react";
import {
  createRegionalJudgement,
  deleteRegionalJudgement,
  getRegionalJudgements,
  updateRegionalJudgement,
} from "./judgementActions";
import { rtcLeafColumns } from "./JudgementColumnDef";
import { rtcJudgementFields } from "./JudgementFieldConfig";
import { RTCJudgementLog } from "./JudgementRecord";
import JudgementTable from "./JudgementTable";

/**
 * RTC (Regional Trial Court) — Nationwide Judgment Week table.
 *
 * Header layout (3 rows):
 *   Row 1: Branches | Cases Heard/Tried (×5) | Cases Disposed (×4)
 *          | PDL/CICL (×4) | PDL Released (×10) | CICL (×4) | fine | TOTAL
 *   Row 2: CIVIL (×2) | CRIMINAL (×2) | Total Heard | Civil | Crim
 *          | Summary Proc | Cases Disposed | M | F | CICL | Total
 *          | V | In-C | bail | recognizance | min/ror | max sentence
 *          | dismissal | acquittal | min sentence | probation
 *          | M | F | V | In-C
 *   Row 3: V | In-C | V | In-C  ← sub-headers for CIVIL and CRIMINAL
 */
const JudgementRTC = () => {
  const [records, setRecords] = useState<RTCJudgementLog[]>([]);

  const loadRecords = async () => {
    const res = await getRegionalJudgements();
    if (res.success) {
      setRecords(res.result);
      return;
    }
    throw new Error(res.error || "Failed to load regional records");
  };

  useEffect(() => {
    loadRecords().catch(console.error);
  }, []);

  const TH = ({
    children,
    rowSpan,
    colSpan,
    className = "",
  }: {
    children?: React.ReactNode;
    rowSpan?: number;
    colSpan?: number;
    className?: string;
  }) => (
    <th
      rowSpan={rowSpan}
      colSpan={colSpan}
      className={`text-center align-middle border border-base-200 bg-base-300 text-xs font-semibold px-1 py-1 whitespace-nowrap ${className}`}
    >
      {children}
    </th>
  );

  const renderHeader = (showActions: boolean) => (
    <thead className="text-base">
      {/* ── Row 1 ─────────────────────────────────────────────────────── */}
      <tr>
        {showActions && <TH rowSpan={3}>Actions</TH>}
        <TH rowSpan={3}>Branches No.</TH>
        <TH colSpan={5}>Number of Cases Heard/Tried</TH>
        <TH colSpan={4}>Number of Cases Disposed</TH>
        <TH colSpan={4}>PDL/CICL</TH>
        <TH colSpan={10}>PDL Released</TH>
        <TH colSpan={4}>CICL</TH>
        <TH rowSpan={3}>fine</TH>
        <TH rowSpan={3}>TOTAL</TH>
      </tr>

      {/* ── Row 2 ─────────────────────────────────────────────────────── */}
      <tr>
        {/* Cases Heard sub-groups */}
        <TH colSpan={2}>CIVIL</TH>
        <TH colSpan={2}>CRIMINAL</TH>
        <TH rowSpan={2}>TOTAL CASES HEARD</TH>
        {/* Cases Disposed */}
        <TH rowSpan={2}>Civil</TH>
        <TH rowSpan={2}>Crim</TH>
        <TH rowSpan={2}>Summary Proc</TH>
        <TH rowSpan={2}>CASES Disposed</TH>
        {/* PDL/CICL */}
        <TH rowSpan={2}>M</TH>
        <TH rowSpan={2}>F</TH>
        <TH rowSpan={2}>CICL</TH>
        <TH rowSpan={2}>Total</TH>
        {/* PDL Released */}
        <TH rowSpan={2}>V</TH>
        <TH rowSpan={2}>In-C</TH>
        <TH rowSpan={2}>bail</TH>
        <TH rowSpan={2}>recognizance</TH>
        <TH rowSpan={2}>min/ror</TH>
        <TH rowSpan={2}>max sentence</TH>
        <TH rowSpan={2}>dismissal</TH>
        <TH rowSpan={2}>acquittal</TH>
        <TH rowSpan={2}>min sentence</TH>
        <TH rowSpan={2}>probation</TH>
        {/* CICL */}
        <TH rowSpan={2}>M</TH>
        <TH rowSpan={2}>F</TH>
        <TH rowSpan={2}>V</TH>
        <TH rowSpan={2}>In-C</TH>
      </tr>

      {/* ── Row 3 — leaf labels for CIVIL and CRIMINAL ──────────────── */}
      <tr>
        <TH>V</TH>
        <TH>In-C</TH>
        <TH>V</TH>
        <TH>In-C</TH>
      </tr>
    </thead>
  );

  return (
    <JudgementTable<RTCJudgementLog & Record<string, unknown>>
      title="RTC Judgment Week"
      subtitle="Regional Trial Court — Nationwide Judgment Week Summary Report"
      data={records as (RTCJudgementLog & Record<string, unknown>)[]}
      leafColumns={rtcLeafColumns}
      fields={rtcJudgementFields}
      renderHeader={renderHeader}
      dateKey="dateRecorded"
      onChange={(data) => setRecords(data as RTCJudgementLog[])}
      onAdd={async (record) => {
        const res = await createRegionalJudgement(record as RTCJudgementLog);
        if (!res.success) throw new Error(res.error || "Create failed");
        await loadRecords();
      }}
      onUpdate={async (record) => {
        const id = Number(record.id);
        if (!id) throw new Error("Missing record id");
        const res = await updateRegionalJudgement(
          id,
          record as RTCJudgementLog,
        );
        if (!res.success) throw new Error(res.error || "Update failed");
        await loadRecords();
      }}
      onDelete={async (id) => {
        const res = await deleteRegionalJudgement(id);
        if (!res.success) throw new Error(res.error || "Delete failed");
        await loadRecords();
      }}
    />
  );
};

export default JudgementRTC;
