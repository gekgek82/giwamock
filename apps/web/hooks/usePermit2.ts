"use client";

import { useMemo } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { parseUnits } from "viem";
import {
  usePermit2DataSource,
  useTokenDataSource,
} from "@/lib/datasources/context";
import { GIWA_SEPOLIA_CHAIN_ID } from "@/lib/config";
import { isMockToken } from "@/lib/mocks";

// ============================================================================
// Constants
// ============================================================================

const MAX_UINT160 = BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF");
const MAX_UINT256 = BigInt(
  "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF",
);

// EIP-712 types for PermitSingle
const PERMIT_TYPES = {
  PermitSingle: [
    { name: "details", type: "PermitDetails" },
    { name: "spender", type: "address" },
    { name: "sigDeadline", type: "uint256" },
  ],
  PermitDetails: [
    { name: "token", type: "address" },
    { name: "amount", type: "uint160" },
    { name: "expiration", type: "uint48" },
    { name: "nonce", type: "uint48" },
  ],
} as const;

// ============================================================================
// Types
// ============================================================================

export interface PermitSingle {
  details: {
    token: `0x${string}`;
    amount: bigint;
    expiration: number;
    nonce: number;
  };
  spender: `0x${string}`;
  sigDeadline: bigint;
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Check if a token has been approved to Permit2 (ERC20 allowance).
 * This is the one-time approval per token.
 */
export function usePermit2Allowance(
  tokenAddress: `0x${string}` | undefined,
  permit2Address: `0x${string}` | undefined,
) {
  const { address } = useAccount();
  const token = useTokenDataSource();

  const { data, isLoading, refetch } = useQuery({
    queryKey: [
      "token",
      "allowance",
      tokenAddress,
      address,
      permit2Address,
    ],
    queryFn: () =>
      token!.getAllowance(tokenAddress!, address!, permit2Address!),
    enabled: !!token && !!address && !!tokenAddress && !!permit2Address,
  });

  // Design-preview: skip the ERC20→Permit2 approval step for mock tokens so
  // the deposit flow can reach the deposit submit panel without trying to
  // sign an `approve(...)` against an address that doesn't exist on chain.
  if (isMockToken(tokenAddress)) {
    return {
      allowance: MAX_UINT256,
      isLoading: false,
      refetch,
      needsApproval: false,
    };
  }

  return {
    allowance: data,
    isLoading,
    refetch,
    needsApproval: data !== undefined && data === 0n,
  };
}

/**
 * Get Permit2 sub-allowance nonce for a token/spender pair.
 * Used to build the PermitSingle for EIP-712 signing.
 */
export function usePermit2Nonce(
  permit2Address: `0x${string}` | undefined,
  tokenAddress: `0x${string}` | undefined,
  spenderAddress: `0x${string}` | undefined,
) {
  const { address } = useAccount();
  const permit2 = usePermit2DataSource();

  const { data, isLoading, refetch } = useQuery({
    queryKey: [
      "permit2",
      "allowance",
      permit2Address,
      tokenAddress,
      address,
      spenderAddress,
    ],
    queryFn: () =>
      permit2!.getAllowance(
        permit2Address!,
        tokenAddress!,
        address!,
        spenderAddress!,
      ),
    enabled:
      !!permit2 &&
      !!address &&
      !!permit2Address &&
      !!tokenAddress &&
      !!spenderAddress,
  });

  // Design-preview: report mock tokens as already-permitted (max amount,
  // far-future expiration) so `usePermit2ApprovalStatus` short-circuits both
  // the ERC20 and the Permit2 approval rows of the modal.
  if (isMockToken(tokenAddress)) {
    return {
      permit2SubAllowance: MAX_UINT160,
      // Roughly +10 years — well past any deposit deadline check.
      permit2Expiration: Math.floor(Date.now() / 1000) + 10 * 365 * 86400,
      nonce: 0,
      isLoading: false,
      refetch,
    };
  }

  return {
    permit2SubAllowance: data?.amount,
    permit2Expiration: data?.expiration,
    nonce: data?.nonce ?? 0,
    isLoading,
    refetch,
  };
}

/**
 * Build a PermitSingle object for EIP-712 signing.
 */
export function buildPermitSingle(
  tokenAddress: `0x${string}`,
  spenderAddress: `0x${string}`,
  nonce: number,
  deadlineSeconds: number = 1200,
): PermitSingle {
  const now = Math.floor(Date.now() / 1000);
  return {
    details: {
      token: tokenAddress,
      amount: MAX_UINT160,
      expiration: now + 86400, // 1 day
      nonce,
    },
    spender: spenderAddress,
    sigDeadline: BigInt(now + deadlineSeconds),
  };
}

/**
 * Hook to sign a PermitSingle via EIP-712.
 * Returns a function that takes a PermitSingle and returns the signature.
 */
export function usePermit2Sign() {
  const { data: walletClient } = useWalletClient();

  const signPermit = async (
    permit2Address: `0x${string}`,
    permitSingle: PermitSingle,
  ): Promise<`0x${string}`> => {
    if (!walletClient) throw new Error("Wallet not connected");

    const signature = await walletClient.signTypedData({
      domain: {
        name: "Permit2",
        chainId: GIWA_SEPOLIA_CHAIN_ID,
        verifyingContract: permit2Address,
      },
      types: PERMIT_TYPES,
      primaryType: "PermitSingle",
      message: {
        details: {
          token: permitSingle.details.token,
          amount: permitSingle.details.amount,
          expiration: permitSingle.details.expiration,
          nonce: permitSingle.details.nonce,
        },
        spender: permitSingle.spender,
        sigDeadline: permitSingle.sigDeadline,
      },
    });

    return signature;
  };

  return { signPermit };
}

/**
 * Combined hook: checks if fromToken needs Permit2 approval,
 * and provides the amountIn-based approval check.
 */
export function usePermit2ApprovalCheck(
  tokenAddress: `0x${string}` | undefined,
  permit2Address: `0x${string}` | undefined,
  amountIn: string,
) {
  const { allowance, isLoading, refetch, needsApproval } =
    usePermit2Allowance(tokenAddress, permit2Address);

  const needsApprovalForAmount = useMemo(() => {
    if (!amountIn || allowance === undefined) return false;
    try {
      const amountParsed = parseUnits(amountIn, 18);
      return allowance < amountParsed;
    } catch {
      return false;
    }
  }, [amountIn, allowance]);

  return {
    allowance,
    isLoading,
    refetch,
    needsApproval: needsApproval || needsApprovalForAmount,
  };
}
