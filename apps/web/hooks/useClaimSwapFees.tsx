"use client";

import { useState, useCallback } from "react";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { PoolAbi, NonfungiblePositionManagerAbi } from "@giwater/shared/abis";
import { useNftPositionManagerAddress } from "@/hooks/useContractAddresses";
import { portfolioApi } from "@/lib/portfolioApi";
import { GIWASCAN_URL } from "@/lib/config";
import {
  getMockDemoAddress,
  isMockMode,
  simulateMockTransaction,
} from "@/lib/mockTransactions";

export type ClaimSwapFeesStatus = "idle" | "claiming" | "success" | "error";

const MAX_UINT128 = (1n << 128n) - 1n;

export interface ClaimSwapFeesArgs {
  poolType: "CL" | "BASIC";
  poolAddress: `0x${string}`;
  tokenId?: string | null;
}

export function useClaimSwapFees(onSuccess?: () => void) {
  const { address } = useAccount();
  const effectiveAddress = address ?? getMockDemoAddress();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const nftPositionManager = useNftPositionManagerAddress();
  const t = useTranslations("toasts");
  const tCommon = useTranslations("common");

  const [status, setStatus] = useState<ClaimSwapFeesStatus>("idle");
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStatus("idle");
    setPendingKey(null);
  }, []);

  const errorToToast = useCallback(
    (error: unknown): string => {
      const msg = error instanceof Error ? error.message : String(error ?? "");
      if (msg.includes("User rejected") || msg.includes("user rejected")) {
        return t("transactionRejected");
      }
      return t("claimSwapFeesFailed");
    },
    [t],
  );

  const claim = useCallback(
    async (args: ClaimSwapFeesArgs) => {
      if (!effectiveAddress) {
        toast.error(t("walletNotConnected"));
        return;
      }
      if (args.poolType === "CL" && !nftPositionManager) {
        toast.error(t("claimSwapFeesContractLoading"));
        return;
      }
      if (args.poolType === "CL" && !args.tokenId) {
        toast.error(t("claimSwapFeesNoTokenId"));
        return;
      }

      const key =
        args.poolType === "CL"
          ? `cl:${args.tokenId}`
          : `basic:${args.poolAddress.toLowerCase()}`;

      setStatus("claiming");
      setPendingKey(key);

      try {
        let txHash: `0x${string}`;

        if (isMockMode()) {
          txHash = await simulateMockTransaction({
            label: `claim-swap-fees:${args.poolType}:${args.poolAddress}:${args.tokenId ?? ""}`,
          });
        } else if (args.poolType === "CL") {
          txHash = await writeContractAsync({
            address: nftPositionManager as `0x${string}`,
            abi: NonfungiblePositionManagerAbi as any,
            functionName: "collect",
            args: [
              {
                tokenId: BigInt(args.tokenId as string),
                recipient: effectiveAddress,
                amount0Max: MAX_UINT128,
                amount1Max: MAX_UINT128,
              },
            ],
          });
        } else {
          txHash = await writeContractAsync({
            address: args.poolAddress,
            abi: PoolAbi as any,
            functionName: "claimFees",
            args: [],
          });
        }

        if (!isMockMode() && publicClient && txHash) {
          await publicClient.waitForTransactionReceipt({
            hash: txHash,
            confirmations: 1,
          });

          try {
            await portfolioApi.notifyTransaction(txHash);
          } catch {
            // Indexer sync is best-effort — don't fail the UX over it.
          }
        }

        setStatus("success");
        setPendingKey(null);

        toast.success(
          <div>
            {t("claimSwapFeesSuccess")}{" "}
            <a
              href={`${GIWASCAN_URL}/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              {tCommon("viewOnGiwaScan")}
            </a>
          </div>,
        );

        onSuccess?.();
      } catch (error) {
        console.error("Claim swap fees error:", error);
        setStatus("error");
        setPendingKey(null);
        toast.error(errorToToast(error));
      }
    },
    [effectiveAddress, nftPositionManager, publicClient, writeContractAsync, onSuccess, t, tCommon, errorToToast],
  );

  return {
    claim,
    status,
    pendingKey,
    reset,
  };
}
