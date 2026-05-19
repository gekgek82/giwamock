"use client";

import { useTranslations } from "next-intl";
import { Checkbox } from "@/components/common/Checkbox";

export type LiquidityLockOption = "permanent" | "6month" | "none";

interface LiquidityLockSettingsProps {
  value: LiquidityLockOption;
  onChange: (value: LiquidityLockOption) => void;
  className?: string;
}

export function LiquidityLockSettings({
  value,
  onChange,
  className = "",
}: LiquidityLockSettingsProps) {
  const t = useTranslations();

  const options: { key: LiquidityLockOption; label: string }[] = [
    { key: "permanent", label: t("deposit.lockPermanent") },
    { key: "6month", label: t("deposit.lock6Month") },
    { key: "none", label: t("deposit.lockNone") },
  ];

  return (
    <section className={`flex flex-col gap-5 w-full ${className}`}>
      <header className="flex flex-col gap-3 pt-[30px] border-t border-gray-30">
        <h3 className="heading-6 text-gray-100">
          {t("deposit.liquidityLockTitle")}
        </h3>
        <p className="body-16-medium text-gray-90 leading-6 whitespace-pre-line">
          {t("deposit.liquidityLockDescription")}
        </p>
      </header>

      <div className="grid grid-cols-3 gap-5 w-full">
        {options.map((option) => {
          const selected = value === option.key;
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => onChange(option.key)}
              aria-pressed={selected}
              className="flex items-center justify-center gap-2 px-2.5 py-5 rounded-[20px] bg-gray-10 transition-colors hover:bg-gray-20"
            >
              <Checkbox checked={selected} className="w-5 h-5" />
              <span className="body-16-bold text-gray-100 whitespace-nowrap">
                {option.label}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
