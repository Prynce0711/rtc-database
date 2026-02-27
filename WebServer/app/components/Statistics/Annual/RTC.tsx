"use client";

import {
    createAnnualTrialCourt,
    deleteAnnualTrialCourt,
    getAnnualTrialCourts,
    updateAnnualTrialCourt,
} from "@/app/components/Statistics/Annual/AnnualActions";
import { CaseSchema } from "@/app/components/Statistics/Annual/Schema";
import { useEffect, useState } from "react";
import { courtColumns } from "./AnnualColumnDef";
import { courtLogFields } from "./AnnualFieldConfig";
import { CourtLog } from "./AnnualRecord";
import AnnualTable from "./AnnualTable";

/**
 * RTC (Regional Trial Court) Receiving Log
 * Uses the shared AnnualTable with court column / field configs.
 */
const RTC = () => {
  const [records, setRecords] = useState<CourtLog[]>([]);

  async function loadRecords() {
    const result = await getAnnualTrialCourts();
    if (result.success) setRecords(result.result as unknown as CourtLog[]);
  }

  useEffect(() => {
    loadRecords();
  }, []);

  const handleAdd = async (record: Record<string, unknown>) => {
    await createAnnualTrialCourt(record as CaseSchema);
    await loadRecords();
  };

  const handleUpdate = async (record: Record<string, unknown>) => {
    await updateAnnualTrialCourt(record.id as number, record as CaseSchema);
    await loadRecords();
  };

  const handleDelete = async (id: number) => {
    await deleteAnnualTrialCourt(id);
    await loadRecords();
  };

  return (
    <AnnualTable<CourtLog & Record<string, unknown>>
      title="RTC Receiving Log"
      subtitle="Regional Trial Court — Track all received documents and case filings"
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

export default RTC;
