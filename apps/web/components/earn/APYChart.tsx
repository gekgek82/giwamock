"use client";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  YAxis,
} from "recharts";

interface APYChartProps {
  data: { date: string; value: number }[];
}

interface TooltipPayload {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}

function ChartTooltip({ active, payload, label }: TooltipPayload) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-[#334155] bg-[#0c1117] px-3 py-2 shadow-lg">
      <p className="text-[11px] text-[#cbd5e1] mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-primary-100">
        ${payload[0].value}M
      </p>
    </div>
  );
}

export function APYChart({ data }: APYChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={data}
        margin={{ top: 10, right: 8, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id="apyFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00fea2" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#00fea2" stopOpacity={0} />
          </linearGradient>
        </defs>
        <YAxis
          orientation="right"
          tick={{ fill: "#94a3b8", fontSize: 10 }}
          tickFormatter={(v) => `$${v}M`}
          axisLine={false}
          tickLine={false}
          width={42}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: "#cbd5e1" }} />
        <Area
          type="monotone"
          dataKey="value"
          stroke="#00fea2"
          strokeWidth={2}
          fill="url(#apyFill)"
          dot={false}
          activeDot={{ r: 4, fill: "#00fea2" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
