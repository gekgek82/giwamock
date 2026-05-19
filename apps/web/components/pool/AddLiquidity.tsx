"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useSendCalls,
  useCapabilities,
  useCallsStatus,
  usePublicClient,
} from "wagmi";
import { parseUnits, encodeFunctionData } from "viem";
import toast from "react-hot-toast";
import { useTranslations } from "next-intl";
import { GIWASCAN_URL, GIWA_SEPOLIA_CHAIN_ID } from "@/lib/config";
import { useSettingsStore, getDeadlineTimestamp } from "@/lib/store";
import { useUniversalRouterAddress } from "@/hooks/useContractAddresses";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { useTokenApprove } from "@/hooks/useTokenApprove";
import { usePoolReserves } from "@/hooks/usePoolReserves";
import { usePools, type PoolInfo } from "@/hooks/usePools";
import { useQuoteAddLiquidity } from "@/hooks/useQuoteAddLiquidity";
import { usePermit2ApprovalStatus } from "@/hooks/usePermit2Approval";
import { PoolSelect } from "./PoolSelect";
import { ApprovalModal } from "./ApprovalModal";
import { GiwaUniversalRouterAbi, ERC20Abi, Permit2Abi } from "@giwater/shared/abis";
import { parseRevertReason, extractRevertReason } from "@/lib/getContractErrorMessage";

const MAX_UINT256 = BigInt(
  "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
);

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

interface AddLiquidityProps {
  initialPool?: PoolInfo;
}

export function AddLiquidity({ initialPool }: AddLiquidityProps = {}) {
  const { address, isConnected } = useAccount();
  const { pools } = usePools();
  const t = useTranslations();
  const universalRouterAddress = useUniversalRouterAddress();
  const { deadlineMinutes } = useSettingsStore();

  const [amount0, setAmount0] = useState("");
  const [amount1, setAmount1] = useState("");
  const prevAddSuccessRef = useRef(false);
  const [manuallySelectedPool, setManuallySelectedPool] = useState<
    PoolInfo | undefined
  >();
  const [isRefetching, setIsRefetching] = useState(false);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [batchId, setBatchId] = useState<string>();
  const hasShownBatchSuccessToast = useRef<string | null>(null);

  // ========== EIP-5792 Batch Detection ==========

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: capabilities } = useCapabilities({ query: { retry: false } } as any);

  const supportsBatch = useMemo(() => {
    if (!capabilities) return false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const caps = capabilities as Record<string, any>;
    const chainCaps = caps?.[String(GIWA_SEPOLIA_CHAIN_ID)] ?? caps;
    return (
      chainCaps?.atomic?.status === "supported" ||
      chainCaps?.atomic?.status === "ready"
    );
  }, [capabilities]);

  // ========== Batch Mode Hooks ==========

  const {
    sendCallsAsync,
    isPending: isBatchPending,
    isError: isBatchError,
    error: batchError,
  } = useSendCalls();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: callsStatus } = useCallsStatus({
    id: batchId || "",
    query: {
      enabled: !!batchId,
      refetchInterval: batchId ? 2000 : false,
    },
  } as any);

  // Determine the pool to use - prioritize manually selected, then initialPool, then first available pool
  const selectedPool = useMemo(() => {
    if (manuallySelectedPool) return manuallySelectedPool;
    if (initialPool) return initialPool;
    return pools.length > 0 ? pools[0] : undefined;
  }, [manuallySelectedPool, initialPool, pools]);

  const { data: balance0, refetch: refetchBalance0 } = useTokenBalance(
    selectedPool?.token0.address
  );
  const { data: balance1, refetch: refetchBalance1 } = useTokenBalance(
    selectedPool?.token1.address
  );
  const {
    reserve0,
    reserve1,
    refetch: refetchReserves,
  } = usePoolReserves(selectedPool?.address);

  const {
    needsErc20Approval: needsErc20Approval0,
    needsPermit2Approval: needsPermit2Approval0,
    needsAnyApproval: needsApproval0,
    refetch: refetchAllowance0,
    permit2Address,
    routerAddress: permit2RouterAddress,
    MAX_UINT160,
  } = usePermit2ApprovalStatus(selectedPool?.token0.address, amount0);
  const {
    needsErc20Approval: needsErc20Approval1,
    needsPermit2Approval: needsPermit2Approval1,
    needsAnyApproval: needsApproval1,
    refetch: refetchAllowance1,
  } = usePermit2ApprovalStatus(selectedPool?.token1.address, amount1);

  // Parse amounts for quoteAddLiquidity
  const amount0Parsed = useMemo(() => {
    if (!amount0 || amount0 === "") return undefined;
    try {
      return parseUnits(amount0, 18);
    } catch {
      return undefined;
    }
  }, [amount0]);

  const amount1Parsed = useMemo(() => {
    if (!amount1 || amount1 === "") return undefined;
    try {
      return parseUnits(amount1, 18);
    } catch {
      return undefined;
    }
  }, [amount1]);

  // Get quote for LP tokens
  const { liquidity: expectedLpTokens, isLoading: isQuoteLoading } =
    useQuoteAddLiquidity(
      selectedPool?.token0.address,
      selectedPool?.token1.address,
      false, // stable
      amount0Parsed,
      amount1Parsed
    );

  const { approve } = useTokenApprove();
  const publicClient = usePublicClient();
  const { writeContractAsync: writePermit2Approve } = useWriteContract();
  const {
    data: addLiquidityHash,
    writeContract: addLiquidity,
    isPending: isAdding,
  } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isAddSuccess } =
    useWaitForTransactionReceipt({
      hash: addLiquidityHash,
    });

  // Check if pool is empty (initial liquidity)
  const isInitialLiquidity =
    parseFloat(reserve0) === 0 && parseFloat(reserve1) === 0;

  // Permit2 expiration: 30 days from now
  const permit2Expiration = Math.floor(Date.now() / 1000) + 30 * 24 * 3600;

  // Shared success handler for both batch and non-batch flows
  const handleSuccess = useCallback(
    (txHash: string) => {
      const refetchData = async () => {
        setIsRefetching(true);
        toast.success(
          <div>
            {t("liquidity.liquidityAddSuccess")}{" "}
            <a
              href={`${GIWASCAN_URL}/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              {t("common.viewOnGiwaScan")}
            </a>
          </div>
        );

        try {
          await Promise.all([
            refetchBalance0(),
            refetchBalance1(),
            refetchReserves(),
            refetchAllowance0(),
            refetchAllowance1(),
          ]);
        } catch (error) {
          console.error("Refetch error:", error);
        }

        setTimeout(() => {
          setAmount0("");
          setAmount1("");
          setIsRefetching(false);
        }, 100);
      };

      refetchData();
    },
    [t, refetchBalance0, refetchBalance1, refetchReserves, refetchAllowance0, refetchAllowance1],
  );

  // ========== Batch Status Tracking ==========

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const status = callsStatus as any;
    if (!status || !batchId) return;

    if (status.status === "success") {
      const receipts = status.receipts as
        | { transactionHash: string }[]
        | undefined;
      const txHash = receipts?.[receipts.length - 1]?.transactionHash;

      if (txHash && hasShownBatchSuccessToast.current !== txHash) {
        hasShownBatchSuccessToast.current = txHash;
        setIsApprovalModalOpen(false);
        handleSuccess(txHash);
      }

      setBatchId(undefined);
    } else if (status.status === "failure") {
      toast.error(t("errors.transactionFailed"));
      setBatchId(undefined);
    }
  }, [callsStatus, batchId, t, handleSuccess]);

  // ========== Non-Batch (Permit2 fallback) Status Tracking ==========

  // Show success message and reset form
  useEffect(() => {
    if (isAddSuccess && addLiquidityHash && !prevAddSuccessRef.current) {
      prevAddSuccessRef.current = true;
      handleSuccess(addLiquidityHash);
      prevAddSuccessRef.current = false;
    }
  }, [isAddSuccess, addLiquidityHash, handleSuccess]);

  useEffect(() => {
    if (isBatchError && batchError) {
      console.error("Batch liquidity error:", batchError);
      toast.error(getErrorMessage(batchError, t));
    }
  }, [isBatchError, batchError, t]);

  const handleAmount0Change = (value: string) => {
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setAmount0(value);

      // Auto-calculate amount1 if pool has liquidity
      if (
        !isInitialLiquidity &&
        value &&
        parseFloat(reserve0) > 0 &&
        parseFloat(reserve1) > 0
      ) {
        const ratio = parseFloat(reserve1) / parseFloat(reserve0);
        const calculatedAmount1 = (parseFloat(value) * ratio).toFixed(6);
        setAmount1(calculatedAmount1);
      } else if (!value && !isInitialLiquidity) {
        setAmount1("");
      }
    }
  };

  const handleAmount1Change = (value: string) => {
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setAmount1(value);
    }
  };

  const handleMax0Click = () => {
    if (balance0) {
      setAmount0(balance0);
    }
  };

  const handleMax1Click = () => {
    if (balance1) {
      setAmount1(balance1);
    }
  };

  const handleApprove = async (tokenAddress: `0x${string}`) => {
    try {
      setApprovingToken(tokenAddress);

      // Determine which approvals this token needs
      const isToken0 = tokenAddress === selectedPool?.token0.address;
      const needsErc20 = isToken0 ? needsErc20Approval0 : needsErc20Approval1;
      const needsPermit2 = isToken0 ? needsPermit2Approval0 : needsPermit2Approval1;

      // Step 1: ERC20.approve(Permit2, MAX) if needed
      if (needsErc20) {
        await approve(tokenAddress, permit2Address as `0x${string}`, MAX_UINT256);
      }

      // Step 2: Permit2.approve(token, Router, MAX_UINT160, expiration) if needed
      if (needsPermit2) {
        const txHash = await writePermit2Approve({
          address: permit2Address as `0x${string}`,
          abi: Permit2Abi,
          functionName: "approve",
          args: [tokenAddress, permit2RouterAddress, MAX_UINT160, permit2Expiration],
        });
        if (publicClient && txHash) {
          await publicClient.waitForTransactionReceipt({ hash: txHash, confirmations: 1 });
        }
      }

      await Promise.all([refetchAllowance0(), refetchAllowance1()]);
      toast.success(t("approval.tokenApprovalSuccess"));
    } catch (error) {
      console.error("Approve error:", error);
      throw error;
    } finally {
      setApprovingToken(null);
    }
  };

  // ---- EIP-5792 Batch Add Liquidity (Permit2 approve + addLiquidity in one popup) ----
  const handleBatchAddLiquidity = async () => {
    if (!address || !amount0 || !amount1 || !selectedPool || !universalRouterAddress) return;

    try {
      const amount0Parsed = parseUnits(amount0, 18);
      const amount1Parsed = parseUnits(amount1, 18);
      const amount0Min = (amount0Parsed * BigInt(95)) / BigInt(100);
      const amount1Min = (amount1Parsed * BigInt(95)) / BigInt(100);
      const deadline = getDeadlineTimestamp(deadlineMinutes);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const calls: any[] = [];

      // ERC20.approve(Permit2) for token0 if needed
      if (needsErc20Approval0) {
        calls.push({
          to: selectedPool.token0.address as `0x${string}`,
          data: encodeFunctionData({
            abi: ERC20Abi,
            functionName: "approve",
            args: [permit2Address, MAX_UINT256],
          }),
        });
      }

      // ERC20.approve(Permit2) for token1 if needed
      if (needsErc20Approval1) {
        calls.push({
          to: selectedPool.token1.address as `0x${string}`,
          data: encodeFunctionData({
            abi: ERC20Abi,
            functionName: "approve",
            args: [permit2Address, MAX_UINT256],
          }),
        });
      }

      // Permit2.approve(token0, Router) if needed
      if (needsPermit2Approval0) {
        calls.push({
          to: permit2Address as `0x${string}`,
          data: encodeFunctionData({
            abi: Permit2Abi,
            functionName: "approve",
            args: [selectedPool.token0.address, permit2RouterAddress, MAX_UINT160, permit2Expiration],
          }),
        });
      }

      // Permit2.approve(token1, Router) if needed
      if (needsPermit2Approval1) {
        calls.push({
          to: permit2Address as `0x${string}`,
          data: encodeFunctionData({
            abi: Permit2Abi,
            functionName: "approve",
            args: [selectedPool.token1.address, permit2RouterAddress, MAX_UINT160, permit2Expiration],
          }),
        });
      }

      // Add liquidity call via UniversalRouter
      calls.push({
        to: universalRouterAddress as `0x${string}`,
        data: encodeFunctionData({
          abi: GiwaUniversalRouterAbi,
          functionName: "addLiquidity",
          args: [
            selectedPool.token0.address,
            selectedPool.token1.address,
            false, // stable
            amount0Parsed,
            amount1Parsed,
            amount0Min,
            amount1Min,
            address,
            deadline,
          ],
        }),
      });

      const result = await sendCallsAsync({
        calls,
        chainId: GIWA_SEPOLIA_CHAIN_ID,
      });

      setBatchId(result.id);
    } catch (error) {
      console.error("Batch add liquidity error:", error);
      toast.error(getErrorMessage(error, t));
    }
  };

  // ---- Non-batch: sequential approval modal flow ----
  const handleLiquidityButtonClick = () => {
    if (supportsBatch) {
      // EIP-5792: approve + addLiquidity in one atomic batch
      handleBatchAddLiquidity();
    } else if (needsApproval0 || needsApproval1) {
      // Fallback: open sequential approval modal
      setInitialApprovalNeeds({
        token0: needsApproval0,
        token1: needsApproval1,
      });
      setIsApprovalModalOpen(true);
    } else {
      handleAddLiquidity();
    }
  };

  const handleAddLiquidity = async () => {
    if (!address || !amount0 || !amount1 || !selectedPool) return;

    try {
      const amount0Parsed = parseUnits(amount0, 18);
      const amount1Parsed = parseUnits(amount1, 18);
      const amount0Min = (amount0Parsed * BigInt(95)) / BigInt(100); // 5% slippage
      const amount1Min = (amount1Parsed * BigInt(95)) / BigInt(100);
      const deadline = getDeadlineTimestamp(deadlineMinutes);

      await addLiquidity({
        address: universalRouterAddress!,
        abi: GiwaUniversalRouterAbi,
        functionName: "addLiquidity",
        args: [
          selectedPool.token0.address,
          selectedPool.token1.address,
          false, // stable
          amount0Parsed,
          amount1Parsed,
          amount0Min,
          amount1Min,
          address,
          deadline,
        ],
      });

      // Close modal on success
      setIsApprovalModalOpen(false);
    } catch (error) {
      console.error("Add liquidity error:", error);
      toast.error(getErrorMessage(error, t));
    }
  };

  // Track initial approval requirements when modal opens
  const [initialApprovalNeeds, setInitialApprovalNeeds] = useState<{
    token0: boolean;
    token1: boolean;
  }>({ token0: false, token1: false });

  // Track which token is currently being approved
  const [approvingToken, setApprovingToken] = useState<`0x${string}` | null>(
    null
  );

  // Prepare approval steps for modal based on initial needs
  const approvalStepsWithStatus = useMemo(() => {
    if (!selectedPool || !isApprovalModalOpen) return [];

    const steps = [];

    // Add token0 if it was initially needed
    if (initialApprovalNeeds.token0) {
      steps.push({
        tokenSymbol: selectedPool.token0.symbol,
        tokenAddress: selectedPool.token0.address,
        isApproved: !needsApproval0,
        isApproving: approvingToken === selectedPool.token0.address,
      });
    }

    // Add token1 if it was initially needed
    if (initialApprovalNeeds.token1) {
      steps.push({
        tokenSymbol: selectedPool.token1.symbol,
        tokenAddress: selectedPool.token1.address,
        isApproved: !needsApproval1,
        isApproving: approvingToken === selectedPool.token1.address,
      });
    }

    return steps;
  }, [
    selectedPool,
    isApprovalModalOpen,
    initialApprovalNeeds,
    needsApproval0,
    needsApproval1,
    approvingToken,
  ]);

  const getButtonContent = () => {
    if (!isConnected) {
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

    if (isRefetching) {
      return {
        text: t("common.updatingData"),
        disabled: true,
        onClick: () => {},
      };
    }

    if (!amount0 || parseFloat(amount0) === 0) {
      return {
        text: t("liquidity.enterQuantity"),
        disabled: true,
        onClick: () => {},
      };
    }

    if (!amount1 || parseFloat(amount1) === 0) {
      return {
        text: t("liquidity.enterQuantity"),
        disabled: true,
        onClick: () => {},
      };
    }

    if (balance0 && parseFloat(amount0) > parseFloat(balance0)) {
      return {
        text: t("errors.insufficientBalanceFor").replace(
          "{symbol}",
          selectedPool.token0.symbol
        ),
        disabled: true,
        onClick: () => {},
      };
    }

    if (balance1 && parseFloat(amount1) > parseFloat(balance1)) {
      return {
        text: t("errors.insufficientBalanceFor").replace(
          "{symbol}",
          selectedPool.token1.symbol
        ),
        disabled: true,
        onClick: () => {},
      };
    }

    const isBusy = isAdding || isConfirming || isBatchPending || !!batchId;

    return {
      text: isBusy
        ? t("liquidity.addingLiquidity")
        : t("liquidity.supplyLiquidity"),
      disabled: isBusy,
      onClick: handleLiquidityButtonClick,
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

  return (
    <div className="space-y-6">
      {/* Initial Liquidity Notice */}
      {isInitialLiquidity && (
        <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💡</span>
            <div>
              <h4 className="font-bold text-blue-400 mb-1">
                {t("liquidity.initialLiquidity")}
              </h4>
              <p className="text-sm text-[#94a3af] leading-relaxed">
                {t("liquidity.initialLiquidityDescription")}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Pool Selection - Only show if no initial pool */}
      {!initialPool && (
        <div>
          <label className="block text-sm font-bold text-white mb-3">
            {t("liquidity.selectPool")}
          </label>
          <PoolSelect
            selectedPool={selectedPool}
            onSelect={setManuallySelectedPool}
          />
        </div>
      )}

      {/* Token 0 Input */}
      <div>
        <div className="flex justify-between mb-3">
          <label className="text-sm font-semibold text-[#94a3af]">
            {selectedPool.token0.symbol}
          </label>
          <span className="text-sm text-[#94a3af]">
            {t("common.balance")}:{" "}
            <span className="font-bold text-white">
              {balance0 ? parseFloat(balance0).toFixed(4) : "0.0000"}
            </span>
          </span>
        </div>
        <div className="border-2 border-[#2d3548] hover:border-[#4c6ef5] rounded-2xl p-5 bg-[#0f1419] transition-all focus-within:border-[#4c6ef5]">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={amount0}
              onChange={(e) => handleAmount0Change(e.target.value)}
              placeholder="0.0"
              className="flex-1 text-3xl font-bold outline-none bg-transparent text-white placeholder:text-[#6b7280]"
              disabled={!isConnected || isRefetching}
            />
            <button
              onClick={handleMax0Click}
              className="px-4 py-2 text-sm font-bold text-[#4c6ef5] hover:bg-[#4c6ef5]/10 rounded-lg transition-all"
              disabled={!isConnected || isRefetching}
            >
              MAX
            </button>
          </div>
        </div>
      </div>

      {/* Plus Icon */}
      <div className="flex justify-center">
        <div className="w-10 h-10 bg-[#2d3548] rounded-full flex items-center justify-center text-[#94a3af] font-bold text-xl">
          +
        </div>
      </div>

      {/* Token 1 Input */}
      <div>
        <div className="flex justify-between mb-3">
          <label className="text-sm font-semibold text-[#94a3af]">
            {selectedPool.token1.symbol}
          </label>
          <span className="text-sm text-[#94a3af]">
            {t("common.balance")}:{" "}
            <span className="font-bold text-white">
              {balance1 ? parseFloat(balance1).toFixed(4) : "0.0000"}
            </span>
          </span>
        </div>
        <div
          className={`border-2 rounded-2xl p-5 bg-[#0f1419] transition-all ${
            isInitialLiquidity
              ? "border-[#2d3548] hover:border-[#4c6ef5] focus-within:border-[#4c6ef5]"
              : "border-[#2d3548]"
          }`}
        >
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={amount1}
              onChange={(e) =>
                isInitialLiquidity && handleAmount1Change(e.target.value)
              }
              readOnly={!isInitialLiquidity}
              placeholder="0.0"
              className="flex-1 text-3xl font-bold outline-none bg-transparent text-white placeholder:text-[#6b7280]"
              disabled={!isConnected || isRefetching}
            />
            {isInitialLiquidity && (
              <button
                onClick={handleMax1Click}
                className="px-4 py-2 text-sm font-bold text-[#4c6ef5] hover:bg-[#4c6ef5]/10 rounded-lg transition-all"
                disabled={!isConnected || isRefetching}
              >
                MAX
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Pool Info */}
      {amount0 && amount1 && (
        <div className="p-5 bg-[#0f1419] rounded-2xl space-y-3 text-sm border border-[#2d3548]">
          <div className="flex justify-between items-center">
            <span className="text-[#94a3af] font-medium">
              {isInitialLiquidity
                ? t("liquidity.settingPriceRatio")
                : t("liquidity.poolRatio")}
            </span>
            <span className="font-bold text-white text-base">
              1 {selectedPool.token0.symbol} ={" "}
              {isInitialLiquidity
                ? (parseFloat(amount1) / parseFloat(amount0)).toFixed(4)
                : (parseFloat(reserve1) / parseFloat(reserve0) || 0).toFixed(
                    4
                  )}{" "}
              {selectedPool.token1.symbol}
            </span>
          </div>

          {/* Expected LP Tokens */}
          <div className="flex justify-between items-center pt-3 border-t border-[#2d3548]">
            <span className="text-[#94a3af] font-medium">
              {t("liquidity.expectedLpTokens")}
            </span>
            <span className="font-bold text-[#4c6ef5] text-base">
              {isQuoteLoading ? (
                <span className="text-[#94a3af]">
                  {t("common.calculating")}
                </span>
              ) : expectedLpTokens && parseFloat(expectedLpTokens) > 0 ? (
                `${parseFloat(expectedLpTokens).toFixed(6)} LP`
              ) : (
                <span className="text-[#94a3af]">-</span>
              )}
            </span>
          </div>

          {isInitialLiquidity && (
            <div className="pt-3 border-t border-[#2d3548]">
              <p className="text-xs text-[#94a3af]">
                ⚠️ {t("liquidity.initialPriceWarning")}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Add Liquidity Button */}
      <button
        onClick={button.onClick}
        disabled={button.disabled}
        className={`w-full py-4 px-6 rounded-xl font-bold text-lg transition-all ${
          button.disabled
            ? "bg-[#2d3548] text-[#94a3af] cursor-not-allowed"
            : "bg-[#4c6ef5] hover:bg-[#5c7cfa] text-white"
        }`}
      >
        {button.text}
      </button>

      {/* Approval Modal */}
      <ApprovalModal
        isOpen={isApprovalModalOpen}
        onClose={() => setIsApprovalModalOpen(false)}
        steps={approvalStepsWithStatus}
        onApprove={handleApprove}
        onAddLiquidity={handleAddLiquidity}
        isAddingLiquidity={isAdding || isConfirming}
      />
    </div>
  );
}
