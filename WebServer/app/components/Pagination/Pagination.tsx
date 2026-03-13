"use client";

import React, { useState } from "react";
import { GrFormNext, GrFormPrevious } from "react-icons/gr";

interface PaginationProps {
  pageCount: number;
  currentPage: number;
  onPageChange?: (page: number) => void;
  className?: string;
  joinClassName?: string;
}

const Pagination: React.FC<PaginationProps> = ({
  pageCount,
  currentPage,
  onPageChange,
  className,
  joinClassName,
}) => {
  const getPages = () => {
    const pages: (number | string)[] = [];
    const delta = 1; // how many pages before/after current

    if (pageCount <= 1) {
      return [1];
    }

    const rangeStart = Math.max(2, currentPage - delta);
    const rangeEnd = Math.min(pageCount - 1, currentPage + delta);

    pages.push(1);

    if (rangeStart > 2) {
      pages.push("...");
    }

    for (let i = rangeStart; i <= rangeEnd; i++) {
      pages.push(i);
    }

    if (rangeEnd < pageCount - 1) {
      pages.push("...");
    }

    if (pageCount > 1) {
      pages.push(pageCount);
    }

    return pages;
  };

  const pages = getPages();
  const [activeEllipsis, setActiveEllipsis] = useState<number | null>(null);
  const [ellipsisValue, setEllipsisValue] = useState<string>("");

  const submitEllipsis = (val?: string) => {
    const v = (val ?? ellipsisValue).trim();
    const n = Number(v);
    if (!Number.isNaN(n) && n >= 1 && n <= pageCount) {
      onPageChange?.(n);
    }
    setActiveEllipsis(null);
    setEllipsisValue("");
  };

  return (
    <div className={className ?? "w-full flex justify-center py-0"}>
      <div
        className={
          joinClassName ??
          "flex items-center gap-1 rounded-xl border border-base-200 bg-base-100 px-2 py-1 shadow-sm"
        }
      >
        {/* PREVIOUS (hidden on first page) */}
        {currentPage > 1 && (
          <button
            className="btn btn-sm btn-ghost rounded-lg px-2"
            onClick={() => onPageChange?.(Math.max(1, currentPage - 1))}
            aria-label="Previous page"
          >
            <GrFormPrevious className="w-5 h-5" />
          </button>
        )}

        {/* PAGE BUTTONS */}
        {/** interactive ellipsis: click to type a page number to jump */}
        {pages.map((page, index) => {
          if (page === "...") {
            if (activeEllipsis === index) {
              return (
                <div key={`ell-${index}`}>
                  <input
                    autoFocus
                    className="input input-sm w-20 text-center rounded-lg"
                    value={ellipsisValue}
                    onChange={(e) => setEllipsisValue(e.target.value)}
                    onBlur={() => submitEllipsis()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submitEllipsis();
                      if (e.key === "Escape") {
                        setActiveEllipsis(null);
                        setEllipsisValue("");
                      }
                    }}
                    aria-label="Jump to page"
                  />
                </div>
              );
            }

            return (
              <button
                key={`ell-btn-${index}`}
                className="btn btn-sm btn-ghost rounded-lg min-w-8"
                onClick={() => {
                  setActiveEllipsis(index);
                  setEllipsisValue("");
                }}
                aria-label="Open page jump"
              >
                ...
              </button>
            );
          }

          return (
            <PageButton
              key={page}
              isActive={currentPage === page}
              onClick={() => onPageChange?.(page as number)}
              aria-label={String(page)}
            >
              {page}
            </PageButton>
          );
        })}

        {/* NEXT (disabled if last page) */}
        <button
          className="btn btn-sm btn-ghost rounded-lg px-2"
          onClick={() => onPageChange?.(Math.min(pageCount, currentPage + 1))}
          aria-label="Next page"
          disabled={currentPage >= pageCount}
        >
          <GrFormNext className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

function PageButton({
  isActive,
  children,
  onClick,
  disabled = false,
}: {
  isActive?: boolean;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      className={`btn btn-sm rounded-lg min-w-8 px-2 ${
        isActive
          ? "bg-base-300 text-base-content font-bold hover:bg-base-300"
          : "btn-ghost text-base-content/80 hover:text-base-content"
      }`}
      onClick={onClick}
      disabled={disabled}
      aria-current={isActive ? "page" : undefined}
    >
      {children}
    </button>
  );
}

export default Pagination;
