"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";

export type UnstakeReviewStatus =
  | "review"
  | "unstaking"
  | "success";

interface UnstakeReviewPanelProps {
  status: UnstakeReviewStatus;
  onEdit: () => void;
  onPrimary: () => void;
  onSecondarySuccess?: () => void;
  isPreTGE?: boolean;
}

export function UnstakeReviewPanel({
  status,
  onEdit,
  onPrimary,
  onSecondarySuccess,
  isPreTGE = false,
}: UnstakeReviewPanelProps) {
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
              {t("unstake.viewConfirmation")}
            </button>
            <button
              type="button"
              onClick={onPrimary}
              className="py-4 rounded-2xl body-16-bold bg-primary-100 text-neutral-1000 hover:bg-primary-200 transition-colors"
            >
              {t("unstake.goPortfolio")}
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
              {t("unstake.edit")}
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
  status: UnstakeReviewStatus,
  t: ReturnType<typeof useTranslations>,
  isPreTGE: boolean,
) {
  switch (status) {
    case "review":
      return {
        title: t("unstake.reviewTitle"),
        message: isPreTGE
          ? t("unstake.offchainReviewMessage")
          : t("unstake.reviewMessage"),
        primaryLabel: t("unstake.confirm"),
        showSpinner: false,
      };
    case "unstaking":
      return {
        title: isPreTGE
          ? t("unstake.offchainSubmittingTitle")
          : t("unstake.waitingWalletTitle"),
        message: isPreTGE
          ? t("unstake.offchainSubmittingMessage")
          : t("unstake.waitingWalletMessage"),
        primaryLabel: t("unstake.confirm"),
        showSpinner: true,
      };
    case "success":
      return {
        title: t("unstake.successTitle"),
        message: t("unstake.successMessage"),
        primaryLabel: t("unstake.goPortfolio"),
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
