'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { GIWASCAN_URL } from '@/lib/config';
import { Button, IconButton } from '@/components/common/Button';
import type { ClaimRewardsStatus } from '@/hooks/useClaimRewards';
import type { ClaimableRewardsResponse } from '@/types/portfolio';

interface ClaimRewardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: ClaimRewardsStatus;
  claimableRewards: ClaimableRewardsResponse | null;
  txHashes: string[];
  error: string | null;
  onFetchClaimable: () => void;
  onClaim: () => void;
  onReset: () => void;
}

export function ClaimRewardsModal({
  isOpen,
  onClose,
  status,
  claimableRewards,
  txHashes,
  error,
  onFetchClaimable,
  onClaim,
  onReset,
}: ClaimRewardsModalProps) {
  const t = useTranslations();

  // Fetch claimable rewards when modal opens
  useEffect(() => {
    if (isOpen) {
      onFetchClaimable();
    }
  }, [isOpen, onFetchClaimable]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      onReset();
    }
  }, [isOpen, onReset]);

  if (!isOpen) return null;

  const handleClose = () => {
    if (status === 'claiming') return; // Prevent closing during claim
    onClose();
  };

  const hasRewards =
    claimableRewards &&
    (claimableRewards.bribes.length > 0 ||
      claimableRewards.fees.length > 0 ||
      (claimableRewards.rebase && parseFloat(claimableRewards.rebase.amount) > 0));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-[24px] w-full max-w-[480px] mx-4 p-6 shadow-xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-neutral-1000">
            {t('portfolio.claimRewards')}
          </h3>
          {status !== 'claiming' && (
            <IconButton onClick={handleClose}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M12 4L4 12M4 4l8 8"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </IconButton>
          )}
        </div>

        {/* Content based on status */}
        {status === 'loading' && (
          <LoadingView message={t('portfolio.loadingRewards')} />
        )}

        {status === 'idle' && claimableRewards && (
          hasRewards ? (
            <RewardsPreviewView
              rewards={claimableRewards}
              onClaim={onClaim}
              t={t}
            />
          ) : (
            <EmptyView onClose={handleClose} t={t} />
          )
        )}

        {status === 'claiming' && (
          <LoadingView message={t('portfolio.claimingRewards')} />
        )}

        {status === 'success' && (
          <SuccessView
            txHashes={txHashes}
            onClose={handleClose}
            t={t}
          />
        )}

        {status === 'error' && (
          <ErrorView
            onRetry={() => {
              onReset();
              onFetchClaimable();
            }}
            onClose={handleClose}
            t={t}
          />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Sub-views
// ============================================================================

function LoadingView({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-700 rounded-full animate-spin" />
      <p className="text-neutral-700 body-14 text-center">{message}</p>
    </div>
  );
}

function formatAmount(amount: string, maxDecimals = 6): string {
  const num = parseFloat(amount);
  if (isNaN(num) || num === 0) return '0';
  return num.toLocaleString(undefined, { maximumFractionDigits: maxDecimals });
}

function formatUsd(amount: string): string {
  const num = parseFloat(amount);
  if (isNaN(num) || num === 0) return '$0.00';
  return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function RewardsPreviewView({
  rewards,
  onClaim,
  t,
}: {
  rewards: ClaimableRewardsResponse;
  onClaim: () => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  return (
    <div className="flex flex-col gap-4 overflow-y-auto">
      {/* Bribe Rewards */}
      {rewards.bribes.length > 0 && (
        <RewardSection title={t('portfolio.bribeRewards')}>
          {rewards.bribes.map((reward, i) => (
            <RewardRow
              key={`bribe-${i}`}
              poolName={reward.poolName}
              tokenSymbol={reward.tokenSymbol}
              amount={reward.amount}
              amountUsd={reward.amountUsd}
            />
          ))}
        </RewardSection>
      )}

      {/* Fee Rewards */}
      {rewards.fees.length > 0 && (
        <RewardSection title={t('portfolio.feeRewards')}>
          {rewards.fees.map((reward, i) => (
            <RewardRow
              key={`fee-${i}`}
              poolName={reward.poolName}
              tokenSymbol={reward.tokenSymbol}
              amount={reward.amount}
              amountUsd={reward.amountUsd}
            />
          ))}
        </RewardSection>
      )}

      {/* Rebase Rewards */}
      {rewards.rebase && parseFloat(rewards.rebase.amount) > 0 && (
        <RewardSection title={t('portfolio.rebaseRewards')}>
          <div className="flex items-center justify-between py-2">
            <span className="text-neutral-700 body-14">Rebase</span>
            <div className="text-right">
              <span className="text-neutral-1000 body-14-bold">
                {formatAmount(rewards.rebase.amount)}
              </span>
              <span className="text-neutral-500 body-12 ml-2">
                {formatUsd(rewards.rebase.amountUsd)}
              </span>
            </div>
          </div>
        </RewardSection>
      )}

      {/* Total */}
      <div className="border-t border-neutral-200 pt-4">
        <div className="flex items-center justify-between">
          <span className="text-neutral-1000 text-base font-bold">
            {t('portfolio.totalClaimable')}
          </span>
          <span className="text-primary-700 text-xl font-bold">
            {formatUsd(rewards.totalUsd)}
          </span>
        </div>
      </div>

      {/* Claim Button */}
      <Button variant="primary" size="md" fullWidth onClick={onClaim}>
        {t('portfolio.claimAll')}
      </Button>
    </div>
  );
}

function RewardSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <h4 className="text-neutral-1000 body-14-bold mb-1">{title}</h4>
      <div className="bg-neutral-50 rounded-[12px] px-4 py-1 flex flex-col divide-y divide-neutral-200">
        {children}
      </div>
    </div>
  );
}

function RewardRow({
  poolName,
  tokenSymbol,
  amount,
  amountUsd,
}: {
  poolName: string;
  tokenSymbol: string;
  amount: string;
  amountUsd: string;
}) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <div className="flex flex-col">
        <span className="text-neutral-1000 body-14">{poolName}</span>
        <span className="text-neutral-500 body-12">{tokenSymbol}</span>
      </div>
      <div className="text-right">
        <span className="text-neutral-1000 body-14-bold">
          {formatAmount(amount)}
        </span>
        <span className="text-neutral-500 body-12 ml-2">
          {formatUsd(amountUsd)}
        </span>
      </div>
    </div>
  );
}

function EmptyView({
  onClose,
  t,
}: {
  onClose: () => void;
  t: (key: string) => string;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <div className="w-12 h-12 bg-neutral-100 rounded-full flex items-center justify-center">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#9ca3af"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="8" y1="12" x2="16" y2="12" />
        </svg>
      </div>
      <p className="text-neutral-700 body-14 text-center">
        {t('portfolio.noClaimableRewards')}
      </p>
      <Button variant="secondary" size="md" fullWidth onClick={onClose}>
        {t('common.close')}
      </Button>
    </div>
  );
}

function SuccessView({
  txHashes,
  onClose,
  t,
}: {
  txHashes: string[];
  onClose: () => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-4">
      {/* Check icon */}
      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#22c55e"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <div className="text-center">
        <p className="text-neutral-1000 body-16-bold">
          {t('portfolio.claimRewardsSuccess')}
        </p>
        <p className="text-neutral-500 body-14 mt-1">
          {t('portfolio.transactionsSent', { count: txHashes.length })}
        </p>
      </div>
      {txHashes.length > 0 && (
        <div className="flex flex-col gap-1">
          {txHashes.map((hash, i) => (
            <a
              key={hash}
              href={`${GIWASCAN_URL}/tx/${hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-700 body-14 underline"
            >
              {txHashes.length > 1 ? `Tx ${i + 1}` : 'GiwaScan'}
            </a>
          ))}
        </div>
      )}
      <Button variant="secondary" size="md" fullWidth onClick={onClose} className="mt-2">
        {t('common.close')}
      </Button>
    </div>
  );
}

function ErrorView({
  onRetry,
  onClose,
  t,
}: {
  onRetry: () => void;
  onClose: () => void;
  t: (key: string) => string;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-4">
      {/* Error icon */}
      <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#ef4444"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </div>
      <p className="text-neutral-700 body-14 text-center">
        {t('portfolio.claimRewardsFailed')}
      </p>
      <div className="flex gap-3 w-full">
        <Button variant="neutral" size="md" className="flex-1" onClick={onClose}>
          {t('common.close')}
        </Button>
        <Button variant="primary" size="md" className="flex-1" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      </div>
    </div>
  );
}
