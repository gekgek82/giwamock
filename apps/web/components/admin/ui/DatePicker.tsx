"use client";

import { useState, useRef, useEffect } from "react";
import { DayPicker } from "react-day-picker";
import { format, parse, isValid } from "date-fns";

interface DatePickerProps {
  value: string; // "YYYY-MM-DD" or ""
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  className,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = value
    ? parse(value, "yyyy-MM-dd", new Date())
    : undefined;

  const handleSelect = (day: Date | undefined) => {
    if (day) {
      onChange(format(day, "yyyy-MM-dd"));
    } else {
      onChange("");
    }
    setOpen(false);
  };

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="h-9 w-full rounded-md border border-ds-gray-400 bg-ds-background-100 px-3 text-sm text-left transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-ds-gray-1000/20 focus:border-ds-gray-700 hover:border-ds-gray-500 flex items-center justify-between gap-2"
      >
        <span className={value ? "text-ds-gray-900" : "text-ds-gray-600"}>
          {selected && isValid(selected)
            ? format(selected, "yyyy-MM-dd")
            : placeholder}
        </span>
        <svg
          className="w-4 h-4 text-ds-gray-600 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
          />
        </svg>
      </button>

      {/* Calendar dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 rounded-lg border border-ds-gray-400 bg-ds-background-200 shadow-xl p-3 animate-in fade-in-0 zoom-in-95">
          <DayPicker
            mode="single"
            selected={selected && isValid(selected) ? selected : undefined}
            onSelect={handleSelect}
            defaultMonth={
              selected && isValid(selected) ? selected : new Date()
            }
            classNames={{
              root: "text-ds-gray-900 text-sm",
              months: "flex flex-col",
              month_caption:
                "flex justify-center items-center h-8 mb-1",
              caption_label:
                "text-sm font-medium text-ds-gray-1000",
              nav: "flex items-center gap-1",
              button_previous:
                "absolute left-1 top-3 inline-flex items-center justify-center w-7 h-7 rounded-md text-ds-gray-700 hover:text-ds-gray-1000 hover:bg-ds-gray-300 transition-colors",
              button_next:
                "absolute right-1 top-3 inline-flex items-center justify-center w-7 h-7 rounded-md text-ds-gray-700 hover:text-ds-gray-1000 hover:bg-ds-gray-300 transition-colors",
              month_grid: "w-full border-collapse",
              weekdays: "flex",
              weekday:
                "w-8 h-8 flex items-center justify-center text-[11px] font-medium text-ds-gray-600 uppercase",
              weeks: "[&>tr]:mt-1",
              week: "flex",
              day: "w-8 h-8 flex items-center justify-center rounded-md text-sm transition-colors hover:bg-ds-gray-300 cursor-pointer",
              day_button:
                "w-8 h-8 flex items-center justify-center rounded-md",
              selected:
                "!bg-ds-blue-700 !text-white hover:!bg-ds-blue-900 font-medium",
              today: "font-bold text-ds-blue-400",
              outside: "text-ds-gray-500 opacity-50",
              disabled: "text-ds-gray-500 opacity-30 cursor-not-allowed",
            }}
          />
        </div>
      )}
    </div>
  );
}
