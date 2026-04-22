"use client";

import { useEffect } from "react";

const STYLE_ELEMENT_ID = "rtc-unified-table-style";
const TABLE_SELECTOR = "table:not([data-rtc-table-ignore='true'])";
const MIN_COLUMN_WIDTH = 96;

const UNIFIED_TABLE_CSS = `
.rtc-table-surface {
  border: 1px solid var(--surface-border, color-mix(in srgb, currentColor 12%, transparent));
  border-radius: 0.85rem;
  background: var(--surface-card, var(--color-base-100));
  overflow: auto;
}

table.rtc-unified-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  background: transparent;
}

table.rtc-unified-table thead th {
  position: relative;
  background: color-mix(in srgb, var(--color-base-200) 68%, transparent);
  color: color-mix(in srgb, var(--color-base-content) 68%, transparent);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 0.72rem 0.85rem;
  border-bottom: 1px solid var(--surface-border-strong, var(--surface-border));
  border-right: 1px solid var(--surface-border, color-mix(in srgb, currentColor 12%, transparent));
  white-space: nowrap;
}

table.rtc-unified-table thead th:last-child {
  border-right: none;
}

table.rtc-unified-table tbody td {
  border-bottom: 1px solid var(--surface-border, color-mix(in srgb, currentColor 12%, transparent));
  border-right: 1px solid var(--surface-border, color-mix(in srgb, currentColor 12%, transparent));
}

table.rtc-unified-table tbody td:last-child {
  border-right: none;
}

table.rtc-unified-table tbody tr:last-child td {
  border-bottom: none;
}

table.rtc-unified-table tbody tr:nth-child(even) {
  background: color-mix(in srgb, var(--color-base-200) 24%, transparent);
}

table.rtc-unified-table tbody tr:hover {
  background: color-mix(in srgb, var(--color-primary) 6%, transparent);
}

table.rtc-unified-table .rtc-col-resizer {
  position: absolute;
  right: -1px;
  top: 0;
  height: 100%;
  width: 12px;
  cursor: col-resize;
  user-select: none;
  touch-action: none;
}

table.rtc-unified-table .rtc-col-resizer::before {
  content: "";
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  height: 1.25rem;
  border-right: 1px solid color-mix(in srgb, var(--color-base-content) 24%, transparent);
}

table.rtc-unified-table th.rtc-col-resizing .rtc-col-resizer::before,
table.rtc-unified-table th:hover .rtc-col-resizer::before {
  border-right-color: var(--color-primary);
}

table.rtc-unified-table.rtc-table-resizing,
table.rtc-unified-table.rtc-table-resizing * {
  cursor: col-resize !important;
  user-select: none !important;
}
`;

type ResizeBinding = {
  onMouseDown: (event: MouseEvent) => void;
  handle: HTMLSpanElement;
};

const resizeBindingMap = new WeakMap<HTMLTableCellElement, ResizeBinding>();

const ensureStyleElement = (): void => {
  if (typeof document === "undefined") return;

  const existing = document.getElementById(STYLE_ELEMENT_ID);
  if (existing) return;

  const style = document.createElement("style");
  style.id = STYLE_ELEMENT_ID;
  style.textContent = UNIFIED_TABLE_CSS;
  document.head.appendChild(style);
};

const getLeafHeaderCells = (
  table: HTMLTableElement,
): HTMLTableCellElement[] => {
  const theadRows = Array.from(table.tHead?.rows ?? []);

  for (let index = theadRows.length - 1; index >= 0; index -= 1) {
    const leafHeaders = Array.from(theadRows[index].cells).filter(
      (cell): cell is HTMLTableCellElement =>
        cell instanceof HTMLTableCellElement &&
        cell.tagName === "TH" &&
        cell.colSpan === 1,
    );

    if (leafHeaders.length > 0) {
      return leafHeaders;
    }
  }

  return [];
};

const getColumnIndexInRow = (
  row: HTMLTableRowElement,
  targetCell: HTMLTableCellElement,
): number => {
  let index = 0;

  for (const cell of Array.from(row.cells)) {
    if (cell === targetCell) {
      return index;
    }

    index += Math.max(1, cell.colSpan || 1);
  }

  return -1;
};

const getCellAtColumn = (
  row: HTMLTableRowElement,
  targetColumnIndex: number,
): HTMLTableCellElement | null => {
  let currentColumnIndex = 0;

  for (const cell of Array.from(row.cells)) {
    const span = Math.max(1, cell.colSpan || 1);
    const inSpan =
      targetColumnIndex >= currentColumnIndex &&
      targetColumnIndex < currentColumnIndex + span;

    if (inSpan) {
      return cell as HTMLTableCellElement;
    }

    currentColumnIndex += span;
  }

  return null;
};

const setColumnWidth = (
  table: HTMLTableElement,
  columnIndex: number,
  width: number,
): void => {
  const safeWidth = `${Math.max(MIN_COLUMN_WIDTH, Math.round(width))}px`;

  for (const row of Array.from(table.rows)) {
    const cell = getCellAtColumn(row, columnIndex);
    if (!cell || cell.colSpan > 1) continue;

    cell.style.width = safeWidth;
    cell.style.minWidth = safeWidth;
    cell.style.maxWidth = safeWidth;
  }
};

const bindResizeHandle = (
  table: HTMLTableElement,
  headerCell: HTMLTableCellElement,
): void => {
  if (resizeBindingMap.has(headerCell)) return;

  const headerRow = headerCell.parentElement;
  if (!(headerRow instanceof HTMLTableRowElement)) return;

  const columnIndex = getColumnIndexInRow(headerRow, headerCell);
  if (columnIndex < 0) return;

  const handle = document.createElement("span");
  handle.className = "rtc-col-resizer";

  const onMouseDown = (event: MouseEvent): void => {
    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startWidth = headerCell.getBoundingClientRect().width;

    table.classList.add("rtc-table-resizing");
    headerCell.classList.add("rtc-col-resizing");

    const onMouseMove = (moveEvent: MouseEvent): void => {
      const nextWidth = Math.max(
        MIN_COLUMN_WIDTH,
        startWidth + (moveEvent.clientX - startX),
      );
      setColumnWidth(table, columnIndex, nextWidth);
    };

    const onMouseUp = (): void => {
      table.classList.remove("rtc-table-resizing");
      headerCell.classList.remove("rtc-col-resizing");
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  handle.addEventListener("mousedown", onMouseDown);

  headerCell.style.position = "relative";
  headerCell.appendChild(handle);

  resizeBindingMap.set(headerCell, {
    onMouseDown,
    handle,
  });
};

const applyTableEnhancements = (table: HTMLTableElement): void => {
  table.classList.add("rtc-unified-table");

  const parentElement = table.parentElement;
  if (parentElement instanceof HTMLDivElement) {
    parentElement.classList.add("rtc-table-surface");
  }

  if (table.hasAttribute("data-rtc-disable-resize")) return;
  if (table.querySelector("thead [role='separator']")) return;

  const headerCells = getLeafHeaderCells(table);
  if (headerCells.length < 2) return;

  if (!table.classList.contains("xls-table-auto") && !table.style.tableLayout) {
    table.style.tableLayout = "fixed";
  }

  for (const headerCell of headerCells) {
    bindResizeHandle(table, headerCell);
  }
};

const refreshAllTables = (): void => {
  if (typeof document === "undefined") return;

  const tables = document.querySelectorAll(TABLE_SELECTOR);
  for (const table of Array.from(tables)) {
    if (table instanceof HTMLTableElement) {
      applyTableEnhancements(table);
    }
  }
};

export default function GlobalTableEnhancer() {
  useEffect(() => {
    if (typeof document === "undefined") return;

    ensureStyleElement();
    refreshAllTables();

    let rafId = 0;
    const queueRefresh = () => {
      if (rafId !== 0) return;

      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        refreshAllTables();
      });
    };

    const observer = new MutationObserver(queueRefresh);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      if (rafId !== 0) {
        window.cancelAnimationFrame(rafId);
      }
      observer.disconnect();
    };
  }, []);

  return null;
}
