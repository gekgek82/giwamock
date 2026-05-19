"use client";

function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export interface ToggleGroupOption<T extends string> {
  value: T;
  label: React.ReactNode;
}

export interface ToggleGroupProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: ToggleGroupOption<T>[];
  className?: string;
}

export function ToggleGroup<T extends string>({
  value,
  onChange,
  options,
  className,
}: ToggleGroupProps<T>) {
  return (
    <div className={cn("flex bg-neutral-100 rounded-full p-1", className)}>
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "px-3 py-1.5 rounded-full body-14-medium transition-all",
            value === option.value
              ? "bg-primary-700 text-white"
              : "text-neutral-700 hover:text-neutral-1000",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
