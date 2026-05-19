"use client";

import { Card } from "@/components/admin/ui";
import { Badge } from "@/components/admin/ui";
import type { UserBadge } from "@/types/admin";

interface BadgeListProps {
  badges: UserBadge[];
  isLoading: boolean;
}

/**
 * Badge List Component
 *
 * Displays badges for a searched user.
 * Supports both legacy system badges and new definition-backed badges.
 */
export function BadgeList({ badges, isLoading }: BadgeListProps) {
  const formatAddress = (address: string): string => {
    if (address.length <= 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getBadgeDisplay = (
    badge: UserBadge,
  ): { name: string; icon: string; color: string; imageUrl?: string | null } => {
    // For definition-backed badges, show definition info
    if (badge.badgeDefinition) {
      const def = badge.badgeDefinition;
      return {
        name: def.name,
        icon: def.category === "SEASON" ? "S" : "C",
        color:
          def.category === "SEASON"
            ? "bg-ds-blue-700/10 text-ds-blue-400"
            : "bg-ds-purple-700/10 text-ds-purple-400",
        imageUrl: def.imageUrl,
      };
    }

    // Legacy system badges
    const icons: Record<string, { icon: string; color: string }> = {
      EARLY_BIRD: { icon: "EB", color: "bg-ds-blue-700/10 text-ds-blue-400" },
      KOL_PARTNER: { icon: "KP", color: "bg-ds-purple-700/10 text-ds-purple-400" },
      KOL_TIER1: { icon: "K1", color: "bg-ds-purple-700/10 text-ds-purple-400" },
      KOL_TIER2: { icon: "K2", color: "bg-ds-purple-700/10 text-ds-purple-400" },
      WHALE: { icon: "WH", color: "bg-ds-cyan-700/10 text-ds-cyan-400" },
      OG: { icon: "OG", color: "bg-ds-yellow-700/10 text-ds-yellow-400" },
      GENESIS_DIAMOND: {
        icon: "GD",
        color: "bg-ds-cyan-700/10 text-ds-cyan-400",
      },
      GENESIS_PLATINUM: {
        icon: "GP",
        color: "bg-ds-gray-200 text-ds-gray-700",
      },
      GENESIS_GOLD: {
        icon: "GG",
        color: "bg-ds-yellow-700/10 text-ds-yellow-400",
      },
      GENESIS_SILVER: {
        icon: "GS",
        color: "bg-ds-gray-200 text-ds-gray-700",
      },
      GENESIS_BRONZE: {
        icon: "GB",
        color: "bg-amber-700/20 text-amber-600",
      },
      PARTNER: { icon: "PT", color: "bg-ds-green-700/10 text-ds-green-400" },
    };

    const display = icons[badge.badgeType] || {
      icon: "??",
      color: "bg-ds-gray-200 text-ds-gray-700",
    };

    return {
      name: badge.badgeType.replace(/_/g, " "),
      ...display,
    };
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-32 bg-ds-gray-300 rounded-lg animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (badges.length === 0) {
    return (
      <Card className="p-12 text-center">
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
            d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
          />
        </svg>
        <h3 className="text-sm font-semibold text-ds-gray-1000 mb-2">
          No Badges Found
        </h3>
        <p className="text-sm text-ds-gray-700">
          Search for a user to see their badges
        </p>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {badges.map((badge) => {
        const display = getBadgeDisplay(badge);
        return (
          <Card
            key={badge.id}
            className={`p-5 ${!badge.isActive ? "opacity-50" : ""}`}
          >
            <div className="flex items-start gap-4">
              {display.imageUrl ? (
                <div className="w-12 h-12 rounded-lg overflow-hidden border border-ds-gray-400 shrink-0">
                  <img
                    src={display.imageUrl}
                    alt={display.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div
                  className={`w-12 h-12 rounded-lg flex items-center justify-center text-sm font-semibold ${display.color} shrink-0`}
                >
                  {display.icon}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-ds-gray-1000">{display.name}</h4>
                <p className="text-xs text-ds-gray-700 font-geist-mono truncate">
                  {formatAddress(badge.userAddress)}
                </p>
              </div>
              <Badge variant={badge.isActive ? "success" : "default"}>
                {badge.isActive ? "ACTIVE" : "EXPIRED"}
              </Badge>
            </div>

            <div className="mt-4 pt-4 border-t border-ds-gray-400 grid grid-cols-3 gap-3 text-xs">
              <div>
                <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider">Boost</p>
                <p className="text-ds-green-400 font-geist-mono">+{badge.boostPercent}%</p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider">Granted</p>
                <p className="text-ds-gray-900 font-geist-mono">
                  {new Date(badge.grantedAt).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider">Expires</p>
                <p className="text-ds-gray-900 font-geist-mono">
                  {badge.expiresAt
                    ? new Date(badge.expiresAt).toLocaleDateString()
                    : "Never"}
                </p>
              </div>
            </div>

            {badge.metadata && Object.keys(badge.metadata).length > 0 && (
              <div className="mt-3 pt-3 border-t border-ds-gray-400">
                <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider mb-2">Metadata</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(badge.metadata).map(([key, value]) => (
                    <span
                      key={key}
                      className="text-xs bg-ds-gray-200 px-2 py-1 rounded text-ds-gray-900 font-geist-mono"
                    >
                      {key}: {String(value)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
