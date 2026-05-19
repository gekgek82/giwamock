"use client";

import { Card, CardContent } from "@/components/admin/ui";

interface BannerStatsCardProps {
  impressions: number;
  clicks: number;
  ctr: string;
}

export function BannerStatsCard({
  impressions,
  clicks,
  ctr,
}: BannerStatsCardProps) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <Card>
        <CardContent className="text-center py-3 px-3">
          <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider mb-1">Impressions</p>
          <p className="text-lg font-semibold text-ds-gray-1000 font-geist-mono">
            {impressions.toLocaleString()}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="text-center py-3 px-3">
          <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider mb-1">Clicks</p>
          <p className="text-lg font-semibold text-ds-blue-400 font-geist-mono">
            {clicks.toLocaleString()}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="text-center py-3 px-3">
          <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider mb-1">CTR</p>
          <p className="text-lg font-semibold text-ds-green-400 font-geist-mono">{ctr}%</p>
        </CardContent>
      </Card>
    </div>
  );
}
