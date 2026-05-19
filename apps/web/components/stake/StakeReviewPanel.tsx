"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";

export type StakeReviewStatus =
  | "review"
  | "approving"
  | "approved"
  | "staking"
  | "success";

interface StakeReviewPanelProps {
  status: StakeReviewStatus;
  onEdit: () => void;
  onPrimary: () => void;
  onSecondarySuccess?: () => void;
  /**
   * Pre-TGE mode: no gauge contract — the stake is recorded off-chain via API.
   * Skips the approve step and changes the review copy/button accordingly.
   */
  isPreTGE?: boolean;
}

export function StakeReviewPanel({
  status,
  onEdit,
  onPrimary,
  onSecondarySuccess,
  isPreTGE = false,
}: StakeReviewPanelProps) {
  const t = useTranslations();

  const { title, message, primaryLabel, showSpinner } = getPanelContent(
    status,
    t,
    isPreTGE,
  );

  const isSuccess = status === "success";

  return (
    <div className="bg-white rounded-[40px] p-8 flex flex-col gap-6">
      <h2 className="heading-6 text-neutral-1000">{title}</h2>

      <div className="flex-1 flex flex-col items-center justify-center gap-5 py-8">
        <GiwaterMark />
        <p className="body-14 text-neutral-700 text-center whitespace-pre-line">
          {message}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {isSuccess ? (
          <>
            <button
              type="button"
              onClick={onSecondarySuccess ?? onEdit}
              className="py-4 rounded-2xl body-16-bold bg-neutral-1000 text-white hover:bg-neutral-900 transition-colors"
            >
              {t("stake.viewConfirmation")}
            </button>
            <button
              type="button"
              onClick={onPrimary}
              className="py-4 rounded-2xl body-16-bold bg-primary-100 text-neutral-1000 hover:bg-primary-200 transition-colors"
            >
              {t("stake.goPortfolio")}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onEdit}
              disabled={showSpinner}
              className={`py-4 rounded-2xl body-16-bold transition-colors ${
                showSpinner
                  ? "bg-neutral-200 text-neutral-700 cursor-not-allowed"
                  : "bg-neutral-1000 text-white hover:bg-neutral-900"
              }`}
            >
              {t("stake.edit")}
            </button>
            <button
              type="button"
              onClick={onPrimary}
              disabled={showSpinner}
              className={`py-4 rounded-2xl body-16-bold transition-colors flex items-center justify-center ${
                showSpinner
                  ? "bg-primary-100 text-neutral-1000 cursor-not-allowed"
                  : "bg-primary-100 text-neutral-1000 hover:bg-primary-200"
              }`}
            >
              {showSpinner ? <Spinner /> : primaryLabel}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function getPanelContent(
  status: StakeReviewStatus,
  t: ReturnType<typeof useTranslations>,
  isPreTGE: boolean,
) {
  switch (status) {
    case "review":
      return {
        title: t("stake.reviewTitle"),
        message: isPreTGE
          ? t("stake.offchainReviewMessage")
          : t("stake.reviewMessage"),
        primaryLabel: isPreTGE ? t("stake.confirm") : t("stake.approve"),
        showSpinner: false,
      };
    case "approving":
      return {
        title: t("stake.waitingWalletTitle"),
        message: t("stake.waitingWalletMessage"),
        primaryLabel: t("stake.approve"),
        showSpinner: true,
      };
    case "approved":
      return {
        title: t("stake.executionTitle"),
        message: t("stake.executionMessage"),
        primaryLabel: t("stake.confirm"),
        showSpinner: false,
      };
    case "staking":
      return {
        title: isPreTGE
          ? t("stake.offchainSubmittingTitle")
          : t("stake.waitingWalletTitle"),
        message: isPreTGE
          ? t("stake.offchainSubmittingMessage")
          : t("stake.waitingWalletMessage"),
        primaryLabel: t("stake.confirm"),
        showSpinner: true,
      };
    case "success":
      return {
        title: t("stake.successTitle"),
        message: t("stake.successMessage"),
        primaryLabel: t("stake.goPortfolio"),
        showSpinner: false,
      };
  }
}

function GiwaterMark() {
  return (
    <Image
      src="/giwater-gray.svg"
      alt="Giwater"
      width={64}
      height={64}
    />
  );
}

function Spinner() {
  return (
    <span className="inline-block w-5 h-5 border-2 border-neutral-1000 border-t-transparent rounded-full animate-spin" />
  );
}
