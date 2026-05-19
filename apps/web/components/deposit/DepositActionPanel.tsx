"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { GIWASCAN_URL } from "@/lib/config";
import { GiwaterLogo } from "@/components/common/GiwaterLogo";

/**
 * Pre-deposit / in-flight / post-deposit status for the desktop deposit screen.
 *
 *  - `approving`  : wallet approval popup in flight (spinner inside CTA)
 *  - `ready`      : approvals are done; user must press Confirm to fire the
 *                   deposit transaction
 *  - `depositing` : add-liquidity transaction is being submitted / mined
 *                   (spinner inside CTA, same shell as `approving`)
 *  - `success`    : deposit transaction confirmed; CTAs switch to View
 *                   Confirmation + Go Portfolio
 */
export type DepositFlowPhase =
  | "approving"
  | "ready"
  | "depositing"
  | "success";

interface DepositActionPanelProps {
  phase: DepositFlowPhase;
  onEdit: () => void;
  onConfirm: () => void;
  /** Defaults to `/portfolio` if not provided. */
  portfolioHref?: string;
  /**
   * Transaction hash from the confirmed deposit, used for the success-state
   * "View Confirmation" link. When omitted, the button is rendered disabled.
   */
  txHash?: `0x${string}`;
}

function PrimarySpinner() {
  return (
    <div className="w-8 h-8 border-[3px] border-gray-100/30 border-t-gray-100 rounded-full animate-spin" />
  );
}

export function DepositActionPanel({
  phase,
  onEdit,
  onConfirm,
  portfolioHref = "/portfolio",
  txHash,
}: DepositActionPanelProps) {
  const t = useTranslations();

  const title =
    phase === "success"
      ? t("deposit.completedSuccessfully")
      : phase === "depositing" || phase === "ready"
      ? t("deposit.depositingAssetsTitle")
      : t("deposit.approveAssetTitle");

  const bodyLine1 =
    phase === "success"
      ? t("deposit.successMessageLine1")
      : phase === "depositing" || phase === "ready"
      ? t("deposit.depositingAssetsLine1")
      : t("deposit.approveAssetLine1");

  const bodyLine2 =
    phase === "success"
      ? t("deposit.successMessageLine2")
      : phase === "depositing" || phase === "ready"
      ? t("deposit.depositingAssetsLine2")
      : t("deposit.approveAssetLine2");

  return (
    <div className="bg-white rounded-[40px] h-full min-h-[569px] flex flex-col">
      {/* Header */}
      <div className="flex flex-col gap-3 pt-[30px]">
        <div className="px-[30px]">
          <h2 className="text-gray-100 heading-6">{title}</h2>
        </div>
        <div className="h-px w-full bg-gray-30" />
      </div>

      {/* Body — illustration + copy */}
      <div className="flex-1 flex flex-col items-center justify-center gap-5 px-[30px] text-center">
        <GiwaterLogo width={96} height={86} />
        <div className="flex flex-col gap-[16px] body-16-bold text-gray-90 max-w-[500px] whitespace-pre-line">
          <p className="leading-[30px]">{bodyLine1}</p>
          <p className="leading-[30px]">{bodyLine2}</p>
        </div>
      </div>

      {/* Footer — CTAs */}
      <div className="grid grid-cols-2 gap-5 px-[30px] pb-[30px]">
        {phase === "success" ? (
          <>
            <a
              href={txHash ? `${GIWASCAN_URL}/tx/${txHash}` : undefined}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={!txHash}
              onClick={(e) => {
                if (!txHash) e.preventDefault();
              }}
              className={`w-full py-4 rounded-[20px] text-center text-[20px] leading-[30px] font-bold transition-colors ${
                txHash
                  ? "bg-gray-70 text-gray-10 hover:bg-gray-80"
                  : "bg-gray-30 text-gray-50 cursor-not-allowed pointer-events-none"
              }`}
            >
              {t("deposit.viewConfirmation")}
            </a>
            <Link
              href={portfolioHref}
              className="w-full py-4 rounded-[20px] text-center text-[20px] leading-[30px] font-bold bg-brand-green text-gray-100 hover:bg-green-10 transition-colors"
            >
              {t("deposit.goPortfolio")}
            </Link>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onEdit}
              className="w-full py-4 rounded-[20px] text-[20px] leading-[30px] font-bold bg-gray-70 text-gray-10 hover:bg-gray-80 transition-colors"
            >
              {t("deposit.edit")}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={phase !== "ready"}
              aria-busy={phase !== "ready"}
              className="w-full py-4 rounded-[20px] text-[20px] leading-[30px] font-bold bg-brand-green text-gray-100 hover:bg-green-10 disabled:hover:bg-brand-green disabled:cursor-not-allowed flex items-center justify-center transition-colors"
            >
              {phase === "ready" ? (
                t("deposit.confirm")
              ) : (
                <PrimarySpinner />
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
