"use client";

interface Tag {
  label: string;
  variant?: "default" | "primary" | "muted";
}

interface DepositInfoCardProps {
  depositNumber: number | string;
  tags?: Tag[];
  tokenInfo: string;
  status: string;
  usdValue: string;
  isLoading?: boolean;
}

export function DepositInfoCard({
  depositNumber,
  tags = [],
  tokenInfo,
  status,
  usdValue,
  isLoading,
}: DepositInfoCardProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl px-6 py-4 animate-pulse">
        <div className="h-6 bg-neutral-100 rounded w-full" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl px-6 py-4 flex items-center justify-between gap-4">
      {/* Left: deposit label + tags + token info */}
      <div className="flex items-center gap-3 flex-wrap min-w-0">
        <span className="body-16-bold text-neutral-1000 shrink-0">
          Deposit #{depositNumber}
        </span>

        {tags.map((tag) => {
          const variantClass =
            tag.variant === "primary"
              ? "bg-primary-100/20 text-primary-300"
              : tag.variant === "muted"
                ? "bg-neutral-200 text-neutral-700"
                : "bg-neutral-100 text-neutral-1000";
          return (
            <span
              key={tag.label}
              className={`px-3 py-1 rounded-full body-12 font-medium shrink-0 ${variantClass}`}
            >
              {tag.label}
            </span>
          );
        })}

        <span className="body-14-medium text-neutral-1000 truncate">
          {tokenInfo}
        </span>
      </div>

      {/* Right: status badge + USD value */}
      <div className="flex items-center gap-4 shrink-0">
        <span className="px-3 py-1 rounded-full bg-primary-100/20 text-primary-300 body-12 font-medium">
          {status}
        </span>
        <span className="body-16-bold text-neutral-1000">{usdValue}</span>
      </div>
    </div>
  );
}
