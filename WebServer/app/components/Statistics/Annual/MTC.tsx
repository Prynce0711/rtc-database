"use client";

import {
    createMunicipalTrialCourt,
    deleteMunicipalTrialCourt,
    getMunicipalTrialCourts,
    updateMunicipalTrialCourt,
} from "@/app/components/Statistics/Annual/AnnualActions";
import { CaseSchema } from "@/app/components/Statistics/Annual/Schema";
import { useEffect, useState } from "react";
import { courtColumns } from "./AnnualColumnDef";
import { courtLogFields } from "./AnnualFieldConfig";
import { CourtLog } from "./AnnualRecord";
import AnnualTable from "./AnnualTable";

/**
 * MTC (Municipal Trial Court) Receiving Log
 * Uses the shared AnnualTable with court column / field configs.
 */
const MTC = () => {
  const [records, setRecords] = useState<CourtLog[]>([]);

  async function loadRecords() {
    const result = await getMunicipalTrialCourts();
    if (result.success) setRecords(result.result as unknown as CourtLog[]);
  }

  useEffect(() => {
    loadRecords();
  }, []);

  const handleAdd = async (record: Record<string, unknown>) => {
    await createMunicipalTrialCourt(record as CaseSchema);
    await loadRecords();
  };

  const handleUpdate = async (record: Record<string, unknown>) => {
    await updateMunicipalTrialCourt(record.id as number, record as CaseSchema);
    await loadRecords();
  };

  const handleDelete = async (id: number) => {
    await deleteMunicipalTrialCourt(id);
    await loadRecords();
  };

  return (
    <AnnualTable<CourtLog & Record<string, unknown>>
      title="MTC Receiving Log"
      subtitle="Municipal Trial Court — Track all received documents and case filings"
      data={records as (CourtLog & Record<string, unknown>)[]}
      columns={courtColumns}
      fields={courtLogFields}
      dateKey="dateRecorded"
      sortDefaultKey="dateRecorded"
      onChange={(data) => setRecords(data as CourtLog[])}
      onAdd={handleAdd}
      onUpdate={handleUpdate}
      onDelete={handleDelete}
    />
  );
};

export default MTC;
