"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

interface ApprovalStep {
  tokenSymbol: string;
  tokenAddress: `0x${string}`;
  isApproved: boolean;
  isApproving: boolean;
}

interface ApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  steps: ApprovalStep[];
  onApprove: (tokenAddress: `0x${string}`) => Promise<void>;
  onAddLiquidity: () => void;
  isAddingLiquidity: boolean;
}

export function ApprovalModal({
  isOpen,
  onClose,
  steps,
  onApprove,
  onAddLiquidity,
  isAddingLiquidity,
}: ApprovalModalProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [localApprovingToken, setLocalApprovingToken] = useState<
    `0x${string}` | null
  >(null);
  const t = useTranslations();

  // Update current step index when steps change
  useEffect(() => {
    const firstUnapprovedIndex = steps.findIndex((step) => !step.isApproved);
    if (firstUnapprovedIndex !== -1) {
      setCurrentStepIndex(firstUnapprovedIndex);
    } else {
      setCurrentStepIndex(steps.length); // All approved
    }
  }, [steps]);

  // Reset local approving state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setLocalApprovingToken(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const allApproved = steps.every((step) => step.isApproved);
  const canAddLiquidity = allApproved && !isAddingLiquidity;

  const handleApprove = async (tokenAddress: `0x${string}`) => {
    setLocalApprovingToken(tokenAddress);
    try {
      await onApprove(tokenAddress);
    } catch {
      // error is surfaced via toast in the parent hook
    } finally {
      setLocalApprovingToken(null);
    }
  };

  const handleAddLiquidity = () => {
    onAddLiquidity();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full border border-gray-30">
        {/* Header */}
        <div className="p-6 border-b border-gray-30">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-90">
              {t("approval.tokenApprovalRequired")}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-50 hover:text-gray-90 transition-colors"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          <p className="text-sm text-gray-50 mt-2">
            {t("approval.approvalDescription")}
          </p>
        </div>

        {/* Steps */}
        <div className="p-6 space-y-4">
          {steps.map((step, index) => {
            const isCurrent = index === currentStepIndex;
            const isPast = step.isApproved;

            return (
              <div
                key={step.tokenAddress}
                className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                  isCurrent
                    ? "border-green-10 bg-brand-green/10"
                    : isPast
                    ? "border-green-10/40 bg-brand-green/5"
                    : "border-gray-30 bg-gray-10"
                }`}
              >
                {/* Step Number/Status Icon */}
                <div
                  className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                    isPast
                      ? "bg-green-10 text-gray-90"
                      : isCurrent
                      ? "bg-green-10 text-gray-90"
                      : "bg-gray-20 text-gray-50"
                  }`}
                >
                  {isPast ? (
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </div>

                {/* Step Info */}
                <div className="flex-1">
                  <div className="font-bold text-gray-90">
                    {step.tokenSymbol} {t("common.approve")}
                  </div>
                  <div className="text-sm text-gray-50">
                    {isPast
                      ? t("approval.approvalComplete")
                      : isCurrent
                      ? t("approval.approvalNeeded")
                      : t("approval.waiting")}
                  </div>
                </div>

                {/* Action Button */}
                {!isPast && (
                  <button
                    onClick={() => handleApprove(step.tokenAddress)}
                    disabled={
                      !isCurrent ||
                      step.isApproving ||
                      localApprovingToken !== null
                    }
                    className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                      isCurrent &&
                      !step.isApproving &&
                      localApprovingToken === null
                        ? "bg-green-10 hover:bg-green-20 text-gray-90"
                        : "bg-gray-20 text-gray-50 cursor-not-allowed"
                    }`}
                  >
                    {step.isApproving ||
                    localApprovingToken === step.tokenAddress ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-gray-90/20 border-t-gray-90 rounded-full animate-spin" />
                        {t("common.approving")}
                      </div>
                    ) : (
                      t("common.approve")
                    )}
                  </button>
                )}
              </div>
            );
          })}

          {/* Add Liquidity Step */}
          <div
            className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
              allApproved
                ? "border-green-10 bg-brand-green/10"
                : "border-gray-30 bg-gray-10"
            }`}
          >
            {/* Step Number */}
            <div
              className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                allApproved
                  ? "bg-green-10 text-gray-90"
                  : "bg-gray-20 text-gray-50"
              }`}
            >
              {steps.length + 1}
            </div>

            {/* Step Info */}
            <div className="flex-1">
              <div className="font-bold text-gray-90">
                {t("liquidity.addLiquidity")}
              </div>
              <div className="text-sm text-gray-50">
                {allApproved
                  ? t("approval.readyToAdd")
                  : t("approval.afterTokenApproval")}
              </div>
            </div>

            {/* Action Button */}
            <button
              onClick={handleAddLiquidity}
              disabled={!canAddLiquidity}
              className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                canAddLiquidity
                  ? "bg-green-10 hover:bg-green-20 text-gray-90"
                  : "bg-gray-20 text-gray-50 cursor-not-allowed"
              }`}
            >
              {isAddingLiquidity ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-gray-90/20 border-t-gray-90 rounded-full animate-spin" />
                  {t("approval.adding")}
                </div>
              ) : (
                t("common.add")
              )}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-30 bg-gray-10 rounded-b-2xl">
          <div className="flex items-start gap-3">
            <span className="text-xl">💡</span>
            <p className="text-sm text-gray-50 leading-relaxed">
              {t("approval.metamaskNote")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
