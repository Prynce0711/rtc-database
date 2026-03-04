"use client";

import React from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   Skeleton Primitives — high-visibility shimmer placeholders
   ═══════════════════════════════════════════════════════════════════════════ */

const shimmer =
  "relative isolate overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-shimmer before:bg-gradient-to-r before:from-transparent before:via-white/60 before:to-transparent";

/** Basic rectangular skeleton block */
export const SkeletonBox = ({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) => (
  <div
    className={`rounded-lg bg-base-300 ${shimmer} ${className}`}
    style={style}
  />
);

/** Circle skeleton (avatar, icon) */
export const SkeletonCircle = ({
  size = 40,
  className = "",
}: {
  size?: number;
  className?: string;
}) => (
  <div
    className={`rounded-full bg-base-300 shrink-0 ${shimmer} ${className}`}
    style={{ width: size, height: size }}
  />
);

/** Text-line skeleton with natural width variation */
export const SkeletonLine = ({
  width = "100%",
  height = 14,
  className = "",
}: {
  width?: string | number;
  height?: number;
  className?: string;
}) => (
  <div
    className={`rounded-md bg-base-300 ${shimmer} ${className}`}
    style={{ width, height }}
  />
);

/* ═══════════════════════════════════════════════════════════════════════════
   Composite Skeletons — faithful page-level loading states
   ═══════════════════════════════════════════════════════════════════════════ */

/** KPI stat card skeleton — mirrors the real card layout */
const StatCardSkeleton = ({ delay = 0 }: { delay?: number }) => (
  <div
    className="card bg-base-100 border border-base-200 shadow-sm relative overflow-hidden"
    style={{
      animation: `skeletonFadeIn 0.5s ease-out ${delay}ms both`,
    }}
  >
    <div className="card-body p-6">
      {/* faint icon ghost (top-right like real card) */}
      <div className="absolute right-0 top-0 h-28 w-28 -translate-y-6 translate-x-6 opacity-[0.04]">
        <SkeletonCircle size={112} className="rounded-lg! opacity-40" />
      </div>
      <div className="relative flex flex-col items-center gap-3 text-center">
        {/* label */}
        <SkeletonLine width={100} height={14} />
        {/* big number */}
        <SkeletonLine width={140} height={48} className="rounded-xl" />
        {/* subtitle */}
        <SkeletonLine width={120} height={13} />
      </div>
    </div>
  </div>
);

/** Toolbar skeleton — search input + dropdown + buttons (matches real toolbar) */
const ToolbarSkeleton = ({ showActions = true }: { showActions?: boolean }) => (
  <div className="flex gap-4 items-center">
    {/* Search input */}
    <SkeletonBox className="flex-1 h-12 rounded-lg" />
    {/* Type dropdown */}
    <SkeletonBox className="w-32 h-12 rounded-lg" />
    {/* Filter button */}
    <SkeletonBox className="w-24 h-12 rounded-lg" />
    {showActions && (
      <>
        {/* Import Excel */}
        <SkeletonBox className="w-28 h-12 rounded-lg" />
        {/* Export Excel */}
        <SkeletonBox className="w-28 h-12 rounded-lg" />
        {/* Add Case (accent) */}
        <SkeletonBox className="w-28 h-12 rounded-lg bg-base-300/80" />
      </>
    )}
  </div>
);

/** Table skeleton — header row + data rows with staggered entrance */
const TableSkeleton = ({
  columns = 7,
  rows = 12,
}: {
  columns?: number;
  rows?: number;
}) => {
  // Deterministic varied widths per column so it looks natural
  const headerWidths = [56, 100, 64, 96, 80, 88, 72, 68, 110, 60, 90, 76, 84];
  const cellPatterns = [
    [50, 90, 44, 80, 66, 74, 58, 52, 96, 48, 76, 62, 70],
    [70, 76, 56, 88, 72, 82, 64, 60, 84, 54, 68, 58, 78],
    [60, 84, 50, 72, 58, 70, 48, 56, 90, 42, 82, 54, 66],
  ];

  return (
    <div className="bg-base-100 rounded-xl border border-base-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-base-200/80 px-3 py-3.5 flex gap-3 border-b border-base-300/40">
        {Array.from({ length: columns }).map((_, i) => (
          <SkeletonLine
            key={`th-${i}`}
            width={headerWidths[i % headerWidths.length]}
            height={12}
            className="opacity-70 shrink-0"
          />
        ))}
      </div>
      {/* Data rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div
          key={`row-${rowIdx}`}
          className={`px-3 py-3 flex gap-3 border-b border-base-200/40 ${
            rowIdx % 2 === 1 ? "bg-base-200/20" : ""
          }`}
          style={{
            animation: `skeletonFadeIn 0.35s ease-out ${60 * rowIdx}ms both`,
          }}
        >
          {Array.from({ length: columns }).map((_, colIdx) => {
            const pattern = cellPatterns[rowIdx % cellPatterns.length];
            return (
              <SkeletonLine
                key={`cell-${rowIdx}-${colIdx}`}
                width={pattern[colIdx % pattern.length]}
                height={11}
                className="shrink-0"
              />
            );
          })}
        </div>
      ))}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   Page-Level Skeletons
   ═══════════════════════════════════════════════════════════════════════════ */

/** Case Management / Proceedings list skeleton — mirrors the real page 1:1 */
export const PageListSkeleton = ({
  title = true,
  statCards = 4,
  tableColumns = 10,
  tableRows = 12,
  showActions = true,
}: {
  title?: boolean;
  statCards?: number;
  tableColumns?: number;
  tableRows?: number;
  showActions?: boolean;
}) => (
  <div className="min-h-screen bg-base-100">
    <main className="w-full">
      {/* ── Page Title ────────────────────────────────────────────────── */}
      {title && (
        <div
          className="mb-8"
          style={{ animation: "skeletonFadeIn 0.4s ease-out both" }}
        >
          <SkeletonLine width={340} height={44} className="rounded-xl mb-2" />
          <SkeletonLine width={200} height={20} />
        </div>
      )}

      {/* ── Toolbar (search + buttons) ────────────────────────────────── */}
      <div
        className="mb-6"
        style={{ animation: "skeletonFadeIn 0.4s ease-out 120ms both" }}
      >
        <ToolbarSkeleton showActions={showActions} />
      </div>

      {/* ── Stat Cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {Array.from({ length: statCards }).map((_, i) => (
          <StatCardSkeleton key={i} delay={220 + i * 100} />
        ))}
      </div>

      {/* ── Table ─────────────────────────────────────────────────────── */}
      <div
        className="mb-4"
        style={{ animation: "skeletonFadeIn 0.4s ease-out 650ms both" }}
      >
        <TableSkeleton columns={tableColumns} rows={tableRows} />
      </div>

      {/* ── Pagination ────────────────────────────────────────────────── */}
      <div
        className="flex justify-end"
        style={{ animation: "skeletonFadeIn 0.4s ease-out 900ms both" }}
      >
        <div className="flex gap-1.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonBox key={i} className="w-9 h-9 rounded-lg" />
          ))}
        </div>
      </div>
    </main>
  </div>
);

/** Detail / view page skeleton */
export const PageDetailSkeleton = () => (
  <div className="min-h-screen bg-base-100">
    {/* Top bar */}
    <header className="sticky top-0 z-50 bg-base-100/80 backdrop-blur-md border-b border-base-200">
      <div className="max-w-5xl mx-auto px-8 h-16 flex items-center justify-between">
        <SkeletonLine width={60} height={14} />
        <SkeletonLine width={160} height={13} />
        <div className="flex gap-2 items-center">
          <SkeletonBox className="w-8 h-8 rounded-lg" />
          <SkeletonLine width={36} height={14} />
          <SkeletonBox className="w-8 h-8 rounded-lg" />
        </div>
      </div>
    </header>

    {/* Body */}
    <main className="max-w-5xl mx-auto px-8 py-14 space-y-10">
      {/* Hero */}
      <div
        className="space-y-4"
        style={{ animation: "skeletonFadeIn 0.5s ease-out both" }}
      >
        <SkeletonLine width={130} height={12} />
        <SkeletonLine width={300} height={36} className="rounded-xl" />
        <div className="flex items-center gap-4">
          <SkeletonLine width={150} height={16} />
          <SkeletonBox className="w-20 h-7 rounded-full" />
        </div>
      </div>

      <div className="h-px bg-base-200" />

      {/* Tabs */}
      <div
        className="flex gap-4 border-b border-base-200 pb-0"
        style={{ animation: "skeletonFadeIn 0.4s ease-out 200ms both" }}
      >
        <SkeletonLine width={100} height={14} className="mb-3" />
        <SkeletonLine width={110} height={14} className="mb-3 opacity-40" />
      </div>

      {/* Fields grid */}
      <div
        className="space-y-5"
        style={{ animation: "skeletonFadeIn 0.4s ease-out 350ms both" }}
      >
        <SkeletonLine width={160} height={15} />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <SkeletonLine width={80} height={11} />
              <SkeletonBox className="h-14 rounded-xl" />
            </div>
          ))}
          <div className="md:col-span-2 lg:col-span-3 space-y-2">
            <SkeletonLine width={130} height={11} />
            <SkeletonBox className="h-14 rounded-xl" />
          </div>
        </div>
      </div>

      <div className="h-px bg-base-200" />

      {/* Nav buttons */}
      <div
        className="flex gap-3"
        style={{ animation: "skeletonFadeIn 0.4s ease-out 500ms both" }}
      >
        <SkeletonBox className="flex-1 h-16 rounded-xl" />
        <SkeletonBox className="flex-1 h-16 rounded-xl" />
      </div>
    </main>
  </div>
);

const SkeletonExports = {
  Box: SkeletonBox,
  Circle: SkeletonCircle,
  Line: SkeletonLine,
  PageList: PageListSkeleton,
  PageDetail: PageDetailSkeleton,
};

export default SkeletonExports;
