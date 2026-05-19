'use client';

import { useState, useCallback } from 'react';
import { useAccount, useSendTransaction, usePublicClient } from 'wagmi';
import toast from 'react-hot-toast';
import { portfolioApi } from '@/lib/portfolioApi';
import { GIWASCAN_URL } from '@/lib/config';
import {
  getMockDemoAddress,
  isMockMode,
  simulateMockTransaction,
} from '@/lib/mockTransactions';
import type { ClaimableRewardsResponse, ClaimType } from '@/types/portfolio';

export type ClaimRewardsStatus = 'idle' | 'loading' | 'claiming' | 'success' | 'error';

export function useClaimRewards() {
  const { address } = useAccount();
  const effectiveAddress = address ?? getMockDemoAddress();
  const { sendTransactionAsync } = useSendTransaction();
  const publicClient = usePublicClient();

  const [status, setStatus] = useState<ClaimRewardsStatus>('idle');
  const [claimableRewards, setClaimableRewards] = useState<ClaimableRewardsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txHashes, setTxHashes] = useState<string[]>([]);

  const fetchClaimable = useCallback(async () => {
    if (!effectiveAddress) return;
    setStatus('loading');
    setError(null);

    try {
      const data = await portfolioApi.getClaimableRewards(effectiveAddress);
      setClaimableRewards(data);
      setStatus('idle');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch rewards';
      setError(message);
      setStatus('error');
    }
  }, [effectiveAddress]);

  const claimRewards = useCallback(async (claimType: ClaimType) => {
    if (!effectiveAddress) {
      toast.error('Please connect your wallet');
      return;
    }

    setStatus('claiming');
    setError(null);
    setTxHashes([]);

    try {
      const response = await portfolioApi.claimRewards(effectiveAddress, { claimType });

      if (!response.transactions || response.transactions.length === 0) {
        toast.error('No claimable rewards');
        setStatus('idle');
        return;
      }

      const hashes: string[] = [];

      for (const tx of response.transactions) {
        const hash = isMockMode()
          ? await simulateMockTransaction({
              label: `claim-rewards:${claimType}:${tx.to}:${tx.data}`,
            })
          : await sendTransactionAsync({
              to: tx.to as `0x${string}`,
              data: tx.data as `0x${string}`,
              value: BigInt(tx.value || '0'),
            });
        hashes.push(hash);

        // Wait for confirmation before sending next tx
        if (!isMockMode() && publicClient) {
          await publicClient.waitForTransactionReceipt({
            hash,
            confirmations: 1,
          });
        }
      }

      // Notify backend about transactions for immediate indexing
      for (const hash of hashes) {
        try {
          await portfolioApi.notifyTransaction(hash);
        } catch {
          // Non-critical
        }
      }

      setTxHashes(hashes);
      setStatus('success');

      if (hashes.length > 0) {
        toast.success(
          <div>
            Rewards claimed!{' '}
            <a
              href={`${GIWASCAN_URL}/tx/${hashes[0]}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              View on GiwaScan
            </a>
          </div>
        );
      }
    } catch (err) {
      console.error('Claim rewards error:', err);
      const message = err instanceof Error ? err.message : 'Claim failed';

      if (message.includes('User rejected') || message.includes('user rejected')) {
        toast.error('Transaction was rejected');
      } else {
        toast.error('Claim failed: ' + message.slice(0, 100));
      }

      setError(message);
      setStatus('error');
    }
  }, [effectiveAddress, sendTransactionAsync, publicClient]);

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
    setTxHashes([]);
    setClaimableRewards(null);
  }, []);

  return {
    status,
    claimableRewards,
    error,
    txHashes,
    fetchClaimable,
    claimRewards,
    reset,
  };
}
