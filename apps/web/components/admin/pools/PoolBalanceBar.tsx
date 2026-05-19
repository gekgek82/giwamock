"use client";

import { useState, useRef, useEffect } from "react";

interface PoolBalanceBarProps {
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

export function PoolBalanceBar({
  poolType,
  token0Symbol,
  token1Symbol,
  token0Decimals,
  token1Decimals,
  reserve0,
  reserve1,
  reserve0Usd,
  reserve1Usd,
}: PoolBalanceBarProps) {
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

  // Clamp between 0 and 100
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
    <div className="space-y-2">
      {/* Labels */}
      <div className="flex items-center justify-between text-xs text-ds-gray-700">
        <span className="font-medium">
          {token0Symbol}{" "}
          <span className="text-ds-gray-600">{ratio0.toFixed(1)}%</span>
        </span>
        <span className="font-medium">
          <span className="text-ds-gray-600">{ratio1.toFixed(1)}%</span>{" "}
          {token1Symbol}
        </span>
      </div>

      {/* Bar */}
      <div
        ref={barRef}
        className="relative"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={() => setShowTooltip((prev) => !prev)}
      >
        <div className="flex h-3 rounded-full overflow-hidden cursor-pointer">
          <div
            className="bg-ds-blue-400 transition-all duration-300"
            style={{ width: `${ratio0}%` }}
          />
          <div
            className="bg-ds-purple-400 transition-all duration-300"
            style={{ width: `${ratio1}%` }}
          />
        </div>

        {/* Tooltip */}
        {showTooltip && (
          <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-10">
            <div className="bg-ds-gray-200 border border-ds-gray-400 rounded-lg px-3 py-2 shadow-lg whitespace-nowrap">
              <p className="text-xs text-ds-gray-1000 font-geist-mono">
                <span className="inline-block w-2 h-2 rounded-full bg-ds-blue-400 mr-1.5" />
                {formatTokenAmount(reserve0, token0Decimals)} {token0Symbol}
              </p>
              <p className="text-xs text-ds-gray-1000 font-geist-mono mt-1">
                <span className="inline-block w-2 h-2 rounded-full bg-ds-purple-400 mr-1.5" />
                {formatTokenAmount(reserve1, token1Decimals)} {token1Symbol}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Pool type indicator */}
      {poolType === "BASIC" && (
        <p className="text-[10px] text-ds-gray-600">
          Basic pool — always 50:50 by design
        </p>
      )}
    </div>
  );
}
