"use client";

import { useMemo } from "react";
import { parseUnits } from "viem";
import { PERMIT2_ADDRESS, UNIVERSAL_ROUTER_ADDRESS } from "@giwater/shared/constants";
import { usePermit2Allowance, usePermit2Nonce } from "./usePermit2";

const MAX_UINT160 = BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF");

/**
 * Check Permit2 approval status for a token relative to the UniversalRouter.
 * Returns whether ERC20→Permit2 and Permit2→Router approvals are needed.
 */
export function usePermit2ApprovalStatus(
  tokenAddress: `0x${string}` | undefined,
  amount: string,
) {
  const permit2Address = PERMIT2_ADDRESS as `0x${string}`;
  const routerAddress = UNIVERSAL_ROUTER_ADDRESS as `0x${string}`;

  // 1. ERC20 allowance to Permit2
  const {
    allowance: erc20Allowance,
    isLoading: isErc20Loading,
    refetch: refetchErc20,
  } = usePermit2Allowance(tokenAddress, permit2Address);

  // 2. Permit2 sub-allowance to Router
  const {
    permit2SubAllowance,
    permit2Expiration,
    isLoading: isSubAllowanceLoading,
    refetch: refetchSubAllowance,
  } = usePermit2Nonce(permit2Address, tokenAddress, routerAddress);

  const needsErc20Approval = useMemo(() => {
    if (!amount || erc20Allowance === undefined) return false;
    try {
      const amountParsed = parseUnits(amount, 18);
      return erc20Allowance < amountParsed;
    } catch {
      return false;
    }
  }, [amount, erc20Allowance]);

  const needsPermit2Approval = useMemo(() => {
    if (!amount || permit2SubAllowance === undefined) return false;
    try {
      const amountParsed = parseUnits(amount, 18);
      // Also check expiration
      const now = Math.floor(Date.now() / 1000);
      const isExpired =
        permit2Expiration !== undefined && permit2Expiration < now;
      return permit2SubAllowance < amountParsed || isExpired;
    } catch {
      return false;
    }
  }, [amount, permit2SubAllowance, permit2Expiration]);

  const refetch = async () => {
    await Promise.all([refetchErc20(), refetchSubAllowance()]);
  };

  return {
    needsErc20Approval,
    needsPermit2Approval,
    needsAnyApproval: needsErc20Approval || needsPermit2Approval,
    isLoading: isErc20Loading || isSubAllowanceLoading,
    refetch,
    permit2Address,
    routerAddress,
    MAX_UINT160,
  };
}
