'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { adminApi } from '@/lib/adminApi';
import { PairSidebarPanel } from '@/components/admin/PairSidebarPanel';
import type {
  AdminVoteStatsDto,
  AdminVoteEventsDto,
  AdminVoteByEpochDto,
  AdminVoteDistributionDto,
} from '@giwater/shared';

const PIE_COLORS = ['#10b981', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

function relativeTime(ts: string): string {
  const diffMs = Date.now() - Number(ts) * 1000;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return `${Math.floor(diffH / 24)}d ago`;
}

export default function VoteDashboardPage() {
  const [selectedPool, setSelectedPool] = useState<string | null>(null);
  const [stats, setStats] = useState<AdminVoteStatsDto | null>(null);
  const [epochData, setEpochData] = useState<AdminVoteByEpochDto | null>(null);
  const [distribution, setDistribution] = useState<AdminVoteDistributionDto | null>(null);
  const [events, setEvents] = useState<AdminVoteEventsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async (pool: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const [s, e, d, ev] = await Promise.all([
        adminApi.getVoteStats(pool ?? undefined),
        adminApi.getVoteByEpoch(pool ?? undefined),
        adminApi.getVoteDistribution(),
        adminApi.getVoteEvents(pool ?? undefined),
      ]);
      setStats(s);
      setEpochData(e);
      setDistribution(d);
      setEvents(ev);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load vote data');
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
      subLabel: `${(p.voteWeightBps / 100).toFixed(1)}% VP · ${p.voterCount} voters`,
    })) ?? [];

  const barChartData =
    epochData?.epochs.map((ep) => ({
      name: `#${ep.epochNumber}`,
      weight: Number(BigInt(ep.totalWeight) / BigInt(1e15)) / 1000,
    })) ?? [];

  const pieData =
    distribution?.buckets
      .filter((b) => b.weightBps > 0)
      .slice(0, 5)
      .map((b) => ({ name: b.label, value: b.weightBps / 100 })) ?? [];

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
        accentColor="green"
      />

      <div className="flex-1 flex flex-col overflow-auto p-6 gap-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-ds-gray-1000">
              Vote Dashboard — {selectedLabel}
            </h1>
            <p className="text-xs text-ds-gray-600 mt-0.5">
              Voter allocations · Epoch #{stats?.currentEpoch ?? '—'}
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
          <div className="bg-ds-background-200 rounded-lg p-4 border-l-4 border-emerald-500">
            <p className="text-[10px] text-ds-gray-600 uppercase tracking-wider">Vote Weight</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">
              {stats ? `${(stats.voteWeightBps / 100).toFixed(1)}%` : '—'}
            </p>
            <p className="text-[10px] text-ds-gray-600 mt-0.5">of epoch VP</p>
          </div>
          <div className="bg-ds-background-200 rounded-lg p-4 border-l-4 border-amber-500">
            <p className="text-[10px] text-ds-gray-600 uppercase tracking-wider">Unique Voters</p>
            <p className="text-2xl font-bold text-amber-400 mt-1">
              {stats?.uniqueVoterCount ?? '—'}
            </p>
            <p className="text-[10px] text-ds-gray-600 mt-0.5">this epoch</p>
          </div>
          <div className="bg-ds-background-200 rounded-lg p-4 border-l-4 border-indigo-500">
            <p className="text-[10px] text-ds-gray-600 uppercase tracking-wider">Epoch</p>
            <p className="text-2xl font-bold text-indigo-400 mt-1">
              #{stats?.currentEpoch ?? '—'}
            </p>
            <p className="text-[10px] text-ds-gray-600 mt-0.5">current</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-ds-background-200 rounded-lg p-4">
            <p className="text-xs font-semibold text-emerald-400 mb-3">
              Vote Weight by Epoch
            </p>
            {loading ? (
              <div className="h-40 flex items-center justify-center text-xs text-ds-gray-600">Loading…</div>
            ) : barChartData.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-xs text-ds-gray-600">No epoch data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={barChartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} width={40} />
                  <Tooltip contentStyle={{ background: '#1e293b', border: 'none', fontSize: 11 }} />
                  <Bar dataKey="weight" fill="#10b981" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-ds-background-200 rounded-lg p-4">
            <p className="text-xs font-semibold text-amber-400 mb-3">
              Epoch #{distribution?.epoch ?? '—'} Distribution
            </p>
            {loading ? (
              <div className="h-40 flex items-center justify-center text-xs text-ds-gray-600">Loading…</div>
            ) : pieData.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-xs text-ds-gray-600">No vote data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={30}
                    outerRadius={60}
                    dataKey="value"
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={(v: unknown) => `${(v as number).toFixed(1)}%`}
                    contentStyle={{ background: '#1e293b', border: 'none', fontSize: 11 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-ds-background-200 rounded-lg p-4 flex-1">
          <p className="text-xs font-semibold text-emerald-400 mb-3">Recent Vote Events</p>
          {loading ? (
            <p className="text-xs text-ds-gray-600">Loading…</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {(events?.events ?? []).length === 0 ? (
                <p className="text-xs text-ds-gray-600">No events</p>
              ) : (
                events?.events.map((ev) => (
                  <div key={ev.id} className="bg-ds-background-100 rounded px-3 py-2 text-xs">
                    <div className="flex justify-between mb-0.5">
                      <span
                        className={`font-medium ${
                          ev.eventType === 'Abstained' ? 'text-amber-400' : 'text-emerald-400'
                        }`}
                      >
                        {ev.eventType.toUpperCase()}
                      </span>
                      <span className="text-ds-gray-600">{relativeTime(ev.blockTimestamp)}</span>
                    </div>
                    <div className="text-ds-gray-700">
                      {ev.owner.slice(0, 8)}…{ev.owner.slice(-4)} · lock #{ev.tokenId} ·{' '}
                      {(Number(ev.weight) / Number(ev.totalWeight) * 100).toFixed(1)}% VP
                    </div>
                    <div className="text-ds-gray-600 text-[10px] mt-0.5">
                      {ev.transactionHash.slice(0, 10)}… · Epoch #{ev.epochTimestamp ?? '?'}
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
