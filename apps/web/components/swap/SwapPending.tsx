"use client";

import { useTranslations } from "next-intl";
import { GiwaterLogo } from "@/components/common/GiwaterLogo";

interface SwapPendingProps {
  onChangeClick: () => void;
}

export function SwapPending({ onChangeClick }: SwapPendingProps) {
  const t = useTranslations();

  return (
    <>
      <h2 className="text-gray-100 heading-6 mb-4">
        {t("swap.waitingForApproval")}
      </h2>
      <div className="h-px w-full bg-gray-30 mb-6" />

      <div className="flex-1 flex flex-col items-center justify-center text-center gap-5">
        <GiwaterLogo width={96} height={86} />
        <p className="text-gray-90 text-[20px] leading-[30px] font-bold">
          {t("swap.assetsBeingTransformed")}
        </p>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-5">
        <button
          onClick={onChangeClick}
          className="flex items-center justify-center px-5 py-2.5 rounded-[20px] body-16-bold md:py-4 md:text-[20px] md:leading-[30px] bg-gray-70 text-gray-10 hover:bg-gray-80 transition-colors"
        >
          {t("swap.change")}
        </button>
        <button
          disabled
          className="flex items-center justify-center px-5 py-2.5 rounded-[20px] md:py-4 bg-brand-green text-gray-100 cursor-not-allowed"
        >
          <div className="w-8 h-8 border-[3px] border-gray-100/30 border-t-gray-100 rounded-full animate-spin" />
        </button>
      </div>
    </>
  );
}
