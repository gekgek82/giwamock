"use client";

import type { BlockchainEventItem } from "@/types/admin";
import {
  Card,
  CardContent,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Badge,
} from "@/components/admin/ui";

interface EventTableProps {
  events: BlockchainEventItem[];
  isLoading: boolean;
}

function truncateHash(hash: string, chars = 6): string {
  if (hash.length <= chars * 2 + 2) return hash;
  return `${hash.slice(0, chars + 2)}...${hash.slice(-chars)}`;
}

function formatTimestamp(ts: string): string {
  const date = new Date(ts);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatUsd(value: string | null): string {
  if (!value) return "-";
  const num = parseFloat(value);
  if (isNaN(num)) return "-";
  if (num === 0) return "$0";
  if (num < 0.01) return "<$0.01";
  return `$${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const CATEGORY_VARIANTS: Record<string, "blue" | "purple" | "success" | "cyan" | "warning" | "error" | "default"> = {
  POOL: "blue",
  CL_POOL: "purple",
  GAUGE: "success",
  CL_GAUGE: "success",
  VE: "purple",
  VOTER: "warning",
  NFT_POSITION: "error",
  MINTER: "warning",
  REWARD: "cyan",
  REWARDS_DISTRIBUTOR: "cyan",
  FACTORY: "error",
};

export function EventTable({ events, isLoading }: EventTableProps) {
  if (isLoading) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            {["ID", "Category", "Type", "TxHash", "Block", "Time", "Contract", "Pool", "User", "USD"].map(
              (h) => (
                <TableHead key={h}>{h}</TableHead>
              )
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 10 }).map((_, i) => (
            <TableRow key={i}>
              {Array.from({ length: 10 }).map((_, j) => (
                <TableCell key={j}>
                  <div className="h-4 bg-ds-gray-300 rounded animate-pulse w-16" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <svg
            className="w-12 h-12 text-ds-gray-600 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12H9.75m0 0l2.25 2.25M9.75 14.25l2.25-2.25M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-ds-gray-900 text-sm font-semibold">No Events Found</p>
          <p className="text-ds-gray-700 text-sm mt-1">Try adjusting the filters</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>ID</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>TxHash</TableHead>
          <TableHead>Block</TableHead>
          <TableHead>Time</TableHead>
          <TableHead>Contract</TableHead>
          <TableHead>Pool</TableHead>
          <TableHead>User</TableHead>
          <TableHead className="text-right">USD</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {events.map((event) => (
          <TableRow key={event.id}>
            <TableCell className="font-geist-mono text-sm text-ds-gray-700">{event.id}</TableCell>
            <TableCell>
              <Badge variant={CATEGORY_VARIANTS[event.category] || "default"}>
                {event.category}
              </Badge>
            </TableCell>
            <TableCell className="text-sm font-medium text-ds-gray-1000">{event.eventType}</TableCell>
            <TableCell className="font-geist-mono text-sm text-ds-gray-700">{truncateHash(event.txHash)}</TableCell>
            <TableCell className="font-geist-mono text-sm text-ds-gray-700">{event.blockNumber}</TableCell>
            <TableCell className="text-sm text-ds-gray-700 whitespace-nowrap">
              {formatTimestamp(event.blockTimestamp)}
            </TableCell>
            <TableCell className="font-geist-mono text-sm text-ds-gray-700">
              {truncateHash(event.contractAddress)}
            </TableCell>
            <TableCell className="font-geist-mono text-sm text-ds-gray-700">
              {event.poolAddress ? truncateHash(event.poolAddress) : "-"}
            </TableCell>
            <TableCell className="font-geist-mono text-sm text-ds-gray-700">
              {event.userAddress ? truncateHash(event.userAddress) : "-"}
            </TableCell>
            <TableCell className="text-sm text-right text-ds-gray-900">{formatUsd(event.amountUsd)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
