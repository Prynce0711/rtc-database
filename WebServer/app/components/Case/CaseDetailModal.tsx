/**
 * Case Detail Modal Component
 *
 * Displays comprehensive case information in a modern, wide modal.
 * Shows all fields from the case schema organized into logical sections.
 * Uses ModalBase for consistent modal behavior across the application.
 */

"use client";

import React from "react";
import type { Case } from "../../generated/prisma/client";
import ModalBase from "../Popup/ModalBase";

interface CaseDetailModalProps {
  /** The case to display */
  caseData: Case;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Optional requestClose injected by ModalBase to run animated close */
  requestClose?: () => void;
}

const CaseDetailModal: React.FC<CaseDetailModalProps> = ({
  caseData,
  onClose,
  requestClose,
}) => {
  /**
   * Formats a date for display, handling null/undefined values
   */
  const formatDate = (date: Date | string | null | undefined): string => {
    if (!date) return "Not set";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  /**
   * Formats currency values for display
   */
  const formatCurrency = (amount: number | null | undefined): string => {
    if (amount === null || amount === undefined) return "Not set";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "PHP",
    }).format(amount);
  };

  return (
    <ModalBase onClose={onClose}>
      <div className="bg-base-100 rounded-2xl shadow-2xl w-[90vw] max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header Section */}
        <div className="bg-gradient-to-r from-primary to-primary-focus text-primary-content px-8 py-6 flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold">{caseData.name}</h2>
            <p className="text-lg opacity-90 mt-1">{caseData.caseNumber}</p>
          </div>
          <button
            onClick={() => (requestClose ? requestClose() : onClose())}
            className="btn btn-circle btn-ghost hover:bg-primary-focus"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content Section - Scrollable */}
        <div className="overflow-y-auto flex-1 px-8 py-6">
          <div className="space-y-6">
            {/* Case Information Section */}
            <div className="card bg-base-200 shadow-md">
              <div className="card-body">
                <h3 className="card-title text-2xl mb-4 flex items-center gap-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6 text-primary"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  Case Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <DetailItem label="Charge" value={caseData.charge} />
                  <DetailItem label="Court" value={caseData.court} />
                  <DetailItem
                    label="Date Filed"
                    value={formatDate(caseData.dateFiled)}
                  />
                  <DetailItem
                    label="Raffle Date"
                    value={formatDate(caseData.raffleDate)}
                  />
                  <DetailItem label="Info Sheet" value={caseData.infoSheet} />
                  <DetailItem
                    label="Consolidation"
                    value={caseData.consolidation}
                  />
                </div>
              </div>
            </div>

            {/* Branch Information Section */}
            <div className="card bg-base-200 shadow-md">
              <div className="card-body">
                <h3 className="card-title text-2xl mb-4 flex items-center gap-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6 text-secondary"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                    />
                  </svg>
                  Branch Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <DetailItem label="Branch" value={caseData.branch} />
                  <DetailItem
                    label="Assistant Branch"
                    value={caseData.assistantBranch}
                  />
                </div>
              </div>
            </div>

            {/* Status Information Section */}
            <div className="card bg-base-200 shadow-md">
              <div className="card-body">
                <h3 className="card-title text-2xl mb-4 flex items-center gap-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6 text-accent"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Status & Financial
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="form-control">
                    <label className="label mb-1">
                      <span className="label-text font-semibold">
                        Detention Status
                      </span>
                    </label>
                    <div>
                      <span
                        className={`badge badge-lg backdrop-blur-md border font-medium
${
  caseData.detained
    ? "bg-red-500/15 text-red-600 border-red-400/30"
    : "bg-emerald-500/15 text-emerald-600 border-emerald-400/30"
}`}
                      >
                        {caseData.detained ? "Detained" : "Free"}
                      </span>
                    </div>
                  </div>
                  <DetailItem
                    label="Bond Amount"
                    value={formatCurrency(caseData.bond)}
                  />
                  <DetailItem
                    label="EQC Number"
                    value={caseData.eqcNumber?.toString() || "Not set"}
                  />
                </div>
              </div>
            </div>

            {/* Committee Information Section */}
            <div className="card bg-base-200 shadow-md">
              <div className="card-body">
                <h3 className="card-title text-2xl mb-4 flex items-center gap-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6 text-info"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                  Committee Assignment
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <DetailItem
                    label="Committee 1"
                    value={caseData.committe1?.toString() || "Not assigned"}
                  />
                  <DetailItem
                    label="Committee 2"
                    value={caseData.committe2?.toString() || "Not assigned"}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Section */}
        <div className="bg-base-200 px-8 py-4 flex justify-end border-t border-base-300">
          <button
            onClick={() => (requestClose ? requestClose() : onClose())}
            className="btn btn-primary btn-wide"
          >
            Close
          </button>
        </div>
      </div>
    </ModalBase>
  );
};

/**
 * Reusable detail item component for displaying label-value pairs
 */
const DetailItem: React.FC<{ label: string; value: string | number }> = ({
  label,
  value,
}) => (
  <div className="form-control">
    <label className="label">
      <span className="label-text font-semibold text-sm opacity-70">
        {label}
      </span>
    </label>
    <div className="text-base font-medium">{value}</div>
  </div>
);

export default CaseDetailModal;
