"use client";

import { useEffect, useState } from "react";
import {
  createMunicipalJudgement,
  deleteMunicipalJudgement,
  getMunicipalJudgements,
  updateMunicipalJudgement,
} from "./judgementActions";
import { mtcLeafColumns } from "./JudgementColumnDef";
import { mtcJudgementFields } from "./JudgementFieldConfig";
import { MTCJudgementLog } from "./JudgementRecord";
import JudgementTable from "./JudgementTable";

const JudgementMTC = () => {
  const [records, setRecords] = useState<MTCJudgementLog[]>([]);

  const loadRecords = async () => {
    const res = await getMunicipalJudgements();
    if (res.success) {
      setRecords(res.result);
      return;
    }
    throw new Error(res.error || "Failed to load municipal records");
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
        <TH colSpan={3}>Number of Cases Disposed</TH>
        <TH colSpan={3}>PDL/CICL</TH>
        <TH colSpan={10}>PDL Released</TH>
        <TH rowSpan={3}>TOTAL</TH>
      </tr>

      {/* ── Row 2 ─────────────────────────────────────────────────────── */}
      <tr>
        {/* Cases Heard sub-groups */}
        <TH colSpan={2}>CIVIL</TH>
        <TH colSpan={2}>CRIMINAL</TH>
        <TH rowSpan={2}>TOTAL Cases Heard</TH>
        {/* Cases Disposed */}
        <TH rowSpan={2}>Civil</TH>
        <TH rowSpan={2}>Crim</TH>
        <TH rowSpan={2}>TOTAL Cases Disposed</TH>
        {/* PDL/CICL */}
        <TH rowSpan={2}>M</TH>
        <TH rowSpan={2}>F</TH>
        <TH rowSpan={2}>Total</TH>
        {/* PDL Released */}
        <TH rowSpan={2}>V</TH>
        <TH rowSpan={2}>I</TH>
        <TH rowSpan={2}>Bail</TH>
        <TH rowSpan={2}>Recognizance</TH>
        <TH rowSpan={2}>Min/ror</TH>
        <TH rowSpan={2}>Max Sentence</TH>
        <TH rowSpan={2}>Dismissal</TH>
        <TH rowSpan={2}>Acquittal</TH>
        <TH rowSpan={2}>Min Sentence</TH>
        <TH rowSpan={2}>Others</TH>
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
    <JudgementTable<MTCJudgementLog & Record<string, unknown>>
      title="MTC Judgment Week"
      subtitle="Municipal Trial Court — Nationwide Judgment Week Summary Report"
      data={records as (MTCJudgementLog & Record<string, unknown>)[]}
      leafColumns={mtcLeafColumns}
      fields={mtcJudgementFields}
      renderHeader={renderHeader}
      dateKey="dateRecorded"
      onChange={(data) => setRecords(data as MTCJudgementLog[])}
      onAdd={async (record) => {
        const res = await createMunicipalJudgement(record as MTCJudgementLog);
        if (!res.success) throw new Error(res.error || "Create failed");
        await loadRecords();
      }}
      onUpdate={async (record) => {
        const id = Number(record.id);
        if (!id) throw new Error("Missing record id");
        const res = await updateMunicipalJudgement(
          id,
          record as MTCJudgementLog,
        );
        if (!res.success) throw new Error(res.error || "Update failed");
        await loadRecords();
      }}
      onDelete={async (id) => {
        const res = await deleteMunicipalJudgement(id);
        if (!res.success) throw new Error(res.error || "Delete failed");
        await loadRecords();
      }}
    />
  );
};

export default JudgementMTC;
