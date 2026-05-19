type BadgeVariant =
  | "default"
  | "success"
  | "warning"
  | "error"
  | "blue"
  | "purple"
  | "cyan";

export interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default:
    "bg-ds-gray-200 text-ds-gray-900 border-ds-gray-400",
  success:
    "bg-ds-green-700/10 text-ds-green-400 border-ds-green-700/20",
  warning:
    "bg-ds-yellow-700/10 text-ds-yellow-400 border-ds-yellow-700/20",
  error:
    "bg-ds-red-700/10 text-ds-red-400 border-ds-red-700/20",
  blue:
    "bg-ds-blue-700/10 text-ds-blue-400 border-ds-blue-700/20",
  purple:
    "bg-ds-purple-700/10 text-ds-purple-400 border-ds-purple-700/20",
  cyan:
    "bg-ds-cyan-700/10 text-ds-cyan-400 border-ds-cyan-700/20",
};

export function Badge({
  variant = "default",
  children,
  className = "",
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
