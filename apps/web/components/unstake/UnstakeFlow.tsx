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
import { useTokenPrices } from "@/hooks/useTokenPrices";
import { useLpStakeIntent } from "@/hooks/useLpStakeIntent";
import { portfolioApi } from "@/lib/portfolioApi";
import { UnstakeAmountPanel } from "./UnstakeAmountPanel";
import { UnstakingConfigDetails } from "./UnstakingConfigDetails";
import {
  UnstakeReviewPanel,
  type UnstakeReviewStatus,
} from "./UnstakeReviewPanel";

type Step = "config" | "review" | "unstaking" | "success";

interface UnstakeFlowProps {
  poolAddress: `0x${string}`;
  /** CL tokenId. Omitted for basic pools. */
  tokenId?: string;
  token0Symbol: string;
  token0Decimals: number;
  token1Symbol: string;
  token1Decimals: number;
  /**
   * Total position size — LP wei for basic, NFT liquidity for CL. Used
   * only for proportional token-amount scaling, so the caller can also
   * pass the on-chain balance (same denominator the stake intent was
   * recorded against).
   */
  balanceRaw: bigint | undefined;
  /** Token0/1 amounts representing the full `balanceRaw` (unscaled floats). */
  token0AmountForBalance: number;
  token1AmountForBalance: number;
  isLoadingBalance: boolean;
}

export function UnstakeFlow({
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
}: UnstakeFlowProps) {
  const t = useTranslations();
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const effectiveAddress = address ?? getMockDemoAddress();
  const effectiveIsConnected = isConnected || Boolean(effectiveAddress);
  const { signMessageAsync } = useSignMessage();
  const [step, setStep] = useState<Step>("config");
  // Slider: 0-100% of currently-staked portion (the amount being unstaked).
  const [percentage, setPercentage] = useState(0);

  const { gaugeAddress, hasGauge, isLoading: isLoadingGauge } = useGauge(
    poolAddress,
  );
  const { prices } = useTokenPrices([token0Symbol, token1Symbol]);

  const {
    stakedAmountRaw,
    isLoading: isLoadingIntent,
  } = useLpStakeIntent(poolAddress, tokenId);

  // Pre-TGE: no on-chain gauge → use signed offchain intent.
  // Post-TGE: call gauge.withdraw. See root CLAUDE.md "Pre-TGE Phase".
  const isPreTGE = !isLoadingGauge && !hasGauge;

  const {
    data: unstakeHash,
    writeContract: unstakeWriteContract,
    reset: resetUnstake,
  } = useWriteContract();
  const { isSuccess: isUnstakeSuccess } = useWaitForTransactionReceipt({
    hash: unstakeHash,
  });

  const hasStaked = stakedAmountRaw > 0n;

  const amountToUnstake = useMemo<bigint>(() => {
    if (!hasStaked || percentage === 0) return 0n;
    return (stakedAmountRaw * BigInt(percentage)) / 100n;
  }, [stakedAmountRaw, hasStaked, percentage]);

  // Underlying token amounts for the unstaked slice — scaled by the
  // amount / balance ratio (same math for basic and CL).
  const [myToken0Amount, myToken1Amount] = useMemo<[number, number]>(() => {
    if (!balanceRaw || balanceRaw === 0n || amountToUnstake === 0n) {
      return [0, 0];
    }
    const ratio = Number(amountToUnstake) / Number(balanceRaw);
    return [token0AmountForBalance * ratio, token1AmountForBalance * ratio];
  }, [balanceRaw, amountToUnstake, token0AmountForBalance, token1AmountForBalance]);

  const price0 = prices[token0Symbol] ?? 0;
  const price1 = prices[token1Symbol] ?? 0;

  const newStakedAmountRaw = stakedAmountRaw - amountToUnstake;

  const button = getConfigButton({
    isConnected: effectiveIsConnected,
    isLoadingGauge,
    isLoadingBalance: isLoadingBalance || isLoadingIntent,
    hasStaked,
    percentage,
    t,
  });

  const reviewStatus: UnstakeReviewStatus =
    step === "review"
      ? "review"
      : step === "unstaking"
        ? "unstaking"
        : "success";

  // ───────────── Handlers ─────────────

  const handleUnstakeClick = () => {
    if (!effectiveIsConnected || !hasStaked || percentage === 0) return;
    setStep("review");
  };

  const handleEdit = () => {
    setStep("config");
  };

  const handleConfirmOnchainUnstake = () => {
    if (!gaugeAddress || !effectiveAddress || amountToUnstake === 0n) return;
    setStep("unstaking");
    try {
      if (isMockMode()) {
        simulateMockTransaction({
          label: `unstake:${poolAddress}:${amountToUnstake.toString()}`,
        })
          .then(() => {
            toast.success(t("unstake.unstakeSuccess"));
            setStep("success");
          })
          .catch((err) => {
            console.error("Mock unstake error:", err);
            toast.error(t("errors.transactionFailed"));
            setStep("review");
          });
        return;
      }

      unstakeWriteContract({
        address: gaugeAddress,
        abi: GaugeAbi,
        functionName: "withdraw",
        args: [amountToUnstake],
      });
    } catch (err) {
      console.error("Unstake error:", err);
      toast.error(
        err instanceof Error ? err.message : t("errors.transactionFailed"),
      );
      setStep("review");
    }
  };

  // Pre-TGE unstake: write the new (reduced) cumulative staked amount as an
  // offchain intent. newStakedAmount=0 clears the intent.
  const handleOffchainUnstake = async () => {
    if (!effectiveAddress || percentage === 0 || !hasStaked) return;

    const newStakedAmountStr = newStakedAmountRaw.toString();

    setStep("unstaking");
    const message = buildUnstakeSignMessage({
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

    try {
      await portfolioApi.setLpStakeIntent(
        effectiveAddress,
        poolAddress,
        newStakedAmountStr,
        signature,
        message,
        tokenId,
      );
      toast.success(t("unstake.offchainPending"));
      setStep("success");
    } catch (err) {
      console.error("Offchain unstake error:", err);
      toast.error(
        err instanceof Error ? err.message : t("errors.transactionFailed"),
      );
      setStep("review");
    }
  };

  const handleReviewPrimary = () => {
    if (reviewStatus === "review") {
      if (isPreTGE) {
        handleOffchainUnstake();
      } else {
        handleConfirmOnchainUnstake();
      }
    } else if (reviewStatus === "success") {
      router.push("/portfolio");
    }
  };

  useEffect(() => {
    if (isUnstakeSuccess && unstakeHash) {
      toast.success(
        <div>
          {t("unstake.unstakeSuccess")}{" "}
          <a
            href={`${GIWASCAN_URL}/tx/${unstakeHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            {t("common.viewOnGiwaScan")}
          </a>
        </div>,
      );
      setStep("success");
      resetUnstake();
    }
  }, [isUnstakeSuccess, unstakeHash, t, resetUnstake]);

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

  const sharedAmountProps = {
    percentage,
    token0Symbol,
    token0Amount: fmtAmount(myToken0Amount),
    token0UsdValue: fmtUsd(myToken0Amount * price0),
    token1Symbol,
    token1Amount: fmtAmount(myToken1Amount),
    token1UsdValue: fmtUsd(myToken1Amount * price1),
  };

  if (step === "config") {
    return (
      <div className="flex justify-center">
        <div className="w-full max-w-[720px]">
          <UnstakeAmountPanel
            {...sharedAmountProps}
            onPercentageChange={setPercentage}
            buttonLabel={button.text}
            buttonDisabled={button.disabled}
            onUnstake={handleUnstakeClick}
            readOnly={!hasStaked}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <UnstakingConfigDetails {...sharedAmountProps} />
      <UnstakeReviewPanel
        status={reviewStatus}
        isPreTGE={isPreTGE}
        onEdit={handleEdit}
        onPrimary={handleReviewPrimary}
        onSecondarySuccess={() => {
          if (unstakeHash) {
            window.open(`${GIWASCAN_URL}/tx/${unstakeHash}`, "_blank");
          }
        }}
      />
    </div>
  );
}

/**
 * Build the plaintext message the wallet signs for an offchain unstake.
 * Must reference the pool and the new cumulative stakedAmount — the backend
 * rejects signatures that don't bind to the same values.
 */
function buildUnstakeSignMessage({
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
    `GiwaTer — Confirm LP unstaking intent`,
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
  hasStaked,
  percentage,
  t,
}: {
  isConnected: boolean;
  isLoadingGauge: boolean;
  isLoadingBalance: boolean;
  hasStaked: boolean;
  percentage: number;
  t: ReturnType<typeof useTranslations>;
}): { text: string; disabled: boolean } {
  if (!isConnected) {
    return { text: t("common.connectWallet"), disabled: true };
  }
  if (isLoadingGauge || isLoadingBalance) {
    return { text: t("common.loading"), disabled: true };
  }
  if (!hasStaked) {
    return { text: t("unstake.nothingStaked"), disabled: true };
  }
  if (percentage === 0) {
    return { text: t("liquidity.selectAmount"), disabled: true };
  }
  return { text: t("unstake.unstakeNow"), disabled: false };
}
