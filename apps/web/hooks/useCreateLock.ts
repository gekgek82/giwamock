import { useWriteContract, usePublicClient } from "wagmi";
import { parseUnits } from "viem";
import { useTranslations } from "next-intl";
import { VotingEscrowAbi } from "@giwater/shared/abis";
import {
  useVotingEscrowAddress,
  useTerTokenAddress,
} from "@/hooks/useContractAddresses";
import { useTokenAllowance } from "@/hooks/useTokenAllowance";
import { useTokenApprove } from "@/hooks/useTokenApprove";
import { portfolioApi } from "@/lib/portfolioApi";
import { isMockMode, simulateMockTransaction } from "@/lib/mockTransactions";
import toast from "react-hot-toast";

export function useCreateLock() {
  const t = useTranslations("toasts");
  const veAddress = useVotingEscrowAddress();
  const terAddress = useTerTokenAddress();
  const {
    allowance,
    refetch: refetchAllowance,
  } = useTokenAllowance(terAddress, veAddress);
  const { approve, isPending: isApproving } = useTokenApprove();
  const { writeContractAsync, isPending: isLocking } = useWriteContract();
  const publicClient = usePublicClient();

  const needsApproval = (amount: bigint): boolean => {
    if (!allowance) return true;
    return allowance < amount;
  };

  const approveToken = async (amount: bigint): Promise<string> => {
    if (!terAddress || !veAddress)
      throw new Error("Contract addresses not loaded");
    const txHash = await approve(terAddress, veAddress, amount);
    await refetchAllowance();
    return txHash;
  };

  const createLock = async (
    amount: string,
    durationDays: number
  ): Promise<string> => {
    if (!veAddress) throw new Error("VotingEscrow address not loaded");

    const amountWei = parseUnits(amount, 18);
    const durationSeconds = BigInt(durationDays * 24 * 60 * 60);

    try {
      if (isMockMode()) {
        const txHash = await simulateMockTransaction({
          label: `create-lock:${amountWei.toString()}:${durationSeconds.toString()}`,
        });
        await portfolioApi.notifyTransaction(txHash).catch(() => undefined);
        return txHash;
      }

      const txHash = await writeContractAsync({
        address: veAddress,
        abi: VotingEscrowAbi as any,
        functionName: "createLock",
        args: [amountWei, durationSeconds],
      });

      if (publicClient && txHash) {
        await publicClient.waitForTransactionReceipt({
          hash: txHash,
          confirmations: 1,
        });

        // Notify backend for immediate indexing
        try {
          await portfolioApi.notifyTransaction(txHash);
        } catch {
          // Non-critical - indexer will pick it up eventually
        }
      }

      return txHash;
    } catch (error) {
      console.error("CreateLock error:", error);
      const message =
        error instanceof Error ? error.message : "Unknown error";
      if (message.includes("User rejected") || message.includes("user rejected")) {
        toast.error(t("transactionRejected"));
      } else if (message.includes("insufficient")) {
        toast.error(t("insufficientBalance"));
      } else {
        toast.error(t("createLockFailed"));
      }
      throw error;
    }
  };

  return {
    needsApproval,
    approveToken,
    createLock,
    isApproving,
    isLocking,
    isPending: isApproving || isLocking,
  };
}
