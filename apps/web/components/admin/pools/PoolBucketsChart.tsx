"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AdminPoolTimeBucketDto } from "@/types/admin";
import { Card, CardHeader } from "@/components/admin/ui";

type MetricTab = "tvl" | "volume";

const METRICS: { label: string; value: MetricTab }[] = [
  { label: "TVL", value: "tvl" },
  { label: "Volume", value: "volume" },
];

export type BucketResolution = "5m" | "1h" | "1d" | "1w" | "1M";

const RESOLUTIONS: { label: string; value: BucketResolution }[] = [
  { label: "5m", value: "5m" },
  { label: "1h", value: "1h" },
  { label: "1d", value: "1d" },
  { label: "1w", value: "1w" },
  { label: "1M", value: "1M" },
];

function fmtUsdShort(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

function formatTickLabel(tsSec: number, resolution: BucketResolution): string {
  const d = new Date(tsSec * 1000);
  if (resolution === "5m" || resolution === "1h") {
    return d.toLocaleString(undefined, { month: "2-digit", day: "2-digit", hour: "2-digit" });
  }
  return d.toLocaleDateString(undefined, { month: "2-digit", day: "2-digit" });
}

function metricValue(item: AdminPoolTimeBucketDto, metric: MetricTab): number {
  if (metric === "tvl")
    return (item.baseLiquidityUSD || 0) + (item.quoteLiquidityUSD || 0);
  return (item.baseVolumeUSD || 0) + (item.quoteVolumeUSD || 0);
}

export function PoolBucketsChart({
  title,
  items,
  resolution,
  onResolutionChange,
}: {
  title: string;
  items: AdminPoolTimeBucketDto[];
  resolution: BucketResolution;
  onResolutionChange: (r: BucketResolution) => void;
}) {
  const [activeMetric, setActiveMetric] = useState<MetricTab>("tvl");

  useEffect(() => {
    // Keep UI stable when switching resolution: default to TVL
    setActiveMetric("tvl");
  }, [resolution]);

  const data = useMemo(() => {
    return (items || []).map((it) => ({
      ts: it.bucketStartTs,
      label: formatTickLabel(it.bucketStartTs, resolution),
      value: metricValue(it, activeMetric),
    }));
  }, [items, resolution, activeMetric]);

  const color = activeMetric === "tvl" ? "#0070f3" : "#0cce6b";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <div className="text-sm font-semibold text-ds-gray-1000">{title}</div>
            <div className="text-[11px] text-ds-gray-600">
              Time buckets: {resolution}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5 bg-ds-gray-200 rounded-md p-0.5">
              {METRICS.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setActiveMetric(tab.value)}
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors duration-100 ${
                    activeMetric === tab.value
                      ? "bg-ds-gray-1000 text-ds-background-100"
                      : "text-ds-gray-700 hover:text-ds-gray-900"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-0.5 bg-ds-gray-200 rounded-md p-0.5">
              {RESOLUTIONS.map((r) => (
                <button
                  key={r.value}
                  onClick={() => onResolutionChange(r.value)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors duration-100 ${
                    resolution === r.value
                      ? "bg-ds-gray-1000 text-ds-background-100"
                      : "text-ds-gray-700 hover:text-ds-gray-900"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </CardHeader>

      <div className="h-[260px] px-6 pb-6 pt-2">
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-xs text-ds-gray-600">No bucket data.</div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="bucketFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" tick={{ fill: "#666666", fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis
                tick={{ fill: "#666666", fontSize: 11 }}
                tickFormatter={(v) => fmtUsdShort(Number(v))}
                tickLine={false}
                axisLine={false}
                width={72}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const v = Number(payload[0]?.value ?? 0);
                  return (
                    <div className="bg-ds-background-200 border border-ds-gray-400 rounded-md px-3 py-2 shadow-lg">
                      <div className="text-[11px] text-ds-gray-600">{label}</div>
                      <div className="text-sm font-semibold text-ds-gray-1000 font-geist-mono">
                        {fmtUsdShort(v)}
                      </div>
                    </div>
                  );
                }}
              />
              <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill="url(#bucketFill)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}

