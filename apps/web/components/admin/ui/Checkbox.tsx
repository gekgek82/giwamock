"use client";

import { forwardRef } from "react";

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, className = "", id, ...props }, ref) => {
    const checkboxId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <label
        htmlFor={checkboxId}
        className="inline-flex items-center gap-2 cursor-pointer select-none group"
      >
        <div className="relative flex items-center justify-center">
          <input
            ref={ref}
            id={checkboxId}
            type="checkbox"
            className="peer sr-only"
            {...props}
          />
          <div
            className={`w-4 h-4 rounded border border-ds-gray-400 bg-ds-background-100 peer-checked:bg-ds-gray-1000 peer-checked:border-ds-gray-1000 peer-focus-visible:ring-2 peer-focus-visible:ring-ds-gray-1000/20 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed transition-colors duration-150 group-hover:border-ds-gray-500 ${className}`}
          />
          <svg
            className="absolute w-3 h-3 text-ds-background-100 opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity duration-150"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        {label && (
          <span className="text-sm text-ds-gray-900 peer-disabled:opacity-50">
            {label}
          </span>
        )}
      </label>
    );
  },
);

Checkbox.displayName = "Checkbox";
