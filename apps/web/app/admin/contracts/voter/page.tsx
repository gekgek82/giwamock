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
import { Toggle } from "@/components/admin/ui/Toggle";

// ============================================================================
// Component
// ============================================================================

export default function VoterPage() {
  const { address: userAddress } = useAccount();
  const { contracts } = useContractAddresses();

  // Form states
  const [newGovernor, setNewGovernor] = useState("");
  const [newEpochGovernor, setNewEpochGovernor] = useState("");
  const [newEmergencyCouncil, setNewEmergencyCouncil] = useState("");
  const [newMaxVotingNum, setNewMaxVotingNum] = useState("");
  const [newMinter, setNewMinter] = useState("");
  const [newFactoryRegistry, setNewFactoryRegistry] = useState("");

  // Whitelist states
  const [whitelistToken, setWhitelistToken] = useState("");
  const [tokenWhitelistStatus, setTokenWhitelistStatus] = useState(true);
  const [whitelistNFT, setWhitelistNFT] = useState("");
  const [nftWhitelistStatus, setNftWhitelistStatus] = useState(true);

  // Create gauge states
  const [createGaugePoolFactory, setCreateGaugePoolFactory] = useState("");
  const [createGaugePool, setCreateGaugePool] = useState("");

  // Factory approval states
  const [poolFactory, setPoolFactory] = useState("");
  const [gaugeFactory, setGaugeFactory] = useState("");
  const [votingRewardsFactory, setVotingRewardsFactory] = useState("");

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
        address: contracts?.voter as `0x${string}`,
        abi: ABIs.Voter,
        functionName: "governor",
      },
      {
        address: contracts?.voter as `0x${string}`,
        abi: ABIs.Voter,
        functionName: "epochGovernor",
      },
      {
        address: contracts?.voter as `0x${string}`,
        abi: ABIs.Voter,
        functionName: "emergencyCouncil",
      },
      {
        address: contracts?.voter as `0x${string}`,
        abi: ABIs.Voter,
        functionName: "minter",
      },
      {
        address: contracts?.voter as `0x${string}`,
        abi: ABIs.Voter,
        functionName: "ve",
      },
      {
        address: contracts?.voter as `0x${string}`,
        abi: ABIs.Voter,
        functionName: "factoryRegistry",
      },
      {
        address: contracts?.voter as `0x${string}`,
        abi: ABIs.Voter,
        functionName: "totalWeight",
      },
      {
        address: contracts?.voter as `0x${string}`,
        abi: ABIs.Voter,
        functionName: "maxVotingNum",
      },
      {
        address: contracts?.voter as `0x${string}`,
        abi: ABIs.Voter,
        functionName: "length",
      },
    ],
    query: {
      enabled: !!contracts?.voter,
    },
  });

  // Extract data
  const governor = contractData?.[0]?.result as string | undefined;
  const epochGovernor = contractData?.[1]?.result as string | undefined;
  const emergencyCouncil = contractData?.[2]?.result as string | undefined;
  const minter = contractData?.[3]?.result as string | undefined;
  const ve = contractData?.[4]?.result as string | undefined;
  const factoryRegistry = contractData?.[5]?.result as string | undefined;
  const totalWeight = contractData?.[6]?.result as bigint | undefined;
  const maxVotingNum = contractData?.[7]?.result as bigint | undefined;
  const gaugeCount = contractData?.[8]?.result as bigint | undefined;

  // Check permissions
  const isGovernor =
    userAddress && governor?.toLowerCase() === userAddress.toLowerCase();
  const isEmergencyCouncilMember =
    userAddress &&
    emergencyCouncil?.toLowerCase() === userAddress.toLowerCase();

  // Write handlers
  const handleSetGovernor = useCallback(() => {
    if (!contracts?.voter || !newGovernor) return;
    setConfirmAction({
      type: "setGovernor",
      onConfirm: () => {
        writeContract({
          address: contracts.voter as `0x${string}`,
          abi: ABIs.Voter,
          functionName: "setGovernor",
          args: [newGovernor as `0x${string}`],
        });
        setConfirmAction(null);
        toast.success("Transaction submitted");
      },
    });
  }, [contracts?.voter, newGovernor, writeContract]);

  const handleSetEpochGovernor = useCallback(() => {
    if (!contracts?.voter || !newEpochGovernor) return;
    writeContract({
      address: contracts.voter as `0x${string}`,
      abi: ABIs.Voter,
      functionName: "setEpochGovernor",
      args: [newEpochGovernor as `0x${string}`],
    });
    toast.success("Transaction submitted");
  }, [contracts?.voter, newEpochGovernor, writeContract]);

  const handleSetEmergencyCouncil = useCallback(() => {
    if (!contracts?.voter || !newEmergencyCouncil) return;
    setConfirmAction({
      type: "setEmergencyCouncil",
      onConfirm: () => {
        writeContract({
          address: contracts.voter as `0x${string}`,
          abi: ABIs.Voter,
          functionName: "setEmergencyCouncil",
          args: [newEmergencyCouncil as `0x${string}`],
        });
        setConfirmAction(null);
        toast.success("Transaction submitted");
      },
    });
  }, [contracts?.voter, newEmergencyCouncil, writeContract]);

  const handleSetMaxVotingNum = useCallback(() => {
    if (!contracts?.voter || !newMaxVotingNum) return;
    writeContract({
      address: contracts.voter as `0x${string}`,
      abi: ABIs.Voter,
      functionName: "setMaxVotingNum",
      args: [BigInt(newMaxVotingNum)],
    });
    toast.success("Transaction submitted");
  }, [contracts?.voter, newMaxVotingNum, writeContract]);

  const handleSetMinter = useCallback(() => {
    if (!contracts?.voter || !newMinter) return;
    writeContract({
      address: contracts.voter as `0x${string}`,
      abi: ABIs.Voter,
      functionName: "setMinter",
      args: [newMinter as `0x${string}`],
    });
    toast.success("Transaction submitted");
  }, [contracts?.voter, newMinter, writeContract]);

  const handleSetFactoryRegistry = useCallback(() => {
    if (!contracts?.voter || !newFactoryRegistry) return;
    writeContract({
      address: contracts.voter as `0x${string}`,
      abi: ABIs.Voter,
      functionName: "setFactoryRegistry",
      args: [newFactoryRegistry as `0x${string}`],
    });
    toast.success("Transaction submitted");
  }, [contracts?.voter, newFactoryRegistry, writeContract]);

  const handleWhitelistToken = useCallback(() => {
    if (!contracts?.voter || !whitelistToken) return;
    writeContract({
      address: contracts.voter as `0x${string}`,
      abi: ABIs.Voter,
      functionName: "whitelistToken",
      args: [whitelistToken as `0x${string}`, tokenWhitelistStatus],
    });
    toast.success("Transaction submitted");
  }, [contracts?.voter, whitelistToken, tokenWhitelistStatus, writeContract]);

  const handleWhitelistNFT = useCallback(() => {
    if (!contracts?.voter || !whitelistNFT) return;
    writeContract({
      address: contracts.voter as `0x${string}`,
      abi: ABIs.Voter,
      functionName: "whitelistNFT",
      args: [BigInt(whitelistNFT), nftWhitelistStatus],
    });
    toast.success("Transaction submitted");
  }, [contracts?.voter, whitelistNFT, nftWhitelistStatus, writeContract]);

  const handleCreateGauge = useCallback(() => {
    if (!contracts?.voter || !createGaugePoolFactory || !createGaugePool) return;
    writeContract({
      address: contracts.voter as `0x${string}`,
      abi: ABIs.Voter,
      functionName: "createGauge",
      args: [
        createGaugePoolFactory as `0x${string}`,
        createGaugePool as `0x${string}`,
      ],
    });
    toast.success("Transaction submitted");
  }, [contracts?.voter, createGaugePoolFactory, createGaugePool, writeContract]);

  const handleApproveFactory = useCallback(() => {
    if (
      !contracts?.voter ||
      !poolFactory ||
      !gaugeFactory ||
      !votingRewardsFactory
    )
      return;
    writeContract({
      address: contracts.voter as `0x${string}`,
      abi: ABIs.Voter,
      functionName: "approveFactory",
      args: [
        poolFactory as `0x${string}`,
        gaugeFactory as `0x${string}`,
        votingRewardsFactory as `0x${string}`,
      ],
    });
    toast.success("Transaction submitted");
  }, [
    contracts?.voter,
    poolFactory,
    gaugeFactory,
    votingRewardsFactory,
    writeContract,
  ]);

  const stateItems = [
    { label: "Governor", value: governor || "-", type: "address" as const },
    {
      label: "Epoch Governor",
      value: epochGovernor || "-",
      type: "address" as const,
    },
    {
      label: "Emergency Council",
      value: emergencyCouncil || "-",
      type: "address" as const,
    },
    { label: "Minter", value: minter || "-", type: "address" as const },
    { label: "VotingEscrow", value: ve || "-", type: "address" as const },
    {
      label: "Factory Registry",
      value: factoryRegistry || "-",
      type: "address" as const,
    },
    {
      label: "Total Weight",
      value: totalWeight
        ? `${Number(formatEther(totalWeight)).toLocaleString()}`
        : "-",
      type: "text" as const,
    },
    {
      label: "Max Voting Num",
      value: maxVotingNum?.toString() || "-",
      type: "number" as const,
    },
    {
      label: "Total Gauges",
      value: gaugeCount?.toString() || "-",
      type: "number" as const,
    },
  ];

  return (
    <div className="space-y-6">
      {/* State Card */}
      <ContractStateCard
        title="Voter State"
        description="Current state of the Voter contract"
        contractAddress={contracts?.voter}
        items={stateItems}
        isLoading={isLoadingData}
        onRefresh={() => refetch()}
      />

      {/* Governor Settings */}
      <h3 className="text-sm font-semibold text-ds-gray-1000">Governor Settings</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Set Governor */}
        <AdminFunctionForm
          title="Set Governor"
          description="Transfer governor role to a new address"
          permission="governor"
          hasPermission={isGovernor}
          onSubmit={handleSetGovernor}
          submitLabel="Set Governor"
          isLoading={isPending || isConfirming}
          txStatus={getTxStatus()}
          txHash={hash}
          onTxReset={reset}
        >
          <AddressInput
            label="New Governor Address"
            value={newGovernor}
            onChange={setNewGovernor}
            required
            helperText="Warning: This will transfer governor role"
          />
        </AdminFunctionForm>

        {/* Set Epoch Governor */}
        <AdminFunctionForm
          title="Set Epoch Governor"
          description="Set the Epoch Governor contract address"
          permission="governor"
          hasPermission={isGovernor}
          onSubmit={handleSetEpochGovernor}
          submitLabel="Set Epoch Governor"
          isLoading={isPending || isConfirming}
          txStatus={getTxStatus()}
          txHash={hash}
          onTxReset={reset}
        >
          <AddressInput
            label="Epoch Governor Address"
            value={newEpochGovernor}
            onChange={setNewEpochGovernor}
            required
          />
        </AdminFunctionForm>

        {/* Set Emergency Council */}
        <AdminFunctionForm
          title="Set Emergency Council"
          description="Set the emergency council address"
          permission="governor"
          hasPermission={isGovernor}
          onSubmit={handleSetEmergencyCouncil}
          submitLabel="Set Emergency Council"
          isLoading={isPending || isConfirming}
          txStatus={getTxStatus()}
          txHash={hash}
          onTxReset={reset}
        >
          <AddressInput
            label="Emergency Council Address"
            value={newEmergencyCouncil}
            onChange={setNewEmergencyCouncil}
            required
          />
        </AdminFunctionForm>

        {/* Set Max Voting Num */}
        <AdminFunctionForm
          title="Set Max Voting Num"
          description="Set the maximum number of pools a user can vote on"
          permission="governor"
          hasPermission={isGovernor}
          onSubmit={handleSetMaxVotingNum}
          submitLabel="Set Max Voting Num"
          isLoading={isPending || isConfirming}
          txStatus={getTxStatus()}
          txHash={hash}
          onTxReset={reset}
        >
          <NumberInput
            label="Max Voting Num"
            value={newMaxVotingNum}
            onChange={setNewMaxVotingNum}
            required
            min={10}
            helperText="Minimum value is 10"
          />
        </AdminFunctionForm>

        {/* Set Minter */}
        <AdminFunctionForm
          title="Set Minter"
          description="Set the Minter contract address"
          permission="governor"
          hasPermission={isGovernor}
          onSubmit={handleSetMinter}
          submitLabel="Set Minter"
          isLoading={isPending || isConfirming}
          txStatus={getTxStatus()}
          txHash={hash}
          onTxReset={reset}
        >
          <AddressInput
            label="Minter Address"
            value={newMinter}
            onChange={setNewMinter}
            required
          />
        </AdminFunctionForm>

        {/* Set Factory Registry */}
        <AdminFunctionForm
          title="Set Factory Registry"
          description="Set the Factory Registry contract address"
          permission="governor"
          hasPermission={isGovernor}
          onSubmit={handleSetFactoryRegistry}
          submitLabel="Set Factory Registry"
          isLoading={isPending || isConfirming}
          txStatus={getTxStatus()}
          txHash={hash}
          onTxReset={reset}
        >
          <AddressInput
            label="Factory Registry Address"
            value={newFactoryRegistry}
            onChange={setNewFactoryRegistry}
            required
          />
        </AdminFunctionForm>
      </div>

      {/* Whitelist Management */}
      <h3 className="text-sm font-semibold text-ds-gray-1000 mt-8">
        Whitelist Management
      </h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Whitelist Token */}
        <AdminFunctionForm
          title="Whitelist Token"
          description="Add or remove a token from the whitelist"
          permission="governor"
          hasPermission={isGovernor}
          onSubmit={handleWhitelistToken}
          submitLabel="Update Whitelist"
          isLoading={isPending || isConfirming}
          txStatus={getTxStatus()}
          txHash={hash}
          onTxReset={reset}
        >
          <AddressInput
            label="Token Address"
            value={whitelistToken}
            onChange={setWhitelistToken}
            required
          />
          <div className="flex items-center gap-3 mt-4">
            <Toggle
              checked={tokenWhitelistStatus}
              onChange={setTokenWhitelistStatus}
              label={tokenWhitelistStatus ? "Add to Whitelist" : "Remove from Whitelist"}
            />
          </div>
        </AdminFunctionForm>

        {/* Whitelist NFT */}
        <AdminFunctionForm
          title="Whitelist NFT"
          description="Add or remove a veTER NFT from the whitelist"
          permission="governor"
          hasPermission={isGovernor}
          onSubmit={handleWhitelistNFT}
          submitLabel="Update NFT Whitelist"
          isLoading={isPending || isConfirming}
          txStatus={getTxStatus()}
          txHash={hash}
          onTxReset={reset}
        >
          <NumberInput
            label="NFT Token ID"
            value={whitelistNFT}
            onChange={setWhitelistNFT}
            required
            helperText="Enter the veTER NFT token ID"
          />
          <div className="flex items-center gap-3 mt-4">
            <Toggle
              checked={nftWhitelistStatus}
              onChange={setNftWhitelistStatus}
              label={nftWhitelistStatus ? "Add to Whitelist" : "Remove from Whitelist"}
            />
          </div>
        </AdminFunctionForm>
      </div>

      {/* Gauge Management */}
      <h3 className="text-sm font-semibold text-ds-gray-1000 mt-8">Gauge Management</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Create Gauge */}
        <AdminFunctionForm
          title="Create Gauge"
          description="Create a new gauge for a pool"
          permission="governor"
          hasPermission={isGovernor}
          onSubmit={handleCreateGauge}
          submitLabel="Create Gauge"
          isLoading={isPending || isConfirming}
          txStatus={getTxStatus()}
          txHash={hash}
          onTxReset={reset}
        >
          <div className="space-y-4">
            <AddressInput
              label="Pool Factory Address"
              value={createGaugePoolFactory}
              onChange={setCreateGaugePoolFactory}
              required
              helperText="The factory that created the pool"
            />
            <AddressInput
              label="Pool Address"
              value={createGaugePool}
              onChange={setCreateGaugePool}
              required
              helperText="The pool to create a gauge for"
            />
          </div>
        </AdminFunctionForm>
      </div>

      {/* Factory Approval */}
      <h3 className="text-sm font-semibold text-ds-gray-1000 mt-8">Factory Approval</h3>
      <div className="grid grid-cols-1 gap-6">
        {/* Approve Factory */}
        <AdminFunctionForm
          title="Approve Factory"
          description="Approve a Pool Factory and link it with Gauge and VotingRewards factories"
          permission="governor"
          hasPermission={isGovernor}
          onSubmit={handleApproveFactory}
          submitLabel="Approve Factory"
          isLoading={isPending || isConfirming}
          txStatus={getTxStatus()}
          txHash={hash}
          onTxReset={reset}
        >
          <div className="space-y-4">
            <AddressInput
              label="Pool Factory Address"
              value={poolFactory}
              onChange={setPoolFactory}
              required
            />
            <AddressInput
              label="Gauge Factory Address"
              value={gaugeFactory}
              onChange={setGaugeFactory}
              required
            />
            <AddressInput
              label="Voting Rewards Factory Address"
              value={votingRewardsFactory}
              onChange={setVotingRewardsFactory}
              required
            />
          </div>
        </AdminFunctionForm>
      </div>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        onConfirm={confirmAction?.onConfirm || (() => {})}
        title={
          confirmAction?.type === "setGovernor"
            ? "Confirm Governor Transfer"
            : "Confirm Action"
        }
        description={
          confirmAction?.type === "setGovernor"
            ? "This action will transfer governor role to a new address. This cannot be undone without the new governor's cooperation."
            : "This action will update the emergency council address."
        }
        variant="danger"
        confirmLabel="Confirm"
      />
    </div>
  );
}
