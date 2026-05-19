"use client";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      className="w-3 h-3"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {direction === "left" ? (
        <polyline points="15 18 9 12 15 6" />
      ) : (
        <polyline points="9 18 15 12 9 6" />
      )}
    </svg>
  );
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: PaginationProps) {
  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);

      if (currentPage > 3) {
        pages.push("...");
      }

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (currentPage < totalPages - 2) {
        pages.push("...");
      }

      pages.push(totalPages);
    }

    return pages;
  };

  const pages = getPageNumbers();

  return (
    <div className="flex items-center gap-5 py-[30px]">
      {/* Previous button */}
      <button
        type="button"
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        aria-label="Previous page"
        className="w-6 h-6 flex items-center justify-center text-gray-80 hover:text-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <Chevron direction="left" />
      </button>

      {/* Page numbers */}
      <div className="flex items-center gap-5">
        {pages.map((page, index) => {
          const isActive = page === currentPage;
          const isEllipsis = page === "...";

          if (isEllipsis) {
            return (
              <span
                key={`ellipsis-${index}`}
                className="text-gray-80 body-16 leading-6 text-center"
              >
                …
              </span>
            );
          }

          if (isActive) {
            return (
              <span
                key={page}
                className="w-6 h-6 flex items-center justify-center rounded-full bg-primary-200 text-white body-16-bold leading-6"
              >
                {page}
              </span>
            );
          }

          return (
            <button
              key={page}
              type="button"
              onClick={() =>
                typeof page === "number" && onPageChange(page)
              }
              className="text-gray-80 body-16 leading-6 text-center hover:text-gray-100 transition-colors"
            >
              {page}
            </button>
          );
        })}
      </div>

      {/* Next button */}
      <button
        type="button"
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
        aria-label="Next page"
        className="w-6 h-6 flex items-center justify-center text-gray-80 hover:text-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <Chevron direction="right" />
      </button>
    </div>
  );
}
