interface CheckboxProps {
  checked: boolean;
  className?: string;
}

export function Checkbox({ checked, className = "" }: CheckboxProps) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    >
      <rect
        width="24"
        height="24"
        rx="5"
        className="transition-colors"
        style={{ fill: checked ? "#00D185" : "#E2E8F0" }}
      />
      <path
        d="M16.7992 8.3999L9.6397 15.5999L7.19922 13.1456"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="transition-colors"
        style={{ stroke: checked ? "#FFFFFF" : "#94A3B8" }}
      />
    </svg>
  );
}
