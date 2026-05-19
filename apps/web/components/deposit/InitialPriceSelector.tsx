"use client";

import { useState, useMemo, useCallback } from "react";
import { useTranslations } from "next-intl";
import { priceToTick, priceToSqrtPriceX96, MIN_INITIAL_TICK, MAX_INITIAL_TICK } from "@/lib/tickMath";

interface InitialPriceSelectorProps {
  token0Symbol: string;
  token1Symbol: string;
  token0Decimals: number;
  token1Decimals: number;
  onContinue: (sqrtPriceX96: bigint, tick: number) => void;
  onChangePool: () => void;
}

export function InitialPriceSelector({
  token0Symbol,
  token1Symbol,
  token0Decimals,
  token1Decimals,
  onContinue,
  onChangePool,
}: InitialPriceSelectorProps) {
  const t = useTranslations();

  const [priceInput, setPriceInput] = useState("");
  const [isInverted, setIsInverted] = useState(false);

  // Base token is what "1 unit" refers to; quote token is the price unit
  const baseToken = isInverted ? token1Symbol : token0Symbol;
  const quoteToken = isInverted ? token0Symbol : token1Symbol;

  const parsedPrice = useMemo(() => {
    const val = parseFloat(priceInput);
    if (isNaN(val) || val <= 0) return null;
    return val;
  }, [priceInput]);

  // Convert display price to raw price (token1/token0), respecting inversion
  const rawPrice = useMemo(() => {
    if (parsedPrice === null) return null;
    return isInverted ? 1 / parsedPrice : parsedPrice;
  }, [parsedPrice, isInverted]);

  // Check if price is within practical bounds
  const isPriceOutOfRange = useMemo(() => {
    if (rawPrice === null) return false;
    const tick = priceToTick(rawPrice, token0Decimals, token1Decimals);
    return tick < MIN_INITIAL_TICK || tick > MAX_INITIAL_TICK;
  }, [rawPrice, token0Decimals, token1Decimals]);

  const canContinue = rawPrice !== null && rawPrice > 0 && !isPriceOutOfRange;

  const handleContinue = useCallback(() => {
    if (rawPrice === null) return;
    const sqrtPriceX96 = priceToSqrtPriceX96(rawPrice, token0Decimals, token1Decimals);
    const tick = priceToTick(rawPrice, token0Decimals, token1Decimals);
    if (sqrtPriceX96 === 0n) return;
    onContinue(sqrtPriceX96, tick);
  }, [rawPrice, token0Decimals, token1Decimals, onContinue]);

  const handlePriceInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow empty, digits, and one decimal point
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setPriceInput(value);
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-white rounded-2xl p-6">
        {/* Header with token toggle */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="heading-6 text-primary-700">
            {t("deposit.setInitialPrice")}
          </h2>

          {/* Token Toggle */}
          <div className="flex bg-neutral-100 rounded-full p-1">
            <button
              onClick={() => setIsInverted(false)}
              className={`px-3 py-1 rounded-full body-14-medium transition-all ${
                !isInverted
                  ? "bg-primary-700 text-white"
                  : "text-neutral-700 hover:text-neutral-1000"
              }`}
            >
              {token0Symbol}
            </button>
            <button
              onClick={() => setIsInverted(true)}
              className={`px-3 py-1 rounded-full body-14-medium transition-all ${
                isInverted
                  ? "bg-primary-700 text-white"
                  : "text-neutral-700 hover:text-neutral-1000"
              }`}
            >
              {token1Symbol}
            </button>
          </div>
        </div>

        {/* Price Input */}
        <div className="relative mb-4">
          <div className="flex items-center border border-red-400 rounded-xl bg-neutral-50 px-4 py-4">
            <span className="body-14 text-neutral-500 mr-2 whitespace-nowrap">
              {baseToken} =
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={priceInput}
              onChange={handlePriceInputChange}
              placeholder="0"
              autoFocus
              className="flex-1 bg-transparent text-right body-16-bold text-neutral-1000 focus:outline-none min-w-0"
            />
            <span className="body-14 text-neutral-500 ml-2 whitespace-nowrap">
              {quoteToken}
            </span>
          </div>
        </div>

        {/* Out-of-range error */}
        {isPriceOutOfRange && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
            <p className="body-14 text-red-800 font-medium">
              {t("deposit.priceOutOfRange")}
            </p>
          </div>
        )}

        {/* Warning */}
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="body-14 text-orange-800">
              <span className="font-bold">Warning: </span>
              {t("deposit.initialPriceDescription")}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={onChangePool}
            className="py-4 px-6 bg-neutral-1000 hover:bg-neutral-900 text-white rounded-xl body-16-bold transition-all"
          >
            {t("liquidity.changePool")}
          </button>
          <button
            onClick={handleContinue}
            disabled={!canContinue}
            className={`py-4 px-6 rounded-xl body-16-bold transition-all ${
              !canContinue
                ? "bg-primary-300 text-neutral-500 cursor-not-allowed"
                : "bg-primary-100 hover:bg-primary-200 text-neutral-1000"
            }`}
          >
            {t("deposit.initialPriceContinue")}
          </button>
        </div>
      </div>
    </div>
  );
}
