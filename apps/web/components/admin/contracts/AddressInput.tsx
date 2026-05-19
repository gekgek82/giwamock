"use client";

import { useState, useEffect } from "react";
import { isAddress } from "viem";

// ============================================================================
// Types
// ============================================================================

interface AddressInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  helperText?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * AddressInput Component
 *
 * Input field for Ethereum addresses with validation.
 */
export function AddressInput({
  label,
  value,
  onChange,
  placeholder = "0x...",
  required = false,
  disabled = false,
  error,
  helperText,
}: AddressInputProps) {
  const [internalError, setInternalError] = useState<string | null>(null);

  useEffect(() => {
    if (value && value.length > 0) {
      if (!value.startsWith("0x")) {
        setInternalError("Address must start with 0x");
      } else if (value.length === 42 && !isAddress(value)) {
        setInternalError("Invalid Ethereum address");
      } else if (value.length > 42) {
        setInternalError("Address is too long");
      } else {
        setInternalError(null);
      }
    } else {
      setInternalError(null);
    }
  }, [value]);

  const displayError = error || internalError;
  const isValid = value.length === 42 && isAddress(value);

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-ds-gray-800">
        {label}
        {required && <span className="text-ds-red-400 ml-1">*</span>}
      </label>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={`h-9 w-full rounded-md border bg-ds-background-100 px-3 text-sm font-geist-mono text-ds-gray-900 placeholder:text-ds-gray-600 transition-colors duration-150 focus:outline-none focus:ring-2 ${
            displayError
              ? "border-ds-red-700 focus:ring-ds-red-700/20"
              : isValid
              ? "border-ds-green-700 focus:ring-ds-green-700/20"
              : "border-ds-gray-400 hover:border-ds-gray-500 focus:ring-ds-gray-1000/20 focus:border-ds-gray-700"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        />
        {isValid && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <svg
              className="w-4 h-4 text-ds-green-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        )}
      </div>
      {displayError && (
        <p className="text-xs text-ds-red-400">{displayError}</p>
      )}
      {helperText && !displayError && (
        <p className="text-xs text-ds-gray-600">{helperText}</p>
      )}
    </div>
  );
}
