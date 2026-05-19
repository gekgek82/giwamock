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
  ConfirmDialog,
  TxStatus,
} from "@/components/admin/contracts";
import { useContractAddresses } from "@/hooks/useContractAddresses";
import { ABIs } from "@giwater/shared/abis";
import toast from "react-hot-toast";
import { Toggle } from "@/components/admin/ui/Toggle";

// ============================================================================
// Component
// ============================================================================

export default function VotingEscrowPage() {
  const { address: userAddress } = useAccount();
  const { contracts } = useContractAddresses();

  // Form states
  const [newTeam, setNewTeam] = useState("");
  const [newArtProxy, setNewArtProxy] = useState("");
  const [newVoter, setNewVoter] = useState("");
  const [newDistributor, setNewDistributor] = useState("");
  const [newAllowedManager, setNewAllowedManager] = useState("");
  const [splitAddress, setSplitAddress] = useState("");
  const [splitEnabled, setSplitEnabled] = useState(true);
  const [managedLockRecipient, setManagedLockRecipient] = useState("");

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
        address: contracts?.votingEscrow as `0x${string}`,
        abi: ABIs.VotingEscrow,
        functionName: "team",
      },
      {
        address: contracts?.votingEscrow as `0x${string}`,
        abi: ABIs.VotingEscrow,
        functionName: "voter",
      },
      {
        address: contracts?.votingEscrow as `0x${string}`,
        abi: ABIs.VotingEscrow,
        functionName: "artProxy",
      },
      {
        address: contracts?.votingEscrow as `0x${string}`,
        abi: ABIs.VotingEscrow,
        functionName: "distributor",
      },
      {
        address: contracts?.votingEscrow as `0x${string}`,
        abi: ABIs.VotingEscrow,
        functionName: "allowedManager",
      },
      {
        address: contracts?.votingEscrow as `0x${string}`,
        abi: ABIs.VotingEscrow,
        functionName: "supply",
      },
      {
        address: contracts?.votingEscrow as `0x${string}`,
        abi: ABIs.VotingEscrow,
        functionName: "totalSupply",
      },
      {
        address: contracts?.votingEscrow as `0x${string}`,
        abi: ABIs.VotingEscrow,
        functionName: "permanentLockBalance",
      },
      {
        address: contracts?.votingEscrow as `0x${string}`,
        abi: ABIs.VotingEscrow,
        functionName: "epoch",
      },
    ],
    query: {
      enabled: !!contracts?.votingEscrow,
    },
  });

  // Extract data
  const team = contractData?.[0]?.result as string | undefined;
  const voter = contractData?.[1]?.result as string | undefined;
  const artProxy = contractData?.[2]?.result as string | undefined;
  const distributor = contractData?.[3]?.result as string | undefined;
  const allowedManager = contractData?.[4]?.result as string | undefined;
  const supply = contractData?.[5]?.result as bigint | undefined;
  const totalSupply = contractData?.[6]?.result as bigint | undefined;
  const permanentLockBalance = contractData?.[7]?.result as bigint | undefined;
  const epoch = contractData?.[8]?.result as bigint | undefined;

  // Check permissions
  const isTeam =
    userAddress && team?.toLowerCase() === userAddress.toLowerCase();
  const isAllowedManager =
    userAddress && allowedManager?.toLowerCase() === userAddress.toLowerCase();

  // Write handlers
  const handleSetTeam = useCallback(() => {
    if (!contracts?.votingEscrow || !newTeam) return;
    setConfirmAction({
      type: "setTeam",
      onConfirm: () => {
        writeContract({
          address: contracts.votingEscrow as `0x${string}`,
          abi: ABIs.VotingEscrow,
          functionName: "setTeam",
          args: [newTeam as `0x${string}`],
        });
        setConfirmAction(null);
        toast.success("Transaction submitted");
      },
    });
  }, [contracts?.votingEscrow, newTeam, writeContract]);

  const handleSetArtProxy = useCallback(() => {
    if (!contracts?.votingEscrow || !newArtProxy) return;
    writeContract({
      address: contracts.votingEscrow as `0x${string}`,
      abi: ABIs.VotingEscrow,
      functionName: "setArtProxy",
      args: [newArtProxy as `0x${string}`],
    });
    toast.success("Transaction submitted");
  }, [contracts?.votingEscrow, newArtProxy, writeContract]);

  const handleSetVoter = useCallback(() => {
    if (!contracts?.votingEscrow || !newVoter) return;
    writeContract({
      address: contracts.votingEscrow as `0x${string}`,
      abi: ABIs.VotingEscrow,
      functionName: "setVoter",
      args: [newVoter as `0x${string}`],
    });
    toast.success("Transaction submitted");
  }, [contracts?.votingEscrow, newVoter, writeContract]);

  const handleSetDistributor = useCallback(() => {
    if (!contracts?.votingEscrow || !newDistributor) return;
    writeContract({
      address: contracts.votingEscrow as `0x${string}`,
      abi: ABIs.VotingEscrow,
      functionName: "setDistributor",
      args: [newDistributor as `0x${string}`],
    });
    toast.success("Transaction submitted");
  }, [contracts?.votingEscrow, newDistributor, writeContract]);

  const handleSetAllowedManager = useCallback(() => {
    if (!contracts?.votingEscrow || !newAllowedManager) return;
    writeContract({
      address: contracts.votingEscrow as `0x${string}`,
      abi: ABIs.VotingEscrow,
      functionName: "setAllowedManager",
      args: [newAllowedManager as `0x${string}`],
    });
    toast.success("Transaction submitted");
  }, [contracts?.votingEscrow, newAllowedManager, writeContract]);

  const handleToggleSplit = useCallback(() => {
    if (!contracts?.votingEscrow || !splitAddress) return;
    writeContract({
      address: contracts.votingEscrow as `0x${string}`,
      abi: ABIs.VotingEscrow,
      functionName: "toggleSplit",
      args: [splitAddress as `0x${string}`, splitEnabled],
    });
    toast.success("Transaction submitted");
  }, [contracts?.votingEscrow, splitAddress, splitEnabled, writeContract]);

  const handleCreateManagedLock = useCallback(() => {
    if (!contracts?.votingEscrow || !managedLockRecipient) return;
    writeContract({
      address: contracts.votingEscrow as `0x${string}`,
      abi: ABIs.VotingEscrow,
      functionName: "createManagedLockFor",
      args: [managedLockRecipient as `0x${string}`],
    });
    toast.success("Transaction submitted");
  }, [contracts?.votingEscrow, managedLockRecipient, writeContract]);

  const stateItems = [
    { label: "Team", value: team || "-", type: "address" as const },
    { label: "Voter", value: voter || "-", type: "address" as const },
    { label: "Art Proxy", value: artProxy || "-", type: "address" as const },
    {
      label: "Distributor",
      value: distributor || "-",
      type: "address" as const,
    },
    {
      label: "Allowed Manager",
      value: allowedManager || "-",
      type: "address" as const,
    },
    {
      label: "Total Locked Supply",
      value: supply
        ? `${Number(formatEther(supply)).toLocaleString()} TER`
        : "-",
      type: "text" as const,
    },
    {
      label: "Total Voting Power",
      value: totalSupply
        ? `${Number(formatEther(totalSupply)).toLocaleString()}`
        : "-",
      type: "text" as const,
    },
    {
      label: "Permanent Lock Balance",
      value: permanentLockBalance
        ? `${Number(formatEther(permanentLockBalance)).toLocaleString()} TER`
        : "-",
      type: "text" as const,
    },
    {
      label: "Current Epoch",
      value: epoch?.toString() || "-",
      type: "number" as const,
    },
  ];

  return (
    <div className="space-y-6">
      {/* State Card */}
      <ContractStateCard
        title="VotingEscrow State"
        description="Current state of the VotingEscrow contract"
        contractAddress={contracts?.votingEscrow}
        items={stateItems}
        isLoading={isLoadingData}
        onRefresh={() => refetch()}
      />

      {/* Admin Functions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Set Team */}
        <AdminFunctionForm
          title="Set Team"
          description="Transfer team ownership to a new address"
          permission="team"
          hasPermission={isTeam}
          onSubmit={handleSetTeam}
          submitLabel="Set Team"
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
            helperText="Warning: This will transfer team ownership"
          />
        </AdminFunctionForm>

        {/* Set Art Proxy */}
        <AdminFunctionForm
          title="Set Art Proxy"
          description="Set the NFT art proxy contract address"
          permission="team"
          hasPermission={isTeam}
          onSubmit={handleSetArtProxy}
          submitLabel="Set Art Proxy"
          isLoading={isPending || isConfirming}
          txStatus={getTxStatus()}
          txHash={hash}
          onTxReset={reset}
        >
          <AddressInput
            label="Art Proxy Address"
            value={newArtProxy}
            onChange={setNewArtProxy}
            required
          />
        </AdminFunctionForm>

        {/* Set Voter */}
        <AdminFunctionForm
          title="Set Voter"
          description="Set the Voter contract address"
          permission="team"
          hasPermission={isTeam}
          onSubmit={handleSetVoter}
          submitLabel="Set Voter"
          isLoading={isPending || isConfirming}
          txStatus={getTxStatus()}
          txHash={hash}
          onTxReset={reset}
        >
          <AddressInput
            label="Voter Address"
            value={newVoter}
            onChange={setNewVoter}
            required
          />
        </AdminFunctionForm>

        {/* Set Distributor */}
        <AdminFunctionForm
          title="Set Distributor"
          description="Set the RewardsDistributor contract address"
          permission="team"
          hasPermission={isTeam}
          onSubmit={handleSetDistributor}
          submitLabel="Set Distributor"
          isLoading={isPending || isConfirming}
          txStatus={getTxStatus()}
          txHash={hash}
          onTxReset={reset}
        >
          <AddressInput
            label="Distributor Address"
            value={newDistributor}
            onChange={setNewDistributor}
            required
          />
        </AdminFunctionForm>

        {/* Set Allowed Manager */}
        <AdminFunctionForm
          title="Set Allowed Manager"
          description="Set the address allowed to create managed locks"
          permission="team"
          hasPermission={isTeam}
          onSubmit={handleSetAllowedManager}
          submitLabel="Set Allowed Manager"
          isLoading={isPending || isConfirming}
          txStatus={getTxStatus()}
          txHash={hash}
          onTxReset={reset}
        >
          <AddressInput
            label="Allowed Manager Address"
            value={newAllowedManager}
            onChange={setNewAllowedManager}
            required
          />
        </AdminFunctionForm>

        {/* Toggle Split */}
        <AdminFunctionForm
          title="Toggle Split"
          description="Enable or disable NFT splitting for an address"
          permission="team"
          hasPermission={isTeam}
          onSubmit={handleToggleSplit}
          submitLabel="Toggle Split"
          isLoading={isPending || isConfirming}
          txStatus={getTxStatus()}
          txHash={hash}
          onTxReset={reset}
        >
          <AddressInput
            label="Address"
            value={splitAddress}
            onChange={setSplitAddress}
            required
          />
          <div className="flex items-center gap-3 mt-4">
            <Toggle
              checked={splitEnabled}
              onChange={setSplitEnabled}
              label={splitEnabled ? "Enable Split" : "Disable Split"}
            />
          </div>
        </AdminFunctionForm>

        {/* Create Managed Lock */}
        <AdminFunctionForm
          title="Create Managed Lock"
          description="Create a managed veTER NFT for an address"
          permission="team"
          hasPermission={isTeam || isAllowedManager}
          onSubmit={handleCreateManagedLock}
          submitLabel="Create Managed Lock"
          isLoading={isPending || isConfirming}
          txStatus={getTxStatus()}
          txHash={hash}
          onTxReset={reset}
        >
          <AddressInput
            label="Recipient Address"
            value={managedLockRecipient}
            onChange={setManagedLockRecipient}
            required
            helperText="The address that will receive the managed lock NFT"
          />
        </AdminFunctionForm>
      </div>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        onConfirm={confirmAction?.onConfirm || (() => {})}
        title="Confirm Team Transfer"
        description="This action will transfer team ownership to a new address. This cannot be undone without the new team's cooperation."
        variant="danger"
        confirmLabel="Transfer Ownership"
      />
    </div>
  );
}
