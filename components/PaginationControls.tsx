import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export const DEFAULT_PAGE_SIZE = 7;

export const usePaginatedRows = <T,>(
  rows: T[],
  resetDeps: React.DependencyList = [],
  pageSize = DEFAULT_PAGE_SIZE
) => {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageStartIndex = (currentPage - 1) * pageSize;
  const pageEndIndex = Math.min(pageStartIndex + pageSize, rows.length);

  const paginatedRows = useMemo(
    () => rows.slice(pageStartIndex, pageStartIndex + pageSize),
    [rows, pageStartIndex, pageSize]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, resetDeps);

  useEffect(() => {
    setCurrentPage(page => Math.min(Math.max(page, 1), totalPages));
  }, [totalPages]);

  return {
    currentPage,
    totalPages,
    pageStartIndex,
    pageEndIndex,
    paginatedRows,
    setCurrentPage,
  };
};

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageStartIndex: number;
  pageEndIndex: number;
  onPageChange: (page: number | ((currentPage: number) => number)) => void;
  itemLabel?: string;
}

const PaginationControls: React.FC<PaginationControlsProps> = ({
  currentPage,
  totalPages,
  totalItems,
  pageStartIndex,
  pageEndIndex,
  onPageChange,
  itemLabel = 'records',
}) => {
  if (totalItems === 0) return null;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t bg-gray-50 px-4 py-3 text-[13px] text-gray-600">
      <div className="font-medium">
        Showing {pageStartIndex + 1}-{pageEndIndex} of {totalItems} {itemLabel}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPageChange(page => Math.max(1, page - 1))}
            disabled={currentPage === 1}
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
            title="Previous page"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="min-w-20 text-center font-semibold text-gray-700">
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(page => Math.min(totalPages, page + 1))}
            disabled={currentPage === totalPages}
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
            title="Next page"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
};

export default PaginationControls;
