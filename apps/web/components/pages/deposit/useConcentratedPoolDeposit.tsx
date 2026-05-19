"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseUnits } from "viem";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useTranslations } from "next-intl";
import type { LiquidityLockOption } from "@/components/deposit/LiquidityLockSettings";
import type { DepositFlowPhase } from "@/components/deposit/DepositActionPanel";
import { usePoolStatsFromIndexer } from "@/hooks/useIndexerStats";
import { isIndexerConfigured } from "@/lib/indexerApi";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { useTokenAllowance } from "@/hooks/useTokenAllowance";
import { useTokenApprove } from "@/hooks/useTokenApprove";
import { useCheckCLPoolExists } from "@/hooks/useCLPoolFactory";
import { useCLPoolSlot0 } from "@/hooks/useCLPoolSlot0";
import { GIWASCAN_URL, MOCK_DATA_ENABLED } from "@/lib/config";
import {
  getMockDemoAddress,
  simulateMockTransaction,
} from "@/lib/mockTransactions";
import { isMockToken } from "@/lib/mocks";
import { useSettingsStore, getDeadlineTimestamp } from "@/lib/store";
import {
  useNftPositionManagerAddress,
  useTokenByAddress,
} from "@/hooks/useContractAddresses";
import { NonfungiblePositionManagerAbi } from "@giwater/shared/abis";
import {
  parseRevertReason,
  extractRevertReason,
} from "@/lib/getContractErrorMessage";
import { calcPairedAmount } from "@/lib/liquidityAmounts";
import { isTickImbalanced, computeRangeRatio } from "@/lib/tickMath";

function getErrorMessage(
  error: unknown,
  t: ReturnType<typeof useTranslations>,
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
  if (
    errorMessage.includes("execution reverted") ||
    errorMessage.includes("reverted with")
  ) {
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

/**
 * Shared business logic for the Concentrated-pool deposit screen. Both
 * `ConcentratedPoolDepositDesktopView` and `ConcentratedPoolDepositMobileView`
 * consume this so the wagmi calls, tick math, allowance bookkeeping, and
 * submission flow live in exactly one place — the desktop / mobile components
 * only differ in JSX.
 */
export function useConcentratedPoolDeposit() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const t = useTranslations();
  const queryClient = useQueryClient();
  const { address, isConnected } = useAccount();
  const effectiveAddress = address ?? getMockDemoAddress();
  const effectiveIsConnected = isConnected || Boolean(effectiveAddress);
  const nftPositionManagerAddress = useNftPositionManagerAddress();
  const { deadlineMinutes } = useSettingsStore();

  const rawToken0 = searchParams.get("token0");
  const rawToken1 = searchParams.get("token1");
  const typeParam = searchParams.get("type");
  const tickSpacing = typeParam !== null ? parseInt(typeParam, 10) : undefined;

  const [token0Address, token1Address] = useMemo(() => {
    if (!rawToken0 || !rawToken1) return [rawToken0, rawToken1];
    return rawToken0.toLowerCase() < rawToken1.toLowerCase()
      ? [rawToken0, rawToken1]
      : [rawToken1, rawToken0];
  }, [rawToken0, rawToken1]);

  const {
    poolAddress: clPoolAddress,
    isLoading: isCLPoolLoading,
  } = useCheckCLPoolExists(
    token0Address ? (token0Address as `0x${string}`) : undefined,
    token1Address ? (token1Address as `0x${string}`) : undefined,
    tickSpacing,
  );

  const token0Info = useTokenByAddress(token0Address ?? undefined);
  const token1Info = useTokenByAddress(token1Address ?? undefined);

  // Even if pool doesn't exist on-chain yet, show the deposit form because
  // NonfungiblePositionManager.mint() with sqrtPriceX96 auto-creates pools.
  const selectedPool = useMemo(() => {
    if (!token0Info || !token1Info) return null;
    return {
      address:
        clPoolAddress ??
        ("0x0000000000000000000000000000000000000000" as `0x${string}`),
      token0: {
        address: token0Info.address as `0x${string}`,
        symbol: token0Info.symbol,
        name: token0Info.name,
        decimals: token0Info.decimals,
      },
      token1: {
        address: token1Info.address as `0x${string}`,
        symbol: token1Info.symbol,
        name: token1Info.name,
        decimals: token1Info.decimals,
      },
      name: `${token0Info.symbol}-${token1Info.symbol} CL Pool`,
      tickSpacing,
    };
  }, [clPoolAddress, token0Info, token1Info, tickSpacing]);

  const {
    tick: currentTick,
    sqrtPriceX96,
    liquidity: poolLiquidity,
    refetch: refetchSlot0,
    isLoading: isSlot0Loading,
  } = useCLPoolSlot0(clPoolAddress);

  // Detect uninitialized pool only AFTER slot0 settles — otherwise a pool that
  // does have liquidity briefly looks uninitialized during the fetch and the
  // InitialPriceSelector flashes on screen.
  const isPoolUninitialized =
    !clPoolAddress ||
    (!isSlot0Loading && (sqrtPriceX96 === null || sqrtPriceX96 === 0n));
  const [userInitialSqrtPriceX96, setUserInitialSqrtPriceX96] = useState<
    bigint | null
  >(null);
  const [userInitialTick, setUserInitialTick] = useState<number | null>(null);

  const effectiveSqrtPriceX96 = isPoolUninitialized
    ? userInitialSqrtPriceX96
    : sqrtPriceX96;
  const effectiveTick = isPoolUninitialized ? userInitialTick : currentTick;

  // Pass sqrtPriceX96 to mint() ONLY when the pool doesn't exist yet.
  // Aerodrome Slipstream CLFactory.createPool() reverts if the pool already
  // exists, so for existing pools we must pass 0 to skip the createPool branch
  // in mint().
  const mintSqrtPriceX96 = isPoolUninitialized
    ? userInitialSqrtPriceX96 ?? 0n
    : 0n;

  const isPoolImbalanced = useMemo(() => {
    if (isPoolUninitialized) return false;
    if (isTickImbalanced(currentTick)) return true;
    if (
      poolLiquidity !== null &&
      poolLiquidity !== undefined &&
      poolLiquidity === 0n
    )
      return true;
    return false;
  }, [isPoolUninitialized, currentTick, poolLiquidity]);

  const imbalancedTokens = useMemo(() => {
    if (!isPoolImbalanced || !selectedPool || currentTick === null) return null;
    if (currentTick > 0) {
      return {
        depleted: selectedPool.token0.symbol,
        available: selectedPool.token1.symbol,
      };
    }
    return {
      depleted: selectedPool.token1.symbol,
      available: selectedPool.token0.symbol,
    };
  }, [isPoolImbalanced, selectedPool, currentTick]);

  const handleInitialPriceConfirm = useCallback(
    (sqrtPrice: bigint, tick: number) => {
      setUserInitialSqrtPriceX96(sqrtPrice);
      setUserInitialTick(tick);
    },
    [],
  );

  const [amount0, setAmount0] = useState("");
  const [amount1, setAmount1] = useState("");
  const [tickRange, setTickRange] = useState({ tickLower: 0, tickUpper: 0 });
  const [slippage] = useState(0.5);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [isGradeWarningOpen, setIsGradeWarningOpen] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const [isMockSubmitting, setIsMockSubmitting] = useState(false);
  const [lockOption, setLockOption] = useState<LiquidityLockOption>("none");
  const prevMintSuccessRef = useRef(false);

  // Desktop-only inline flow state (see `useBasicPoolDeposit` for the full
  // state-machine docstring). Mobile keeps using the dark `ApprovalModal`.
  const [desktopFlowPhase, setDesktopFlowPhase] =
    useState<DepositFlowPhase | "idle">("idle");
  const [desktopTxHash, setDesktopTxHash] = useState<`0x${string}` | undefined>(
    undefined,
  );

  const lastEditedTokenRef = useRef<"token0" | "token1" | null>(null);
  const amount0Ref = useRef(amount0);
  const amount1Ref = useRef(amount1);
  amount0Ref.current = amount0;
  amount1Ref.current = amount1;
  const [approvingTokenAddress, setApprovingTokenAddress] = useState<
    `0x${string}` | null
  >(null);

  const [lastDeposit, setLastDeposit] = useState<{
    amount0: string;
    amount1: string;
    tickLower: number;
    tickUpper: number;
    txHash?: `0x${string}`;
  } | null>(null);
  const dismissLastDeposit = () => setLastDeposit(null);

  const { data: clPoolStatsData } = usePoolStatsFromIndexer(
    clPoolAddress ?? "",
    { enabled: isIndexerConfigured() && !!clPoolAddress },
  );
  const poolGrade = clPoolStatsData?.grade ?? 3;
  const [initialApprovalNeeds, setInitialApprovalNeeds] = useState<{
    token0: boolean;
    token1: boolean;
  }>({ token0: false, token1: false });
  const [locallyApprovedTokens, setLocallyApprovedTokens] = useState<
    Set<string>
  >(new Set());

  const { data: balance0, refetch: refetchBalance0 } = useTokenBalance(
    selectedPool
      ? {
          tokenAddress: selectedPool.token0.address,
          decimals: selectedPool.token0.decimals,
        }
      : undefined,
  );
  const { data: balance1, refetch: refetchBalance1 } = useTokenBalance(
    selectedPool
      ? {
          tokenAddress: selectedPool.token1.address,
          decimals: selectedPool.token1.decimals,
        }
      : undefined,
  );

  const { allowance: allowance0, refetch: refetchAllowance0 } =
    useTokenAllowance(
      selectedPool?.token0.address,
      nftPositionManagerAddress,
    );
  const { allowance: allowance1, refetch: refetchAllowance1 } =
    useTokenAllowance(
      selectedPool?.token1.address,
      nftPositionManagerAddress,
    );

  const { approve, isPending: isApproving } = useTokenApprove();

  const {
    data: mintHash,
    writeContract: mintPosition,
    isPending: isMinting,
    error: mintError,
  } = useWriteContract();
  const {
    isLoading: isConfirming,
    isSuccess: isMintSuccess,
    error: receiptError,
  } = useWaitForTransactionReceipt({ hash: mintHash });

  const isAllowanceLoading =
    (amount0 && parseFloat(amount0) > 0 && allowance0 === undefined) ||
    (amount1 && parseFloat(amount1) > 0 && allowance1 === undefined);

  const needsApproval0 = useMemo(() => {
    if (!amount0 || !selectedPool) return false;
    if (locallyApprovedTokens.has(selectedPool.token0.address.toLowerCase()))
      return false;
    try {
      const amountParsed = parseUnits(amount0, selectedPool.token0.decimals);
      if (allowance0 === undefined) return true;
      return allowance0 < amountParsed;
    } catch {
      return false;
    }
  }, [amount0, allowance0, selectedPool, locallyApprovedTokens]);

  const needsApproval1 = useMemo(() => {
    if (!amount1 || !selectedPool) return false;
    if (locallyApprovedTokens.has(selectedPool.token1.address.toLowerCase()))
      return false;
    try {
      const amountParsed = parseUnits(amount1, selectedPool.token1.decimals);
      if (allowance1 === undefined) return true;
      return allowance1 < amountParsed;
    } catch {
      return false;
    }
  }, [amount1, allowance1, selectedPool, locallyApprovedTokens]);

  const computePaired = useCallback(
    (
      edited: "token0" | "token1",
      amount: string,
      tl: number,
      tu: number,
    ) => {
      if (
        !selectedPool ||
        !effectiveSqrtPriceX96 ||
        effectiveSqrtPriceX96 === 0n
      )
        return;
      const result = calcPairedAmount(
        edited,
        amount,
        effectiveSqrtPriceX96,
        tl,
        tu,
        selectedPool.token0.decimals,
        selectedPool.token1.decimals,
      );
      if (edited === "token0") setAmount1(result);
      else setAmount0(result);
    },
    [selectedPool, effectiveSqrtPriceX96],
  );

  const depositRatio = useMemo(() => {
    if (!selectedPool) return { ratio0: 0.5, ratio1: 0.5 };
    return computeRangeRatio(
      effectiveTick,
      tickRange.tickLower,
      tickRange.tickUpper,
      selectedPool.token0.decimals,
      selectedPool.token1.decimals,
    );
  }, [effectiveTick, tickRange, selectedPool]);

  const DISABLE_THRESHOLD = 1e-3;
  const disableToken0 = depositRatio.ratio0 < DISABLE_THRESHOLD;
  const disableToken1 = depositRatio.ratio1 < DISABLE_THRESHOLD;

  const handleAmount0Change = useCallback(
    (value: string) => {
      if (disableToken0) return;
      setAmount0(value);
      lastEditedTokenRef.current = "token0";
      computePaired("token0", value, tickRange.tickLower, tickRange.tickUpper);
    },
    [computePaired, tickRange, disableToken0],
  );

  const handleAmount1Change = useCallback(
    (value: string) => {
      if (disableToken1) return;
      setAmount1(value);
      lastEditedTokenRef.current = "token1";
      computePaired("token1", value, tickRange.tickLower, tickRange.tickUpper);
    },
    [computePaired, tickRange, disableToken1],
  );

  useEffect(() => {
    if (disableToken0 && amount0Ref.current) setAmount0("");
    if (disableToken1 && amount1Ref.current) setAmount1("");
  }, [disableToken0, disableToken1]);

  const handleRangeChange = useCallback(
    (tickLower: number, tickUpper: number) => {
      setTickRange({ tickLower, tickUpper });
      if (lastEditedTokenRef.current) {
        const amt =
          lastEditedTokenRef.current === "token0"
            ? amount0Ref.current
            : amount1Ref.current;
        computePaired(lastEditedTokenRef.current, amt, tickLower, tickUpper);
      }
    },
    [computePaired],
  );

  // Confirmation effect — same pattern as `useBasicPoolDeposit`. We snapshot
  // amounts + tick range BEFORE the reset so the success view can render them.
  useEffect(() => {
    if (isMintSuccess && mintHash && !prevMintSuccessRef.current) {
      prevMintSuccessRef.current = true;

      setLastDeposit({
        amount0,
        amount1,
        tickLower: tickRange.tickLower,
        tickUpper: tickRange.tickUpper,
        txHash: mintHash,
      });

      setDesktopTxHash(mintHash);
      setDesktopFlowPhase((prev) =>
        prev === "depositing" || prev === "ready" || prev === "approving"
          ? "success"
          : prev,
      );

      const refetchData = async () => {
        setIsRefetching(true);
        toast.success(
          <div>
            {t("liquidity.liquidityAddSuccess")}{" "}
            <a
              href={`${GIWASCAN_URL}/tx/${mintHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              {t("common.viewOnGiwaScan")}
            </a>
          </div>,
        );

        try {
          await Promise.all([
            refetchBalance0(),
            refetchBalance1(),
            refetchSlot0(),
          ]);
          // Immediate invalidation + delayed one after backend Redis cache
          // (30s) expires.
          queryClient.invalidateQueries({
            queryKey: ["liquidity-distribution"],
          });
          setTimeout(() => {
            queryClient.invalidateQueries({
              queryKey: ["liquidity-distribution"],
            });
          }, 35_000);
        } catch (error) {
          console.error("[deposit-cl] Refetch error:", error);
        }

        setTimeout(() => {
          setAmount0("");
          setAmount1("");
          setIsRefetching(false);
          prevMintSuccessRef.current = false;
        }, 100);
      };

      refetchData();
    }
  }, [
    isMintSuccess,
    mintHash,
    refetchBalance0,
    refetchBalance1,
    refetchSlot0,
    queryClient,
    t,
    amount0,
    amount1,
    tickRange.tickLower,
    tickRange.tickUpper,
  ]);

  useEffect(() => {
    if (mintError) toast.error(getErrorMessage(mintError, t));
    if (receiptError) toast.error(getErrorMessage(receiptError, t));
  }, [mintError, receiptError, t]);

  const approvalStepsWithStatus = useMemo(() => {
    if (!selectedPool || !isApprovalModalOpen) return [];

    const steps: {
      tokenSymbol: string;
      tokenAddress: `0x${string}`;
      isApproved: boolean;
      isApproving: boolean;
    }[] = [];

    if (initialApprovalNeeds.token0) {
      steps.push({
        tokenSymbol: selectedPool.token0.symbol,
        tokenAddress: selectedPool.token0.address,
        isApproved: !needsApproval0,
        isApproving:
          isApproving &&
          approvingTokenAddress?.toLowerCase() ===
            selectedPool.token0.address.toLowerCase(),
      });
    }

    if (initialApprovalNeeds.token1) {
      steps.push({
        tokenSymbol: selectedPool.token1.symbol,
        tokenAddress: selectedPool.token1.address,
        isApproved: !needsApproval1,
        isApproving:
          isApproving &&
          approvingTokenAddress?.toLowerCase() ===
            selectedPool.token1.address.toLowerCase(),
      });
    }

    return steps;
  }, [
    selectedPool,
    isApprovalModalOpen,
    initialApprovalNeeds,
    needsApproval0,
    needsApproval1,
    isApproving,
    approvingTokenAddress,
  ]);

  const handleApprove = async (tokenAddress: `0x${string}`) => {
    try {
      setApprovingTokenAddress(tokenAddress);
      const maxAmount = BigInt(
        "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
      );
      await approve(tokenAddress, nftPositionManagerAddress!, maxAmount);
      setLocallyApprovedTokens((prev) =>
        new Set(prev).add(tokenAddress.toLowerCase()),
      );
      Promise.all([refetchAllowance0(), refetchAllowance1()]).catch(() => {});
      toast.success(t("approval.tokenApprovalSuccess"));
      setApprovingTokenAddress(null);
    } catch (error) {
      console.error("Approve error:", error);
      setApprovingTokenAddress(null);
      throw error;
    }
  };

  const handleMintPosition = async () => {
    if (!effectiveAddress || !selectedPool || !nftPositionManagerAddress) return;
    if (!amount0 && !amount1) return;
    if (effectiveSqrtPriceX96 === null || effectiveSqrtPriceX96 === 0n) return;

    if (
      MOCK_DATA_ENABLED &&
      isMockToken(selectedPool.token0.address) &&
      isMockToken(selectedPool.token1.address)
    ) {
      const snapshot = {
        amount0,
        amount1,
        tickLower: tickRange.tickLower,
        tickUpper: tickRange.tickUpper,
      };
      setIsApprovalModalOpen(false);
      setIsMockSubmitting(true);
      const txHash = await simulateMockTransaction({
        label: `mint-position:${selectedPool.address}:${amount0}:${amount1}:${tickRange.tickLower}:${tickRange.tickUpper}`,
      });
      toast.success(t("liquidity.liquidityAddSuccess"));
      setLastDeposit({ ...snapshot, txHash });
      setDesktopTxHash(txHash);
      setAmount0("");
      setAmount1("");
      setIsMockSubmitting(false);
      setDesktopFlowPhase((prev) =>
        prev === "depositing" || prev === "ready" || prev === "approving"
          ? "success"
          : prev,
      );
      return;
    }

    try {
      const amount0Parsed = amount0
        ? parseUnits(amount0, selectedPool.token0.decimals)
        : BigInt(0);
      const amount1Parsed = amount1
        ? parseUnits(amount1, selectedPool.token1.decimals)
        : BigInt(0);

      // For first deposit (pool uninitialized or zero liquidity), set min
      // amounts to 0 since there's no existing liquidity to slip against.
      const isFirstDeposit =
        isPoolUninitialized || !poolLiquidity || poolLiquidity === 0n;
      const slippageMultiplier = BigInt(Math.floor((100 - slippage) * 100));
      const amount0Min = isFirstDeposit
        ? BigInt(0)
        : (amount0Parsed * slippageMultiplier) / BigInt(10000);
      const amount1Min = isFirstDeposit
        ? BigInt(0)
        : (amount1Parsed * slippageMultiplier) / BigInt(10000);
      const deadline = getDeadlineTimestamp(deadlineMinutes);

      const mintArgs = {
        token0: selectedPool.token0.address,
        token1: selectedPool.token1.address,
        tickSpacing: selectedPool.tickSpacing ?? 50,
        tickLower: tickRange.tickLower,
        tickUpper: tickRange.tickUpper,
        amount0Desired: amount0Parsed,
        amount1Desired: amount1Parsed,
        amount0Min,
        amount1Min,
        recipient: effectiveAddress,
        deadline,
        sqrtPriceX96: mintSqrtPriceX96,
      };

      mintPosition({
        address: nftPositionManagerAddress,
        abi: NonfungiblePositionManagerAbi,
        functionName: "mint",
        args: [mintArgs],
      });

      setIsApprovalModalOpen(false);
    } catch (error) {
      console.error("[deposit-cl] error:", error);
      toast.error(getErrorMessage(error, t));
    }
  };

  const proceedToDeposit = () => {
    if (needsApproval0 || needsApproval1) {
      setLocallyApprovedTokens(new Set());
      setInitialApprovalNeeds({
        token0: needsApproval0,
        token1: needsApproval1,
      });
      setIsApprovalModalOpen(true);
    } else {
      handleMintPosition();
    }
  };

  const handleDepositClick = () => {
    if (poolGrade >= 2) {
      setIsGradeWarningOpen(true);
      return;
    }
    proceedToDeposit();
  };

  const handleGradeWarningConfirm = () => {
    setIsGradeWarningOpen(false);
    proceedToDeposit();
  };

  const handleChangePool = () => {
    router.push("/liquidity");
  };

  // ---------------------------------------------------------------------------
  // Desktop inline flow orchestration (mirrors `useBasicPoolDeposit`)
  // ---------------------------------------------------------------------------

  const runDesktopApprovals = async () => {
    if (!selectedPool) return;
    setDesktopFlowPhase("approving");
    try {
      if (needsApproval0) {
        await handleApprove(selectedPool.token0.address);
      }
      if (needsApproval1) {
        await handleApprove(selectedPool.token1.address);
      }
      setDesktopFlowPhase("ready");
    } catch (error) {
      console.error("[deposit-cl] desktop approval error:", error);
      setDesktopFlowPhase("idle");
    }
  };

  const handleDesktopDepositClick = () => {
    if (poolGrade >= 2) {
      setIsGradeWarningOpen(true);
      return;
    }
    if (needsApproval0 || needsApproval1) {
      void runDesktopApprovals();
    } else {
      setDesktopFlowPhase("ready");
    }
  };

  const handleDesktopGradeWarningConfirm = () => {
    setIsGradeWarningOpen(false);
    if (needsApproval0 || needsApproval1) {
      void runDesktopApprovals();
    } else {
      setDesktopFlowPhase("ready");
    }
  };

  const handleDesktopConfirm = () => {
    setDesktopFlowPhase("depositing");
    void handleMintPosition();
  };

  const handleDesktopEdit = () => {
    setDesktopFlowPhase("idle");
    setDesktopTxHash(undefined);
  };

  const buttonState = useMemo<{ text: string; disabled: boolean }>(() => {
    if (!effectiveIsConnected) {
      return { text: t("deposit.walletRequired"), disabled: true };
    }
    if (isRefetching) {
      return { text: t("common.updatingData"), disabled: true };
    }
    if (
      (!amount0 || parseFloat(amount0) === 0) &&
      (!amount1 || parseFloat(amount1) === 0)
    ) {
      return { text: t("deposit.enterAmountPrompt"), disabled: true };
    }
    if (currentTick !== null) {
      const a0 = amount0 ? parseFloat(amount0) : 0;
      const a1 = amount1 ? parseFloat(amount1) : 0;
      if (
        currentTick >= tickRange.tickLower &&
        currentTick < tickRange.tickUpper
      ) {
        if (a0 === 0 || a1 === 0) {
          return { text: t("deposit.bothTokensRequired"), disabled: true };
        }
      } else if (currentTick < tickRange.tickLower && a0 === 0) {
        return {
          text: t("deposit.tokenRequiredForRange", {
            symbol: selectedPool?.token0.symbol ?? "Token1",
          }),
          disabled: true,
        };
      } else if (currentTick >= tickRange.tickUpper && a1 === 0) {
        return {
          text: t("deposit.tokenRequiredForRange", {
            symbol: selectedPool?.token1.symbol ?? "Token2",
          }),
          disabled: true,
        };
      }
    }
    if (balance0 && amount0 && parseFloat(amount0) > parseFloat(balance0)) {
      return {
        text: t("errors.insufficientBalanceFor", {
          symbol: selectedPool?.token0.symbol ?? "",
        }),
        disabled: true,
      };
    }
    if (balance1 && amount1 && parseFloat(amount1) > parseFloat(balance1)) {
      return {
        text: t("errors.insufficientBalanceFor", {
          symbol: selectedPool?.token1.symbol ?? "",
        }),
        disabled: true,
      };
    }
    if (tickRange.tickLower >= tickRange.tickUpper) {
      return { text: t("deposit.invalidRange"), disabled: true };
    }
    if (isAllowanceLoading) {
      return { text: t("common.loading"), disabled: true };
    }
    if (isMinting || isConfirming || isMockSubmitting) {
      return { text: t("liquidity.addingLiquidity"), disabled: true };
    }
    return { text: t("liquidity.deposit"), disabled: false };
  }, [
    effectiveIsConnected,
    isRefetching,
    amount0,
    amount1,
    currentTick,
    tickRange.tickLower,
    tickRange.tickUpper,
    balance0,
    balance1,
    selectedPool?.token0.symbol,
    selectedPool?.token1.symbol,
    isAllowanceLoading,
    isMinting,
    isConfirming,
    isMockSubmitting,
    t,
  ]);

  return {
    // routing context
    tickSpacing,

    // pool data
    selectedPool,
    isCLPoolLoading,
    isSlot0Loading,
    clPoolAddress,
    poolGrade,

    // tick / price state
    currentTick,
    sqrtPriceX96,
    poolLiquidity,
    effectiveTick,
    effectiveSqrtPriceX96,
    isPoolUninitialized,
    userInitialSqrtPriceX96,
    handleInitialPriceConfirm,
    isPoolImbalanced,
    imbalancedTokens,

    // wallet
    isConnected: effectiveIsConnected,
    address: effectiveAddress,

    // form
    amount0,
    amount1,
    slippage,
    lockOption,
    setLockOption,
    handleAmount0Change,
    handleAmount1Change,

    // tick range
    tickRange,
    handleRangeChange,
    depositRatio,
    disableToken0,
    disableToken1,

    // balances
    balance0,
    balance1,

    // modals
    isApprovalModalOpen,
    setIsApprovalModalOpen,
    approvalStepsWithStatus,
    handleApprove,
    isGradeWarningOpen,
    setIsGradeWarningOpen,
    handleGradeWarningConfirm,

    // submit
    isMinting,
    isConfirming,
    isMockSubmitting,
    handleMintPosition,
    handleDepositClick,
    lastDeposit,
    dismissLastDeposit,

    // ui actions
    handleChangePool,
    buttonState,

    // desktop inline flow
    desktopFlowPhase,
    desktopTxHash,
    handleDesktopDepositClick,
    handleDesktopGradeWarningConfirm,
    handleDesktopConfirm,
    handleDesktopEdit,
  };
}

export type UseConcentratedPoolDepositReturn = ReturnType<
  typeof useConcentratedPoolDeposit
>;
