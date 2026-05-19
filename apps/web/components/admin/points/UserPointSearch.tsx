"use client";

import { useState } from "react";
import type { PointBalance } from "@/types/admin";
import { Button, Card, CardHeader, CardTitle, CardContent } from "@/components/admin/ui";

interface UserPointSearchProps {
  onSearch: (address: string) => Promise<PointBalance>;
}

/**
 * User Point Search Component
 *
 * Search for a user's point balance by address.
 */
export function UserPointSearch({ onSearch }: UserPointSearchProps) {
  const [address, setAddress] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<PointBalance | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return;

    setIsSearching(true);
    setError(null);
    setResult(null);

    try {
      const balance = await onSearch(address);
      setResult(balance);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch balance");
    } finally {
      setIsSearching(false);
    }
  };

  const formatAddress = (addr: string): string => {
    if (addr.length <= 10) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>User Point Lookup</CardTitle>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="flex gap-3">
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Enter wallet address (0x...)"
              className="flex-1 h-9 rounded-md border border-ds-gray-400 bg-ds-background-100 px-3 text-sm text-ds-gray-1000 placeholder:text-ds-gray-600 font-geist-mono transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-ds-gray-1000/20 focus:border-ds-gray-700 hover:border-ds-gray-500"
            />
            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={isSearching}
              disabled={!address}
            >
              Search
            </Button>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-ds-red-700/10 border border-ds-red-700/20 rounded-lg p-3 text-sm text-ds-red-400">
              {error}
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="bg-ds-gray-200 rounded-lg p-4">
              {/* Header */}
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-ds-gray-400">
                <div>
                  <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider">Address</p>
                  <p className="font-geist-mono text-sm text-ds-gray-1000">{formatAddress(result.address)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider">{result.seasonName}</p>
                  <p className="text-xs text-ds-gray-600">Rank #{result.rank || "-"}</p>
                </div>
              </div>

              {/* Point Flow: Total → Claimed / Claimable → On-chain */}
              <div className="py-4 mb-4 space-y-3">
                {/* Total Points */}
                <div className="text-center">
                  <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider mb-1">Total Points (DB)</p>
                  <p className="text-3xl font-semibold text-ds-gray-1000 font-geist-mono">
                    {parseFloat(result.totalPoints).toLocaleString()}
                  </p>
                  {result.percentile != null && result.percentile > 0 && (
                    <p className="text-xs text-ds-gray-600 mt-1">
                      Top {(100 - result.percentile).toFixed(1)}%
                    </p>
                  )}
                </div>

                {/* Arrow */}
                <div className="flex items-center justify-center text-ds-gray-500">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </div>

                {/* Claimed / Claimable */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-ds-background-200 border border-ds-gray-400 rounded-lg p-3 text-center">
                    <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider mb-1">Claimed</p>
                    <p className="text-lg font-semibold text-ds-gray-1000 font-geist-mono">
                      {parseFloat(result.claimedPoints).toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-ds-background-200 border border-ds-green-700/30 rounded-lg p-3 text-center">
                    <p className="text-[11px] font-medium text-ds-green-400 uppercase tracking-wider mb-1">Claimable</p>
                    <p className="text-lg font-semibold text-ds-green-400 font-geist-mono">
                      {parseFloat(result.claimablePoints).toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Arrow */}
                <div className="flex items-center justify-center text-ds-gray-500">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </div>

                {/* On-chain tPOINT */}
                <div className="bg-ds-blue-700/10 border border-ds-blue-700/30 rounded-lg p-3 text-center">
                  <p className="text-[11px] font-medium text-ds-blue-400 uppercase tracking-wider mb-1">tPOINT (On-chain)</p>
                  <p className="text-2xl font-semibold text-ds-blue-400 font-geist-mono">
                    {parseFloat(result.onChainBalance).toLocaleString()}
                  </p>
                  <p className="text-[11px] text-ds-gray-600 mt-1">Vote page에서 유저에게 표시되는 값</p>
                </div>

                {/* Arrow */}
                <div className="flex items-center justify-center text-ds-gray-500">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </div>

                {/* Locked / Available */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-ds-purple-700/10 border border-ds-purple-700/30 rounded-lg p-3 text-center">
                    <p className="text-[11px] font-medium text-ds-purple-400 uppercase tracking-wider mb-1">Locked (Voting)</p>
                    <p className="text-lg font-semibold text-ds-purple-400 font-geist-mono">
                      {parseFloat(result.lockedInVoting).toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-ds-background-200 border border-ds-gray-400 rounded-lg p-3 text-center">
                    <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider mb-1">Available</p>
                    <p className="text-lg font-semibold text-ds-gray-1000 font-geist-mono">
                      {parseFloat(result.availableBalance).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Breakdown */}
              <div className="grid grid-cols-4 gap-2">
                <div className="bg-ds-background-200 border border-ds-gray-400 rounded-lg p-3 text-center">
                  <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider mb-1">LP</p>
                  <p className="text-sm font-semibold text-ds-gray-1000 font-geist-mono">
                    {parseFloat(result.breakdown.lp).toLocaleString()}
                  </p>
                </div>
                <div className="bg-ds-background-200 border border-ds-gray-400 rounded-lg p-3 text-center">
                  <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider mb-1">Trading</p>
                  <p className="text-sm font-semibold text-ds-gray-1000 font-geist-mono">
                    {parseFloat(result.breakdown.trading).toLocaleString()}
                  </p>
                </div>
                <div className="bg-ds-background-200 border border-ds-gray-400 rounded-lg p-3 text-center">
                  <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider mb-1">Referral</p>
                  <p className="text-sm font-semibold text-ds-gray-1000 font-geist-mono">
                    {parseFloat(result.breakdown.referral).toLocaleString()}
                  </p>
                </div>
                <div className="bg-ds-background-200 border border-ds-gray-400 rounded-lg p-3 text-center">
                  <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider mb-1">Emission</p>
                  <p className="text-sm font-semibold text-ds-gray-1000 font-geist-mono">
                    {parseFloat(result.breakdown.emission).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
