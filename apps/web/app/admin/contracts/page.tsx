"use client";

import { useEffect, useState } from "react";
import { useAccount, useReadContracts } from "wagmi";
import { formatEther } from "viem";
import { ContractStateCard, StateItem } from "@/components/admin/contracts";
import { useContractAddresses } from "@/hooks/useContractAddresses";
import { ABIs } from "@giwater/shared/abis";
import {
  Card,
  CardHeader,
  CardContent,
} from "@/components/admin/ui/Card";
import { Badge } from "@/components/admin/ui/Badge";

// ============================================================================
// Types
// ============================================================================

interface ContractOverview {
  name: string;
  description: string;
  address?: string;
  keyMetrics: StateItem[];
}

// ============================================================================
// Component
// ============================================================================

export default function ContractsOverviewPage() {
  const { address: userAddress } = useAccount();
  const { contracts, isLoading: isLoadingAddresses } = useContractAddresses();

  // Read contract states
  const {
    data: contractData,
    isLoading: isLoadingData,
    refetch,
  } = useReadContracts({
    contracts: [
      // VotingEscrow
      {
        address: contracts?.votingEscrow as `0x${string}`,
        abi: ABIs.VotingEscrow,
        functionName: "team",
      },
      {
        address: contracts?.votingEscrow as `0x${string}`,
        abi: ABIs.VotingEscrow,
        functionName: "supply",
      },
      // Voter
      {
        address: contracts?.voter as `0x${string}`,
        abi: ABIs.Voter,
        functionName: "governor",
      },
      {
        address: contracts?.voter as `0x${string}`,
        abi: ABIs.Voter,
        functionName: "emergencyCouncil",
      },
      // Minter
      {
        address: contracts?.minter as `0x${string}`,
        abi: ABIs.Minter,
        functionName: "team",
      },
      {
        address: contracts?.minter as `0x${string}`,
        abi: ABIs.Minter,
        functionName: "weekly",
      },
      // PoolFactory
      {
        address: contracts?.poolFactory as `0x${string}`,
        abi: ABIs.PoolFactory,
        functionName: "isPaused",
      },
      {
        address: contracts?.poolFactory as `0x${string}`,
        abi: ABIs.PoolFactory,
        functionName: "allPoolsLength",
      },
    ],
    query: {
      enabled:
        !!contracts?.votingEscrow &&
        !!contracts?.voter &&
        !!contracts?.minter &&
        !!contracts?.poolFactory,
    },
  });

  const isLoading = isLoadingAddresses || isLoadingData;

  // Process contract data
  const veTeam = contractData?.[0]?.result as string | undefined;
  const veSupply = contractData?.[1]?.result as bigint | undefined;
  const voterGovernor = contractData?.[2]?.result as string | undefined;
  const voterEmergencyCouncil = contractData?.[3]?.result as string | undefined;
  const minterTeam = contractData?.[4]?.result as string | undefined;
  const minterWeekly = contractData?.[5]?.result as bigint | undefined;
  const poolFactoryPaused = contractData?.[6]?.result as boolean | undefined;
  const poolCount = contractData?.[7]?.result as bigint | undefined;

  // Check user permissions
  const isTeam =
    userAddress &&
    (veTeam?.toLowerCase() === userAddress.toLowerCase() ||
      minterTeam?.toLowerCase() === userAddress.toLowerCase());
  const isGovernor =
    userAddress && voterGovernor?.toLowerCase() === userAddress.toLowerCase();
  const isEmergencyCouncil =
    userAddress &&
    voterEmergencyCouncil?.toLowerCase() === userAddress.toLowerCase();

  const overviews: ContractOverview[] = [
    {
      name: "VotingEscrow",
      description: "veTER NFT management - vote locking and voting power",
      address: contracts?.votingEscrow,
      keyMetrics: [
        { label: "Team", value: veTeam || "-", type: "address" },
        {
          label: "Total Supply",
          value: veSupply
            ? `${Number(formatEther(veSupply)).toLocaleString()} TER`
            : "-",
          type: "text",
        },
      ],
    },
    {
      name: "Voter",
      description: "Gauge voting and emission distribution",
      address: contracts?.voter,
      keyMetrics: [
        { label: "Governor", value: voterGovernor || "-", type: "address" },
        {
          label: "Emergency Council",
          value: voterEmergencyCouncil || "-",
          type: "address",
        },
      ],
    },
    {
      name: "Minter",
      description: "TER token emission controller",
      address: contracts?.minter,
      keyMetrics: [
        { label: "Team", value: minterTeam || "-", type: "address" },
        {
          label: "Weekly Emission",
          value: minterWeekly
            ? `${Number(formatEther(minterWeekly)).toLocaleString()} TER`
            : "-",
          type: "text",
        },
      ],
    },
    {
      name: "PoolFactory",
      description: "Basic AMM pool creation and fee management",
      address: contracts?.poolFactory,
      keyMetrics: [
        {
          label: "Paused",
          value:
            poolFactoryPaused !== undefined ? String(poolFactoryPaused) : "-",
          type: "boolean",
        },
        {
          label: "Total Pools",
          value: poolCount !== undefined ? poolCount.toString() : "-",
          type: "number",
        },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {/* Permission Summary */}
      <Card>
        <CardHeader>
          <h3 className="text-sm font-semibold text-ds-gray-1000">Your Permissions</h3>
        </CardHeader>
        <CardContent>
          {userAddress ? (
            <div className="flex flex-wrap gap-2">
              {isTeam && <Badge variant="purple">Team</Badge>}
              {isGovernor && <Badge variant="blue">Governor</Badge>}
              {isEmergencyCouncil && (
                <Badge variant="error">Emergency Council</Badge>
              )}
              {!isTeam && !isGovernor && !isEmergencyCouncil && (
                <span className="text-ds-gray-700 text-sm">
                  No special permissions detected for this address
                </span>
              )}
            </div>
          ) : (
            <p className="text-ds-gray-700 text-sm">
              Connect your wallet to check permissions
            </p>
          )}
        </CardContent>
      </Card>

      {/* Contract Overview Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {overviews.map((overview) => (
          <ContractStateCard
            key={overview.name}
            title={overview.name}
            description={overview.description}
            contractAddress={overview.address}
            items={overview.keyMetrics}
            isLoading={isLoading}
            onRefresh={() => refetch()}
          />
        ))}
      </div>

      {/* Quick Links */}
      <Card>
        <CardHeader>
          <h3 className="text-sm font-semibold text-ds-gray-1000">Quick Actions</h3>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <a
              href="/admin/contracts/voting-escrow"
              className="flex flex-col items-center p-4 bg-ds-gray-200 hover:bg-ds-gray-300 rounded-lg transition-colors"
            >
              <svg
                className="w-8 h-8 text-ds-purple-400 mb-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
              <span className="text-sm text-ds-gray-1000 font-medium">VotingEscrow</span>
            </a>
            <a
              href="/admin/contracts/voter"
              className="flex flex-col items-center p-4 bg-ds-gray-200 hover:bg-ds-gray-300 rounded-lg transition-colors"
            >
              <svg
                className="w-8 h-8 text-ds-blue-400 mb-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                />
              </svg>
              <span className="text-sm text-ds-gray-1000 font-medium">Voter</span>
            </a>
            <a
              href="/admin/contracts/gauges"
              className="flex flex-col items-center p-4 bg-ds-gray-200 hover:bg-ds-gray-300 rounded-lg transition-colors"
            >
              <svg
                className="w-8 h-8 text-ds-red-400 mb-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              <span className="text-sm text-ds-gray-1000 font-medium">Gauges</span>
            </a>
            <a
              href="/admin/contracts/pool-factory"
              className="flex flex-col items-center p-4 bg-ds-gray-200 hover:bg-ds-gray-300 rounded-lg transition-colors"
            >
              <svg
                className="w-8 h-8 text-ds-green-400 mb-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
              <span className="text-sm text-ds-gray-1000 font-medium">Pool Factory</span>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
