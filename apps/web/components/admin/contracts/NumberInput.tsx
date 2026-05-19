"use client";

// ============================================================================
// Types
// ============================================================================

interface NumberInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  helperText?: string;
  min?: number;
  max?: number;
  suffix?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * NumberInput Component
 *
 * Input field for numeric values with validation.
 */
export function NumberInput({
  label,
  value,
  onChange,
  placeholder = "0",
  required = false,
  disabled = false,
  error,
  helperText,
  min,
  max,
  suffix,
}: NumberInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    // Allow empty string, digits, and decimal point
    if (newValue === "" || /^\d*\.?\d*$/.test(newValue)) {
      onChange(newValue);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-ds-gray-800">
        {label}
        {required && <span className="text-ds-red-400 ml-1">*</span>}
      </label>
      <div className="relative">
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={disabled}
          className={`h-9 w-full rounded-md border bg-ds-background-100 px-3 text-sm text-ds-gray-900 placeholder:text-ds-gray-600 transition-colors duration-150 focus:outline-none focus:ring-2 ${
            error
              ? "border-ds-red-700 focus:ring-ds-red-700/20"
              : "border-ds-gray-400 hover:border-ds-gray-500 focus:ring-ds-gray-1000/20 focus:border-ds-gray-700"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${
            suffix ? "pr-16" : ""
          }`}
        />
        {suffix && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ds-gray-600">
            {suffix}
          </div>
        )}
      </div>
      {error && <p className="text-xs text-ds-red-400">{error}</p>}
      {helperText && !error && (
        <p className="text-xs text-ds-gray-600">{helperText}</p>
      )}
      {(min !== undefined || max !== undefined) && !error && (
        <p className="text-xs text-ds-gray-600">
          {min !== undefined && max !== undefined
            ? `Range: ${min} - ${max}`
            : min !== undefined
            ? `Min: ${min}`
            : `Max: ${max}`}
        </p>
      )}
    </div>
  );
}
