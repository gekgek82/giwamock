export function ChevronDown({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function CheckBox({ checked }: { checked: boolean }) {
  return (
    <div
      className={`w-6 h-6 rounded-[5px] flex items-center justify-center ${
        checked ? "bg-primary-200" : "bg-gray-30"
      }`}
    >
      {checked && (
        <svg
          className="w-3.5 h-3.5 text-white"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </div>
  );
}
