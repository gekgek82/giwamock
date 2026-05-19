"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminPoolInfo } from "@/types/admin";
import { spotPairBaseQuoteLabels } from "@/lib/spotPairDisplay";
import { TokenPairIcon } from "@/components/common/TokenIcon";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Toggle,
  Badge,
  Card,
  CardContent,
} from "@/components/admin/ui";

interface PoolTableProps {
  pools: AdminPoolInfo[];
  isLoading: boolean;
  onToggleListed: (address: string, listed: boolean) => Promise<void>;
  onToggleVoting: (address: string, isVotingEnabled: boolean) => Promise<void>;
  onChangeGrade: (address: string, grade: 1 | 2 | 3) => Promise<void>;
  risingSet?: Set<string>;
  onToggleRising?: (address: string, inRising: boolean) => Promise<void>;
}

const GRADE_LABELS: Record<number, { label: string; variant: "blue" | "default" | "warning" }> = {
  1: { label: "Verified", variant: "blue" },
  2: { label: "Rising", variant: "default" },
  3: { label: "Unknown", variant: "warning" },
};

export function PoolTable({
  pools,
  isLoading,
  onToggleListed,
  onToggleVoting,
  onChangeGrade,
  risingSet,
  onToggleRising,
}: PoolTableProps) {
  const router = useRouter();
  const [togglingAddresses, setTogglingAddresses] = useState<Set<string>>(
    new Set()
  );
  const [listingAddresses, setListingAddresses] = useState<Set<string>>(
    new Set()
  );
  const [gradingAddresses, setGradingAddresses] = useState<Set<string>>(
    new Set()
  );
  const [risingAddresses, setRisingAddresses] = useState<Set<string>>(
    new Set()
  );

  const formatAddress = (address: string): string => {
    if (address.length <= 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatUsdCompact = (n: number): string =>
    Number.isFinite(n)
      ? n.toLocaleString(undefined, { maximumFractionDigits: 2 })
      : "—";

  const handleToggleVoting = async (pool: AdminPoolInfo) => {
    setTogglingAddresses((prev) => new Set(prev).add(pool.address));
    try {
      await onToggleVoting(pool.address, !pool.isVotingEnabled);
    } finally {
      setTogglingAddresses((prev) => {
        const next = new Set(prev);
        next.delete(pool.address);
        return next;
      });
    }
  };

  const handleToggleListed = async (pool: AdminPoolInfo) => {
    setListingAddresses((prev) => new Set(prev).add(pool.address));
    try {
      await onToggleListed(pool.address, !pool.listed);
    } finally {
      setListingAddresses((prev) => {
        const next = new Set(prev);
        next.delete(pool.address);
        return next;
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-16 bg-ds-gray-300 rounded animate-pulse"
            />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (pools.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <svg
            className="w-16 h-16 mx-auto mb-4 text-ds-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
          <h3 className="text-sm font-semibold text-ds-gray-1000 mb-2">No Pools Found</h3>
          <p className="text-sm text-ds-gray-700">
            No pools match the current filter criteria
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Pair (base/quote)</TableHead>
          <TableHead>Token0</TableHead>
          <TableHead>Token1</TableHead>
          <TableHead>Pool Address</TableHead>
          <TableHead className="text-center">Type</TableHead>
          <TableHead className="text-center">Labeling</TableHead>
          <TableHead className="text-center">Listed</TableHead>
          <TableHead className="text-center">Rising</TableHead>
          <TableHead className="text-center">Gauge WL</TableHead>
          <TableHead className="text-center">Voting</TableHead>
          <TableHead className="text-right">Fees USD</TableHead>
          <TableHead>Last Updated</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {pools.map((pool) => {
          const { baseSymbol: bSym, quoteSymbol: qSym } =
            spotPairBaseQuoteLabels(pool);
          return (
          <TableRow
            key={pool.address}
            onClick={() => router.push(`/admin/pools/${pool.address}`)}
            className="cursor-pointer"
          >
            <TableCell>
              <div className="flex items-center gap-3">
                <TokenPairIcon
                  leftAddress={pool.baseAddress ?? ""}
                  leftSymbol={bSym}
                  rightAddress={pool.quoteAddress ?? ""}
                  rightSymbol={qSym}
                  size={32}
                />
                <div>
                  <p className="font-medium text-ds-gray-1000 text-sm">
                    {bSym || "—"} / {qSym || "—"}
                  </p>
                  <p className="text-xs text-ds-gray-700">
                    {(pool.baseName || bSym) || "—"} / {(pool.quoteName || qSym) || "—"}
                  </p>
                </div>
              </div>
            </TableCell>
            <TableCell>
              <div className="text-xs">
                <div className="font-medium text-ds-gray-1000">
                  {pool.token0Symbol}
                </div>
                <div className="font-geist-mono text-ds-gray-700">
                  {formatAddress(pool.token0Address)}
                </div>
              </div>
            </TableCell>
            <TableCell>
              <div className="text-xs">
                <div className="font-medium text-ds-gray-1000">
                  {pool.token1Symbol}
                </div>
                <div className="font-geist-mono text-ds-gray-700">
                  {formatAddress(pool.token1Address)}
                </div>
              </div>
            </TableCell>
            <TableCell onClick={(e) => e.stopPropagation()}>
              <a
                href={`${process.env.NEXT_PUBLIC_GIWASCAN_URL}/address/${pool.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-geist-mono text-sm text-ds-gray-700 hover:text-ds-blue-400 transition-colors"
              >
                {formatAddress(pool.address)}
              </a>
            </TableCell>
            <TableCell className="text-center">
              <div className="flex items-center justify-center gap-1.5">
                <Badge variant={pool.poolType === "CL" ? "success" : "warning"}>
                  {pool.poolType === "CL" ? "CL" : "Basic"}
                </Badge>
                <Badge
                  variant={
                    pool.poolType === "CL"
                      ? "cyan"
                      : pool.isStable
                        ? "blue"
                        : "purple"
                  }
                >
                  {pool.poolType === "CL"
                    ? `CL${pool.tickSpacing ?? ''}`
                    : pool.isStable ? "Stable" : "Volatile"}
                </Badge>
              </div>
            </TableCell>
            <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
              <div className="inline-flex items-center gap-1">
                <select
                  value={pool.grade}
                  onChange={async (e) => {
                    const newGrade = Number(e.target.value) as 1 | 2 | 3;
                    setGradingAddresses((prev) => new Set(prev).add(pool.address));
                    try {
                      await onChangeGrade(pool.address, newGrade);
                    } finally {
                      setGradingAddresses((prev) => {
                        const next = new Set(prev);
                        next.delete(pool.address);
                        return next;
                      });
                    }
                  }}
                  disabled={gradingAddresses.has(pool.address)}
                  className={`h-7 rounded-md border border-ds-gray-400 bg-ds-background-100 pl-2 pr-6 text-xs font-medium text-ds-gray-900 appearance-none cursor-pointer transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-ds-gray-1000/20 focus:border-ds-gray-700 disabled:opacity-50 disabled:cursor-not-allowed ${gradingAddresses.has(pool.address) ? "opacity-50" : ""}`}
                >
                  <option value={1}>Verified</option>
                  <option value={2}>Rising</option>
                  <option value={3}>Unknown</option>
                </select>
                {pool.isGradeManualOverride && (
                  <span className="relative group text-[10px] text-ds-yellow-400 font-medium cursor-help">
                    M
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block whitespace-nowrap rounded-md bg-gray-900 px-2.5 py-1 text-[11px] font-normal text-gray-100 shadow-lg">
                      Manually overridden
                      <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                    </span>
                  </span>
                )}
              </div>
            </TableCell>
            <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-center">
                <Toggle
                  checked={pool.listed}
                  onChange={() => handleToggleListed(pool)}
                  disabled={listingAddresses.has(pool.address)}
                  size="sm"
                />
              </div>
            </TableCell>
            <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-center">
                <Toggle
                  checked={risingSet?.has(pool.address.toLowerCase()) ?? false}
                  onChange={async () => {
                    if (!onToggleRising) return;
                    const inRising = risingSet?.has(pool.address.toLowerCase()) ?? false;
                    setRisingAddresses((prev) => new Set(prev).add(pool.address));
                    try {
                      await onToggleRising(pool.address, !inRising);
                    } finally {
                      setRisingAddresses((prev) => {
                        const next = new Set(prev);
                        next.delete(pool.address);
                        return next;
                      });
                    }
                  }}
                  disabled={risingAddresses.has(pool.address) || !onToggleRising}
                  size="sm"
                />
              </div>
            </TableCell>
            <TableCell className="text-center">
              <div className="flex justify-center">
                <Badge variant={pool.gaugeWhitelisted ? "success" : "default"}>
                  {pool.gaugeWhitelisted ? "Yes" : "No"}
                </Badge>
              </div>
            </TableCell>
            <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-center">
                <Toggle
                  checked={pool.isVotingEnabled}
                  onChange={() => handleToggleVoting(pool)}
                  disabled={togglingAddresses.has(pool.address)}
                  size="sm"
                />
              </div>
            </TableCell>
            <TableCell className="text-right">
              <div className="text-xs text-ds-gray-1000 font-geist-mono">
                <div title="Lifetime swap fees (USD)">Σ {formatUsdCompact(pool.totalSwapFeesUsd)}</div>
                <div className="text-ds-gray-600" title="UTC-day swap fees (USD)">24h {formatUsdCompact(pool.daySwapFeesUsd)}</div>
              </div>
            </TableCell>
            <TableCell>
              <span className="text-sm text-ds-gray-700">
                {formatDate(pool.updatedAt)}
              </span>
            </TableCell>
          </TableRow>
        );
        })}
      </TableBody>
    </Table>
  );
}
