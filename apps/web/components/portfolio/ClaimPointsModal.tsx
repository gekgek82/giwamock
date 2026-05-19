"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { GIWASCAN_URL } from "@/lib/config";
import { Button, IconButton } from "@/components/common/Button";
import type { ClaimPointsStatus } from "@/hooks/useClaimPoints";
import type { ClaimResponse } from "@/types/portfolio";

interface ClaimPointsModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: ClaimPointsStatus;
  claimData: ClaimResponse | null;
  txHash: string | null;
  onClaim: () => void;
  onReset: () => void;
}

export function ClaimPointsModal({
  isOpen,
  onClose,
  status,
  claimData,
  txHash,
  onClaim,
  onReset,
}: ClaimPointsModalProps) {
  const t = useTranslations();

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      onReset();
    }
  }, [isOpen, onReset]);

  if (!isOpen) return null;

  const claimableAmount = claimData?.rewards?.points?.amount
    ? parseFloat(claimData.rewards.points.amount).toLocaleString(undefined, {
        maximumFractionDigits: 4,
      })
    : "0";

  const handleClose = () => {
    if (status === "claiming") return; // Prevent closing during mint
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-[24px] w-full max-w-[420px] mx-4 p-6 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-neutral-1000">
            {t("portfolio.claimPoints")}
          </h3>
          {status !== "claiming" && (
            <IconButton onClick={handleClose}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M12 4L4 12M4 4l8 8"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </IconButton>
          )}
        </div>

        {/* Content based on status */}
        {status === "idle" && (
          <IdleView
            onClaim={onClaim}
            t={t}
          />
        )}

        {status === "claiming" && (
          <LoadingView message={t("portfolio.preparingClaim")} />
        )}

        {status === "success" && (
          <SuccessView
            amount={claimableAmount}
            txHash={txHash}
            onClose={handleClose}
            t={t}
          />
        )}

        {status === "error" && (
          <ErrorView
            onRetry={() => {
              onReset();
              onClaim();
            }}
            onClose={handleClose}
            t={t}
          />
        )}
      </div>
    </div>
  );
}

function IdleView({
  onClaim,
  t,
}: {
  onClaim: () => void;
  t: (key: string) => string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-neutral-700 body-14">
        {t("portfolio.claimPointsDescription")}
      </p>
      <Button variant="primary" size="md" fullWidth onClick={onClaim}>
        {t("portfolio.claimPoints")}
      </Button>
    </div>
  );
}

function LoadingView({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-4">
      {/* Spinner */}
      <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-700 rounded-full animate-spin" />
      <p className="text-neutral-700 body-14 text-center">{message}</p>
    </div>
  );
}

function SuccessView({
  amount,
  txHash,
  onClose,
  t,
}: {
  amount: string;
  txHash: string | null;
  onClose: () => void;
  t: (key: string) => string;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-4">
      {/* Check icon */}
      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#22c55e"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <div className="text-center">
        <p className="text-neutral-1000 body-16-bold">{amount} tPOINT</p>
        <p className="text-neutral-700 body-14 mt-1">
          {t("portfolio.claimSuccess")}
        </p>
      </div>
      {txHash && (
        <a
          href={`${GIWASCAN_URL}/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary-700 body-14 underline"
        >
          GiwaScan
        </a>
      )}
      <Button variant="secondary" size="md" fullWidth onClick={onClose} className="mt-2">
        {t("common.close")}
      </Button>
    </div>
  );
}

function ErrorView({
  onRetry,
  onClose,
  t,
}: {
  onRetry: () => void;
  onClose: () => void;
  t: (key: string) => string;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-4">
      {/* Error icon */}
      <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#ef4444"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </div>
      <p className="text-neutral-700 body-14 text-center">
        {t("portfolio.claimFailed")}
      </p>
      <div className="flex gap-3 w-full">
        <Button variant="neutral" size="md" className="flex-1" onClick={onClose}>
          {t("common.close")}
        </Button>
        <Button variant="primary" size="md" className="flex-1" onClick={onRetry}>
          {t("common.retry")}
        </Button>
      </div>
    </div>
  );
}
