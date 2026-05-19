"use client";

import { useState, useCallback, useEffect } from "react";
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatEther } from "viem";
import {
  AddressInput,
  ConfirmDialog,
  TxStatus,
} from "@/components/admin/contracts";
import { useContractAddresses } from "@/hooks/useContractAddresses";
import { ABIs } from "@giwater/shared/abis";
import toast from "react-hot-toast";
import { GIWASCAN_URL } from "@/lib/config";
import {
  Card,
  CardHeader,
  CardContent,
} from "@/components/admin/ui/Card";
import { Badge } from "@/components/admin/ui/Badge";
import { Button } from "@/components/admin/ui/Button";

// ============================================================================
// Types
// ============================================================================

interface GaugeInfo {
  address: string;
  pool: string;
  isAlive: boolean;
}

// ============================================================================
// Component
// ============================================================================

export default function GaugesPage() {
  const { address: userAddress } = useAccount();
  const { contracts } = useContractAddresses();

  // State
  const [gauges, setGauges] = useState<GaugeInfo[]>([]);
  const [isLoadingGauges, setIsLoadingGauges] = useState(true);
  const [selectedGauge, setSelectedGauge] = useState<GaugeInfo | null>(null);
  const [searchAddress, setSearchAddress] = useState("");

  // Direct gauge action states
  const [directGaugeAddress, setDirectGaugeAddress] = useState("");
  const [directAction, setDirectAction] = useState<"kill" | "revive">("kill");

  // Confirm dialog state
  const [confirmAction, setConfirmAction] = useState<{
    type: "kill" | "revive";
    gauge: GaugeInfo;
    onConfirm: () => void;
  } | null>(null);

  // Contract write
  const { data: hash, writeContract, isPending, reset } = useWriteContract();

  // Wait for transaction
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  // Get transaction status
  const getTxStatus = (): TxStatus => {
    if (isPending) return "pending";
    if (isConfirming) return "confirming";
    if (isSuccess) return "success";
    return "idle";
  };

  // Read emergency council
  const { data: emergencyCouncil } = useReadContract({
    address: contracts?.voter as `0x${string}`,
    abi: ABIs.Voter,
    functionName: "emergencyCouncil",
    query: { enabled: !!contracts?.voter },
  });

  // Read gauge count
  const { data: gaugeCount } = useReadContract({
    address: contracts?.voter as `0x${string}`,
    abi: ABIs.Voter,
    functionName: "length",
    query: { enabled: !!contracts?.voter },
  });

  // Check permissions
  const isEmergencyCouncil =
    userAddress &&
    (emergencyCouncil as string)?.toLowerCase() === userAddress.toLowerCase();

  // Fetch gauges
  useEffect(() => {
    const fetchGauges = async () => {
      if (!contracts?.voter || !gaugeCount) return;

      setIsLoadingGauges(true);
      const count = Number(gaugeCount);
      const gaugeList: GaugeInfo[] = [];

      // Fetch in batches
      const batchSize = 10;
      for (let i = 0; i < count; i += batchSize) {
        const batch = [];
        for (let j = i; j < Math.min(i + batchSize, count); j++) {
          batch.push(j);
        }

        // For simplicity, we'll show a limited number of gauges
        // In production, you'd want pagination
        if (i >= 50) break;
      }

      setGauges(gaugeList);
      setIsLoadingGauges(false);
    };

    fetchGauges();
  }, [contracts?.voter, gaugeCount]);

  // Kill gauge handler
  const handleKillGauge = useCallback(
    (gauge: GaugeInfo) => {
      if (!contracts?.voter) return;
      setConfirmAction({
        type: "kill",
        gauge,
        onConfirm: () => {
          writeContract({
            address: contracts.voter as `0x${string}`,
            abi: ABIs.Voter,
            functionName: "killGauge",
            args: [gauge.address as `0x${string}`],
          });
          setConfirmAction(null);
          toast.success("Transaction submitted");
        },
      });
    },
    [contracts?.voter, writeContract]
  );

  // Revive gauge handler
  const handleReviveGauge = useCallback(
    (gauge: GaugeInfo) => {
      if (!contracts?.voter) return;
      setConfirmAction({
        type: "revive",
        gauge,
        onConfirm: () => {
          writeContract({
            address: contracts.voter as `0x${string}`,
            abi: ABIs.Voter,
            functionName: "reviveGauge",
            args: [gauge.address as `0x${string}`],
          });
          setConfirmAction(null);
          toast.success("Transaction submitted");
        },
      });
    },
    [contracts?.voter, writeContract]
  );

  // Direct action handler
  const handleDirectAction = useCallback(() => {
    if (!contracts?.voter || !directGaugeAddress) return;

    const functionName = directAction === "kill" ? "killGauge" : "reviveGauge";

    if (directAction === "kill") {
      setConfirmAction({
        type: "kill",
        gauge: { address: directGaugeAddress, pool: "", isAlive: true },
        onConfirm: () => {
          writeContract({
            address: contracts.voter as `0x${string}`,
            abi: ABIs.Voter,
            functionName,
            args: [directGaugeAddress as `0x${string}`],
          });
          setConfirmAction(null);
          toast.success("Transaction submitted");
        },
      });
    } else {
      writeContract({
        address: contracts.voter as `0x${string}`,
        abi: ABIs.Voter,
        functionName,
        args: [directGaugeAddress as `0x${string}`],
      });
      toast.success("Transaction submitted");
    }
  }, [contracts?.voter, directGaugeAddress, directAction, writeContract]);

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="space-y-6">
      {/* Permission Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-ds-gray-1000">Gauge Management</h3>
              <p className="text-sm text-ds-gray-700 mt-1">
                Kill or revive gauges as Emergency Council
              </p>
            </div>
            <Badge variant={isEmergencyCouncil ? "success" : "default"}>
              {isEmergencyCouncil ? "Emergency Council" : "Not Authorized"}
            </Badge>
          </div>
        </CardHeader>
        {typeof emergencyCouncil === "string" && emergencyCouncil && (
          <CardContent className="pt-0">
            <div className="text-sm text-ds-gray-700">
              Emergency Council Address:{" "}
              <a
                href={`${GIWASCAN_URL}/address/${emergencyCouncil}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-geist-mono text-ds-blue-400 hover:underline"
              >
                {formatAddress(emergencyCouncil)}
              </a>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Direct Gauge Action */}
      <Card>
        <CardHeader>
          <h3 className="text-sm font-semibold text-ds-gray-1000">
            Direct Gauge Action
          </h3>
        </CardHeader>
        <CardContent className="space-y-4">
          <AddressInput
            label="Gauge Address"
            value={directGaugeAddress}
            onChange={setDirectGaugeAddress}
            helperText="Enter the gauge address directly"
          />

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={directAction === "kill"}
                onChange={() => setDirectAction("kill")}
                className="w-4 h-4 text-ds-red-400 bg-ds-background-100 border-ds-gray-400 focus:ring-ds-red-400"
              />
              <span className="text-sm text-ds-gray-900">Kill Gauge</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={directAction === "revive"}
                onChange={() => setDirectAction("revive")}
                className="w-4 h-4 text-ds-green-400 bg-ds-background-100 border-ds-gray-400 focus:ring-ds-green-400"
              />
              <span className="text-sm text-ds-gray-900">Revive Gauge</span>
            </label>
          </div>

          <Button
            variant={directAction === "kill" ? "danger" : "primary"}
            size="lg"
            onClick={handleDirectAction}
            disabled={
              !directGaugeAddress ||
              !isEmergencyCouncil ||
              isPending ||
              isConfirming
            }
            loading={isPending || isConfirming}
            className="w-full"
          >
            {directAction === "kill" ? "Kill Gauge" : "Revive Gauge"}
          </Button>

          {/* Transaction status */}
          {hash && (
            <div
              className={`rounded-lg p-4 border ${
                isSuccess
                  ? "bg-ds-green-700/10 border-ds-green-700/20"
                  : "bg-ds-blue-700/10 border-ds-blue-700/20"
              }`}
            >
              <p
                className={`text-sm ${
                  isSuccess ? "text-ds-green-400" : "text-ds-blue-400"
                }`}
              >
                {isConfirming
                  ? "Confirming transaction..."
                  : isSuccess
                  ? "Transaction confirmed!"
                  : "Transaction submitted"}
              </p>
              <a
                href={`${GIWASCAN_URL}/tx/${hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-ds-gray-700 hover:text-ds-gray-1000 font-geist-mono mt-2 inline-flex items-center gap-1"
              >
                {hash.slice(0, 10)}...{hash.slice(-8)}
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info about Kill/Revive */}
      <Card>
        <CardHeader>
          <h3 className="text-sm font-semibold text-ds-gray-1000">
            About Kill/Revive Gauges
          </h3>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 bg-ds-red-700/10 border border-ds-red-700/20 rounded-lg">
              <h4 className="font-medium text-ds-red-400 mb-2 flex items-center gap-2">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                  />
                </svg>
                Kill Gauge
              </h4>
              <ul className="text-sm text-ds-gray-700 space-y-2">
                <li>- Stops emissions to the gauge</li>
                <li>- Gauge will not receive voting rewards</li>
                <li>- Users can still withdraw their LP tokens</li>
                <li>- Used for emergency situations</li>
              </ul>
            </div>
            <div className="p-4 bg-ds-green-700/10 border border-ds-green-700/20 rounded-lg">
              <h4 className="font-medium text-ds-green-400 mb-2 flex items-center gap-2">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Revive Gauge
              </h4>
              <ul className="text-sm text-ds-gray-700 space-y-2">
                <li>- Restores emissions to the gauge</li>
                <li>- Gauge will receive voting rewards again</li>
                <li>- Stakers can earn rewards again</li>
                <li>- Used after emergency is resolved</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <Card>
        <CardHeader>
          <h3 className="text-sm font-semibold text-ds-gray-1000">Gauge Statistics</h3>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-ds-gray-200 rounded-lg p-4">
              <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider mb-1">Total Gauges</p>
              <p className="text-2xl font-semibold text-ds-gray-1000">
                {gaugeCount !== undefined
                  ? Number(gaugeCount).toLocaleString()
                  : "-"}
              </p>
            </div>
            <div className="bg-ds-gray-200 rounded-lg p-4">
              <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider mb-1">Voter Contract</p>
              <p className="text-sm font-geist-mono text-ds-blue-400">
                {contracts?.voter ? formatAddress(contracts.voter) : "-"}
              </p>
            </div>
            <div className="bg-ds-gray-200 rounded-lg p-4">
              <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider mb-1">Permission</p>
              <p
                className={`text-lg font-medium ${
                  isEmergencyCouncil ? "text-ds-green-400" : "text-ds-red-400"
                }`}
              >
                {isEmergencyCouncil ? "Authorized" : "Not Authorized"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        onConfirm={confirmAction?.onConfirm || (() => {})}
        title={
          confirmAction?.type === "kill"
            ? "Confirm Kill Gauge"
            : "Confirm Revive Gauge"
        }
        description={
          confirmAction?.type === "kill"
            ? `This will stop all emissions to this gauge. Users will not receive rewards until the gauge is revived. Are you sure you want to kill this gauge?`
            : `This will restore emissions to this gauge. Users will start receiving rewards again. Are you sure you want to revive this gauge?`
        }
        variant={confirmAction?.type === "kill" ? "danger" : "default"}
        confirmLabel={
          confirmAction?.type === "kill" ? "Kill Gauge" : "Revive Gauge"
        }
      >
        {confirmAction && (
          <div className="bg-ds-gray-200 rounded-lg p-3 mt-4">
            <p className="text-xs text-ds-gray-700 mb-1">Gauge Address:</p>
            <p className="font-geist-mono text-sm text-ds-gray-1000">
              {confirmAction.gauge.address}
            </p>
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}
