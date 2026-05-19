'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { adminApi } from '@/lib/adminApi';
import { PairSidebarPanel } from '@/components/admin/PairSidebarPanel';
import type {
  AdminLockStatsDto,
  AdminLockEventsDto,
  AdminLockByEpochDto,
} from '@giwater/shared';

function formatAmount(wei: string): string {
  const n = Number(BigInt(wei) / BigInt(1e15)) / 1000;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}

function relativeTime(ts: string): string {
  const diffMs = Date.now() - Number(ts) * 1000;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return `${Math.floor(diffH / 24)}d ago`;
}

function eventBadgeColor(eventType: string, depositType: string | null): string {
  if (eventType === 'Withdraw') return 'text-red-400';
  if (depositType === 'INCREASE_UNLOCK_TIME') return 'text-purple-400';
  return 'text-indigo-400';
}

function eventLabel(eventType: string, depositType: string | null): string {
  if (eventType === 'Withdraw') return 'WITHDRAW';
  if (depositType === 'INCREASE_UNLOCK_TIME') return 'EXTEND';
  return 'DEPOSIT';
}

export default function LockDashboardPage() {
  const [selectedPool, setSelectedPool] = useState<string | null>(null);
  const [stats, setStats] = useState<AdminLockStatsDto | null>(null);
  const [epochData, setEpochData] = useState<AdminLockByEpochDto | null>(null);
  const [events, setEvents] = useState<AdminLockEventsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async (pool: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const [s, e, ev] = await Promise.all([
        adminApi.getLockStats(pool ?? undefined),
        adminApi.getLockByEpoch(pool ?? undefined),
        adminApi.getLockEvents(pool ?? undefined),
      ]);
      setStats(s);
      setEpochData(e);
      setEvents(ev);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load lock data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll(selectedPool);
  }, [selectedPool, fetchAll]);

  const pairs =
    stats?.pairStats.map((p) => ({
      pool: p.pool,
      label: p.label,
      subLabel: formatAmount(p.totalLockedAmount) + ' locked',
    })) ?? [];

  const chartData =
    epochData?.epochs.map((ep) => ({
      name: `#${ep.epochNumber}`,
      locked: Number(BigInt(ep.totalLockedAmount) / BigInt(1e18)),
    })) ?? [];

  const selectedLabel =
    selectedPool === null
      ? 'All Pairs (Global)'
      : (stats?.pairStats.find((p) => p.pool === selectedPool)?.label ?? selectedPool);

  return (
    <div className="flex h-full -m-8">
      <PairSidebarPanel
        pairs={pairs}
        selectedPool={selectedPool}
        onSelect={setSelectedPool}
        accentColor="indigo"
      />

      <div className="flex-1 flex flex-col overflow-auto p-6 gap-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-ds-gray-1000">
              Lock Dashboard — {selectedLabel}
            </h1>
            <p className="text-xs text-ds-gray-600 mt-0.5">
              VotingEscrow lock positions and events
            </p>
          </div>
          <button
            onClick={() => fetchAll(selectedPool)}
            className="text-xs text-ds-gray-700 hover:text-ds-gray-900 border border-ds-gray-400 rounded px-3 py-1.5 transition-colors"
          >
            Refresh
          </button>
        </div>

        {error && (
          <div className="rounded-lg bg-red-900/20 border border-red-700/30 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          <div className="bg-ds-background-200 rounded-lg p-4 border-l-4 border-indigo-500">
            <p className="text-[10px] text-ds-gray-600 uppercase tracking-wider">Total Locked</p>
            <p className="text-2xl font-bold text-indigo-400 mt-1">
              {stats ? formatAmount(stats.totalLockedAmount) : '—'}
            </p>
            <p className="text-[10px] text-ds-gray-600 mt-0.5">veNFT amount</p>
          </div>
          <div className="bg-ds-background-200 rounded-lg p-4 border-l-4 border-purple-500">
            <p className="text-[10px] text-ds-gray-600 uppercase tracking-wider">Active Locks</p>
            <p className="text-2xl font-bold text-purple-400 mt-1">
              {stats?.activeLockCount ?? '—'}
            </p>
            <p className="text-[10px] text-ds-gray-600 mt-0.5">positions</p>
          </div>
          <div className="bg-ds-background-200 rounded-lg p-4 border-l-4 border-emerald-500">
            <p className="text-[10px] text-ds-gray-600 uppercase tracking-wider">Avg Duration</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">
              {stats ? `${stats.avgRemainingDays}d` : '—'}
            </p>
            <p className="text-[10px] text-ds-gray-600 mt-0.5">remaining</p>
          </div>
        </div>

        <div className="bg-ds-background-200 rounded-lg p-4">
          <p className="text-xs font-semibold text-indigo-400 mb-3">
            Total Locked Over Time (by epoch)
          </p>
          {loading ? (
            <div className="h-40 flex items-center justify-center text-xs text-ds-gray-600">
              Loading…
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-xs text-ds-gray-600">
              No epoch data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} width={40} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: 'none', fontSize: 11 }}
                />
                <Bar dataKey="locked" fill="#6366f1" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-ds-background-200 rounded-lg p-4 flex-1">
          <p className="text-xs font-semibold text-indigo-400 mb-3">Recent Lock Events</p>
          {loading ? (
            <p className="text-xs text-ds-gray-600">Loading…</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {(events?.events ?? []).length === 0 ? (
                <p className="text-xs text-ds-gray-600">No events</p>
              ) : (
                events?.events.map((ev) => (
                  <div
                    key={ev.id}
                    className="bg-ds-background-100 rounded px-3 py-2 text-xs"
                  >
                    <div className="flex justify-between mb-0.5">
                      <span className={`font-medium ${eventBadgeColor(ev.eventType, ev.depositType)}`}>
                        {eventLabel(ev.eventType, ev.depositType)}
                      </span>
                      <span className="text-ds-gray-600">{relativeTime(ev.blockTimestamp)}</span>
                    </div>
                    <div className="text-ds-gray-700">
                      {ev.owner.slice(0, 8)}…{ev.owner.slice(-4)} · lock #{ev.tokenId} ·{' '}
                      {formatAmount(ev.value)}
                      {ev.lockEnd && (
                        <> · ends {new Date(Number(ev.lockEnd) * 1000).toLocaleDateString()}</>
                      )}
                    </div>
                    <div className="text-ds-gray-600 text-[10px] mt-0.5">
                      {ev.transactionHash.slice(0, 10)}…
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
