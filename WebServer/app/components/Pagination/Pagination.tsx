"use client";

import React from "react";
import { GrFormNext, GrFormPrevious } from "react-icons/gr";

interface PaginationProps {
  pageCount: number;
  currentPage: number;
  onPageChange?: (page: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({
  pageCount,
  currentPage,
  onPageChange,
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

  return (
    <div className="join">
      {/* PREVIOUS (hidden if first page) */}
      {currentPage > 1 && (
        <button
          className="join-item btn btn-sm"
          onClick={() => onPageChange?.(currentPage - 1)}
          aria-label="Previous page"
        >
          <GrFormPrevious className="w-5 h-5" />
        </button>
      )}

      {/* PAGE BUTTONS */}
      {pages.map((page, index) =>
        page === "..." ? (
          <button
            key={index}
            className="join-item btn btn-sm btn-disabled"
            disabled
          >
            ...
          </button>
        ) : (
          <PageButton
            key={page}
            isActive={currentPage === page}
            onClick={() => onPageChange?.(page as number)}
          >
            {page}
          </PageButton>
        ),
      )}

      {/* NEXT (hidden if last page) */}
      {currentPage < pageCount && (
        <button
          className="join-item btn btn-sm"
          onClick={() => onPageChange?.(currentPage + 1)}
          aria-label="Next page"
        >
          <GrFormNext className="w-5 h-5" />
        </button>
      )}
    </div>
  );
};

function PageButton({
  isActive,
  children,
  onClick,
}: {
  isActive?: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className={`join-item btn btn-sm ${isActive ? "btn-active" : ""}`}
      onClick={onClick}
      aria-current={isActive ? "page" : undefined}
    >
      {children}
    </button>
  );
}

export default Pagination;
