"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useSendCalls,
  useCapabilities,
  useCallsStatus,
  usePublicClient,
  useSendTransaction,
} from "wagmi";
import { parseUnits, encodeFunctionData, encodePacked } from "viem";
import toast from "react-hot-toast";
import { useTranslations } from "next-intl";
import { GIWASCAN_URL, GIWA_SEPOLIA_CHAIN_ID } from "@/lib/config";
import {
  getMockDemoAddress,
  isMockMode,
  simulateMockTransaction,
} from "@/lib/mockTransactions";
import { useSettingsStore, getDeadlineTimestamp } from "@/lib/store";
import { portfolioApi } from "@/lib/portfolioApi";
import {
  usePoolFactoryAddress,
  useUniversalRouterAddress,
  type TokenInfo,
} from "@/hooks/useContractAddresses";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { useTokenApprove } from "@/hooks/useTokenApprove";
import { usePermit2ApprovalStatus } from "@/hooks/usePermit2Approval";
import { ERC20Abi, GiwaUniversalRouterAbi, Permit2Abi } from "@giwater/shared/abis";
import {
  parseRevertReason,
  extractRevertReason,
} from "@/lib/getContractErrorMessage";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { Button } from "@/components/common/Button";

// ============================================================================
// Constants
// ============================================================================

const MAX_UINT256 = BigInt(
  "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
);
const MAX_UINT160 = BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF");

// ============================================================================
// Types
// ============================================================================

interface Route {
  from: `0x${string}`;
  to: `0x${string}`;
  stable: boolean;
  factory: `0x${string}`;
  poolType?: string;
  tickSpacing?: number;
  poolAddress?: `0x${string}`;
}

export type SwapStatus =
  | "idle"
  | "pending"
  | "confirming"
  | "success"
  | "error";

interface SwapButtonProps {
  fromToken: TokenInfo;
  toToken: TokenInfo;
  fromAmount: string;
  minimumReceived: string;
  routes: Route[];
  /** Optional router tx from broker `swap-routes` (preferred when present). */
  routerTx?: { to: `0x${string}`; data: `0x${string}`; valueWei: string; method: string };
  insufficientLiquidity?: boolean;
  onSwapSuccess?: () => void;
  onStatusChange?: (status: SwapStatus, txHash?: string) => void;
  /**
   * When set, clicking the enabled CTA calls this handler instead of executing
   * the swap directly. Used by the mobile flow to route through a "Check
   * before you swap" confirmation screen before triggering wallet approval.
   */
  onRequestConfirm?: () => void;
  /** Override CTA label (e.g. "Confirm" on the mobile confirmation screen). */
  submitLabel?: string;
}

// ============================================================================
// Helpers
// ============================================================================

function encodeCLPath(routes: Route[]): `0x${string}` {
  const types: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const values: any[] = [];
  for (let i = 0; i < routes.length; i++) {
    if (i === 0) {
      types.push("address", "int24", "address");
      values.push(routes[i].from, routes[i].tickSpacing, routes[i].to);
    } else {
      types.push("int24", "address");
      values.push(routes[i].tickSpacing, routes[i].to);
    }
  }
  return encodePacked(types, values);
}

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
    errorMessage.includes("INSUFFICIENT_OUTPUT_AMOUNT") ||
    errorMessage.includes("Too little received") ||
    errorMessage.includes("amountOutMinimum") ||
    (errorMessage.includes("execution reverted") &&
      errorMessage.includes("slippage"))
  ) {
    return t("errors.slippageError");
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

// ============================================================================
// Component
// ============================================================================

export function SwapButton({
  fromToken,
  toToken,
  fromAmount,
  minimumReceived,
  routes,
  routerTx,
  insufficientLiquidity,
  onSwapSuccess,
  onStatusChange,
  onRequestConfirm,
  submitLabel,
}: SwapButtonProps) {
  const { address, isConnected } = useAccount();
  const mockAddress = getMockDemoAddress();
  const effectiveAddress = (address ?? mockAddress) as `0x${string}` | undefined;
  const effectiveIsConnected = isConnected || Boolean(mockAddress);
  const { openConnectModal } = useConnectModal();
  const t = useTranslations();
  const poolFactoryAddress = usePoolFactoryAddress();
  const universalRouterAddress = useUniversalRouterAddress();

  const [isSigningAndSwapping, setIsSigningAndSwapping] = useState(false);
  const [isMockSwapPending, setIsMockSwapPending] = useState(false);
  const [batchId, setBatchId] = useState<string>();
  const hasShownSuccessToast = useRef<string | null>(null);
  const { deadlineMinutes } = useSettingsStore();

  // ========== EIP-5792 Batch Detection ==========

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: capabilities } = useCapabilities({
    query: { retry: false },
  } as any);

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

  const allCL =
    routes.length > 0 &&
    routes.every((r) => r.poolType === "CL" && r.tickSpacing);
  const isSingleCL = allCL && routes.length === 1;
  const isMultiCL = allCL && routes.length > 1;
  const isMixed =
    routes.length > 1 &&
    routes.some((r) => r.poolType === "CL") &&
    routes.some((r) => r.poolType !== "CL");
  const useBatchFlow = supportsBatch && !isMockMode();

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

  // ========== Permit2 Approval Status ==========

  const {
    needsErc20Approval,
    needsPermit2Approval,
    refetch: refetchPermit2Status,
    permit2Address,
    routerAddress: permit2RouterAddress,
  } = usePermit2ApprovalStatus(
    fromToken?.address as `0x${string}` | undefined,
    fromAmount,
  );

  // Permit2 expiration: 30 days from now
  const permit2Expiration = Math.floor(Date.now() / 1000) + 30 * 24 * 3600;

  // ========== Common Hooks ==========

  const { approve, isPending: isApproving } = useTokenApprove();
  const { writeContractAsync: writePermit2Approve } = useWriteContract();
  const publicClient = usePublicClient();

  const { data: balance, refetch: refetchBalance } = useTokenBalance(
    fromToken?.address as `0x${string}` | undefined,
  );

  const {
    data: swapHash,
    writeContractAsync,
    isPending: isSwapping,
    isError: isSwapError,
    error: swapError,
  } = useWriteContract();

  const { sendTransactionAsync, isPending: isSendingTx, error: sendTxError } =
    useSendTransaction();
  const [rawSwapHash, setRawSwapHash] = useState<`0x${string}` | undefined>();

  const activeSwapHash = (rawSwapHash ?? (swapHash as `0x${string}` | undefined)) as
    | `0x${string}`
    | undefined;

  const {
    isLoading: isSwapConfirming,
    isSuccess: isSwapSuccess,
    isError: isReceiptError,
    error: receiptError,
  } = useWaitForTransactionReceipt({ hash: activeSwapHash });

  // ========== Status Reporting ==========

  const reportStatus = useCallback(
    (status: SwapStatus, txHash?: string) => {
      onStatusChange?.(status, txHash);
    },
    [onStatusChange],
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

      if (txHash && hasShownSuccessToast.current !== txHash) {
        hasShownSuccessToast.current = txHash;

        toast.success(
          <div>
            {t("swap.swapSuccess")}{" "}
            <a
              href={`${GIWASCAN_URL}/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              {t("common.viewOnGiwaScan")}
            </a>
          </div>,
        );

        portfolioApi.notifyTransaction(txHash).catch((err) => {
          console.warn("Failed to notify transaction:", err);
        });

        reportStatus("success", txHash);

        setTimeout(() => {
          refetchBalance();
          refetchPermit2Status();
          onSwapSuccess?.();
        }, 2000);
      }

      setBatchId(undefined);
    } else if (status.status === "failure") {
      toast.error(t("errors.transactionFailed"));
      reportStatus("error");
      setBatchId(undefined);
    } else {
      // pending
      reportStatus("pending");
    }
  }, [
    callsStatus,
    batchId,
    t,
    refetchBalance,
    refetchPermit2Status,
    onSwapSuccess,
    reportStatus,
  ]);

  // ========== Direct Swap Status Tracking ==========

  useEffect(() => {
    if (
      isSwapSuccess &&
      activeSwapHash &&
      hasShownSuccessToast.current !== activeSwapHash
    ) {
      hasShownSuccessToast.current = activeSwapHash;

      toast.success(
        <div>
          {t("swap.swapSuccess")}{" "}
          <a
            href={`${GIWASCAN_URL}/tx/${activeSwapHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            {t("common.viewOnGiwaScan")}
          </a>
        </div>,
      );

      portfolioApi.notifyTransaction(activeSwapHash).catch((err) => {
        console.warn("Failed to notify transaction:", err);
      });

      setTimeout(() => {
        refetchBalance();
        refetchPermit2Status();
        onSwapSuccess?.();
      }, 2000);
    }
  }, [
    isSwapSuccess,
    activeSwapHash,
    refetchBalance,
    refetchPermit2Status,
    onSwapSuccess,
    t,
  ]);

  useEffect(() => {
    if (isSwapError && swapError) {
      console.error("Swap transaction error:", swapError);
      toast.error(getErrorMessage(swapError, t));
    }
  }, [isSwapError, swapError, t]);

  useEffect(() => {
    if (sendTxError) {
      console.error("SendTransaction error:", sendTxError);
      toast.error(getErrorMessage(sendTxError, t));
    }
  }, [sendTxError, t]);

  useEffect(() => {
    if (isBatchError && batchError) {
      console.error("Batch transaction error:", batchError);
      toast.error(getErrorMessage(batchError, t));
    }
  }, [isBatchError, batchError, t]);

  // Receipt error (on-chain revert, e.g. slippage)
  useEffect(() => {
    if (isReceiptError && receiptError) {
      console.error("Transaction receipt error:", receiptError);
      toast.error(getErrorMessage(receiptError, t));
    }
  }, [isReceiptError, receiptError, t]);

  // Swap status → parent.
  // Use `activeSwapHash` (rawSwapHash ?? swapHash) so the routerTx path
  // (sendTransactionAsync, where `swapHash` from writeContractAsync stays
  // undefined) still reports success and triggers the completed view.
  useEffect(() => {
    if (isSwapSuccess && activeSwapHash) {
      reportStatus("success", activeSwapHash);
    } else if (isSwapConfirming) {
      reportStatus("confirming", activeSwapHash);
    } else if (isSwapping || isSigningAndSwapping || isSendingTx) {
      reportStatus("pending");
    } else if (isSwapError || isReceiptError) {
      reportStatus("error");
    }
  }, [
    isSwapping,
    isSigningAndSwapping,
    isSendingTx,
    isSwapConfirming,
    isSwapSuccess,
    isSwapError,
    isReceiptError,
    activeSwapHash,
    reportStatus,
  ]);

  // ========== Handlers ==========

  // ---- EIP-5792 Batch Swap (via UniversalRouter) ----
  const handleBatchSwap = async () => {
    if (!effectiveAddress || !universalRouterAddress) return;

    try {
      const amountInParsed = parseUnits(fromAmount, fromToken.decimals ?? 18);
      const amountOutMinParsed = parseUnits(
        minimumReceived,
        toToken.decimals ?? 18,
      );
      const deadline = getDeadlineTimestamp(deadlineMinutes);

      // Build calls: [Permit2 approvals if needed] + [swap]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const calls: any[] = [];

      // Step 1: ERC20.approve(Permit2, MAX) if needed
      if (needsErc20Approval) {
        calls.push({
          to: fromToken.address as `0x${string}`,
          data: encodeFunctionData({
            abi: ERC20Abi,
            functionName: "approve",
            args: [permit2Address, MAX_UINT256],
          }),
        });
      }

      // Step 2: Permit2.approve(token, Router, MAX_UINT160, expiration) if needed
      if (needsPermit2Approval) {
        calls.push({
          to: permit2Address as `0x${string}`,
          data: encodeFunctionData({
            abi: Permit2Abi,
            functionName: "approve",
            args: [
              fromToken.address as `0x${string}`,
              permit2RouterAddress,
              MAX_UINT160,
              permit2Expiration,
            ],
          }),
        });
      }

      // Swap call: prefer broker-provided calldata when available.
      if (routerTx) {
        calls.push({
          to: routerTx.to,
          data: routerTx.data,
          value: BigInt(routerTx.valueWei || "0"),
        });
      } else {
        // Fallback to legacy client-side encoding.
        if (isMixed) {
          const hops = routes.map((r) => ({
            tokenIn: r.from,
            tokenOut: r.to,
            isCL: r.poolType === "CL",
            stable: r.stable,
            tickSpacing: r.tickSpacing ?? 0,
          }));
          calls.push({
            to: universalRouterAddress,
            data: encodeFunctionData({
              abi: GiwaUniversalRouterAbi,
              functionName: "mixedExactInput",
              args: [
                {
                  hops,
                  recipient: effectiveAddress,
                  deadline,
                  amountIn: amountInParsed,
                  amountOutMinimum: amountOutMinParsed,
                },
              ],
            }),
          });
        } else if (isMultiCL) {
          calls.push({
            to: universalRouterAddress,
            data: encodeFunctionData({
              abi: GiwaUniversalRouterAbi,
              functionName: "clExactInput",
              args: [
                {
                  path: encodeCLPath(routes),
                  recipient: effectiveAddress,
                  deadline,
                  amountIn: amountInParsed,
                  amountOutMinimum: amountOutMinParsed,
                },
              ],
            }),
          });
        } else if (isSingleCL) {
          calls.push({
            to: universalRouterAddress,
            data: encodeFunctionData({
              abi: GiwaUniversalRouterAbi,
              functionName: "clExactInputSingle",
              args: [
                {
                  tokenIn: fromToken.address as `0x${string}`,
                  tokenOut: toToken.address as `0x${string}`,
                  tickSpacing: routes[0].tickSpacing!,
                  recipient: effectiveAddress,
                  deadline,
                  amountIn: amountInParsed,
                  amountOutMinimum: amountOutMinParsed,
                  sqrtPriceLimitX96: 0n,
                },
              ],
            }),
          });
        } else {
          const swapRoutes =
            routes.length > 0
              ? routes.map((r) => ({
                  from: r.from,
                  to: r.to,
                  stable: r.stable,
                  factory: poolFactoryAddress ?? r.factory,
                }))
              : [
                  {
                    from: fromToken.address as `0x${string}`,
                    to: toToken.address as `0x${string}`,
                    stable: false,
                    factory: poolFactoryAddress!,
                  },
                ];
          calls.push({
            to: universalRouterAddress,
            data: encodeFunctionData({
              abi: GiwaUniversalRouterAbi,
              functionName: "swapExactTokensForTokens",
              args: [
                amountInParsed,
                amountOutMinParsed,
                swapRoutes,
                effectiveAddress,
                deadline,
              ],
            }),
          });
        }
      }

      const result = await sendCallsAsync({
        calls,
        chainId: GIWA_SEPOLIA_CHAIN_ID,
      });

      setBatchId(result.id);
    } catch (error) {
      console.error("Batch swap error:", error);
      toast.error(getErrorMessage(error, t));
    }
  };

  // ---- Direct Approve Swap (via UniversalRouter) ----
  const handleDirectSwap = async () => {
    if (!effectiveAddress || !universalRouterAddress) return;

    setIsSigningAndSwapping(true);
    try {
      const amountInParsed = parseUnits(fromAmount, fromToken.decimals ?? 18);
      const amountOutMinParsed = parseUnits(
        minimumReceived,
        toToken.decimals ?? 18,
      );
      const deadline = getDeadlineTimestamp(deadlineMinutes);

      // Step 1: ERC20.approve(Permit2, MAX) if needed
      if (needsErc20Approval) {
        await approve(
          fromToken.address as `0x${string}`,
          permit2Address as `0x${string}`,
          MAX_UINT256,
        );
      }

      // Step 2: Permit2.approve(token, Router, MAX_UINT160, expiration) if needed
      if (needsPermit2Approval) {
        if (isMockMode()) {
          await simulateMockTransaction({
            label: `permit2-approve:${fromToken.address}:${permit2RouterAddress}`,
          });
        } else {
          const txHash = await writePermit2Approve({
            address: permit2Address as `0x${string}`,
            abi: Permit2Abi,
            functionName: "approve",
            args: [
              fromToken.address as `0x${string}`,
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
      }

      if (needsErc20Approval || needsPermit2Approval) {
        await refetchPermit2Status();
      }

      if (isMockMode()) {
        setIsMockSwapPending(true);
        reportStatus("pending");
        const hash = await simulateMockTransaction({
          label: `swap:${fromToken.address}:${toToken.address}:${fromAmount}`,
        });
        setRawSwapHash(hash);
        hasShownSuccessToast.current = hash;
        toast.success(
          <div>
            {t("swap.swapSuccess")}{" "}
            <span className="underline">{hash.slice(0, 10)}...</span>
          </div>,
        );
        await portfolioApi.notifyTransaction(hash).catch((err) => {
          console.warn("Failed to notify mock transaction:", err);
        });
        reportStatus("success", hash);
        setTimeout(() => {
          refetchBalance();
          refetchPermit2Status();
          onSwapSuccess?.();
        }, 250);
        return;
      }

      // Prefer broker-provided raw calldata when available.
      if (routerTx) {
        const hash = await sendTransactionAsync({
          to: routerTx.to,
          data: routerTx.data,
          value: BigInt(routerTx.valueWei || "0"),
        });
        setRawSwapHash(hash);
      } else {
        // Legacy fallback: client-side encoding.
        if (isMixed) {
          const hops = routes.map((r) => ({
            tokenIn: r.from,
            tokenOut: r.to,
            isCL: r.poolType === "CL",
            stable: r.stable,
            tickSpacing: r.tickSpacing ?? 0,
          }));
          await writeContractAsync({
            address: universalRouterAddress,
            abi: GiwaUniversalRouterAbi,
            functionName: "mixedExactInput",
            args: [
              {
                hops,
                  recipient: effectiveAddress,
                deadline,
                amountIn: amountInParsed,
                amountOutMinimum: amountOutMinParsed,
              },
            ],
          });
        } else if (isMultiCL) {
          await writeContractAsync({
            address: universalRouterAddress,
            abi: GiwaUniversalRouterAbi,
            functionName: "clExactInput",
            args: [
              {
                path: encodeCLPath(routes),
                  recipient: effectiveAddress,
                deadline,
                amountIn: amountInParsed,
                amountOutMinimum: amountOutMinParsed,
              },
            ],
          });
        } else if (isSingleCL) {
          await writeContractAsync({
            address: universalRouterAddress,
            abi: GiwaUniversalRouterAbi,
            functionName: "clExactInputSingle",
            args: [
              {
                tokenIn: fromToken.address as `0x${string}`,
                tokenOut: toToken.address as `0x${string}`,
                tickSpacing: routes[0].tickSpacing!,
                  recipient: effectiveAddress,
                deadline,
                amountIn: amountInParsed,
                amountOutMinimum: amountOutMinParsed,
                sqrtPriceLimitX96: 0n,
              },
            ],
          });
        } else {
          const swapRoutes =
            routes.length > 0
              ? routes.map((r) => ({
                  from: r.from,
                  to: r.to,
                  stable: r.stable,
                  factory: poolFactoryAddress ?? r.factory,
                }))
              : [
                  {
                    from: fromToken.address as `0x${string}`,
                    to: toToken.address as `0x${string}`,
                    stable: false,
                    factory: poolFactoryAddress!,
                  },
                ];

          await writeContractAsync({
            address: universalRouterAddress,
            abi: GiwaUniversalRouterAbi,
            functionName: "swapExactTokensForTokens",
            args: [
              amountInParsed,
              amountOutMinParsed,
              swapRoutes,
              effectiveAddress,
              deadline,
            ],
          });
        }
      }
    } catch (error) {
      console.error("Swap error:", error);
      toast.error(getErrorMessage(error, t));
    } finally {
      setIsSigningAndSwapping(false);
      setIsMockSwapPending(false);
    }
  };

  // ---- Unified Handler ----
  const handleSwap = async () => {
    if (!effectiveAddress) {
      toast.error(t("errors.walletNotConnected"));
      return;
    }
    if (!fromToken?.address || !toToken?.address) {
      toast.error(t("errors.selectToken"));
      return;
    }

    if (useBatchFlow) {
      await handleBatchSwap();
    } else {
      await handleDirectSwap();
    }
  };

  // ========== Render ==========

  if (!fromToken || !toToken) {
    return (
      <Button size="lg" disabled>
        {t("swap.selectToken")}
      </Button>
    );
  }

  if (!effectiveIsConnected) {
    return (
      <Button size="lg" onClick={openConnectModal}>
        {t("common.connectWallet")}
      </Button>
    );
  }

  if (!fromAmount || parseFloat(fromAmount) === 0) {
    return (
      <Button size="lg" disabled>
        {t("swap.swapButton")}
      </Button>
    );
  }

  if (balance && parseFloat(fromAmount) > parseFloat(balance)) {
    return (
      <Button variant="danger" size="lg" disabled>
        {t("swap.insufficientBalance")}
      </Button>
    );
  }

  if (insufficientLiquidity) {
    return (
      <Button variant="danger" size="lg" disabled>
        {t("swap.insufficientLiquidityButton")}
      </Button>
    );
  }

  const isBusy =
    isApproving ||
    isSwapping ||
    isSendingTx ||
    isSwapConfirming ||
    isSigningAndSwapping ||
    isMockSwapPending ||
    isBatchPending ||
    !!batchId;

  const ctaHandler = onRequestConfirm ?? handleSwap;
  const ctaLabel = submitLabel ?? t("swap.swapButton");

  return (
    <Button size="lg" onClick={ctaHandler} loading={isBusy}>
      {isBusy ? t("swap.swapping") : ctaLabel}
    </Button>
  );
}
