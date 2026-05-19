"use client";

import { useCallback, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import toast from "react-hot-toast";
import { useTranslations } from "next-intl";
import { portfolioApi } from "@/lib/portfolioApi";
import {
  createMockSignature,
  getMockDemoAddress,
  isMockMode,
} from "@/lib/mockTransactions";
import type { VoteIncentive } from "@/types/portfolio";

interface AddIncentiveParams {
  poolAddress: string;
  tokenAddress: string;
  tokenSymbol: string;
  tokenDecimals: number;
  /** Absolute wei amount */
  amountWei: string;
  amountUsd?: string;
  epoch: number;
}

interface UseAddVoteIncentiveReturn {
  /** Produce the personal_sign signature that the user approves the incentive submission with. */
  sign: (params: AddIncentiveParams) => Promise<{
    signature: string;
    message: string;
  } | null>;
  /** Submit the signed payload to the backend. */
  submit: (
    params: AddIncentiveParams & { signature: string; message: string },
  ) => Promise<VoteIncentive | null>;
  isSigning: boolean;
  isSubmitting: boolean;
}

/**
 * Build the plaintext message the wallet signs to register a vote incentive.
 * Must reference the pool, token, amount, and epoch — the backend rejects
 * signatures whose message doesn't bind to the same values.
 */
function buildIncentiveSignMessage(params: AddIncentiveParams) {
  const lines = [
    `GiwaTer — Register vote incentive`,
    `Pool: ${params.poolAddress}`,
    `Token: ${params.tokenAddress} (${params.tokenSymbol})`,
    `Amount: ${params.amountWei}`,
    `Epoch: ${params.epoch}`,
    `Timestamp: ${Math.floor(Date.now() / 1000)}`,
    `Note: This registration is irreversible.`,
  ];
  return lines.join("\n");
}

export function useAddVoteIncentive(): UseAddVoteIncentiveReturn {
  const { address } = useAccount();
  const effectiveAddress = address ?? getMockDemoAddress();
  const { signMessageAsync } = useSignMessage();
  const t = useTranslations();
  const [isSigning, setIsSigning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sign = useCallback(
    async (params: AddIncentiveParams) => {
      if (!effectiveAddress) {
        toast.error(t("errors.walletNotConnected"));
        return null;
      }
      setIsSigning(true);
      try {
        const message = buildIncentiveSignMessage(params);
        const signature = isMockMode()
          ? createMockSignature({ address: effectiveAddress, message })
          : await signMessageAsync({ message });
        return { signature, message };
      } catch (err) {
        console.error("Incentive sign error:", err);
        toast.error(t("errors.userRejected"));
        return null;
      } finally {
        setIsSigning(false);
      }
    },
    [effectiveAddress, signMessageAsync, t],
  );

  const submit = useCallback(
    async (
      params: AddIncentiveParams & { signature: string; message: string },
    ) => {
      if (!effectiveAddress) {
        toast.error(t("errors.walletNotConnected"));
        return null;
      }
      setIsSubmitting(true);
      try {
        const result = await portfolioApi.addVoteIncentive({
          walletAddress: effectiveAddress,
          poolAddress: params.poolAddress,
          tokenAddress: params.tokenAddress,
          tokenSymbol: params.tokenSymbol,
          tokenDecimals: params.tokenDecimals,
          amount: params.amountWei,
          amountUsd: params.amountUsd,
          epoch: params.epoch,
          signature: params.signature,
          message: params.message,
        });
        return result;
      } catch (err) {
        console.error("Incentive submit error:", err);
        const msg =
          err instanceof Error ? err.message : t("errors.transactionFailed");
        toast.error(msg);
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    [effectiveAddress, t],
  );

  return { sign, submit, isSigning, isSubmitting };
}
