import { useWriteContract, usePublicClient } from "wagmi";
import { useTranslations } from "next-intl";
import { ERC20Abi as ERC20_ABI } from "@giwater/shared/abis";
import { GIWA_SEPOLIA_CHAIN_ID } from "@/lib/config";
import { isMockMode, simulateMockTransaction } from "@/lib/mockTransactions";
import toast from "react-hot-toast";

function getErrorMessage(
  error: unknown,
  t: ReturnType<typeof useTranslations>,
): string {
  if (!error) return t("unknownError");

  const errorMessage = error instanceof Error ? error.message : String(error);

  if (
    errorMessage.includes("rate limit") ||
    errorMessage.includes("Request is being rate limited")
  ) {
    return t("rateLimitError");
  }

  if (
    errorMessage.includes("User rejected") ||
    errorMessage.includes("user rejected")
  ) {
    return t("userRejected");
  }

  if (errorMessage.includes("insufficient funds")) {
    return t("insufficientFunds");
  }

  if (errorMessage.includes("execution reverted") || errorMessage.includes("reverted with")) {
    const reason = errorMessage.match(
      /(?:reverted with the following reason:\s*|reverted(?:\s*with)?\s*(?:reason\s*)?:\s*)(.+?)(?:\n|$)/i
    )?.[1]?.trim();
    if (reason && reason.length < 200) return reason;
    return t("executionReverted");
  }

  if (errorMessage.includes("network") || errorMessage.includes("fetch")) {
    return t("networkError");
  }

  return t("transactionFailedPrefix") + errorMessage.slice(0, 100);
}

export function useTokenApprove() {
  const { writeContractAsync, isPending } = useWriteContract();
  const publicClient = usePublicClient();
  const t = useTranslations("errors");

  const approve = async (
    tokenAddress: `0x${string}`,
    spenderAddress: `0x${string}`,
    amount: bigint
  ) => {
    try {
      if (isMockMode()) {
        return await simulateMockTransaction({
          label: `approve:${tokenAddress}:${spenderAddress}:${amount.toString()}`,
        });
      }

      const txHash = await writeContractAsync({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [spenderAddress, amount],
        chainId: GIWA_SEPOLIA_CHAIN_ID,
      });

      if (publicClient && txHash) {
        await publicClient.waitForTransactionReceipt({
          hash: txHash,
          confirmations: 1,
        });
      }

      return txHash;
    } catch (error) {
      console.error("Approve error:", error);
      toast.error(getErrorMessage(error, t));
      throw error;
    }
  };

  return {
    approve,
    isPending,
  };
}
