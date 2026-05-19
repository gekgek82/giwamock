"use client";

import { forwardRef } from "react";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className = "", id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-medium text-ds-gray-800"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`h-9 w-full rounded-md border bg-ds-background-100 px-3 text-sm text-ds-gray-900 placeholder:text-ds-gray-600 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-ds-gray-1000/20 focus:border-ds-gray-700 disabled:opacity-50 disabled:cursor-not-allowed ${error ? "border-ds-red-700 focus:ring-ds-red-700/20" : "border-ds-gray-400 hover:border-ds-gray-500"} ${className}`}
          {...props}
        />
        {error && <p className="text-xs text-ds-red-400">{error}</p>}
        {hint && !error && <p className="text-xs text-ds-gray-600">{hint}</p>}
      </div>
    );
  },
);

Input.displayName = "Input";
