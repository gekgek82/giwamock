"use client";

import { usePairOhlcvUpdate } from "@/hooks/usePairOhlcvUpdate";

interface LivePriceBadgeProps {
  pool: string | null | undefined;
  fromSymbol: string;
  toSymbol: string;
}

export function LivePriceBadge({ pool, fromSymbol, toSymbol }: LivePriceBadgeProps) {
  const update = usePairOhlcvUpdate(pool);

  if (!update) return null;

  const price = update.price.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });

  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-10/10 border border-green-10/30 text-green-10 body-12">
      <span className="relative flex size-1.5">
        <span className="animate-ping absolute inline-flex size-full rounded-full bg-green-10 opacity-75" />
        <span className="relative inline-flex rounded-full size-1.5 bg-green-10" />
      </span>
      1 {fromSymbol} = {price} {toSymbol}
    </span>
  );
}
