"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// ============================================================================
// Types
// ============================================================================

interface Tab {
  id: string;
  label: string;
  href: string;
}

// ============================================================================
// Tab Configuration
// ============================================================================

const contractTabs: Tab[] = [
  { id: "overview", label: "Overview", href: "/admin/contracts" },
  {
    id: "voting-escrow",
    label: "VotingEscrow",
    href: "/admin/contracts/voting-escrow",
  },
  { id: "voter", label: "Voter", href: "/admin/contracts/voter" },
  { id: "minter", label: "Minter", href: "/admin/contracts/minter" },
  { id: "ter-token", label: "TER Token", href: "/admin/contracts/ter-token" },
  {
    id: "pool-factory",
    label: "PoolFactory",
    href: "/admin/contracts/pool-factory",
  },
  { id: "cl-factory", label: "CLFactory", href: "/admin/contracts/cl-factory" },
  {
    id: "factory-registry",
    label: "FactoryRegistry",
    href: "/admin/contracts/factory-registry",
  },
  {
    id: "rewards-distributor",
    label: "RewardsDistributor",
    href: "/admin/contracts/rewards-distributor",
  },
  { id: "gauges", label: "Gauges", href: "/admin/contracts/gauges" },
  {
    id: "faucet",
    label: "Faucet",
    href: "/admin/contracts/faucet",
  },
  {
    id: "lock-vote-test",
    label: "Lock/Vote Test",
    href: "/admin/contracts/lock-vote-test",
  },
  {
    id: "access-control",
    label: "Access Control",
    href: "/admin/contracts/access-control",
  },
  {
    id: "role-members",
    label: "Role Members",
    href: "/admin/contracts/role-members",
  },
];

// ============================================================================
// Component
// ============================================================================

/**
 * ContractTabs Component
 *
 * Tab navigation for contract management pages.
 */
export function ContractTabs() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/admin/contracts") {
      return pathname === "/admin/contracts";
    }
    return pathname?.startsWith(href);
  };

  return (
    <div className="border-b border-ds-gray-400 overflow-x-auto">
      <nav className="flex gap-1 min-w-max pb-px">
        {contractTabs.map((tab) => (
          <Link
            key={tab.id}
            href={tab.href}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors relative ${
              isActive(tab.href)
                ? "text-ds-gray-1000"
                : "text-ds-gray-700 hover:text-ds-gray-1000"
            }`}
          >
            {tab.label}
            {isActive(tab.href) && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-ds-gray-1000" />
            )}
          </Link>
        ))}
      </nav>
    </div>
  );
}
