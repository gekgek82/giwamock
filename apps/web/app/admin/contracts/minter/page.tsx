"use client";

import { useState, useCallback } from "react";
import {
  useAccount,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatEther } from "viem";
import {
  ContractStateCard,
  AdminFunctionForm,
  AddressInput,
  NumberInput,
  ConfirmDialog,
  TxStatus,
} from "@/components/admin/contracts";
import { useContractAddresses } from "@/hooks/useContractAddresses";
import { ABIs } from "@giwater/shared/abis";
import toast from "react-hot-toast";

// ============================================================================
// Component
// ============================================================================

export default function MinterPage() {
  const { address: userAddress } = useAccount();
  const { contracts } = useContractAddresses();

  // Form states
  const [newTeam, setNewTeam] = useState("");
  const [newTeamRate, setNewTeamRate] = useState("");
  const [newDistributor, setNewDistributor] = useState("");

  // Confirm dialog state
  const [confirmAction, setConfirmAction] = useState<{
    type: string;
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

  // Read contract states
  const {
    data: contractData,
    isLoading: isLoadingData,
    refetch,
  } = useReadContracts({
    contracts: [
      {
        address: contracts?.minter as `0x${string}`,
        abi: ABIs.Minter,
        functionName: "team",
      },
      {
        address: contracts?.minter as `0x${string}`,
        abi: ABIs.Minter,
        functionName: "pendingTeam",
      },
      {
        address: contracts?.minter as `0x${string}`,
        abi: ABIs.Minter,
        functionName: "teamRate",
      },
      {
        address: contracts?.minter as `0x${string}`,
        abi: ABIs.Minter,
        functionName: "rewardsDistributor",
      },
      {
        address: contracts?.minter as `0x${string}`,
        abi: ABIs.Minter,
        functionName: "activePeriod",
      },
      {
        address: contracts?.minter as `0x${string}`,
        abi: ABIs.Minter,
        functionName: "weekly",
      },
      {
        address: contracts?.minter as `0x${string}`,
        abi: ABIs.Minter,
        functionName: "tailEmissionRate",
      },
      {
        address: contracts?.minter as `0x${string}`,
        abi: ABIs.Minter,
        functionName: "ter",
      },
      {
        address: contracts?.minter as `0x${string}`,
        abi: ABIs.Minter,
        functionName: "ve",
      },
      {
        address: contracts?.minter as `0x${string}`,
        abi: ABIs.Minter,
        functionName: "voter",
      },
    ],
    query: {
      enabled: !!contracts?.minter,
    },
  });

  // Extract data
  const team = contractData?.[0]?.result as string | undefined;
  const pendingTeam = contractData?.[1]?.result as string | undefined;
  const teamRate = contractData?.[2]?.result as bigint | undefined;
  const rewardsDistributor = contractData?.[3]?.result as string | undefined;
  const activePeriod = contractData?.[4]?.result as bigint | undefined;
  const weekly = contractData?.[5]?.result as bigint | undefined;
  const tailEmissionRate = contractData?.[6]?.result as bigint | undefined;
  const terToken = contractData?.[7]?.result as string | undefined;
  const ve = contractData?.[8]?.result as string | undefined;
  const voter = contractData?.[9]?.result as string | undefined;

  // Check permissions
  const isTeam =
    userAddress && team?.toLowerCase() === userAddress.toLowerCase();
  const isPendingTeam =
    userAddress && pendingTeam?.toLowerCase() === userAddress.toLowerCase();

  // Format active period
  const formatActivePeriod = (timestamp: bigint | undefined) => {
    if (!timestamp) return "-";
    const date = new Date(Number(timestamp) * 1000);
    return date.toLocaleString();
  };

  // Write handlers
  const handleSetTeam = useCallback(() => {
    if (!contracts?.minter || !newTeam) return;
    setConfirmAction({
      type: "setTeam",
      onConfirm: () => {
        writeContract({
          address: contracts.minter as `0x${string}`,
          abi: ABIs.Minter,
          functionName: "setTeam",
          args: [newTeam as `0x${string}`],
        });
        setConfirmAction(null);
        toast.success("Transaction submitted");
      },
    });
  }, [contracts?.minter, newTeam, writeContract]);

  const handleAcceptTeam = useCallback(() => {
    if (!contracts?.minter) return;
    writeContract({
      address: contracts.minter as `0x${string}`,
      abi: ABIs.Minter,
      functionName: "acceptTeam",
      args: [],
    });
    toast.success("Transaction submitted");
  }, [contracts?.minter, writeContract]);

  const handleSetTeamRate = useCallback(() => {
    if (!contracts?.minter || !newTeamRate) return;
    const rate = parseInt(newTeamRate);
    if (rate > 500) {
      toast.error("Team rate cannot exceed 500 (5%)");
      return;
    }
    writeContract({
      address: contracts.minter as `0x${string}`,
      abi: ABIs.Minter,
      functionName: "setTeamRate",
      args: [BigInt(rate)],
    });
    toast.success("Transaction submitted");
  }, [contracts?.minter, newTeamRate, writeContract]);

  const handleSetRewardsDistributor = useCallback(() => {
    if (!contracts?.minter || !newDistributor) return;
    writeContract({
      address: contracts.minter as `0x${string}`,
      abi: ABIs.Minter,
      functionName: "setRewardsDistributor",
      args: [newDistributor as `0x${string}`],
    });
    toast.success("Transaction submitted");
  }, [contracts?.minter, newDistributor, writeContract]);

  const stateItems = [
    { label: "Team", value: team || "-", type: "address" as const },
    {
      label: "Pending Team",
      value:
        pendingTeam &&
        pendingTeam !== "0x0000000000000000000000000000000000000000"
          ? pendingTeam
          : "-",
      type: "address" as const,
    },
    {
      label: "Team Rate",
      value:
        teamRate !== undefined
          ? `${Number(teamRate)} bps (${(Number(teamRate) / 100).toFixed(2)}%)`
          : "-",
      type: "text" as const,
    },
    {
      label: "Rewards Distributor",
      value: rewardsDistributor || "-",
      type: "address" as const,
    },
    { label: "TER Token", value: terToken || "-", type: "address" as const },
    { label: "VotingEscrow", value: ve || "-", type: "address" as const },
    { label: "Voter", value: voter || "-", type: "address" as const },
    {
      label: "Active Period",
      value: formatActivePeriod(activePeriod),
      type: "text" as const,
    },
    {
      label: "Weekly Emission",
      value: weekly
        ? `${Number(formatEther(weekly)).toLocaleString()} TER`
        : "-",
      type: "text" as const,
    },
    {
      label: "Tail Emission Rate",
      value:
        tailEmissionRate !== undefined
          ? `${Number(tailEmissionRate)} bps (${(
              Number(tailEmissionRate) / 100
            ).toFixed(2)}%)`
          : "-",
      type: "text" as const,
    },
  ];

  return (
    <div className="space-y-6">
      {/* State Card */}
      <ContractStateCard
        title="Minter State"
        description="Current state of the Minter contract"
        contractAddress={contracts?.minter}
        items={stateItems}
        isLoading={isLoadingData}
        onRefresh={() => refetch()}
      />

      {/* Team Management */}
      <h3 className="text-sm font-semibold text-ds-gray-1000">Team Management</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Set Team */}
        <AdminFunctionForm
          title="Set Team (Step 1)"
          description="Propose a new team address (2-step process)"
          permission="team"
          hasPermission={isTeam}
          onSubmit={handleSetTeam}
          submitLabel="Propose New Team"
          isLoading={isPending || isConfirming}
          txStatus={getTxStatus()}
          txHash={hash}
          onTxReset={reset}
        >
          <AddressInput
            label="New Team Address"
            value={newTeam}
            onChange={setNewTeam}
            required
            helperText="The new team must call acceptTeam() to complete the transfer"
          />
        </AdminFunctionForm>

        {/* Accept Team */}
        <AdminFunctionForm
          title="Accept Team (Step 2)"
          description="Accept pending team transfer"
          permission="team"
          hasPermission={isPendingTeam}
          onSubmit={handleAcceptTeam}
          submitLabel="Accept Team Role"
          isLoading={isPending || isConfirming}
          txStatus={getTxStatus()}
          txHash={hash}
          onTxReset={reset}
        >
          <div className="bg-ds-gray-200 rounded-lg p-4">
            <p className="text-sm text-ds-gray-700">
              {pendingTeam &&
              pendingTeam !== "0x0000000000000000000000000000000000000000" ? (
                <>
                  Pending team transfer to:{" "}
                  <span className="font-geist-mono text-ds-blue-400">
                    {pendingTeam.slice(0, 6)}...{pendingTeam.slice(-4)}
                  </span>
                </>
              ) : (
                "No pending team transfer"
              )}
            </p>
          </div>
        </AdminFunctionForm>
      </div>

      {/* Settings */}
      <h3 className="text-sm font-semibold text-ds-gray-1000 mt-8">Settings</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Set Team Rate */}
        <AdminFunctionForm
          title="Set Team Rate"
          description="Set the team's share of emissions"
          permission="team"
          hasPermission={isTeam}
          onSubmit={handleSetTeamRate}
          submitLabel="Set Team Rate"
          isLoading={isPending || isConfirming}
          txStatus={getTxStatus()}
          txHash={hash}
          onTxReset={reset}
        >
          <NumberInput
            label="Team Rate (basis points)"
            value={newTeamRate}
            onChange={setNewTeamRate}
            required
            max={500}
            helperText="Max: 500 bps (5%). Current: ${teamRate !== undefined ? `${Number(teamRate)} bps` : '-'}"
            suffix="bps"
          />
        </AdminFunctionForm>

        {/* Set Rewards Distributor */}
        <AdminFunctionForm
          title="Set Rewards Distributor"
          description="Set the RewardsDistributor contract address"
          permission="team"
          hasPermission={isTeam}
          onSubmit={handleSetRewardsDistributor}
          submitLabel="Set Distributor"
          isLoading={isPending || isConfirming}
          txStatus={getTxStatus()}
          txHash={hash}
          onTxReset={reset}
        >
          <AddressInput
            label="Rewards Distributor Address"
            value={newDistributor}
            onChange={setNewDistributor}
            required
          />
        </AdminFunctionForm>
      </div>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        onConfirm={confirmAction?.onConfirm || (() => {})}
        title="Confirm Team Transfer"
        description="This will propose a new team address. The new address must call acceptTeam() to complete the transfer."
        variant="warning"
        confirmLabel="Propose Transfer"
      />
    </div>
  );
}
