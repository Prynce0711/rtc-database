"use client";

import React from "react";

export type TableInteractionContextValue = {
  disableCellTooltips: boolean;
};

export const TableInteractionContext =
  React.createContext<TableInteractionContextValue>({
    disableCellTooltips: false,
  });
