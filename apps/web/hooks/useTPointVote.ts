import { useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { useTranslations } from "next-intl";
import { portfolioApi } from "@/lib/portfolioApi";
import {
  createMockSignature,
  getMockDemoAddress,
  isMockMode,
} from "@/lib/mockTransactions";
import toast from "react-hot-toast";

export function useTPointVote() {
  const { address } = useAccount();
  const effectiveAddress = address ?? getMockDemoAddress();
  const { signMessageAsync } = useSignMessage();
  const t = useTranslations("toasts");
  const [isPending, setIsPending] = useState(false);

  const vote = async (
    lockId: number,
    poolAddresses: string[],
    percentages: number[]
  ): Promise<void> => {
    if (!effectiveAddress) throw new Error("Wallet not connected");

    setIsPending(true);
    try {
      for (let i = 0; i < poolAddresses.length; i++) {
        const message = `Vote lock #${lockId} for pool ${poolAddresses[i]} at ${percentages[i]}%`;
        const signature = isMockMode()
          ? createMockSignature({ address: effectiveAddress, message })
          : await signMessageAsync({ message });

        await portfolioApi.tpointVote(
          effectiveAddress,
          lockId,
          poolAddresses[i],
          percentages[i],
          signature,
          message
        );
      }
      toast.success(t("voteSuccess"));
    } catch (error) {
      console.error("TPointVote error:", error);
      const msg = error instanceof Error ? error.message : "Unknown error";
      if (msg.includes("User rejected") || msg.includes("user rejected")) {
        toast.error(t("signatureRejected"));
      } else {
        toast.error(t("voteFailed"));
      }
      throw error;
    } finally {
      setIsPending(false);
    }
  };

  const reset = async (lockId: number): Promise<void> => {
    if (!effectiveAddress) throw new Error("Wallet not connected");

    setIsPending(true);
    try {
      const message = `Reset votes for lock #${lockId}`;
      const signature = isMockMode()
        ? createMockSignature({ address: effectiveAddress, message })
        : await signMessageAsync({ message });

      await portfolioApi.resetTPointVotes(
        effectiveAddress,
        lockId,
        signature,
        message
      );
      toast.success(t("voteResetSuccess"));
    } catch (error) {
      console.error("ResetTPointVote error:", error);
      toast.error(t("voteResetFailed"));
      throw error;
    } finally {
      setIsPending(false);
    }
  };

  return { vote, reset, isPending };
}
