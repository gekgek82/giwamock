"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  usePublicClient,
  useReadContract,
} from "wagmi";
import { parseUnits, formatUnits } from "viem";
import toast from "react-hot-toast";
import { useTranslations } from "next-intl";
import type { LiquidityLockOption } from "@/components/deposit/LiquidityLockSettings";
import type { DepositFlowPhase } from "@/components/deposit/DepositActionPanel";
import { usePools } from "@/hooks/usePools";
import { usePoolStatsFromIndexer } from "@/hooks/useIndexerStats";
import { isIndexerConfigured } from "@/lib/indexerApi";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { useTokenApprove } from "@/hooks/useTokenApprove";
import { usePermit2ApprovalStatus } from "@/hooks/usePermit2Approval";
import { usePoolReserves } from "@/hooks/usePoolReserves";
import { useQuoteAddLiquidity } from "@/hooks/useQuoteAddLiquidity";
import { useCheckPoolExists } from "@/hooks/usePoolFactory";
import { GIWASCAN_URL, MOCK_DATA_ENABLED } from "@/lib/config";
import {
  getMockDemoAddress,
  simulateMockTransaction,
} from "@/lib/mockTransactions";
import { isMockToken } from "@/lib/mocks";
import { useSettingsStore, getDeadlineTimestamp } from "@/lib/store";
import {
  useUniversalRouterAddress,
  useTokenByAddress,
} from "@/hooks/useContractAddresses";
import { GiwaUniversalRouterAbi, Permit2Abi } from "@giwater/shared/abis";
import {
  parseRevertReason,
  extractRevertReason,
} from "@/lib/getContractErrorMessage";
import { parseReserveWeiString } from "@/lib/liquidityAmounts";
import { estimateVolatileInitialLpHuman } from "@/lib/basicPoolInitialLp";

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
 * Shared business logic for the Basic-pool deposit screen. Both
 * `BasicPoolDepositDesktopView` and `BasicPoolDepositMobileView` consume this
 * so the wagmi calls, allowance bookkeeping, and submission flow live in
 * exactly one place — the desktop / mobile components only differ in JSX.
 */
export function useBasicPoolDeposit() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const t = useTranslations();
  const { address, isConnected } = useAccount();
  const effectiveAddress = address ?? getMockDemoAddress();
  const effectiveIsConnected = isConnected || Boolean(effectiveAddress);
  const { pools, isLoading } = usePools();
  const universalRouterAddress = useUniversalRouterAddress();
  const { deadlineMinutes } = useSettingsStore();

  const rawToken0 = searchParams.get("token0");
  const rawToken1 = searchParams.get("token1");
  const typeParam = searchParams.get("type");
  const isStableParam = typeParam === "0";

  // Normalize token order so token0 < token1 (required by smart contracts)
  const [token0Address, token1Address] = useMemo(() => {
    if (!rawToken0 || !rawToken1) return [rawToken0, rawToken1];
    return rawToken0.toLowerCase() < rawToken1.toLowerCase()
      ? [rawToken0, rawToken1]
      : [rawToken1, rawToken0];
  }, [rawToken0, rawToken1]);

  // Form state
  const [amount0, setAmount0] = useState("");
  const [amount1, setAmount1] = useState("");
  const [slippage, setSlippage] = useState(0.5);
  const [isAutoSlippage, setIsAutoSlippage] = useState(true);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [isGradeWarningOpen, setIsGradeWarningOpen] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  // Pseudo-loading flag for the design-preview submit path. Real submits use
  // the wagmi `isAdding`/`isConfirming` flags; mock submits flip this so the
  // CTA still flashes a loading label before the success toast.
  const [isMockSubmitting, setIsMockSubmitting] = useState(false);
  // Snapshot of the deposit that just landed, used by the mobile success
  // screen. We capture amounts at submit-time (before the form is reset) so
  // the success view can display them even after `amount0`/`amount1` clear.
  // `txHash` is set only on the real submit path; mock submits leave it null.
  const [lastDeposit, setLastDeposit] = useState<{
    amount0: string;
    amount1: string;
    txHash?: `0x${string}`;
  } | null>(null);
  const dismissLastDeposit = () => setLastDeposit(null);
  // Liquidity lock selection — off-chain only during pre-TGE.
  const [lockOption, setLockOption] = useState<LiquidityLockOption>("none");
  const prevAddSuccessRef = useRef(false);

  // Desktop-only inline flow state. Mobile keeps using the dark `ApprovalModal`
  // overlay; desktop replaces that overlay with `DepositActionPanel` swapped
  // into the right half of the page (see `BasicPoolDepositDesktopView`).
  //   idle       – form is editable; CTA reads "Deposit"
  //   approving  – orchestrator is firing token approvals; panel shows spinner
  //   ready      – approvals done; panel shows enabled Confirm CTA
  //   depositing – add-liquidity tx submitted/mining; panel shows spinner
  //   success    – tx confirmed; panel shows View Confirmation + Go Portfolio
  const [desktopFlowPhase, setDesktopFlowPhase] =
    useState<DepositFlowPhase | "idle">("idle");
  const [desktopTxHash, setDesktopTxHash] = useState<`0x${string}` | undefined>(
    undefined,
  );

  // Find the pool based on token addresses from indexer.
  const indexerPool = pools.find((pool) => {
    const a = pool.token0.address.toLowerCase();
    const b = pool.token1.address.toLowerCase();
    const t0 = token0Address?.toLowerCase();
    const t1 = token1Address?.toLowerCase();
    const pairMatches = (a === t0 && b === t1) || (a === t1 && b === t0);
    if (!pairMatches) return false;
    if ((pool.poolType || "BASIC") !== "BASIC") return false;
    return pool.isStable === isStableParam;
  });

  // Fallback: query on-chain PoolFactory if indexer hasn't indexed yet.
  const {
    poolAddress: onChainPoolAddress,
    isLoading: isOnChainLoading,
    refetch: refetchPoolAddress,
  } = useCheckPoolExists(
    token0Address ? (token0Address as `0x${string}`) : undefined,
    token1Address ? (token1Address as `0x${string}`) : undefined,
    isStableParam,
  );

  const token0Info = useTokenByAddress(token0Address ?? undefined);
  const token1Info = useTokenByAddress(token1Address ?? undefined);

  const fallbackPool = useMemo(() => {
    if (indexerPool || !token0Info || !token1Info) return null;
    return {
      address:
        onChainPoolAddress ??
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
      name: `${token0Info.symbol}-${token1Info.symbol} Pool`,
      isStable: isStableParam,
    };
  }, [indexerPool, onChainPoolAddress, token0Info, token1Info, isStableParam]);

  const selectedPool = indexerPool ?? fallbackPool;

  const resolvedPoolAddress = useMemo((): `0x${string}` | undefined => {
    const z = "0x0000000000000000000000000000000000000000";
    const sel = selectedPool?.address;
    if (sel && sel.toLowerCase() !== z) return sel;
    if (onChainPoolAddress && onChainPoolAddress.toLowerCase() !== z) {
      return onChainPoolAddress;
    }
    return undefined;
  }, [selectedPool?.address, onChainPoolAddress]);

  const poolHeaderAddress = useMemo((): `0x${string}` => {
    if (resolvedPoolAddress) return resolvedPoolAddress;
    if (selectedPool?.address) return selectedPool.address;
    return "0x0000000000000000000000000000000000000000" as `0x${string}`;
  }, [resolvedPoolAddress, selectedPool?.address]);

  // Pool grade from indexer stats
  const { data: poolStatsData } = usePoolStatsFromIndexer(resolvedPoolAddress, {
    enabled: isIndexerConfigured() && !!resolvedPoolAddress,
  });
  const poolGrade = poolStatsData?.grade ?? indexerPool?.grade ?? (indexerPool ? 1 : 3);

  // Token balances. Decimals must be passed explicitly — `useTokenBalance`
  // defaults to 18, which silently mis-formats 6-decimal tokens (USDC/USDT)
  // by 12 orders of magnitude and makes any non-WETH balance render as ~0.
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

  // Pool reserves
  const {
    reserve0Raw,
    reserve1Raw,
    refetch: refetchReserves,
  } = usePoolReserves(resolvedPoolAddress);

  const { data: poolTotalSupply } = useReadContract({
    address: resolvedPoolAddress,
    abi: [{ inputs: [], name: "totalSupply", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" }] as const,
    functionName: "totalSupply",
    query: { enabled: !!resolvedPoolAddress },
  });

  const indexerReserve0Raw = useMemo(
    () => parseReserveWeiString(poolStatsData?.reserve0),
    [poolStatsData?.reserve0],
  );
  const indexerReserve1Raw = useMemo(
    () => parseReserveWeiString(poolStatsData?.reserve1),
    [poolStatsData?.reserve1],
  );

  const reserve0ForPairing = reserve0Raw ?? indexerReserve0Raw;
  const reserve1ForPairing = reserve1Raw ?? indexerReserve1Raw;

  // Permit2 approval status
  const {
    needsErc20Approval: needsErc20Approval0,
    needsPermit2Approval: needsPermit2Approval0,
    needsAnyApproval: needsApproval0,
    isLoading: isAllowance0Loading,
    refetch: refetchAllowance0,
    permit2Address,
    routerAddress: permit2RouterAddress,
    MAX_UINT160,
  } = usePermit2ApprovalStatus(selectedPool?.token0.address, amount0);
  const {
    needsErc20Approval: needsErc20Approval1,
    needsPermit2Approval: needsPermit2Approval1,
    needsAnyApproval: needsApproval1,
    isLoading: isAllowance1Loading,
    refetch: refetchAllowance1,
  } = usePermit2ApprovalStatus(selectedPool?.token1.address, amount1);

  // Parse amounts for quoteAddLiquidity
  const amount0Parsed = useMemo(() => {
    if (!amount0 || amount0 === "" || !selectedPool) return undefined;
    try {
      return parseUnits(amount0, selectedPool.token0.decimals);
    } catch {
      return undefined;
    }
  }, [amount0, selectedPool]);

  const amount1Parsed = useMemo(() => {
    if (!amount1 || amount1 === "" || !selectedPool) return undefined;
    try {
      return parseUnits(amount1, selectedPool.token1.decimals);
    } catch {
      return undefined;
    }
  }, [amount1, selectedPool]);

  // LP token quote
  const {
    liquidity: expectedLpTokens,
    isLoading: isQuoteLoading,
    isError: isQuoteError,
  } = useQuoteAddLiquidity(
    selectedPool?.token0.address,
    selectedPool?.token1.address,
    isStableParam,
    amount0Parsed,
    amount1Parsed,
  );

  // Approval hooks
  const { approve, isPending: isApproving } = useTokenApprove();
  const publicClient = usePublicClient();
  const { writeContractAsync: writePermit2Approve } = useWriteContract();

  // Add liquidity transaction
  const {
    data: addLiquidityHash,
    writeContract: addLiquidity,
    isPending: isAdding,
  } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isAddSuccess } =
    useWaitForTransactionReceipt({ hash: addLiquidityHash });

  const isInitialLiquidity = useMemo(() => {
    const r0 = reserve0ForPairing ?? 0n;
    const r1 = reserve1ForPairing ?? 0n;
    return r0 === 0n && r1 === 0n;
  }, [reserve0ForPairing, reserve1ForPairing]);

  const estimatedInitialLpHuman = useMemo(() => {
    if (!isInitialLiquidity || isStableParam) return null;
    if (!amount0Parsed || !amount1Parsed) return null;
    return estimateVolatileInitialLpHuman(amount0Parsed, amount1Parsed);
  }, [isInitialLiquidity, isStableParam, amount0Parsed, amount1Parsed]);

  const isAllowanceLoading = isAllowance0Loading || isAllowance1Loading;
  const permit2Expiration = Math.floor(Date.now() / 1000) + 30 * 24 * 3600;

  const [initialApprovalNeeds, setInitialApprovalNeeds] = useState<{
    token0: boolean;
    token1: boolean;
  }>({ token0: false, token1: false });
  const [approvingTokenAddress, setApprovingTokenAddress] = useState<
    `0x${string}` | null
  >(null);

  // Toast + form reset on confirmed deposit
  useEffect(() => {
    if (isAddSuccess && addLiquidityHash && !prevAddSuccessRef.current) {
      prevAddSuccessRef.current = true;

      // Snapshot the amounts before any refetch / reset so the success view
      // can render them. The async work below clears `amount0`/`amount1`.
      setLastDeposit({
        amount0,
        amount1,
        txHash: addLiquidityHash,
      });

      // Surface success in the desktop inline panel as well — only when the
      // user actually came through the desktop flow (mobile uses ApprovalModal
      // and stays in `idle`).
      setDesktopTxHash(addLiquidityHash);
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
              href={`${GIWASCAN_URL}/tx/${addLiquidityHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              {t("common.viewOnGiwaScan")}
            </a>
          </div>,
        );

        try {
          await refetchPoolAddress();
          await new Promise((r) => setTimeout(r, 2000));
          await Promise.all([
            refetchBalance0(),
            refetchBalance1(),
            refetchReserves(),
          ]);
        } catch (error) {
          console.error("[deposit] Refetch error:", error);
        }

        setTimeout(() => {
          setAmount0("");
          setAmount1("");
          setIsRefetching(false);
          prevAddSuccessRef.current = false;
        }, 100);
      };

      refetchData();
    }
  }, [
    isAddSuccess,
    addLiquidityHash,
    refetchBalance0,
    refetchBalance1,
    refetchReserves,
    refetchPoolAddress,
    t,
    amount0,
    amount1,
  ]);

  const handleAmount0Change = (value: string) => {
    setAmount0(value);

    if (
      !isInitialLiquidity &&
      value &&
      reserve0ForPairing &&
      reserve1ForPairing &&
      reserve0ForPairing > 0n &&
      selectedPool
    ) {
      try {
        const inputRaw = parseUnits(value, selectedPool.token0.decimals);
        const pairedRaw = (inputRaw * reserve1ForPairing) / reserve0ForPairing;
        setAmount1(formatUnits(pairedRaw, selectedPool.token1.decimals));
      } catch {
        // invalid input
      }
    } else if (!value && !isInitialLiquidity) {
      setAmount1("");
    }
  };

  const handleAmount1Change = (value: string) => {
    setAmount1(value);

    if (
      !isInitialLiquidity &&
      value &&
      reserve0ForPairing &&
      reserve1ForPairing &&
      reserve1ForPairing > 0n &&
      selectedPool
    ) {
      try {
        const inputRaw = parseUnits(value, selectedPool.token1.decimals);
        const pairedRaw = (inputRaw * reserve0ForPairing) / reserve1ForPairing;
        setAmount0(formatUnits(pairedRaw, selectedPool.token0.decimals));
      } catch {
        // invalid input
      }
    } else if (!value && !isInitialLiquidity) {
      setAmount0("");
    }
  };

  const handleChangePool = () => {
    router.push("/liquidity");
  };

  const handleApprove = async (tokenAddress: `0x${string}`) => {
    try {
      setApprovingTokenAddress(tokenAddress);
      const maxAmount = BigInt(
        "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
      );

      const isToken0 = tokenAddress === selectedPool?.token0.address;
      const needsErc20 = isToken0 ? needsErc20Approval0 : needsErc20Approval1;
      const needsPermit2 = isToken0
        ? needsPermit2Approval0
        : needsPermit2Approval1;

      if (needsErc20) {
        await approve(tokenAddress, permit2Address as `0x${string}`, maxAmount);
      }

      if (needsPermit2) {
        const txHash = await writePermit2Approve({
          address: permit2Address as `0x${string}`,
          abi: Permit2Abi,
          functionName: "approve",
          args: [
            tokenAddress,
            permit2RouterAddress,
            MAX_UINT160,
            permit2Expiration,
          ],
        });
        if (publicClient && txHash) {
          await publicClient.waitForTransactionReceipt({
            hash: txHash,
            confirmations: 1,
          });
        }
      }

      Promise.all([refetchAllowance0(), refetchAllowance1()]).catch(() => {});
      toast.success(t("approval.tokenApprovalSuccess"));
      setApprovingTokenAddress(null);
    } catch (error) {
      console.error("Approve error:", error);
      setApprovingTokenAddress(null);
      throw error;
    }
  };

  const proceedToDeposit = () => {
    if (needsApproval0 || needsApproval1) {
      setInitialApprovalNeeds({
        token0: needsApproval0,
        token1: needsApproval1,
      });
      setIsApprovalModalOpen(true);
    } else {
      handleAddLiquidity();
    }
  };

  const handleLiquidityButtonClick = () => {
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

  // ---------------------------------------------------------------------------
  // Desktop inline flow orchestration
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
      console.error("[deposit] desktop approval error:", error);
      setDesktopFlowPhase("idle");
    }
  };

  /**
   * Desktop entry point — replaces the dark `ApprovalModal` flow used on
   * mobile. The pool-grade warning still gets a chance to interrupt; on
   * confirmation it falls through to `runDesktopApprovals` via
   * `handleDesktopGradeWarningConfirm`.
   */
  const handleDesktopDepositClick = () => {
    if (poolGrade >= 2) {
      setIsGradeWarningOpen(true);
      return;
    }
    if (needsApproval0 || needsApproval1) {
      void runDesktopApprovals();
    } else {
      // Already approved: jump straight to the Confirm stage so the user can
      // fire the deposit tx explicitly (matches Figma 934-20210).
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
    void handleAddLiquidity();
  };

  const handleDesktopEdit = () => {
    setDesktopFlowPhase("idle");
    setDesktopTxHash(undefined);
  };

  const handleAddLiquidity = async () => {
    if (!effectiveAddress || !amount0 || !amount1 || !selectedPool) return;

    // Design-preview short-circuit. Mock pool addresses don't exist on chain,
    // so calling `addLiquidity` would either prompt the wallet for a doomed
    // tx or revert. Instead we close the approval modal, simulate a brief
    // pending state, then fire the same success toast the real path would.
    if (
      MOCK_DATA_ENABLED &&
      isMockToken(selectedPool.token0.address) &&
      isMockToken(selectedPool.token1.address)
    ) {
      // Capture the inputs before the reset so the success view has them.
      const snapshot = { amount0, amount1 };
      setIsApprovalModalOpen(false);
      setIsMockSubmitting(true);
      const txHash = await simulateMockTransaction({
        label: `add-liquidity:${selectedPool.address}:${amount0}:${amount1}`,
      });
      toast.success(t("liquidity.liquidityAddSuccess"));
      setLastDeposit({ ...snapshot, txHash });
      setDesktopTxHash(txHash);
      setAmount0("");
      setAmount1("");
      setIsMockSubmitting(false);
      // Mock path has no on-chain hash, but we still flip the desktop panel
      // into success so the UX matches the real flow.
      setDesktopFlowPhase((prev) =>
        prev === "depositing" || prev === "ready" || prev === "approving"
          ? "success"
          : prev,
      );
      return;
    }

    try {
      const a0 = parseUnits(amount0, selectedPool.token0.decimals);
      const a1 = parseUnits(amount1, selectedPool.token1.decimals);
      const slippageMultiplier = BigInt(Math.floor((100 - slippage) * 100));
      const amount0Min = (a0 * slippageMultiplier) / BigInt(10000);
      const amount1Min = (a1 * slippageMultiplier) / BigInt(10000);
      const deadline = getDeadlineTimestamp(deadlineMinutes);

      addLiquidity({
        address: universalRouterAddress!,
        abi: GiwaUniversalRouterAbi,
        functionName: "addLiquidity",
        args: [
          selectedPool.token0.address,
          selectedPool.token1.address,
          isStableParam,
          a0,
          a1,
          amount0Min,
          amount1Min,
          effectiveAddress,
          deadline,
        ],
      });

      setIsApprovalModalOpen(false);
    } catch (error) {
      console.error("[deposit] Add liquidity error:", error);
      toast.error(getErrorMessage(error, t));
    }
  };

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

  const buttonState = useMemo<{ text: string; disabled: boolean }>(() => {
    if (!effectiveIsConnected) {
      return { text: t("deposit.walletRequired"), disabled: true };
    }
    if (isRefetching) {
      return { text: t("common.updatingData"), disabled: true };
    }
    if (!amount0 || parseFloat(amount0) === 0) {
      return { text: t("deposit.enterAmountPrompt"), disabled: true };
    }
    if (!amount1 || parseFloat(amount1) === 0) {
      return { text: t("deposit.enterAmountPrompt"), disabled: true };
    }
    if (balance0 && parseFloat(amount0) > parseFloat(balance0)) {
      return {
        text: t("errors.insufficientBalanceFor", {
          symbol: selectedPool?.token0.symbol ?? "",
        }),
        disabled: true,
      };
    }
    if (balance1 && parseFloat(amount1) > parseFloat(balance1)) {
      return {
        text: t("errors.insufficientBalanceFor", {
          symbol: selectedPool?.token1.symbol ?? "",
        }),
        disabled: true,
      };
    }
    if (isAllowanceLoading) {
      return { text: t("common.loading"), disabled: true };
    }
    if (isAdding || isConfirming || isMockSubmitting) {
      return { text: t("liquidity.addingLiquidity"), disabled: true };
    }
    return { text: t("liquidity.deposit"), disabled: false };
  }, [
    effectiveIsConnected,
    isRefetching,
    amount0,
    amount1,
    balance0,
    balance1,
    selectedPool?.token0.symbol,
    selectedPool?.token1.symbol,
    isAllowanceLoading,
    isAdding,
    isConfirming,
    isMockSubmitting,
    t,
  ]);

  return {
    // routing context
    isStableParam,

    // pool data
    selectedPool,
    indexerPool,
    poolHeaderAddress,
    poolGrade,
    isInitialLiquidity,

    // loading
    isLoading,
    isOnChainLoading,

    // wallet
    isConnected: effectiveIsConnected,
    address: effectiveAddress,

    // form
    amount0,
    amount1,
    slippage,
    isAutoSlippage,
    lockOption,
    setSlippage,
    setIsAutoSlippage,
    setLockOption,
    handleAmount0Change,
    handleAmount1Change,

    // balances
    balance0,
    balance1,

    // quote
    expectedLpTokens,
    isQuoteLoading,
    isQuoteError,
    estimatedInitialLpHuman,
    poolTotalSupply: poolTotalSupply as bigint | undefined,

    // modals
    isApprovalModalOpen,
    setIsApprovalModalOpen,
    approvalStepsWithStatus,
    handleApprove,
    isGradeWarningOpen,
    setIsGradeWarningOpen,
    handleGradeWarningConfirm,

    // submit
    isAdding,
    isConfirming,
    lastDeposit,
    dismissLastDeposit,
    handleAddLiquidity,

    // ui actions
    handleLiquidityButtonClick,
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

export type UseBasicPoolDepositReturn = ReturnType<typeof useBasicPoolDeposit>;
