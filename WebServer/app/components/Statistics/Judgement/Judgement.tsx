"use client";

import { useState } from "react";
import AnnualTable from "../Annual/AnnualTable";
import { judgementColumns } from "./JudgementColumnDef";
import { judgementFields } from "./JudgementFieldConfig";
import { JudgementLog } from "./JudgementRecord";

const Judgement = () => {
  const [records, setRecords] = useState<JudgementLog[]>([]);

  return (
    <AnnualTable<JudgementLog & Record<string, unknown>>
      title="Judgment Day"
      subtitle="Judgment Day — Daily hearing and disposition summary"
      data={records as (JudgementLog & Record<string, unknown>)[]}
      columns={judgementColumns}
      fields={judgementFields}
      dateKey="dateRecorded"
      sortDefaultKey="dateRecorded"
      onChange={(data) => setRecords(data as JudgementLog[])}
    />
  );
};

export default Judgement;
