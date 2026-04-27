"use client";

import React from "react";
import { FiCalendar } from "react-icons/fi";

type CaseSectionHeaderProps = {
  sectionLabel: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
  navigation?: React.ReactNode;
  footer?: React.ReactNode;
};

const CaseSectionHeader: React.FC<CaseSectionHeaderProps> = ({
  sectionLabel,
  title,
  description,
  actions,
  navigation,
  footer,
}) => {
  return (
    <header className="card bg-base-100 shadow-xl">
      <div className="card-body p-4 sm:p-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div className="flex-1">
              <div className="mb-1 flex items-center gap-2 text-base font-bold text-base-content">
                <span>Cases</span>
                <span className="text-base-content/30">/</span>
                <span className="font-medium text-base-content/70">
                  {sectionLabel}
                </span>
              </div>
              <h1 className="text-3xl font-black tracking-tight text-base-content sm:text-4xl lg:text-5xl">
                {title}
              </h1>
              <p className="mt-1 flex items-center gap-2 text-sm font-medium text-base-content/50 sm:text-base">
                <FiCalendar className="shrink-0" />
                <span>{description}</span>
              </p>
            </div>

            {actions ? (
              <div className="flex flex-wrap items-center justify-end gap-2">
                {actions}
              </div>
            ) : null}
          </div>

          {navigation ? (
            <div className="border-t border-base-200 pt-4">{navigation}</div>
          ) : null}

          {footer}
        </div>
      </div>
    </header>
  );
};

export default CaseSectionHeader;
