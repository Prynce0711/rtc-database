"use client";

import {
    createInventoryDocument,
    deleteInventoryDocument,
    getInventoryDocuments,
    updateInventoryDocument,
} from "@/app/components/Statistics/Annual/AnnualActions";
import { InventoryDocumentSchema } from "@/app/components/Statistics/Annual/Schema";
import { useEffect, useState } from "react";
import { inventoryColumns } from "./AnnualColumnDef";
import { inventoryLogFields } from "./AnnualFieldConfig";
import { InventoryLog } from "./AnnualRecord";
import AnnualTable from "./AnnualTable";

/**
 * Inventory
 * Uses the shared AnnualTable with inventory-specific column / field configs.
 */
const Inventory = () => {
  const [records, setRecords] = useState<InventoryLog[]>([]);

  async function loadRecords() {
    const result = await getInventoryDocuments();
    if (result.success) setRecords(result.result as unknown as InventoryLog[]);
  }

  useEffect(() => {
    loadRecords();
  }, []);

  const handleAdd = async (record: Record<string, unknown>) => {
    await createInventoryDocument(record as InventoryDocumentSchema);
    await loadRecords();
  };

  const handleUpdate = async (record: Record<string, unknown>) => {
    await updateInventoryDocument(
      record.id as number,
      record as InventoryDocumentSchema,
    );
    await loadRecords();
  };

  const handleDelete = async (id: number) => {
    await deleteInventoryDocument(id);
    await loadRecords();
  };

  return (
    <AnnualTable<InventoryLog & Record<string, unknown>>
      title="Inventory"
      subtitle="Court Document Inventory — Track all court documents and filings"
      data={records as (InventoryLog & Record<string, unknown>)[]}
      columns={inventoryColumns}
      fields={inventoryLogFields}
      dateKey="dateRecorded"
      sortDefaultKey="dateRecorded"
      onChange={(data) => setRecords(data as InventoryLog[])}
      onAdd={handleAdd}
      onUpdate={handleUpdate}
      onDelete={handleDelete}
    />
  );
};

export default Inventory;
