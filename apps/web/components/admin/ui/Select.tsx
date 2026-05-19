"use client";

import { forwardRef } from "react";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, placeholder, className = "", id, ...props }, ref) => {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={selectId}
            className="text-xs font-medium text-ds-gray-800"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={`h-9 w-full rounded-md border bg-ds-background-100 pl-3 pr-8 text-sm text-ds-gray-900 appearance-none transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-ds-gray-1000/20 focus:border-ds-gray-700 disabled:opacity-50 disabled:cursor-not-allowed ${error ? "border-ds-red-700 focus:ring-ds-red-700/20" : "border-ds-gray-400 hover:border-ds-gray-500"} ${className}`}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {/* Chevron icon */}
          <svg
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ds-gray-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
        {error && <p className="text-xs text-ds-red-400">{error}</p>}
      </div>
    );
  },
);

Select.displayName = "Select";
