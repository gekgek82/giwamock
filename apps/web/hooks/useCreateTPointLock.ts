import { useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { parseUnits } from "viem";
import { useTranslations } from "next-intl";
import { portfolioApi } from "@/lib/portfolioApi";
import {
  createMockSignature,
  getMockDemoAddress,
  isMockMode,
} from "@/lib/mockTransactions";
import toast from "react-hot-toast";

export function useCreateTPointLock() {
  const { address } = useAccount();
  const effectiveAddress = address ?? getMockDemoAddress();
  const { signMessageAsync } = useSignMessage();
  const t = useTranslations("toasts");
  const [isPending, setIsPending] = useState(false);

  const createLock = async (
    amount: string,
    durationDays: number
  ): Promise<number> => {
    if (!effectiveAddress) throw new Error("Wallet not connected");

    setIsPending(true);
    try {
      const amountWei = parseUnits(amount, 18).toString();
      const durationLabel = durationDays < 1
        ? `${Math.round(durationDays * 24)} hours`
        : `${Math.round(durationDays)} days`;
      const message = `Lock ${amount} tPOINT for ${durationLabel}`;
      const signature = isMockMode()
        ? createMockSignature({ address: effectiveAddress, message })
        : await signMessageAsync({ message });

      const result = await portfolioApi.createTPointLock(
        effectiveAddress,
        amountWei,
        durationDays,
        signature,
        message
      );

      toast.success(t("createTPointLockSuccess"));
      return result.id;
    } catch (error) {
      console.error("CreateTPointLock error:", error);
      const msg = error instanceof Error ? error.message : "Unknown error";
      if (msg.includes("User rejected") || msg.includes("user rejected")) {
        toast.error(t("signatureRejected"));
      } else if (msg.includes("Insufficient")) {
        toast.error(t("insufficientTPointBalance"));
      } else {
        toast.error(t("createTPointLockFailed"));
      }
      throw error;
    } finally {
      setIsPending(false);
    }
  };

  return {
    createLock,
    isPending,
  };
}
