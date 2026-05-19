"use client";

import { useEffect, useState, useCallback } from "react";
import { useAccount } from "wagmi";
import { Button } from "@/components/common/Button";
import { referralApi } from "@/lib/gatewayBrokerApi";
import {
  getPendingReferralCode,
  hasClaimedReferral,
  markReferralClaimed,
} from "@/hooks/useReferralCapture";
import type { ReferralCodeResponse } from "@giwater/shared";

function CopyIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="inline-block"
    >
      <rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M3 11H2.5A1.5 1.5 0 0 1 1 9.5v-7A1.5 1.5 0 0 1 2.5 1h7A1.5 1.5 0 0 1 11 2.5V3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="inline-block"
    >
      <path
        d="M3 8l4 4 6-6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function useCopy(text: string) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }, [text]);

  return { copied, copy };
}

const HOW_IT_WORKS = [
  {
    step: "1",
    title: "Share Your Code",
    desc: "Copy your unique referral link and share it with friends.",
  },
  {
    step: "2",
    title: "Friend Signs Up",
    desc: "Your friend connects their wallet using your referral link.",
  },
  {
    step: "3",
    title: "Earn Together",
    desc: "Both of you earn referral points on every trade your friend makes.",
  },
];

export function PromotionContent() {
  const { address, isConnected } = useAccount();

  const [codeData, setCodeData] = useState<ReferralCodeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [claimStatus, setClaimStatus] = useState<"idle" | "claiming" | "done" | "error">("idle");
  const [claimError, setClaimError] = useState<string | null>(null);

  const inviteUrl = codeData
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/promotion?ref=${codeData.code}`
    : "";

  const { copied: codeCopied, copy: copyCode } = useCopy(codeData?.code ?? "");
  const { copied: urlCopied, copy: copyUrl } = useCopy(inviteUrl);

  useEffect(() => {
    if (!isConnected || !address) {
      setCodeData(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    referralApi
      .getCode(address)
      .then((data) => {
        if (!cancelled) setCodeData(data);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load your referral code. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [address, isConnected]);

  // Auto-claim pending referral after wallet connect
  useEffect(() => {
    if (!isConnected || !address) return;
    if (hasClaimedReferral()) return;

    const pendingCode = getPendingReferralCode();
    if (!pendingCode) return;

    setClaimStatus("claiming");
    referralApi
      .claim({ refereeAddress: address, referralCode: pendingCode })
      .then((res) => {
        if (res.success || res.alreadyClaimed) {
          markReferralClaimed();
          setClaimStatus("done");
        } else {
          setClaimStatus("error");
          setClaimError("Could not apply referral code.");
        }
      })
      .catch(() => {
        setClaimStatus("error");
        setClaimError("Could not apply referral code.");
      });
  }, [address, isConnected]);

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
        <div className="text-4xl">🔗</div>
        <p className="body-16 text-gray-70 max-w-xs">
          Connect your wallet to view your referral code and invite friends.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Pending referral claim notice */}
      {claimStatus === "done" && (
        <div className="rounded-xl bg-green-50 border border-brand-green px-4 py-3 body-14 text-green-700">
          Referral code applied! Welcome bonus points are on their way.
        </div>
      )}
      {claimStatus === "error" && claimError && (
        <div className="rounded-xl bg-red-50 border border-red-300 px-4 py-3 body-14 text-red-700">
          {claimError}
        </div>
      )}

      {/* Hero card */}
      <div className="rounded-2xl bg-gradient-to-br from-[#0a1628] to-[#0d1f3c] border border-white/10 p-6 sm:p-8 flex flex-col gap-6">
        <div>
          <h2 className="heading-20 text-white mb-1">Your Referral Code</h2>
          <p className="body-14 text-gray-400">
            Share this code with friends to earn referral points together.
          </p>
        </div>

        {/* Code box */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex-1 rounded-xl bg-white/5 border border-white/10 px-5 py-4 flex items-center justify-center sm:justify-start">
            {loading ? (
              <span className="body-16 text-gray-400 animate-pulse">Loading...</span>
            ) : error ? (
              <span className="body-14 text-red-400">{error}</span>
            ) : (
              <span className="font-mono text-2xl font-bold tracking-widest text-brand-green">
                {codeData?.code ?? "—"}
              </span>
            )}
          </div>
          <Button
            variant="secondary"
            size="md"
            disabled={!codeData}
            onClick={copyCode}
            className="flex items-center gap-2 whitespace-nowrap"
          >
            {codeCopied ? <CheckIcon /> : <CopyIcon />}
            {codeCopied ? "Copied!" : "Copy Code"}
          </Button>
        </div>

        {/* Invite URL box */}
        <div className="flex flex-col gap-2">
          <span className="body-12 text-gray-400 uppercase tracking-wide">Invite Link</span>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex-1 rounded-xl bg-white/5 border border-white/10 px-4 py-3 overflow-hidden">
              {loading ? (
                <span className="body-14 text-gray-400 animate-pulse">Loading...</span>
              ) : (
                <span className="body-14 text-gray-300 truncate block">{inviteUrl || "—"}</span>
              )}
            </div>
            <Button
              variant="primary"
              size="md"
              disabled={!codeData}
              onClick={copyUrl}
              className="flex items-center gap-2 whitespace-nowrap"
            >
              {urlCopied ? <CheckIcon /> : <CopyIcon />}
              {urlCopied ? "Copied!" : "Copy Link"}
            </Button>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="flex flex-col gap-4">
        <h3 className="heading-16 text-gray-900">How It Works</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {HOW_IT_WORKS.map(({ step, title, desc }) => (
            <div
              key={step}
              className="rounded-2xl border border-gray-100 bg-white p-5 flex flex-col gap-3 shadow-sm"
            >
              <div className="w-8 h-8 rounded-full bg-brand-green flex items-center justify-center text-gray-900 font-bold body-14">
                {step}
              </div>
              <div>
                <p className="heading-14 text-gray-900 mb-1">{title}</p>
                <p className="body-14 text-gray-500">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Points breakdown info */}
      <div className="rounded-2xl border border-gray-100 bg-[#f9fafb] p-6 flex flex-col gap-4">
        <h3 className="heading-16 text-gray-900">Referral Rewards</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 body-14">
          <div className="flex flex-col gap-1">
            <span className="text-gray-500">Referee Welcome Bonus</span>
            <span className="font-semibold text-gray-900">Bonus points on first trade</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-gray-500">Referrer Ongoing Bonus</span>
            <span className="font-semibold text-gray-900">% of referee&apos;s trading points</span>
          </div>
        </div>
        <p className="body-12 text-gray-400">
          Point rates are set by the team and may change over time. Points will convert to tokens at
          TGE.
        </p>
      </div>
    </div>
  );
}
