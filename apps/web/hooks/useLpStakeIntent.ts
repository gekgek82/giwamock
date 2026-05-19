import { useCallback, useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { portfolioApi } from "@/lib/portfolioApi";

/**
 * Pre-TGE LP staking intent for a (wallet, pool, tokenId) triple.
 *
 * Reads the user's declared staking amount as an absolute value (wei for
 * basic pools, liquidity units for CL). Absolute-amount semantics mean the
 * user's committed stake doesn't drift when their underlying balance
 * changes — if you stake 50 out of 100 and then withdraw 20 of the
 * unstaked portion, you still have 50 staked out of the remaining 80.
 *
 * Pass `tokenId` for CL positions so each NFT's stake is tracked
 * independently; omit (or pass undefined) for basic pools.
 *
 * Both the stake page (to know how much is already staked) and the
 * withdraw page (to cap withdrawals at the unstaked portion) read from
 * the same source.
 */
export function useLpStakeIntent(poolAddress?: string, tokenId?: string) {
  const { address } = useAccount();
  const [stakedAmountRaw, setStakedAmountRaw] = useState<bigint>(0n);
  const [isLoading, setIsLoading] = useState(true);
  const [version, setVersion] = useState(0);

  const refetch = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (!address || !poolAddress) {
      setStakedAmountRaw(0n);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    const normalizedTokenId = tokenId ?? "";
    portfolioApi
      .getLpStakeIntents(address)
      .then(({ intents }) => {
        if (cancelled) return;
        const match = intents.find(
          (i) =>
            i.poolAddress.toLowerCase() === poolAddress.toLowerCase() &&
            (i.tokenId ?? "") === normalizedTokenId &&
            i.isActive,
        );
        try {
          setStakedAmountRaw(match ? BigInt(match.stakedAmount) : 0n);
        } catch {
          setStakedAmountRaw(0n);
        }
      })
      .catch(() => {
        if (!cancelled) setStakedAmountRaw(0n);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [address, poolAddress, tokenId, version]);

  return {
    stakedAmountRaw,
    isLoading,
    refetch,
  };
}
