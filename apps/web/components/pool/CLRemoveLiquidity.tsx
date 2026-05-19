"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import toast from "react-hot-toast";
import { useTranslations } from "next-intl";
import { encodeFunctionData } from "viem";
import { GIWASCAN_URL } from "@/lib/config";
import {
  getMockDemoAddress,
  isMockMode,
  simulateMockTransaction,
} from "@/lib/mockTransactions";
import { useSettingsStore, getDeadlineTimestamp } from "@/lib/store";
import { useNftPositionManagerAddress } from "@/hooks/useContractAddresses";
import { useTokenByAddress } from "@/hooks/useContractAddresses";
import { useTokenPrices } from "@/hooks/useTokenPrices";
import { useLpStakeIntent } from "@/hooks/useLpStakeIntent";
import { NonfungiblePositionManagerAbi, ERC20Abi } from "@giwater/shared/abis";
import { portfolioApi } from "@/lib/portfolioApi";
import { WithdrawAmountPanel } from "@/components/withdraw/WithdrawAmountPanel";
import { WithdrawConfirmPanel } from "@/components/withdraw/WithdrawConfirmPanel";

type Step = "input" | "confirm" | "success";

const MAX_UINT128 = (1n << 128n) - 1n;

interface CLRemoveLiquidityProps {
  tokenId: string;
  token0Address: `0x${string}`;
  token1Address: `0x${string}`;
  /**
   * CL pool address. Used to look up the pre-TGE off-chain stake intent
   * so the withdraw slider can cap at (liquidity - staked).
   */
  poolAddress?: `0x${string}`;
}

export function CLRemoveLiquidity({
  tokenId,
  token0Address,
  token1Address,
  poolAddress,
}: CLRemoveLiquidityProps) {
  const t = useTranslations();
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const effectiveAddress = address ?? getMockDemoAddress();
  const effectiveIsConnected = isConnected || Boolean(effectiveAddress);
  const nftManager = useNftPositionManagerAddress();
  const { deadlineMinutes } = useSettingsStore();
  const [percentage, setPercentage] = useState(0);
  const [step, setStep] = useState<Step>("input");
  // Snapshot at submit-time so success view stays stable after refetches.
  const [submittedSnapshot, setSubmittedSnapshot] = useState<{
    percentage: number;
    token0Amount: string;
    token0UsdValue: string;
    token1Amount: string;
    token1UsdValue: string;
    txHash: `0x${string}`;
  } | null>(null);

  // On-chain position data
  const {
    data: positionData,
    refetch: refetchPosition,
    isFetching: isPositionFetching,
  } = useReadContract({
    address: nftManager,
    abi: NonfungiblePositionManagerAbi,
    functionName: "positions",
    args: [BigInt(tokenId)],
    query: { enabled: !!nftManager },
  });

  // Token symbols (via on-chain ERC20 fallback)
  const token0Info = useTokenByAddress(token0Address);
  const token1Info = useTokenByAddress(token1Address);
  const { data: symbol0OnChain } = useReadContract({
    address: token0Address,
    abi: ERC20Abi,
    functionName: "symbol",
    query: { enabled: !token0Info?.symbol },
  });
  const { data: symbol1OnChain } = useReadContract({
    address: token1Address,
    abi: ERC20Abi,
    functionName: "symbol",
    query: { enabled: !token1Info?.symbol },
  });
  const symbol0 = token0Info?.symbol || (symbol0OnChain as string) || "TOKEN0";
  const symbol1 = token1Info?.symbol || (symbol1OnChain as string) || "TOKEN1";

  // Deposited totals from the portfolio API — used to show expected output
  // amounts and USD values while the user scrubs the slider. Exact CL math
  // requires sqrtPriceX96/tick calculations, so we use the backend-computed
  // totals and scale by percentage.
  const [totalDeposited, setTotalDeposited] = useState<{
    token0Amount: number;
    token1Amount: number;
    usdValue: number;
  } | null>(null);
  const [depositedVersion, setDepositedVersion] = useState(0);
  const refetchDeposited = useCallback(() => {
    setDepositedVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    if (!effectiveAddress || !tokenId) return;
    let cancelled = false;
    portfolioApi
      .getLiquidityPositions(effectiveAddress)
      .then((data) => {
        if (cancelled) return;
        const match = data.positions.find((p) => p.tokenId === tokenId);
        if (match) {
          setTotalDeposited({
            token0Amount: parseFloat(match.deposited.token0Amount) || 0,
            token1Amount: parseFloat(match.deposited.token1Amount) || 0,
            usdValue: parseFloat(match.deposited.usdValue) || 0,
          });
        } else {
          setTotalDeposited(null);
        }
      })
      .catch(() => {
        if (!cancelled) setTotalDeposited(null);
      });
    return () => {
      cancelled = true;
    };
  }, [effectiveAddress, tokenId, depositedVersion]);

  // Token prices for USD calculation when portfolio API is unavailable
  const { prices } = useTokenPrices([symbol0, symbol1]);

  // positions() returns a tuple; with named outputs in viem v2 it's an object
  const positionLiquidity = useMemo<bigint>(() => {
    if (!positionData) return 0n;
    const liq = Array.isArray(positionData)
      ? (positionData as unknown[])[7]
      : (positionData as { liquidity?: bigint }).liquidity;
    return typeof liq === "bigint" ? liq : 0n;
  }, [positionData]);

  // Pre-TGE: exclude the staked portion from what's withdrawable here —
  // the user has to unstake first. Matches the basic-pool slider semantics.
  const {
    stakedAmountRaw,
    isLoading: isLoadingIntent,
    refetch: refetchIntent,
  } = useLpStakeIntent(poolAddress, tokenId);
  const withdrawableLiquidity =
    positionLiquidity > stakedAmountRaw
      ? positionLiquidity - stakedAmountRaw
      : 0n;
  const isFullyStaked =
    positionLiquidity > 0n && withdrawableLiquidity === 0n;

  const liquidityToRemove = useMemo<bigint>(() => {
    if (withdrawableLiquidity === 0n || percentage === 0) return 0n;
    return (withdrawableLiquidity * BigInt(percentage)) / 100n;
  }, [withdrawableLiquidity, percentage]);

  const {
    data: txHash,
    writeContract,
    isPending: isWriting,
    reset: resetWrite,
  } = useWriteContract();
  const {
    data: receipt,
    isLoading: isConfirming,
    isError: isReceiptError,
    error: receiptError,
  } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  useEffect(() => {
    if (!txHash) return;

    if (receipt) {
      const explorerLink = (
        <a
          href={`${GIWASCAN_URL}/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          {t("common.viewOnGiwaScan")}
        </a>
      );

      if (receipt.status === "success") {
        toast.success(
          <div>
            {t("liquidity.liquidityRemoveSuccess")} {explorerLink}
          </div>,
        );
        // Move to success step before resetting percentage so the snapshot
        // (which already captured the pre-reset values) drives the view.
        setStep("success");
        setPercentage(0);
        // Refresh every piece of state the slider depends on so the next
        // click can't re-submit a stale amount. refetchPosition drives
        // positionLiquidity; refetchIntent drives the staked-amount cap;
        // refetchDeposited refreshes the expected-output display.
        refetchPosition();
        refetchIntent();
        refetchDeposited();
      } else {
        toast.error(
          <div>
            {t("errors.transactionFailed")} {explorerLink}
          </div>,
        );
        // Tx reverted — let the user adjust on the input step.
        setStep("input");
      }
      resetWrite();
    } else if (isReceiptError) {
      toast.error(receiptError?.message ?? t("errors.transactionFailed"));
      setStep("input");
      resetWrite();
    }
  }, [
    receipt,
    isReceiptError,
    receiptError,
    txHash,
    t,
    resetWrite,
    refetchPosition,
    refetchIntent,
    refetchDeposited,
  ]);

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

  // Expected output tokens map to the fraction of the NFT being burned —
  // not the slider percentage directly, since the slider is framed against
  // the unstaked portion only.
  const liquidityRatio =
    positionLiquidity > 0n
      ? Number(liquidityToRemove) / Number(positionLiquidity)
      : 0;
  const expectedToken0 = totalDeposited
    ? totalDeposited.token0Amount * liquidityRatio
    : 0;
  const expectedToken1 = totalDeposited
    ? totalDeposited.token1Amount * liquidityRatio
    : 0;

  const price0 = prices[symbol0] ?? 0;
  const price1 = prices[symbol1] ?? 0;
  const token0Usd = expectedToken0 * price0;
  const token1Usd = expectedToken1 * price1;

  const handleConfirmSubmit = async () => {
    if (!effectiveAddress || !nftManager || liquidityToRemove === 0n) return;
    try {
      const deadline = getDeadlineTimestamp(deadlineMinutes);

      const decreaseCall = encodeFunctionData({
        abi: NonfungiblePositionManagerAbi,
        functionName: "decreaseLiquidity",
        args: [
          {
            tokenId: BigInt(tokenId),
            liquidity: liquidityToRemove,
            amount0Min: 0n,
            amount1Min: 0n,
            deadline: BigInt(deadline),
          },
        ],
      });

      const collectCall = encodeFunctionData({
        abi: NonfungiblePositionManagerAbi,
        functionName: "collect",
        args: [
          {
            tokenId: BigInt(tokenId),
            recipient: effectiveAddress,
            amount0Max: MAX_UINT128,
            amount1Max: MAX_UINT128,
          },
        ],
      });

      const calls: `0x${string}`[] = [decreaseCall, collectCall];
      // Only burn the NFT when ALL on-chain liquidity is being removed.
      // Pre-TGE off-chain stake intent keeps a portion non-withdrawable here,
      // so liquidityToRemove can equal withdrawableLiquidity while still being
      // less than positionLiquidity — in that case the NFT must stay alive
      // until the remaining liquidity is unstaked and withdrawn, otherwise
      // NonfungiblePositionManager.burn reverts with "NC".
      if (liquidityToRemove === positionLiquidity) {
        calls.push(
          encodeFunctionData({
            abi: NonfungiblePositionManagerAbi,
            functionName: "burn",
            args: [BigInt(tokenId)],
          }),
        );
      }

      if (isMockMode()) {
        const hash = await simulateMockTransaction({
          label: `cl-remove-liquidity:${tokenId}:${liquidityToRemove.toString()}`,
        });
        setSubmittedSnapshot({
          percentage,
          token0Amount: fmtAmount(expectedToken0),
          token0UsdValue: fmtUsd(token0Usd),
          token1Amount: fmtAmount(expectedToken1),
          token1UsdValue: fmtUsd(token1Usd),
          txHash: hash,
        });
        toast.success(t("liquidity.liquidityRemoveSuccess"));
        setStep("success");
        setPercentage(0);
        refetchPosition();
        refetchIntent();
        refetchDeposited();
        return;
      }

      writeContract(
        {
          address: nftManager,
          abi: NonfungiblePositionManagerAbi,
          functionName: "multicall",
          args: [calls],
        },
        {
          onSuccess: (hash) => {
            // Snapshot inputs at submit-time so the success view stays stable
            // after refetches reset the slider/positions.
            setSubmittedSnapshot({
              percentage,
              token0Amount: fmtAmount(expectedToken0),
              token0UsdValue: fmtUsd(token0Usd),
              token1Amount: fmtAmount(expectedToken1),
              token1UsdValue: fmtUsd(token1Usd),
              txHash: hash,
            });
          },
        },
      );
    } catch (err) {
      console.error("CL remove error:", err);
      toast.error(
        err instanceof Error ? err.message : t("errors.transactionFailed"),
      );
    }
  };

  const hasLiquidity = positionLiquidity > 0n;
  const hasWithdrawable = withdrawableLiquidity > 0n;

  // Input-step button: gates entry into the confirm step. Tx-progress states
  // belong to the confirm step itself, so they don't appear here.
  const inputButtonDisabled =
    !effectiveIsConnected ||
    !hasLiquidity ||
    !hasWithdrawable ||
    percentage === 0 ||
    isLoadingIntent ||
    isPositionFetching;
  const inputButtonLabel = !effectiveIsConnected
    ? t("common.connectWallet")
    : isLoadingIntent
      ? t("common.loading")
      : !hasLiquidity
        ? t("liquidity.noLiquidity")
        : isFullyStaked
          ? t("stake.alreadyFullyStaked")
          : percentage === 0
            ? t("liquidity.selectAmount")
            : t("liquidity.removeLiquidity");

  if (step === "confirm") {
    return (
      <WithdrawConfirmPanel
        mode="confirm"
        percentage={percentage}
        token0Symbol={symbol0}
        token0Amount={fmtAmount(expectedToken0)}
        token0UsdValue={fmtUsd(token0Usd)}
        token1Symbol={symbol1}
        token1Amount={fmtAmount(expectedToken1)}
        token1UsdValue={fmtUsd(token1Usd)}
        onSecondary={() => setStep("input")}
        onPrimary={handleConfirmSubmit}
        isSubmitting={isWriting || isConfirming}
      />
    );
  }

  if (step === "success" && submittedSnapshot) {
    return (
      <WithdrawConfirmPanel
        mode="success"
        percentage={submittedSnapshot.percentage}
        token0Symbol={symbol0}
        token0Amount={submittedSnapshot.token0Amount}
        token0UsdValue={submittedSnapshot.token0UsdValue}
        token1Symbol={symbol1}
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

  return (
    <WithdrawAmountPanel
      percentage={percentage}
      onPercentageChange={setPercentage}
      token0Symbol={symbol0}
      token0Amount={fmtAmount(expectedToken0)}
      token0UsdValue={fmtUsd(token0Usd)}
      token1Symbol={symbol1}
      token1Amount={fmtAmount(expectedToken1)}
      token1UsdValue={fmtUsd(token1Usd)}
      buttonLabel={inputButtonLabel}
      buttonDisabled={inputButtonDisabled}
      onWithdraw={() => setStep("confirm")}
    />
  );
}
