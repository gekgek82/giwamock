'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

const STORAGE_KEY = 'gw_ref_code';

export function useReferralCapture() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref && ref.trim()) {
      sessionStorage.setItem(STORAGE_KEY, ref.trim().toUpperCase());
    }
  }, [searchParams]);
}

export function getPendingReferralCode(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(STORAGE_KEY);
}

export function clearPendingReferralCode(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(STORAGE_KEY);
}

const CLAIMED_KEY = 'gw_ref_claimed';

export function hasClaimedReferral(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(CLAIMED_KEY) === '1';
}

export function markReferralClaimed(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CLAIMED_KEY, '1');
  clearPendingReferralCode();
}
