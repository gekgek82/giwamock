"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useSwapStore } from "@/lib/store";

const PRESET_SLIPPAGES = [0.01, 0.1, 0.5, 1, 5];

export function SlippageSettings() {
  const [isOpen, setIsOpen] = useState(false);
  const { slippage, setSlippage } = useSwapStore();
  const [customValue, setCustomValue] = useState("");
  const t = useTranslations();

  // Check if current slippage is a custom value
  const isCustom = useMemo(() => {
    return customValue !== "" || !PRESET_SLIPPAGES.includes(slippage);
  }, [customValue, slippage]);

  const handleCustomChange = (value: string) => {
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setCustomValue(value);
      if (value && !isNaN(parseFloat(value))) {
        setSlippage(parseFloat(value));
      }
    }
  };

  const handlePresetClick = (value: number) => {
    setSlippage(value);
    setCustomValue("");
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1 p-1 lg:gap-2 lg:px-2 lg:py-1.5 bg-gray-30 hover:bg-gray-40 rounded-[10px] text-gray-90 text-[10px] leading-tight font-medium lg:text-[14px] lg:leading-[21px] transition-all"
      >
        <span className="whitespace-nowrap">Slippage {slippage}%</span>
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 16 16"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.6}
            d="M4 6l4 4 4-4"
          />
        </svg>
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 bg-[rgba(77,77,77,0.8)] z-50 flex items-center justify-center"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="relative bg-white rounded-[40px] pb-[30px] w-[430px] max-w-[calc(100vw-32px)] flex flex-col gap-[20px] items-center shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex flex-col gap-[12px] items-center pt-[30px] w-full">
              <div className="flex gap-[10px] items-center px-[30px] w-full">
                <p className="flex-1 text-gray-100 heading-6">
                  {t("swap.slippageTitle")}
                </p>
              </div>
              <div className="h-px w-full bg-gray-30" />
            </div>

            {/* Close (x-01) */}
            <button
              onClick={() => setIsOpen(false)}
              aria-label="Close"
              className="absolute top-[30px] right-[30px] size-6 text-gray-100 hover:text-gray-80 transition-colors"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Description */}
            <p className="w-[370px] text-gray-90 body-16-medium">
              {t("swap.slippageDescription")}
            </p>

            {/* Preset Buttons */}
            <div className="w-[370px] border border-gray-30 rounded-[20px] px-[20px] py-[16px] flex gap-[20px] items-start">
              {PRESET_SLIPPAGES.map((value) => {
                const isActive = slippage === value && !isCustom;
                return (
                  <button
                    key={value}
                    onClick={() => handlePresetClick(value)}
                    className="flex-1 flex flex-col gap-[4px] items-center min-w-0"
                  >
                    <span
                      className={`w-full text-center text-[16px] leading-[24px] ${
                        isActive
                          ? "font-bold text-green-10"
                          : "font-medium text-gray-100"
                      }`}
                    >
                      {value}%
                    </span>
                    {isActive && (
                      <span
                        aria-hidden="true"
                        className="w-full h-0.5 bg-green-10"
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Custom Section */}
            <div className="w-[370px] flex flex-col gap-[8px]">
              <label className="text-gray-90 body-14-medium">
                {t("swap.slippageCustom")}
              </label>
              <input
                type="text"
                value={customValue}
                onChange={(e) => handleCustomChange(e.target.value)}
                placeholder={t("swap.slippageCustomPlaceholder")}
                className="w-full bg-gray-20 rounded-[10px] p-[10px] text-gray-90 body-14-medium text-right outline-none placeholder:text-gray-60"
              />
            </div>

            {/* Warning */}
            {slippage > 5 && (
              <div className="w-[370px] p-3 bg-orange-100/10 border border-orange-100/30 rounded-xl text-orange-100 body-14">
                {t("swap.slippageWarningHigh")}
              </div>
            )}
            {slippage < 0.1 && (
              <div className="w-[370px] p-3 bg-orange-100/10 border border-orange-100/30 rounded-xl text-orange-100 body-14">
                {t("swap.slippageWarningLow")}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
