"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { adminApi } from "@/lib/adminApi";
import { Card, CardHeader } from "@/components/admin/ui";
import type { AdminExchangeTimeBucketDto } from "@/types/admin";

type MetricTab = "tvl" | "volume" | "fees";
type PeriodOption = 7 | 30 | 90;

const PERIODS: { label: string; value: PeriodOption }[] = [
  { label: "7D", value: 7 },
  { label: "30D", value: 30 },
  { label: "90D", value: 90 },
];

const TABS: { label: string; value: MetricTab }[] = [
  { label: "TVL", value: "tvl" },
  { label: "Volume", value: "volume" },
  { label: "Fees", value: "fees" },
];

const COLORS: Record<MetricTab, string> = {
  tvl: "#0070f3",
  volume: "#0cce6b",
  fees: "#f5a623",
};

function formatUsdShort(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
  return `$${val.toFixed(0)}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: { value: number; dataKey: string }[];
  label?: string;
}

function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-ds-background-200 border border-ds-gray-400 rounded-md px-3 py-2 shadow-lg">
      <p className="text-[11px] text-ds-gray-600 mb-0.5">{label}</p>
      {payload.map((entry, i) => (
        <p
          key={i}
          className="text-sm font-semibold text-ds-gray-1000 font-geist-mono"
        >
          {formatUsdShort(entry.value)}
        </p>
      ))}
    </div>
  );
}

export function ProtocolCharts() {
  const [activeTab, setActiveTab] = useState<MetricTab>("tvl");
  const [period, setPeriod] = useState<PeriodOption>(30);
  const [chartData, setChartData] = useState<AdminExchangeTimeBucketDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await adminApi.getExchangeTimeBuckets("giwater", {
        resolution: "1d",
        limit: period,
      });
      setChartData(result.items);
    } catch {
      setChartData([]);
    } finally {
      setIsLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formattedData = chartData.map((item) => ({
    date: formatDate(new Date(item.timestamp * 1000).toISOString().slice(0, 10)),
    fullDate: new Date(item.timestamp * 1000).toISOString().slice(0, 10),
    value:
      activeTab === "tvl"
        ? Number(item.tvl || 0)
        : activeTab === "volume"
          ? Number(item.totalVolume || 0)
          : Number(item.totalFeesUsd || 0),
  }));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          {/* Metric Tabs */}
          <div className="flex items-center gap-0.5 bg-ds-gray-200 rounded-md p-0.5">
            {TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors duration-100 ${
                  activeTab === tab.value
                    ? "bg-ds-gray-1000 text-ds-background-100"
                    : "text-ds-gray-700 hover:text-ds-gray-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Period Selector */}
          <div className="flex items-center gap-0.5 bg-ds-gray-200 rounded-md p-0.5">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors duration-100 ${
                  period === p.value
                    ? "bg-ds-gray-1000 text-ds-background-100"
                    : "text-ds-gray-700 hover:text-ds-gray-900"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>

      {/* Chart */}
      <div className="h-[280px] px-6 pb-6 pt-2">
        {isLoading ? (
          <div className="h-full flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-6 h-6 border-2 border-ds-gray-400 border-t-ds-gray-1000 rounded-full animate-spin" />
              <span className="text-xs text-ds-gray-600">Loading...</span>
            </div>
          </div>
        ) : formattedData.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <svg
                className="w-10 h-10 mx-auto mb-3 text-ds-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              <p className="text-sm text-ds-gray-600">
                No historical data available
              </p>
              <p className="text-xs text-ds-gray-500 mt-1">
                Data will appear after the daily snapshot runs
              </p>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={formattedData}
              margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#333333"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tick={{ fill: "#666666", fontSize: 11 }}
                axisLine={{ stroke: "#333333" }}
                tickLine={false}
              />
              <YAxis
                tickFormatter={formatUsdShort}
                tick={{ fill: "#666666", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={60}
              />
              <Tooltip content={<ChartTooltip />} />
              <Bar
                dataKey="value"
                fill={COLORS[activeTab]}
                radius={[3, 3, 0, 0]}
                maxBarSize={36}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
