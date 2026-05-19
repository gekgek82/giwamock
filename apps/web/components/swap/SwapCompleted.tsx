"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { GIWASCAN_URL } from "@/lib/config";
import { GiwaterLogo } from "@/components/common/GiwaterLogo";

interface SwapCompletedProps {
  txHash: string;
}

export function SwapCompleted({ txHash }: SwapCompletedProps) {
  const t = useTranslations();

  return (
    <>
      <h2 className="text-gray-100 heading-6 mb-4">
        {t("swap.swapCompleted")}
      </h2>
      <div className="h-px w-full bg-gray-30 mb-6" />

      <div className="flex-1 flex flex-col items-center justify-center text-center gap-5">
        <GiwaterLogo width={96} height={86} />
        <div className="text-gray-90 text-[20px] leading-[30px] font-bold">
          <p>{t("swap.safelySwapped")}</p>
          <p>{t("swap.exchangeFinished")}</p>
          <p>{t("swap.viewRewardPoints")}</p>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-5">
        <a
          href={`${GIWASCAN_URL}/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center px-5 py-2.5 rounded-[20px] body-16-bold md:py-4 md:text-[20px] md:leading-[30px] bg-gray-70 text-gray-10 hover:bg-gray-80 transition-colors text-center"
        >
          {t("swap.viewConfirmation")}
        </a>
        <Link
          href="/portfolio"
          className="flex items-center justify-center px-5 py-2.5 rounded-[20px] body-16-bold md:py-4 md:text-[20px] md:leading-[30px] bg-brand-green text-gray-100 hover:bg-green-10 transition-colors text-center"
        >
          {t("swap.goPortfolio")}
        </Link>
      </div>
    </>
  );
}
