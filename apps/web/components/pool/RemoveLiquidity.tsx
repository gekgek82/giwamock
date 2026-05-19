"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseUnits, formatUnits } from "viem";
import toast from "react-hot-toast";
import { useTranslations } from "next-intl";
import { GIWASCAN_URL } from "@/lib/config";
import {
  getMockDemoAddress,
  isMockMode,
  simulateMockTransaction,
} from "@/lib/mockTransactions";
import { useSettingsStore, getDeadlineTimestamp } from "@/lib/store";
import { useRouterAddress } from "@/hooks/useContractAddresses";
import { useLpBalance } from "@/hooks/useLpBalance";
import { usePoolReserves } from "@/hooks/usePoolReserves";
import { useTokenAllowance } from "@/hooks/useTokenAllowance";
import { useTokenApprove } from "@/hooks/useTokenApprove";
import { usePools, type PoolInfo } from "@/hooks/usePools";
import { useQuoteRemoveLiquidity } from "@/hooks/useQuoteRemoveLiquidity";
import { useTokenPrices } from "@/hooks/useTokenPrices";
import { useLpStakeIntent } from "@/hooks/useLpStakeIntent";
import { RouterAbi } from "@giwater/shared/abis";
import { parseRevertReason, extractRevertReason } from "@/lib/getContractErrorMessage";
import { WithdrawAmountPanel } from "@/components/withdraw/WithdrawAmountPanel";
import { WithdrawConfirmPanel } from "@/components/withdraw/WithdrawConfirmPanel";

type Step = "input" | "confirm" | "success";

// Helper function to parse error messages
function getErrorMessage(
  error: unknown,
  t: ReturnType<typeof useTranslations>
): string {
  if (!error) return t("errors.unknownError");

  const errorMessage = error instanceof Error ? error.message : String(error);

  if (
    errorMessage.includes("rate limit") ||
    errorMessage.includes("Request is being rate limited")
  ) {
    return t("errors.rateLimitError");
  }

  if (
    errorMessage.includes("User rejected") ||
    errorMessage.includes("user rejected")
  ) {
    return t("errors.userRejected");
  }

  if (errorMessage.includes("insufficient funds")) {
    return t("errors.insufficientFunds");
  }

  if (errorMessage.includes("execution reverted") || errorMessage.includes("reverted with")) {
    const revertKey = parseRevertReason(errorMessage);
    if (revertKey) return t(revertKey);
    const reason = extractRevertReason(errorMessage);
    if (reason) return reason;
    return t("errors.executionReverted");
  }

  if (errorMessage.includes("network") || errorMessage.includes("fetch")) {
    return t("errors.networkError");
  }

  return t("errors.transactionFailed") + ": " + errorMessage.slice(0, 100);
}

interface RemoveLiquidityProps {
  initialPool?: PoolInfo;
}

export function RemoveLiquidity({ initialPool }: RemoveLiquidityProps = {}) {
  const { address, isConnected } = useAccount();
  const effectiveAddress = address ?? getMockDemoAddress();
  const effectiveIsConnected = isConnected || Boolean(effectiveAddress);
  const { pools } = usePools();
  const t = useTranslations();
  const router = useRouter();
  const routerAddress = useRouterAddress();
  const { deadlineMinutes } = useSettingsStore();
  const [selectedPool, setSelectedPool] = useState<PoolInfo | undefined>(
    initialPool
  );
  const [removePercentage, setRemovePercentage] = useState(0);
  const [step, setStep] = useState<Step>("input");
  const [submittedSnapshot, setSubmittedSnapshot] = useState<{
    percentage: number;
    token0Amount: string;
    token0UsdValue: string;
    token1Amount: string;
    token1UsdValue: string;
    txHash: `0x${string}`;
  } | null>(null);

  // Set default pool when pools are loaded
  useEffect(() => {
    if (!selectedPool && pools.length > 0) {
      setSelectedPool(pools[0]);
    }
  }, [pools, selectedPool]);

  const {
    balanceRaw,
    isLoading: isLoadingBalance,
    isFetching: isBalanceFetching,
    refetch: refetchBalance,
  } = useLpBalance(selectedPool?.address);
  const {
    reserve0Raw,
    reserve1Raw,
    refetch: refetchReserves,
  } = usePoolReserves(selectedPool?.address);
  const { prices } = useTokenPrices([
    selectedPool?.token0.symbol,
    selectedPool?.token1.symbol,
  ]);
  const { allowance, refetch: refetchAllowance } = useTokenAllowance(
    selectedPool?.address,
    routerAddress
  );
  // Pre-TGE: users cannot withdraw the staked portion of their LP. Subtract
  // the absolute staked amount from the on-chain LP balance to get the
  // actually-withdrawable balance. Clamp at 0 if staked > balance (can
  // happen if user withdrew outside the UI).
  const {
    stakedAmountRaw,
    isLoading: isLoadingIntent,
    refetch: refetchIntent,
  } = useLpStakeIntent(selectedPool?.address);
  const availableBalanceRaw =
    balanceRaw !== undefined
      ? balanceRaw > stakedAmountRaw
        ? balanceRaw - stakedAmountRaw
        : 0n
      : undefined;
  const isFullyStaked =
    balanceRaw !== undefined &&
    balanceRaw > 0n &&
    availableBalanceRaw === 0n;

  const { approve, isPending: isApproving } = useTokenApprove();
  const [isApprovalProcessing, setIsApprovalProcessing] = useState(false);
  const {
    data: removeHash,
    writeContract: removeLiquidity,
    isPending: isRemoving,
    reset: resetRemoveWrite,
  } = useWriteContract();
  const {
    data: removeReceipt,
    isLoading: isConfirming,
    isError: isReceiptError,
    error: receiptError,
  } = useWaitForTransactionReceipt({
    hash: removeHash,
  });

  const [needsApproval, setNeedsApproval] = useState(false);

  // Slider percentage is relative to *available* (unstaked) LP. This keeps
  // the staked portion locked until the user explicitly unstakes.
  const liquidityToRemove =
    availableBalanceRaw && removePercentage > 0
      ? (availableBalanceRaw * BigInt(removePercentage)) / BigInt(100)
      : BigInt(0);

  // Use quoteRemoveLiquidity for accurate token amounts
  const {
    amountA: quotedToken0,
    amountB: quotedToken1,
    isLoading: isQuoteLoading,
  } = useQuoteRemoveLiquidity(
    selectedPool?.token0.address,
    selectedPool?.token1.address,
    selectedPool?.isStable ?? false,
    liquidityToRemove > BigInt(0) ? liquidityToRemove : undefined,
    selectedPool?.token0.decimals ?? 18,
    selectedPool?.token1.decimals ?? 18,
  );

  // Fallback to manual calculation when the router quote is unavailable.
  // (reserve * liquidityToRemove) / totalSupply is in the token's native decimals,
  // so we must formatUnits with the token's decimals, not stringify the raw bigint.
  const token0Decimals = selectedPool?.token0.decimals ?? 18;
  const token1Decimals = selectedPool?.token1.decimals ?? 18;

  const expectedToken0 =
    quotedToken0 && parseFloat(quotedToken0) > 0
      ? quotedToken0
      : reserve0Raw && balanceRaw && balanceRaw > BigInt(0) && liquidityToRemove > BigInt(0)
      ? formatUnits(
          (reserve0Raw * liquidityToRemove) / balanceRaw,
          token0Decimals,
        )
      : "0";

  const expectedToken1 =
    quotedToken1 && parseFloat(quotedToken1) > 0
      ? quotedToken1
      : reserve1Raw && balanceRaw && balanceRaw > BigInt(0) && liquidityToRemove > BigInt(0)
      ? formatUnits(
          (reserve1Raw * liquidityToRemove) / balanceRaw,
          token1Decimals,
        )
      : "0";

  // Check if approval is needed
  useEffect(() => {
    if (liquidityToRemove > BigInt(0) && allowance !== undefined) {
      setNeedsApproval(allowance < liquidityToRemove);
    }
  }, [liquidityToRemove, allowance]);


  // Surface tx outcome. `useWaitForTransactionReceipt` returns the receipt
  // for both success and reverted txs, so we inspect `receipt.status`
  // instead of `isSuccess` to avoid the "silent failure" UX where a reverted
  // tx just re-enables the button with no toast.
  useEffect(() => {
    if (!removeHash) return;

    if (removeReceipt) {
      const explorerLink = (
        <a
          href={`${GIWASCAN_URL}/tx/${removeHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          {t("common.viewOnGiwaScan")}
        </a>
      );

      if (removeReceipt.status === "success") {
        toast.success(
          <div>
            {t("liquidity.liquidityRemoveSuccess")} {explorerLink}
          </div>
        );
        setStep("success");
        setRemovePercentage(0);
        // Refresh every piece of state the slider depends on so the next
        // click can't re-submit a stale amount. balanceRaw drives the
        // available cap, reserves drive the expected-output math, intent
        // drives the staked-cap, and allowance can change if we spent it.
        refetchBalance();
        refetchReserves();
        refetchIntent();
        refetchAllowance();
      } else {
        toast.error(
          <div>
            {t("errors.transactionFailed")} {explorerLink}
          </div>
        );
        setStep("input");
      }
      resetRemoveWrite();
    } else if (isReceiptError) {
      toast.error(receiptError?.message ?? t("errors.transactionFailed"));
      setStep("input");
      resetRemoveWrite();
    }
  }, [
    removeReceipt,
    isReceiptError,
    receiptError,
    removeHash,
    t,
    resetRemoveWrite,
    refetchBalance,
    refetchReserves,
    refetchIntent,
    refetchAllowance,
  ]);

  const handleApprove = async () => {
    if (!selectedPool) return;
    setIsApprovalProcessing(true);
    try {
      const maxAmount = BigInt(
        "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
      );
      await approve(selectedPool.address, routerAddress!, maxAmount);
      // Refetch allowance after successful approval
      await refetchAllowance();
      toast.success(t("liquidity.lpApprovalSuccess"));
    } catch (error) {
      console.error("Approve error:", error);
      toast.error(getErrorMessage(error, t));
    } finally {
      setIsApprovalProcessing(false);
    }
  };

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

  const handleRemoveLiquidity = async () => {
    if (!effectiveAddress || !selectedPool || liquidityToRemove === BigInt(0)) return;

    try {
      // Convert string amounts to BigInt using each token's own decimals.
      const expectedToken0BigInt = parseUnits(
        expectedToken0,
        selectedPool.token0.decimals ?? 18,
      );
      const expectedToken1BigInt = parseUnits(
        expectedToken1,
        selectedPool.token1.decimals ?? 18,
      );

      const amount0Min = (expectedToken0BigInt * BigInt(95)) / BigInt(100); // 5% slippage
      const amount1Min = (expectedToken1BigInt * BigInt(95)) / BigInt(100);
      const deadline = getDeadlineTimestamp(deadlineMinutes);

      const token0AmountNumLocal = parseFloat(expectedToken0) || 0;
      const token1AmountNumLocal = parseFloat(expectedToken1) || 0;
      const price0Local = prices[selectedPool.token0.symbol] ?? 0;
      const price1Local = prices[selectedPool.token1.symbol] ?? 0;

      if (isMockMode()) {
        const hash = await simulateMockTransaction({
          label: `remove-liquidity:${selectedPool.address}:${liquidityToRemove.toString()}`,
        });
        setSubmittedSnapshot({
          percentage: removePercentage,
          token0Amount: fmtAmount(token0AmountNumLocal),
          token0UsdValue: fmtUsd(token0AmountNumLocal * price0Local),
          token1Amount: fmtAmount(token1AmountNumLocal),
          token1UsdValue: fmtUsd(token1AmountNumLocal * price1Local),
          txHash: hash,
        });
        toast.success(t("liquidity.liquidityRemoveSuccess"));
        setStep("success");
        setRemovePercentage(0);
        refetchBalance();
        refetchIntent();
        refetchReserves();
        return;
      }

      removeLiquidity(
        {
          address: routerAddress!,
          abi: RouterAbi,
          functionName: "removeLiquidity",
          args: [
            selectedPool.token0.address,
            selectedPool.token1.address,
            selectedPool.isStable,
            liquidityToRemove,
            amount0Min,
            amount1Min,
            effectiveAddress,
            deadline,
          ],
        },
        {
          onSuccess: (hash) => {
            // Snapshot inputs at submit-time so the success view stays stable
            // after refetches reset the slider/positions.
            setSubmittedSnapshot({
              percentage: removePercentage,
              token0Amount: fmtAmount(token0AmountNumLocal),
              token0UsdValue: fmtUsd(token0AmountNumLocal * price0Local),
              token1Amount: fmtAmount(token1AmountNumLocal),
              token1UsdValue: fmtUsd(token1AmountNumLocal * price1Local),
              txHash: hash,
            });
          },
        },
      );
    } catch (error) {
      console.error("Remove liquidity error:", error);
      toast.error(getErrorMessage(error, t));
    }
  };

  const hasLiquidity = balanceRaw && balanceRaw > BigInt(0);
  const hasWithdrawableLiquidity =
    availableBalanceRaw !== undefined && availableBalanceRaw > BigInt(0);

  const getButtonContent = () => {
    if (!effectiveIsConnected) {
      return {
        text: t("common.connectWallet"),
        disabled: true,
        onClick: () => {},
      };
    }

    if (!selectedPool) {
      return {
        text: t("common.loadingPool"),
        disabled: true,
        onClick: () => {},
      };
    }

    if ((isLoadingBalance && balanceRaw === undefined) || isLoadingIntent) {
      return {
        text: t("common.loading"),
        disabled: true,
        onClick: () => {},
      };
    }

    if (!hasLiquidity) {
      return {
        text: t("liquidity.noLiquidity"),
        disabled: true,
        onClick: () => {},
      };
    }

    // All LP is staked off-chain → user must unstake first.
    if (isFullyStaked || !hasWithdrawableLiquidity) {
      return {
        text: t("stake.alreadyFullyStaked"),
        disabled: true,
        onClick: () => {},
      };
    }

    if (removePercentage === 0) {
      return {
        text: t("liquidity.selectAmount"),
        disabled: true,
        onClick: () => {},
      };
    }

    if (needsApproval) {
      return {
        text: isApprovalProcessing
          ? t("common.approving")
          : t("liquidity.lpTokenApproval"),
        disabled: isApproving || isApprovalProcessing,
        onClick: handleApprove,
      };
    }

    return {
      text:
        isRemoving || isConfirming
          ? t("liquidity.removingLiquidity")
          : t("liquidity.removeLiquidity"),
      // Block re-submission while the post-tx balance refetch is in flight,
      // otherwise availableBalanceRaw still reflects the pre-remove state.
      disabled: isRemoving || isConfirming || isBalanceFetching,
      onClick: handleRemoveLiquidity,
    };
  };

  const button = getButtonContent();

  if (!selectedPool) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#4c6ef5]"></div>
        <p className="text-[#94a3af] mt-4">{t("common.loadingPools")}</p>
      </div>
    );
  }

  // Compute display amounts and USD values for the panel.
  const price0 = prices[selectedPool.token0.symbol] ?? 0;
  const price1 = prices[selectedPool.token1.symbol] ?? 0;
  const token0AmountNum = parseFloat(expectedToken0) || 0;
  const token1AmountNum = parseFloat(expectedToken1) || 0;

  if (step === "confirm") {
    return (
      <WithdrawConfirmPanel
        mode="confirm"
        percentage={removePercentage}
        token0Symbol={selectedPool.token0.symbol}
        token0Amount={fmtAmount(token0AmountNum)}
        token0UsdValue={fmtUsd(token0AmountNum * price0)}
        token1Symbol={selectedPool.token1.symbol}
        token1Amount={fmtAmount(token1AmountNum)}
        token1UsdValue={fmtUsd(token1AmountNum * price1)}
        onSecondary={() => setStep("input")}
        onPrimary={handleRemoveLiquidity}
        isSubmitting={isRemoving || isConfirming}
      />
    );
  }

  if (step === "success" && submittedSnapshot) {
    return (
      <WithdrawConfirmPanel
        mode="success"
        percentage={submittedSnapshot.percentage}
        token0Symbol={selectedPool.token0.symbol}
        token0Amount={submittedSnapshot.token0Amount}
        token0UsdValue={submittedSnapshot.token0UsdValue}
        token1Symbol={selectedPool.token1.symbol}
        token1Amount={submittedSnapshot.token1Amount}
        token1UsdValue={submittedSnapshot.token1UsdValue}
        onSecondary={() =>
          window.open(
            `${GIWASCAN_URL}/tx/${submittedSnapshot.txHash}`,
            "_blank",
            "noopener,noreferrer",
          )
        }
        onPrimary={() => router.push("/portfolio")}
      />
    );
  }

  // Input-step button: tx-progress states belong to the confirm step now,
  // so the click handler navigates instead of submitting. Approval still
  // happens here because it's a prerequisite to even reaching confirm.
  const inputButton = (() => {
    if (button.text === t("liquidity.removeLiquidity")) {
      return {
        ...button,
        onClick: () => setStep("confirm"),
      };
    }
    // Loading / approval / no-liquidity states: keep current behavior.
    return button;
  })();

  return (
    <div className="space-y-6">
      {/* My Positions - Only show if no initial pool */}
      {!initialPool && (
        <div>
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <span>📊</span>
            {t("liquidity.myPositions")}
          </h3>
          <div className="space-y-3">
            {pools.map((pool) => (
              <PositionCard
                key={pool.address}
                pool={pool}
                isSelected={selectedPool?.address === pool.address}
                onSelect={() => {
                  setSelectedPool(pool);
                  setRemovePercentage(0);
                }}
              />
            ))}
          </div>
        </div>
      )}

      <WithdrawAmountPanel
        percentage={removePercentage}
        onPercentageChange={setRemovePercentage}
        token0Symbol={selectedPool.token0.symbol}
        token0Amount={
          isQuoteLoading && removePercentage > 0
            ? "…"
            : fmtAmount(token0AmountNum)
        }
        token0UsdValue={fmtUsd(token0AmountNum * price0)}
        token1Symbol={selectedPool.token1.symbol}
        token1Amount={
          isQuoteLoading && removePercentage > 0
            ? "…"
            : fmtAmount(token1AmountNum)
        }
        token1UsdValue={fmtUsd(token1AmountNum * price1)}
        buttonLabel={inputButton.text}
        buttonDisabled={inputButton.disabled}
        onWithdraw={inputButton.onClick}
      />
    </div>
  );
}

function PositionCard({
  pool,
  isSelected,
  onSelect,
}: {
  pool: PoolInfo;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const t = useTranslations();
  const { balance, sharePercentage } = useLpBalance(pool.address);
  const { reserve0, reserve1 } = usePoolReserves(pool.address);

  const hasLiquidity = parseFloat(balance) > 0;

  if (!hasLiquidity) {
    return null;
  }

  const myToken0 = (parseFloat(balance) / 1e18) * parseFloat(reserve0);
  const myToken1 = (parseFloat(balance) / 1e18) * parseFloat(reserve1);

  return (
    <button
      onClick={onSelect}
      className={`w-full p-5 rounded-2xl border-2 transition-all text-left ${
        isSelected
          ? "border-[#4c6ef5] bg-[#4c6ef5]/10"
          : "border-[#2d3548] hover:border-[#4c6ef5] bg-[#1a1f2e]"
      }`}
    >
      <div className="font-bold text-white mb-3 text-lg">{pool.name}</div>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between items-center">
          <span className="text-[#94a3af] font-medium">
            {t("liquidity.lpTokens")}:
          </span>
          <span className="font-bold text-white">
            {parseFloat(balance).toFixed(6)}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[#94a3af] font-medium">
            {t("liquidity.poolOccupancy")}:
          </span>
          <span className="font-bold text-[#4c6ef5]">
            {sharePercentage.toFixed(4)}%
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[#94a3af] font-medium">
            {pool.token0.symbol}:
          </span>
          <span className="font-bold text-white">{myToken0.toFixed(6)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[#94a3af] font-medium">
            {pool.token1.symbol}:
          </span>
          <span className="font-bold text-white">{myToken1.toFixed(6)}</span>
        </div>
      </div>
    </button>
  );
}
