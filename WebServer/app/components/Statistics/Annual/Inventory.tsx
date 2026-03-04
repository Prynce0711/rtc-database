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

interface InventoryProps {
  selectedYear?: string;
  requestAdd?: number;
  onDataReady?: (data: Record<string, unknown>[]) => void;
  onActivePageChange?: (active: boolean) => void;
  activeView?: string;
  onSwitchView?: (view: string) => void;
}

/**
 * Inventory
 * Uses the shared AnnualTable with inventory-specific column / field configs.
 */
const Inventory = ({
  selectedYear,
  requestAdd,
  onDataReady,
  onActivePageChange,
  activeView,
  onSwitchView,
}: InventoryProps) => {
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

  useEffect(() => {
    if (onDataReady)
      onDataReady(records as unknown as Record<string, unknown>[]);
  }, [records, onDataReady]);

  return (
    <AnnualTable<InventoryLog & Record<string, unknown>>
      title="Inventory"
      subtitle="Court Document Inventory — Track all court documents and filings"
      variant="inventory"
      data={records as (InventoryLog & Record<string, unknown>)[]}
      columns={inventoryColumns}
      fields={inventoryLogFields}
      dateKey="dateRecorded"
      sortDefaultKey="dateRecorded"
      selectedYear={selectedYear}
      requestAdd={requestAdd}
      onChange={(data) => setRecords(data as InventoryLog[])}
      onAdd={handleAdd}
      onUpdate={handleUpdate}
      onDelete={handleDelete}
      onActivePageChange={onActivePageChange}
      activeView={activeView}
      onSwitchView={onSwitchView}
    />
  );
};

export default Inventory;
