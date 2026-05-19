"use client";

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  size?: "sm" | "md";
}

export function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
  size = "md",
}: ToggleProps) {
  const isSm = size === "sm";

  return (
    <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        className={`relative inline-flex shrink-0 rounded-full transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-gray-1000/20 disabled:opacity-50 disabled:cursor-not-allowed ${isSm ? "w-8 h-[18px]" : "w-10 h-[22px]"} ${checked ? "bg-ds-gray-1000" : "bg-ds-gray-400"}`}
      >
        <span
          className={`pointer-events-none inline-block rounded-full bg-ds-background-100 shadow-sm transition-transform duration-200 ease-in-out ${isSm ? "w-3 h-3" : "w-4 h-4"} ${checked ? (isSm ? "translate-x-[15px]" : "translate-x-[19px]") : "translate-x-[3px]"} ${isSm ? "translate-y-[3px]" : "translate-y-[3px]"}`}
        />
      </button>
      {label && <span className="text-sm text-ds-gray-900">{label}</span>}
    </label>
  );
}
