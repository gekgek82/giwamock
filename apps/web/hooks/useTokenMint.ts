'use client';

import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';
import { useTranslations } from 'next-intl';
import toast from 'react-hot-toast';

function getErrorMessage(
  error: unknown,
  t: ReturnType<typeof useTranslations>,
): string {
  if (!error) return t("unknownError");

  const errorMessage = error instanceof Error ? error.message : String(error);

  if (errorMessage.includes("rate limit") || errorMessage.includes("Request is being rate limited")) {
    return t("rateLimitError");
  }

  if (errorMessage.includes("User rejected") || errorMessage.includes("user rejected")) {
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

const MINT_ABI = [
  {
    inputs: [
      {
        internalType: 'address',
        name: 'to',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: 'amount',
        type: 'uint256',
      },
    ],
    name: 'mint',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

export function useTokenMint() {
  const t = useTranslations("errors");
  const {
    data: hash,
    writeContract,
    isPending: isWritePending,
    error: writeError
  } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed
  } = useWaitForTransactionReceipt({
    hash,
  });

  const mint = async (tokenAddress: `0x${string}`, to: `0x${string}`, amount: string) => {
    try {
      const amountInWei = parseUnits(amount, 18);

      writeContract({
        address: tokenAddress,
        abi: MINT_ABI,
        functionName: 'mint',
        args: [to, amountInWei],
      });
    } catch (error) {
      console.error('Mint error:', error);
      toast.error(getErrorMessage(error, t));
      throw error;
    }
  };

  return {
    mint,
    isPending: isWritePending,
    isConfirming,
    isConfirmed,
    hash,
    error: writeError,
  };
}
