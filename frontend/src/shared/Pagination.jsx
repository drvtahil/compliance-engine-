import React, { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const PAGE_SIZES = [50, 100, 150];

// Client-side paging for a list already in memory. Goes back to page 1 when
// the list changes length (new search/filter), and never points past the end.
export function usePagination(items, initialSize = 50) {
  const [pageSize, setPageSize] = useState(initialSize);
  const [page, setPage] = useState(1);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => { setPage(1); }, [total, pageSize]);

  const safePage = Math.min(page, totalPages);
  const pageItems = useMemo(
    () => items.slice((safePage - 1) * pageSize, safePage * pageSize),
    [items, safePage, pageSize]
  );

  return { pageItems, page: safePage, setPage, pageSize, setPageSize, totalPages, total, offset: (safePage - 1) * pageSize };
}

// "Rows per page: 50 100 150 · Page x of y · N items  < >"
export default function Pagination({ pager, noun = "item", className = "" }) {
  const { page, setPage, pageSize, setPageSize, totalPages, total } = pager;
  if (total === 0) return null;
  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-xs p-3 flex flex-wrap items-center justify-between gap-3 text-xs ${className}`}>
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-bold text-slate-500">Rows per page:</span>
        {PAGE_SIZES.map((size) => (
          <button
            key={size}
            type="button"
            onClick={() => setPageSize(size)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition ${
              pageSize === size ? "bg-[#ff5a36] text-white border-[#ff5a36]" : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
            }`}
          >
            {size}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-slate-500">
          Page {page} of {totalPages} &middot; {total} {noun}{total === 1 ? "" : "s"}
        </span>
        <button
          type="button"
          onClick={() => setPage(Math.max(1, page - 1))}
          disabled={page === 1}
          className="p-1.5 rounded-md border border-slate-300 bg-white disabled:opacity-40 hover:bg-slate-100"
        >
          <ChevronLeft className="w-3.5 h-3.5 text-slate-600" />
        </button>
        <button
          type="button"
          onClick={() => setPage(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className="p-1.5 rounded-md border border-slate-300 bg-white disabled:opacity-40 hover:bg-slate-100"
        >
          <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
        </button>
      </div>
    </div>
  );
}
