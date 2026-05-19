import { forwardRef } from "react";

/* ── Table wrapper (with border + overflow) ── */
export const Table = forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className = "", ...props }, ref) => (
  <div className="w-full overflow-x-auto rounded-lg border border-ds-gray-400">
    <table
      ref={ref}
      className={`w-full text-sm ${className}`}
      {...props}
    />
  </div>
));
Table.displayName = "Table";

/* ── TableHeader ── */
export const TableHeader = forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className = "", ...props }, ref) => (
  <thead
    ref={ref}
    className={`bg-ds-gray-100 ${className}`}
    {...props}
  />
));
TableHeader.displayName = "TableHeader";

/* ── TableBody ── */
export const TableBody = forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className = "", ...props }, ref) => (
  <tbody
    ref={ref}
    className={`divide-y divide-ds-gray-400 ${className}`}
    {...props}
  />
));
TableBody.displayName = "TableBody";

/* ── TableRow ── */
export const TableRow = forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className = "", ...props }, ref) => (
  <tr
    ref={ref}
    className={`transition-colors duration-100 hover:bg-ds-gray-100 ${className}`}
    {...props}
  />
));
TableRow.displayName = "TableRow";

/* ── TableHead (th) ── */
export const TableHead = forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className = "", ...props }, ref) => (
  <th
    ref={ref}
    className={`h-10 px-4 text-left text-xs font-medium text-ds-gray-700 uppercase tracking-wider ${className}`}
    {...props}
  />
));
TableHead.displayName = "TableHead";

/* ── TableCell (td) ── */
export const TableCell = forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className = "", ...props }, ref) => (
  <td
    ref={ref}
    className={`px-4 py-3 text-ds-gray-900 ${className}`}
    {...props}
  />
));
TableCell.displayName = "TableCell";
