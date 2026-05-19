"use client";

import { useState, useRef, useEffect } from "react";

interface PoolBalanceMiniBarProps {
  poolType: string; // 'BASIC' | 'CL'
  token0Symbol: string;
  token1Symbol: string;
  token0Decimals: number;
  token1Decimals: number;
  reserve0: string; // raw reserve (BigInt string)
  reserve1: string;
  reserve0Usd: string;
  reserve1Usd: string;
}

function formatTokenAmount(raw: string, decimals: number): string {
  const num = Number(raw) / Math.pow(10, decimals);
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function PoolBalanceMiniBar({
  poolType,
  token0Symbol,
  token1Symbol,
  token0Decimals,
  token1Decimals,
  reserve0,
  reserve1,
  reserve0Usd,
  reserve1Usd,
}: PoolBalanceMiniBarProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  // Calculate ratio
  let ratio0: number;
  if (poolType === "BASIC") {
    ratio0 = 50;
  } else {
    const usd0 = parseFloat(reserve0Usd);
    const usd1 = parseFloat(reserve1Usd);
    const total = usd0 + usd1;
    ratio0 = total > 0 ? (usd0 / total) * 100 : 50;
  }
  ratio0 = Math.max(0, Math.min(100, ratio0));
  const ratio1 = 100 - ratio0;

  // Close tooltip on outside click (mobile)
  useEffect(() => {
    if (!showTooltip) return;
    const handleClick = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setShowTooltip(false);
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [showTooltip]);

  return (
    <div
      ref={barRef}
      className="relative mt-1.5 w-full max-w-[120px] mx-auto cursor-pointer"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onClick={(e) => {
        e.stopPropagation();
        setShowTooltip((prev) => !prev);
      }}
    >
      {/* Bar */}
      <div className="flex h-1.5 rounded-full overflow-hidden">
        <div
          className="bg-[#1A73E8] transition-all duration-300"
          style={{ width: `${ratio0}%` }}
        />
        <div
          className="bg-[#BF7AF0] transition-all duration-300"
          style={{ width: `${ratio1}%` }}
        />
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-50">
          <div className="bg-white border border-neutral-200 rounded-lg px-3 py-2 shadow-lg whitespace-nowrap">
            <p className="text-xs text-neutral-1000 font-mono">
              <span className="inline-block w-2 h-2 rounded-full bg-[#1A73E8] mr-1.5 align-middle" />
              {formatTokenAmount(reserve0, token0Decimals)} {token0Symbol}
            </p>
            <p className="text-xs text-neutral-1000 font-mono mt-0.5">
              <span className="inline-block w-2 h-2 rounded-full bg-[#BF7AF0] mr-1.5 align-middle" />
              {formatTokenAmount(reserve1, token1Decimals)} {token1Symbol}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
