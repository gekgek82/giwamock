"use client";

import { useState, useEffect, useMemo } from "react";
import {
  useAccount,
  useSignMessage,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { GaugeAbi } from "@giwater/shared/abis";
import { GIWASCAN_URL } from "@/lib/config";
import {
  createMockSignature,
  getMockDemoAddress,
  isMockMode,
  simulateMockTransaction,
} from "@/lib/mockTransactions";
import { useGauge } from "@/hooks/useGauge";
import { useTokenAllowance } from "@/hooks/useTokenAllowance";
import { useTokenApprove } from "@/hooks/useTokenApprove";
import { useTokenPrices } from "@/hooks/useTokenPrices";
import { useEmissionAPR } from "@/hooks/useEmissionAPR";
import { useLpStakeIntent } from "@/hooks/useLpStakeIntent";
import { portfolioApi } from "@/lib/portfolioApi";
import { StakeAmountPanel } from "./StakeAmountPanel";
import { StakingConfigDetails } from "./StakingConfigDetails";
import {
  StakeReviewPanel,
  type StakeReviewStatus,
} from "./StakeReviewPanel";

type Step = "config" | "review" | "approving" | "approved" | "staking" | "success";

interface StakeFlowProps {
  poolAddress: `0x${string}`;
  /** CL tokenId. Omitted for basic pools. */
  tokenId?: string;
  token0Symbol: string;
  token0Decimals: number;
  token1Symbol: string;
  token1Decimals: number;
  /**
   * Total stakeable units. For basic pools this is the user's LP token
   * balance (wei); for CL it's the NFT's current liquidity. Both paths
   * use the same scaling: myTokenX = tokenXAmountForBalance * amount /
   * balanceRaw.
   */
  balanceRaw: bigint | undefined;
  /** Token0/1 amounts representing the full `balanceRaw` (unscaled floats). */
  token0AmountForBalance: number;
  token1AmountForBalance: number;
  isLoadingBalance: boolean;
}

export function StakeFlow({
  poolAddress,
  tokenId,
  token0Symbol,
  token0Decimals: _token0Decimals,
  token1Symbol,
  token1Decimals: _token1Decimals,
  balanceRaw,
  token0AmountForBalance,
  token1AmountForBalance,
  isLoadingBalance,
}: StakeFlowProps) {
  const t = useTranslations();
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const effectiveAddress = address ?? getMockDemoAddress();
  const effectiveIsConnected = isConnected || Boolean(effectiveAddress);
  const { signMessageAsync } = useSignMessage();
  const [step, setStep] = useState<Step>("config");
  // Slider value: 0-100% of the user's AVAILABLE (not-yet-staked) liquidity.
  const [percentage, setPercentage] = useState(0);

  // Pool / gauge
  const { gaugeAddress, hasGauge, isLoading: isLoadingGauge } = useGauge(
    poolAddress,
  );
  const { prices } = useTokenPrices([token0Symbol, token1Symbol]);
  const { aprFormatted: emissionApr } = useEmissionAPR(poolAddress);

  // LP token approval to gauge
  const { allowance, refetch: refetchAllowance } = useTokenAllowance(
    poolAddress,
    gaugeAddress ?? undefined,
  );
  const { approve } = useTokenApprove();

  // Stake transaction
  const {
    data: stakeHash,
    writeContract: stakeWriteContract,
    reset: resetStake,
  } = useWriteContract();
  const { isSuccess: isStakeSuccess } = useWaitForTransactionReceipt({
    hash: stakeHash,
  });

  // Pre-TGE: no on-chain gauge yet → record staking intent off-chain.
  // Both paths coexist so we can migrate pool-by-pool once gauges are created.
  // See root CLAUDE.md "Pre-TGE Phase" for the convention.
  const isPreTGE = !isLoadingGauge && !hasGauge;

  // Fetch the currently-staked amount. The slider is framed against the
  // remaining *available* portion — staking 100% twice in a row stakes
  // 100% of the original, not 200%.
  const { stakedAmountRaw, isLoading: isLoadingIntent } = useLpStakeIntent(
    poolAddress,
    tokenId,
  );

  // Available = balance - staked (clamped at 0). Fully staked when balance
  // exists but nothing is available.
  const availableBalanceRaw =
    balanceRaw !== undefined
      ? balanceRaw > stakedAmountRaw
        ? balanceRaw - stakedAmountRaw
        : 0n
      : 0n;
  const isFullyStaked =
    balanceRaw !== undefined &&
    balanceRaw > 0n &&
    availableBalanceRaw === 0n;

  // Convert slider (% of available) into raw amount (LP wei or liquidity units).
  const amountToStake = useMemo<bigint>(() => {
    if (!availableBalanceRaw || percentage === 0) return 0n;
    return (availableBalanceRaw * BigInt(percentage)) / 100n;
  }, [availableBalanceRaw, percentage]);

  // Proportional scale: the caller supplies the full-balance token totals;
  // we scale them by amountToStake / balanceRaw.
  const [myToken0Amount, myToken1Amount] = useMemo<[number, number]>(() => {
    if (!balanceRaw || balanceRaw === 0n || amountToStake === 0n) {
      return [0, 0];
    }
    const ratio = Number(amountToStake) / Number(balanceRaw);
    return [token0AmountForBalance * ratio, token1AmountForBalance * ratio];
  }, [balanceRaw, amountToStake, token0AmountForBalance, token1AmountForBalance]);

  const price0 = prices[token0Symbol] ?? 0;
  const price1 = prices[token1Symbol] ?? 0;

  // Note: estimated point rewards are not yet specified by business — keep a
  // simple proportional display so the UI matches the design mock.
  const estPoints = useMemo(() => {
    const usd = myToken0Amount * price0 + myToken1Amount * price1;
    return usd > 0 ? usd.toFixed(3) : "0.000";
  }, [myToken0Amount, myToken1Amount, price0, price1]);

  const hasBalance = balanceRaw !== undefined && balanceRaw > 0n;
  const needsApproval =
    allowance !== undefined && amountToStake > 0n && allowance < amountToStake;

  // Cumulative absolute staked amount after this session succeeds.
  // e.g. stakedAmount=50, slider=100% of available → stake the full remaining
  // → newStakedAmount = stakedAmount + available.
  const newStakedAmountRaw = stakedAmountRaw + amountToStake;

  // Button state for the config panel
  const button = getConfigButton({
    isConnected: effectiveIsConnected,
    isLoadingGauge,
    isLoadingBalance: isLoadingBalance || isLoadingIntent,
    hasBalance,
    isFullyStaked,
    percentage,
    t,
  });

  // Review status mapped to the right-side panel
  const reviewStatus: StakeReviewStatus =
    step === "review"
      ? "review"
      : step === "approving"
        ? "approving"
        : step === "approved"
          ? "approved"
          : step === "staking"
            ? "staking"
            : "success";

  // ───────────── Handlers ─────────────

  const handleStakeClick = () => {
    if (!effectiveIsConnected || !hasBalance || percentage === 0) return;
    setStep("review");
  };

  const handleEdit = () => {
    setStep("config");
  };

  const handleApprove = async () => {
    if (!gaugeAddress) return;
    setStep("approving");
    try {
      // Approve max to avoid re-approving for every stake
      const maxAmount =
        BigInt(
          "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
        );
      await approve(poolAddress, gaugeAddress, maxAmount);
      await refetchAllowance();
      toast.success(t("stake.approveSuccess"));
      setStep("approved");
    } catch (_err) {
      // Error toast already shown by useTokenApprove
      setStep("review");
    }
  };

  const handleConfirmStake = () => {
    if (!gaugeAddress || !effectiveAddress || amountToStake === 0n) return;
    setStep("staking");
    try {
      if (isMockMode()) {
        simulateMockTransaction({
          label: `stake:${poolAddress}:${amountToStake.toString()}`,
        })
          .then(() => {
            toast.success(t("stake.stakeSuccess"));
            setStep("success");
          })
          .catch((err) => {
            console.error("Mock stake error:", err);
            toast.error(t("errors.transactionFailed"));
            setStep("approved");
          });
        return;
      }

      stakeWriteContract({
        address: gaugeAddress,
        abi: GaugeAbi,
        functionName: "deposit",
        args: [amountToStake],
      });
    } catch (err) {
      console.error("Stake error:", err);
      toast.error(
        err instanceof Error ? err.message : t("errors.transactionFailed"),
      );
      setStep("approved");
    }
  };

  // Pre-TGE stake: no on-chain tx, but we still ask the wallet to sign a
  // message binding (wallet, pool, new cumulative staked amount) so the
  // backend can verify authenticity. The persisted `stakedAmount` is always
  // the total absolute wei of staked LP, not this session's delta — see
  // CLAUDE.md "Pre-TGE Phase".
  const handleOffchainStake = async () => {
    if (!effectiveAddress || percentage === 0 || isFullyStaked) return;

    const newStakedAmountStr = newStakedAmountRaw.toString();

    // Step 1: prompt wallet signature
    setStep("approving");
    const message = buildStakeSignMessage({
      poolAddress,
      tokenId,
      stakedAmount: newStakedAmountStr,
      timestamp: Math.floor(Date.now() / 1000),
    });
    let signature: string;
    try {
      signature = isMockMode()
        ? createMockSignature({ address: effectiveAddress, message })
        : await signMessageAsync({ message });
    } catch (err) {
      console.error("Signature rejected:", err);
      toast.error(t("errors.userRejected"));
      setStep("review");
      return;
    }

    // Step 2: submit signed intent to backend
    setStep("staking");
    try {
      await portfolioApi.setLpStakeIntent(
        effectiveAddress,
        poolAddress,
        newStakedAmountStr,
        signature,
        message,
        tokenId,
      );
      toast.success(t("stake.offchainPending"));
      setStep("success");
    } catch (err) {
      console.error("Offchain stake error:", err);
      toast.error(
        err instanceof Error ? err.message : t("errors.transactionFailed"),
      );
      setStep("review");
    }
  };

  // The "Review" button picks whichever action is needed next.
  // Pre-TGE: single-step confirm → offchain submit.
  // Post-TGE: review → (approve if needed) → confirm → on-chain deposit.
  const handleReviewPrimary = () => {
    if (reviewStatus === "review") {
      if (isPreTGE) {
        handleOffchainStake();
        return;
      }
      if (needsApproval) {
        handleApprove();
      } else {
        setStep("approved");
      }
    } else if (reviewStatus === "approved") {
      handleConfirmStake();
    } else if (reviewStatus === "success") {
      router.push("/portfolio");
    }
  };

  // Watch for stake success
  useEffect(() => {
    if (isStakeSuccess && stakeHash) {
      toast.success(
        <div>
          {t("stake.stakeSuccess")}{" "}
          <a
            href={`${GIWASCAN_URL}/tx/${stakeHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            {t("common.viewOnGiwaScan")}
          </a>
        </div>,
      );
      setStep("success");
      resetStake();
    }
  }, [isStakeSuccess, stakeHash, t, resetStake]);

  // ───────────── Format helpers ─────────────

  const fmtAmount = (n: number) =>
    n.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 6,
    });
  const fmtUsd = (n: number) =>
    `~$${n.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  // Pre-TGE: label this as "Point APR" and show a placeholder until the
  // business defines the point-to-APR formula. Post-TGE falls back to the
  // on-chain emission APR from useEmissionAPR.
  const aprLabel = isPreTGE ? t("stake.estPointApr") : t("stake.estApr");
  const aprValue = isPreTGE ? "—" : emissionApr;

  const sharedAmountProps = {
    percentage,
    token0Symbol,
    token0Amount: fmtAmount(myToken0Amount),
    token0UsdValue: fmtUsd(myToken0Amount * price0),
    token1Symbol,
    token1Amount: fmtAmount(myToken1Amount),
    token1UsdValue: fmtUsd(myToken1Amount * price1),
    aprLabel,
    aprValue,
    estPoints,
  };

  // ───────────── Render ─────────────

  if (step === "config") {
    return (
      <div className="flex justify-center">
        <div className="w-full max-w-[720px]">
          <StakeAmountPanel
            {...sharedAmountProps}
            onPercentageChange={setPercentage}
            buttonLabel={button.text}
            buttonDisabled={button.disabled}
            onStake={handleStakeClick}
            readOnly={isFullyStaked}
          />
        </div>
      </div>
    );
  }

  // Review / approving / approved / staking / success — side-by-side layout
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <StakingConfigDetails {...sharedAmountProps} />
      <StakeReviewPanel
        status={reviewStatus}
        isPreTGE={isPreTGE}
        onEdit={handleEdit}
        onPrimary={handleReviewPrimary}
        onSecondarySuccess={() => {
          if (stakeHash) {
            window.open(`${GIWASCAN_URL}/tx/${stakeHash}`, "_blank");
          }
        }}
      />
    </div>
  );
}

/**
 * Build the plaintext message the wallet signs for an offchain stake intent.
 * Must reference the pool address and staked amount (wei string) — the
 * backend rejects signatures whose message doesn't bind to the same values.
 */
function buildStakeSignMessage({
  poolAddress,
  tokenId,
  stakedAmount,
  timestamp,
}: {
  poolAddress: string;
  tokenId?: string;
  stakedAmount: string;
  timestamp: number;
}): string {
  const lines = [
    `GiwaTer — Confirm LP staking intent`,
    `Pool: ${poolAddress}`,
  ];
  if (tokenId) lines.push(`Token ID: ${tokenId}`);
  lines.push(`Staked amount: ${stakedAmount}`);
  lines.push(`Timestamp: ${timestamp}`);
  return lines.join("\n");
}

function getConfigButton({
  isConnected,
  isLoadingGauge,
  isLoadingBalance,
  hasBalance,
  isFullyStaked,
  percentage,
  t,
}: {
  isConnected: boolean;
  isLoadingGauge: boolean;
  isLoadingBalance: boolean;
  hasBalance: boolean;
  isFullyStaked: boolean;
  percentage: number;
  t: ReturnType<typeof useTranslations>;
}): { text: string; disabled: boolean } {
  if (!isConnected) {
    return { text: t("common.connectWallet"), disabled: true };
  }
  if (isLoadingGauge || isLoadingBalance) {
    return { text: t("common.loading"), disabled: true };
  }
  if (!hasBalance) {
    return { text: t("stake.insufficientBalance"), disabled: true };
  }
  if (isFullyStaked) {
    return { text: t("stake.alreadyFullyStaked"), disabled: true };
  }
  if (percentage === 0) {
    return { text: t("liquidity.selectAmount"), disabled: true };
  }
  return { text: t("stake.stakeNow"), disabled: false };
}
