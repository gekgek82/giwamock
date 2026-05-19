import { useWriteContract, usePublicClient } from "wagmi";
import { useTranslations } from "next-intl";
import { VoterAbi } from "@giwater/shared/abis";
import { useVoterAddress } from "@/hooks/useContractAddresses";
import { portfolioApi } from "@/lib/portfolioApi";
import { isMockMode, simulateMockTransaction } from "@/lib/mockTransactions";
import toast from "react-hot-toast";

export function useVote() {
  const voterAddress = useVoterAddress();
  const { writeContractAsync, isPending } = useWriteContract();
  const publicClient = usePublicClient();
  const t = useTranslations("toasts");

  const vote = async (
    tokenId: bigint,
    poolAddresses: `0x${string}`[],
    weights: bigint[]
  ): Promise<string> => {
    if (!voterAddress) throw new Error("Voter address not loaded");

    try {
      if (isMockMode()) {
        const txHash = await simulateMockTransaction({
          label: `vote:${tokenId.toString()}:${poolAddresses.join(",")}:${weights.join(",")}`,
        });
        await portfolioApi.notifyTransaction(txHash).catch(() => undefined);
        return txHash;
      }

      const txHash = await writeContractAsync({
        address: voterAddress,
        abi: VoterAbi as any,
        functionName: "vote",
        args: [tokenId, poolAddresses, weights],
      });

      if (publicClient && txHash) {
        await publicClient.waitForTransactionReceipt({
          hash: txHash,
          confirmations: 1,
        });

        try {
          await portfolioApi.notifyTransaction(txHash);
        } catch {
          // Non-critical
        }
      }

      return txHash;
    } catch (error) {
      console.error("Vote error:", error);
      const message =
        error instanceof Error ? error.message : "Unknown error";
      if (message.includes("User rejected") || message.includes("user rejected")) {
        toast.error(t("transactionRejected"));
      } else {
        toast.error(t("voteFailed"));
      }
      throw error;
    }
  };

  const reset = async (tokenId: bigint): Promise<string> => {
    if (!voterAddress) throw new Error("Voter address not loaded");

    try {
      if (isMockMode()) {
        return await simulateMockTransaction({
          label: `vote-reset:${tokenId.toString()}`,
        });
      }

      const txHash = await writeContractAsync({
        address: voterAddress,
        abi: VoterAbi as any,
        functionName: "reset",
        args: [tokenId],
      });

      if (publicClient && txHash) {
        await publicClient.waitForTransactionReceipt({
          hash: txHash,
          confirmations: 1,
        });
      }

      return txHash;
    } catch (error) {
      console.error("Reset vote error:", error);
      toast.error(t("voteResetFailed"));
      throw error;
    }
  };

  const poke = async (tokenId: bigint): Promise<string> => {
    if (!voterAddress) throw new Error("Voter address not loaded");

    try {
      if (isMockMode()) {
        const txHash = await simulateMockTransaction({
          label: `vote-poke:${tokenId.toString()}`,
        });
        await portfolioApi.notifyTransaction(txHash).catch(() => undefined);
        return txHash;
      }

      const txHash = await writeContractAsync({
        address: voterAddress,
        abi: VoterAbi as any,
        functionName: "poke",
        args: [tokenId],
      });

      if (publicClient && txHash) {
        await publicClient.waitForTransactionReceipt({
          hash: txHash,
          confirmations: 1,
        });

        try {
          await portfolioApi.notifyTransaction(txHash);
        } catch {
          // Non-critical
        }
      }

      return txHash;
    } catch (error) {
      console.error("Poke error:", error);
      const message =
        error instanceof Error ? error.message : "Unknown error";
      if (message.includes("User rejected") || message.includes("user rejected")) {
        toast.error(t("transactionRejected"));
      } else {
        toast.error(t("pokeTxFailed"));
      }
      throw error;
    }
  };

  return { vote, reset, poke, isPending };
}
