"use client";

interface PoolGradeBadgeProps {
  grade: number;
  size?: "sm" | "md";
  showLabel?: boolean;
}

const GRADE_CONFIG = {
  1: {
    label: "Verified",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
  },
  2: {
    label: "Rising",
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30",
  },
} as const;

/** Blue check circle for Verified pools */
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8 16A8 8 0 108 0a8 8 0 000 16zm3.78-9.72a.75.75 0 00-1.06-1.06L7 8.94 5.28 7.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.06 0l4.25-4.25z"
      />
    </svg>
  );
}

/** Rising arrow icon for Rising pools */
function RisingIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8 16A8 8 0 108 0a8 8 0 000 16zm.75-10.94V11a.75.75 0 01-1.5 0V5.06L5.28 7.03a.75.75 0 01-1.06-1.06l3.25-3.25a.75.75 0 011.06 0l3.25 3.25a.75.75 0 11-1.06 1.06L8.75 5.06z"
      />
    </svg>
  );
}

export function PoolGradeBadge({
  grade,
  size = "sm",
  showLabel = false,
}: PoolGradeBadgeProps) {
  // Lv.3 (Unknown) has no badge
  if (grade === 3 || !(grade in GRADE_CONFIG)) return null;

  const config = GRADE_CONFIG[grade as 1 | 2];
  // sm = 12x12 (w-3 h-3), md = 16x16 (w-4 h-4)
  const iconSize = size === "sm" ? "w-3 h-3" : "w-4 h-4";
  const Icon = grade === 1 ? CheckIcon : RisingIcon;

  if (!showLabel) {
    return (
      <span title={config.label}>
        <Icon className={`${iconSize} ${config.color}`} />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium ${config.bgColor} ${config.color} border ${config.borderColor}`}
    >
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}
