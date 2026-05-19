"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { usePools, type PoolInfo } from "@/hooks/usePools";
import { TokenPairIcon } from "@/components/common/TokenIcon";

interface PoolSelectProps {
  selectedPool: PoolInfo | undefined;
  onSelect: (pool: PoolInfo) => void;
}

export function PoolSelect({ selectedPool, onSelect }: PoolSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { pools } = usePools();
  const t = useTranslations();

  if (!selectedPool) {
    return (
      <div className="w-full px-5 py-4 bg-[#2d3548] rounded-xl text-center text-[#94a3af]">
        {t("common.loadingPool")}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-5 py-4 bg-gradient-to-br from-slate-100 to-slate-200 hover:from-slate-200 hover:to-slate-300 rounded-xl transition-all font-bold text-slate-900 shadow-md hover:shadow-lg border border-slate-300"
      >
        <div className="flex items-center gap-3">
          <TokenPairIcon
            leftAddress={selectedPool.token0.address}
            leftSymbol={selectedPool.token0.symbol}
            rightAddress={selectedPool.token1.address}
            rightSymbol={selectedPool.token1.symbol}
            size={32}
          />
          <span className="text-lg">{selectedPool.name}</span>
        </div>
        <svg
          className={`w-5 h-5 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute left-0 right-0 mt-3 bg-white rounded-2xl shadow-2xl border-2 border-slate-200 z-20 overflow-hidden">
            {pools.map((pool, index) => (
              <button
                key={pool.address}
                onClick={() => {
                  onSelect(pool);
                  setIsOpen(false);
                }}
                className={`w-full px-5 py-4 text-left hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all ${
                  index !== pools.length - 1 ? "border-b border-slate-100" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <TokenPairIcon
                    leftAddress={pool.token0.address}
                    leftSymbol={pool.token0.symbol}
                    rightAddress={pool.token1.address}
                    rightSymbol={pool.token1.symbol}
                    size={28}
                  />
                  <div>
                    <div className="font-bold text-slate-900 text-lg">
                      {pool.name}
                    </div>
                    <div className="text-sm text-slate-600">
                      {pool.token0.symbol} - {pool.token1.symbol}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
