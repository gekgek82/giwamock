"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { parseUnits } from "viem";
import { useTerTokenAddress } from "@/hooks/useContractAddresses";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { useCreateLock } from "@/hooks/useCreateLock";
import { TokenIcon } from "@/components/common/TokenIcon";
import { GIWASCAN_URL } from "@/lib/config";
import { Button } from "@/components/common/Button";
import { LockStepLayout } from "@/components/vote/LockStepLayout";

// Lockable token info
interface LockableToken {
  address: `0x${string}`;
  symbol: string;
  name: string;
  decimals: number;
  balance: string;
  balanceUsd: number;
}

// Duration options in days
const DURATION_MARKS = [
  { label: "7 days", value: 7, position: 0 },
  { label: "1 year", value: 365, position: 25 },
  { label: "2 years", value: 730, position: 50 },
  { label: "3 years", value: 1095, position: 75 },
  { label: "4 years", value: 1460, position: 100 },
];

// Convert slider position to days
function positionToDays(position: number): number {
  if (position <= 0) return 7;
  if (position >= 100) return 1460;

  // Find the two marks we're between
  for (let i = 0; i < DURATION_MARKS.length - 1; i++) {
    const current = DURATION_MARKS[i];
    const next = DURATION_MARKS[i + 1];
    if (position >= current.position && position <= next.position) {
      const ratio =
        (position - current.position) / (next.position - current.position);
      return Math.round(current.value + ratio * (next.value - current.value));
    }
  }
  return 730; // Default to 2 years
}

// Convert days to lock time display
function daysToLockTime(days: number): { value: number; unit: string } {
  if (days >= 365) {
    return { value: Math.round(days / 365), unit: "Years" };
  }
  return { value: days, unit: "Days" };
}

// Calculate voting power (veTER) based on amount and duration
function calculateVotingPower(amount: number, days: number): number {
  const maxDays = 1460;
  const ratio = days / maxDays;
  return amount * ratio;
}

type Step = "input" | "approve" | "confirm" | "success";

export function CreateLockForm() {
  const router = useRouter();
  const t = useTranslations();
  const queryClient = useQueryClient();

  // Get TER token address from server
  const terTokenAddress = useTerTokenAddress();
  const tokenAddress =
    terTokenAddress ??
    ("0x0000000000000000000000000000000000000000" as `0x${string}`);

  // Get real token balance
  const { data: realBalance } = useTokenBalance(terTokenAddress);

  // Lock contract hooks
  const {
    needsApproval,
    approveToken,
    createLock,
    isApproving,
    isLocking,
  } = useCreateLock();

  // Create lockable tokens list dynamically with real balance
  const lockableTokens: LockableToken[] = useMemo(
    () => [
      {
        address: tokenAddress,
        symbol: "TER",
        name: "TER Token",
        decimals: 18,
        balance: realBalance ?? "0",
        balanceUsd: 0,
      },
    ],
    [tokenAddress, realBalance]
  );

  const [step, setStep] = useState<Step>("input");
  const [selectedToken, setSelectedToken] = useState<LockableToken | null>(
    null
  );
  const [amount, setAmount] = useState("");
  const [sliderPosition, setSliderPosition] = useState(50); // Default to 2 years
  const [isTokenDropdownOpen, setIsTokenDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [warningChecked, setWarningChecked] = useState(false);

  // Initialize selected token when lockable tokens are ready
  const currentToken = selectedToken ?? lockableTokens[0];

  const isInsufficientBalance =
    amount !== "" &&
    parseFloat(amount) > parseFloat(currentToken.balance);

  const days = useMemo(() => positionToDays(sliderPosition), [sliderPosition]);
  const lockTime = useMemo(() => daysToLockTime(days), [days]);
  const votingPower = useMemo(() => {
    const numAmount = parseFloat(amount) || 0;
    return calculateVotingPower(numAmount, days);
  }, [amount, days]);

  const handlePercentage = (percentage: number) => {
    const balance = parseFloat(currentToken.balance) || 0;
    const newAmount = (balance * percentage) / 100;
    setAmount(newAmount.toString());
  };

  const handleCancel = () => {
    router.back();
  };

  const handleCreateLock = () => {
    setShowWarningModal(true);
    setWarningChecked(false);
  };

  const handleWarningConfirm = () => {
    setShowWarningModal(false);
    const amountWei = parseUnits(amount, 18);
    if (needsApproval(amountWei)) {
      setStep("approve");
    } else {
      setStep("confirm");
    }
  };

  const handleEditAmount = () => {
    setStep("input");
  };

  const handleApprove = async () => {
    setIsLoading(true);
    try {
      const amountWei = parseUnits(amount, 18);
      await approveToken(amountWei);
      setStep("confirm");
    } catch (error) {
      // Error toast is shown by useTokenApprove
      console.error("Approve failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      const hash = await createLock(amount, days);
      setTxHash(hash);
      setStep("success");
      queryClient.invalidateQueries({ queryKey: ["portfolio", "points"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio", "locks"] });
      queryClient.invalidateQueries({ queryKey: ["tpoint-locks"] });
    } catch (error) {
      console.error("Lock failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoToDashboard = () => {
    router.push("/vote");
  };

  const handleViewConfirmation = () => {
    if (txHash) {
      window.open(`${GIWASCAN_URL}/tx/${txHash}`, "_blank");
    }
  };

  // Render token icon using shared component
  const renderTokenIcon = (token: LockableToken) => (
    <TokenIcon address={token.address} symbol={token.symbol} size={32} />
  );

  const summaryProps = {
    amount: { value: amount || "0", unit: currentToken.symbol },
    duration: { value: String(lockTime.value), unit: lockTime.unit },
    votingPower: {
      value: votingPower.toFixed(5),
      unit: `ve${currentToken.symbol}`,
    },
  };

  // Success Step UI
  if (step === "success") {
    return (
      <LockStepLayout
        title={t("vote.lockCreatedTitle")}
        description={
          <>
            <p className="leading-[21px]">
              {t("vote.lockCreatedDescription1")}
            </p>
            <p className="leading-[21px]">
              {t("vote.lockCreatedDescription2")}
            </p>
          </>
        }
        {...summaryProps}
        heroText={t("vote.lockHasBeenCreated")}
        leftButton={{
          text: t("vote.viewConfirmation"),
          onClick: handleViewConfirmation,
          disabled: !txHash,
        }}
        rightButton={{
          text: t("vote.goPortfolio"),
          onClick: handleGoToDashboard,
        }}
      />
    );
  }

  // Confirm Step UI (after approval)
  if (step === "confirm") {
    const loading = isLoading || isLocking;
    return (
      <LockStepLayout
        title={t("vote.finalReviewTitle")}
        description={t("vote.finalReviewDescription")}
        {...summaryProps}
        heroText={t("vote.readyToLockUp")}
        leftButton={{
          text: t("vote.edit"),
          onClick: handleEditAmount,
          disabled: loading,
        }}
        rightButton={{
          text: loading ? t("vote.confirming") : t("common.confirm"),
          onClick: handleConfirm,
          loading,
        }}
      />
    );
  }

  // Approve Step UI (token not approved yet)
  if (step === "approve") {
    const loading = isLoading || isApproving;
    return (
      <LockStepLayout
        title={t("vote.approveTitle")}
        description={
          <>
            <p className="leading-[21px]">{t("vote.approveDescription1")}</p>
            <p className="leading-[21px]">{t("vote.approveDescription2")}</p>
          </>
        }
        {...summaryProps}
        heroText={t("vote.checkWalletForApproval")}
        leftButton={{
          text: t("vote.edit"),
          onClick: handleEditAmount,
          disabled: loading,
        }}
        rightButton={{
          text: loading ? t("common.approving") : t("common.approve"),
          onClick: handleApprove,
          loading,
        }}
      />
    );
  }

  // Input Step UI
  return (
    <div className="bg-neutral-50 rounded-2xl p-6 shadow-sm max-w-xl mx-auto">
      {/* Header */}
      <h2 className="text-primary-700 heading-5 mb-2">
        {t("vote.createNewLockTitle")}
      </h2>
      <p className="body-14 text-neutral-700 mb-1">{t("vote.readyToEarn")}</p>
      <p className="body-14 text-neutral-700 mb-4">
        {t("vote.cannotUnlockEarly")}
        <br />
        {t("vote.extendDuration")}
      </p>

      {/* Warning Notice */}
      <div className="bg-orange-100/10 border border-orange-100 rounded-xl p-4 mb-6">
        <p className="body-14 text-orange-100">{t("vote.lockNotice")}</p>
      </div>

      {/* Token Input Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="body-14 text-neutral-700">Token1</span>
          <div className="flex items-center gap-2">
            <span className={`body-12 ${isInsufficientBalance ? "text-red-500" : "text-neutral-700"}`}>
              {currentToken.balance} {currentToken.symbol}
            </span>
            <Button variant="neutral" size="sm" className="px-2! py-1!" onClick={() => handlePercentage(50)}>
              50%
            </Button>
            <Button variant="neutral" size="sm" className="px-2! py-1!" onClick={() => handlePercentage(100)}>
              100%
            </Button>
            <button className="p-1 bg-primary-100 rounded-full hover:bg-primary-200 transition-all">
              <svg
                className="w-4 h-4 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className={`rounded-xl p-4 flex items-center justify-between ${isInsufficientBalance ? "bg-red-50 border-2 border-red-500" : "bg-primary-200"}`}>
          {/* Token Selector */}
          <div className="relative">
            <button
              onClick={() => setIsTokenDropdownOpen(!isTokenDropdownOpen)}
              className="flex items-center gap-2 px-3 py-2 bg-white hover:bg-neutral-100 border border-neutral-300 rounded-full transition-all"
            >
              {renderTokenIcon(currentToken)}
              <span className="body-16-medium text-neutral-1000">
                {currentToken.symbol}
              </span>
              <svg
                className={`w-4 h-4 text-neutral-700 transition-transform ${
                  isTokenDropdownOpen ? "rotate-180" : ""
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {isTokenDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setIsTokenDropdownOpen(false)}
                />
                <div className="absolute left-0 mt-2 w-48 bg-white border border-neutral-300 rounded-xl shadow-lg z-20 overflow-hidden">
                  {lockableTokens.map((token) => (
                    <button
                      key={token.address}
                      onClick={() => {
                        setSelectedToken(token);
                        setIsTokenDropdownOpen(false);
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-neutral-100 transition-all flex items-center gap-3"
                    >
                      {renderTokenIcon(token)}
                      <div>
                        <div className="body-16-medium text-neutral-1000">
                          {token.symbol}
                        </div>
                        <div className="body-12 text-neutral-700">
                          {token.name}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Amount Input */}
          <div className="text-right">
            <div className="flex items-center justify-end gap-2">
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "" || /^\d*\.?\d*$/.test(v)) setAmount(v);
                }}
                placeholder="0"
                className="bg-transparent text-right heading-4 text-neutral-1000 placeholder:text-neutral-500 w-full focus:outline-none"
                style={isInsufficientBalance ? { color: "var(--color-red-500)" } : undefined}
              />
              <span className="body-16 text-neutral-700">Max</span>
            </div>
            <span className="body-12 text-neutral-600">
              ~${(parseFloat(amount) * currentToken.balanceUsd || 0).toFixed(1)}
            </span>
          </div>
        </div>
      </div>

      {/* Duration Slider */}
      <div className="mb-6">
        <span className="body-14 text-neutral-700 mb-3 block">
          {t("vote.duration")}
        </span>

        <div className="relative pt-2 pb-8">
          {/* Slider Track */}
          <div className="relative h-2">
            <div className="absolute inset-0 bg-neutral-300 rounded-full" />
            <div
              className="absolute left-0 top-0 h-full bg-primary-700 rounded-full"
              style={{ width: `${sliderPosition}%` }}
            />
            {/* Slider Thumb */}
            <input
              type="range"
              min="0"
              max="100"
              value={sliderPosition}
              onChange={(e) => setSliderPosition(Number(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-primary-700 rounded-full border-2 border-white shadow-md pointer-events-none"
              style={{ left: `calc(${sliderPosition}% - 8px)` }}
            />
          </div>

          {/* Duration Labels */}
          <div className="absolute left-0 right-0 top-6 flex justify-between">
            {DURATION_MARKS.map((mark) => (
              <span
                key={mark.value}
                className="body-12 text-neutral-600"
                style={{
                  position: "absolute",
                  left: `${mark.position}%`,
                  transform: "translateX(-50%)",
                }}
              >
                {mark.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Lock Info Display */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-neutral-100 rounded-xl p-4 text-center">
          <span className="body-12 text-neutral-700 block mb-1">
            {t("vote.newLockTime")}
          </span>
          <div className="flex items-center justify-center gap-2">
            <span className="heading-5 text-primary-700">{lockTime.value}</span>
            <span className="body-16 text-neutral-700">{lockTime.unit}</span>
          </div>
        </div>
        <div className="bg-neutral-100 rounded-xl p-4 text-center">
          <span className="body-12 text-neutral-700 block mb-1">
            {t("vote.newEstimatedVotingPower")}
          </span>
          <div className="flex items-center justify-center gap-2">
            <span className="heading-5 text-primary-700">
              {votingPower.toFixed(1)}
            </span>
            <span className="body-16 text-neutral-700">veTER</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-4">
        <Button variant="secondary" size="md" onClick={handleCancel}>
          {t("common.cancel")}
        </Button>
        {isInsufficientBalance ? (
          <Button variant="danger" size="md" disabled>
            {t("swap.insufficientBalance")}
          </Button>
        ) : (
          <Button size="md" onClick={handleCreateLock} disabled={!amount || parseFloat(amount) <= 0}>
            {t("vote.createLock")}
          </Button>
        )}
      </div>

      {/* Warning Modal */}
      {showWarningModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl w-[90%] max-w-md overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-5 pb-0">
              <h3 className="heading-6 text-neutral-1000">{t("vote.warningTitle")}</h3>
              <button
                onClick={() => setShowWarningModal(false)}
                className="p-1 hover:bg-neutral-100 rounded-lg transition-all"
              >
                <svg className="w-5 h-5 text-neutral-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="p-5">
              <div className="border border-neutral-200 rounded-xl p-4 mb-5">
                <p className="body-14-bold text-orange-100 mb-2 flex items-center gap-1">
                  <span>⚠️</span> {t("vote.tokenAdditionWarning")}
                </p>
                <p className="body-14 text-neutral-700 mb-4">
                  {t("vote.lockWarningMessage")}
                </p>
                <div
                  className="flex items-center gap-3 cursor-pointer"
                  onClick={() => setWarningChecked(!warningChecked)}
                >
                  <div
                    className={`w-6 h-6 shrink-0 rounded-md border-2 flex items-center justify-center transition-all ${
                      warningChecked
                        ? "bg-primary-700 border-primary-700"
                        : "border-neutral-300 bg-white"
                    }`}
                  >
                    {warningChecked && (
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className="body-14 text-neutral-700">{t("vote.understandRisks")}</span>
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="grid grid-cols-2 gap-3 px-5 pb-5">
              <Button variant="secondary" size="md" onClick={() => setShowWarningModal(false)}>
                {t("common.cancel")}
              </Button>
              <Button size="md" onClick={handleWarningConfirm} disabled={!warningChecked}>
                {t("vote.continue")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
