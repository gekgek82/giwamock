"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

interface DepositGradeWarningModalProps {
  grade: number;
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Deposit warning modal based on pool grade.
 *
 * Lv.1 (Verified): No modal shown
 * Lv.2 (Rising):   General volatility/risk warning - confirm to proceed
 * Lv.3 (Unknown):  Strong warning - checkbox agreement + confirm required
 */
export function DepositGradeWarningModal({
  grade,
  isOpen,
  onConfirm,
  onCancel,
}: DepositGradeWarningModalProps) {
  const t = useTranslations();
  const [agreed, setAgreed] = useState(false);

  if (!isOpen || grade === 1) return null;

  const isUnknown = grade === 3;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl max-w-md w-full mx-4 overflow-hidden shadow-xl">
        {/* Header */}
        <div
          className={`px-6 py-4 ${
            isUnknown
              ? "bg-red-50 border-b border-red-200"
              : "bg-yellow-50 border-b border-yellow-200"
          }`}
        >
          <div className="flex items-center gap-3">
            {isUnknown ? (
              <svg
                className="w-6 h-6 text-red-500 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            ) : (
              <svg
                className="w-6 h-6 text-yellow-500 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            )}
            <h3
              className={`text-lg font-bold ${
                isUnknown ? "text-red-800" : "text-yellow-800"
              }`}
            >
              {isUnknown
                ? t("deposit.unknownPoolWarningTitle")
                : t("deposit.risingPoolWarningTitle")}
            </h3>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {isUnknown ? (
            <>
              <p className="text-sm text-neutral-700 mb-4">
                {t("deposit.unknownPoolWarningBody")}
              </p>
              <ul className="text-sm text-neutral-600 space-y-2 mb-5">
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">&#8226;</span>
                  {t("deposit.unknownPoolWarning1")}
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">&#8226;</span>
                  {t("deposit.unknownPoolWarning2")}
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">&#8226;</span>
                  {t("deposit.unknownPoolWarning3")}
                </li>
              </ul>

              {/* Checkbox */}
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-red-500 rounded"
                />
                <span className="text-sm text-neutral-800 font-medium">
                  {t("deposit.unknownPoolAgreement")}
                </span>
              </label>
            </>
          ) : (
            <p className="text-sm text-neutral-700">
              {t("deposit.risingPoolWarningBody")}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 bg-neutral-50 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 bg-neutral-200 text-neutral-700 font-medium rounded-xl hover:bg-neutral-300 transition-colors"
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={onConfirm}
            disabled={isUnknown && !agreed}
            className={`flex-1 py-3 font-medium rounded-xl transition-colors ${
              isUnknown
                ? agreed
                  ? "bg-red-500 text-white hover:bg-red-600"
                  : "bg-neutral-300 text-neutral-500 cursor-not-allowed"
                : "bg-yellow-500 text-white hover:bg-yellow-600"
            }`}
          >
            {t("common.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
