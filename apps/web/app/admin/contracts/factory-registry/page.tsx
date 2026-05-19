"use client";

import { useState, useCallback } from "react";
import {
  useAccount,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
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

export default function FactoryRegistryPage() {
  const { address: userAddress } = useAccount();
  const { contracts } = useContractAddresses();

  // Form states
  const [newOwner, setNewOwner] = useState("");
  const [newFallbackPoolFactory, setNewFallbackPoolFactory] = useState("");

  // Approve factory states
  const [approvePoolFactory, setApprovePoolFactory] = useState("");
  const [approveVotingRewardsFactory, setApproveVotingRewardsFactory] =
    useState("");
  const [approveGaugeFactory, setApproveGaugeFactory] = useState("");
  const [isCL, setIsCL] = useState(false);

  // Unapprove state
  const [unapprovePoolFactory, setUnapprovePoolFactory] = useState("");

  // Confirm dialog state
  const [confirmAction, setConfirmAction] = useState<{
    type: string;
    onConfirm: () => void;
  } | null>(null);

  // Contract write
  const {
    data: hash,
    writeContractAsync,
    isPending,
    reset,
  } = useWriteContract();

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
        address: contracts?.factoryRegistry as `0x${string}`,
        abi: ABIs.FactoryRegistry,
        functionName: "owner",
      },
      {
        address: contracts?.factoryRegistry as `0x${string}`,
        abi: ABIs.FactoryRegistry,
        functionName: "fallbackPoolFactory",
      },
      {
        address: contracts?.factoryRegistry as `0x${string}`,
        abi: ABIs.FactoryRegistry,
        functionName: "poolFactoriesLength",
      },
    ],
    query: {
      enabled: !!contracts?.factoryRegistry,
    },
  });

  // Extract data
  const owner = contractData?.[0]?.result as string | undefined;
  const fallbackPoolFactory = contractData?.[1]?.result as string | undefined;
  const factoryCount = contractData?.[2]?.result as bigint | undefined;

  // Check permissions
  const isOwner =
    userAddress && owner?.toLowerCase() === userAddress.toLowerCase();

  // Helper to execute a write and show proper toast
  const execWrite = useCallback(
    async (params: Parameters<typeof writeContractAsync>[0]) => {
      try {
        await writeContractAsync(params);
        toast.success("Transaction submitted");
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : "Transaction failed";
        if (!msg.includes("User rejected")) {
          toast.error(msg.length > 120 ? msg.slice(0, 120) + "…" : msg);
        }
      }
    },
    [writeContractAsync],
  );

  // Write handlers
  const handleSetOwner = useCallback(() => {
    if (!contracts?.factoryRegistry || !newOwner) return;
    setConfirmAction({
      type: "setOwner",
      onConfirm: async () => {
        setConfirmAction(null);
        await execWrite({
          address: contracts.factoryRegistry as `0x${string}`,
          abi: ABIs.FactoryRegistry,
          functionName: "setOwner",
          args: [newOwner as `0x${string}`],
        });
      },
    });
  }, [contracts?.factoryRegistry, newOwner, execWrite]);

  const handleSetFallbackPoolFactory = useCallback(async () => {
    if (!contracts?.factoryRegistry || !newFallbackPoolFactory) return;
    await execWrite({
      address: contracts.factoryRegistry as `0x${string}`,
      abi: ABIs.FactoryRegistry,
      functionName: "setFallbackPoolFactory",
      args: [newFallbackPoolFactory as `0x${string}`],
    });
  }, [contracts?.factoryRegistry, newFallbackPoolFactory, execWrite]);

  const handleApproveFactory = useCallback(async () => {
    if (
      !contracts?.factoryRegistry ||
      !approvePoolFactory ||
      !approveVotingRewardsFactory ||
      !approveGaugeFactory
    )
      return;

    const functionName = isCL ? "approveCL" : "approve";
    await execWrite({
      address: contracts.factoryRegistry as `0x${string}`,
      abi: ABIs.FactoryRegistry,
      functionName,
      args: [
        approvePoolFactory as `0x${string}`,
        approveVotingRewardsFactory as `0x${string}`,
        approveGaugeFactory as `0x${string}`,
      ],
    });
  }, [
    contracts?.factoryRegistry,
    approvePoolFactory,
    approveVotingRewardsFactory,
    approveGaugeFactory,
    isCL,
    execWrite,
  ]);

  const handleUnapproveFactory = useCallback(() => {
    if (!contracts?.factoryRegistry || !unapprovePoolFactory) return;
    setConfirmAction({
      type: "unapprove",
      onConfirm: async () => {
        setConfirmAction(null);
        await execWrite({
          address: contracts.factoryRegistry as `0x${string}`,
          abi: ABIs.FactoryRegistry,
          functionName: "unapprove",
          args: [unapprovePoolFactory as `0x${string}`],
        });
      },
    });
  }, [contracts?.factoryRegistry, unapprovePoolFactory, execWrite]);

  const stateItems = [
    { label: "Owner", value: owner || "-", type: "address" as const },
    {
      label: "Fallback Pool Factory",
      value: fallbackPoolFactory || "-",
      type: "address" as const,
    },
    {
      label: "Approved Factory Count",
      value: factoryCount?.toString() || "-",
      type: "number" as const,
    },
  ];

  return (
    <div className="space-y-6">
      {/* State Card */}
      <ContractStateCard
        title="FactoryRegistry State"
        description="Current state of the FactoryRegistry contract"
        contractAddress={contracts?.factoryRegistry}
        items={stateItems}
        isLoading={isLoadingData}
        onRefresh={() => refetch()}
      />

      {/* Owner Management */}
      <h3 className="text-sm font-semibold text-ds-gray-1000">Owner Management</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Set Owner */}
        <AdminFunctionForm
          title="Set Owner"
          description="Transfer ownership to a new address"
          permission="owner"
          hasPermission={isOwner}
          onSubmit={handleSetOwner}
          submitLabel="Transfer Ownership"
          isLoading={isPending || isConfirming}
          txStatus={getTxStatus()}
          txHash={hash}
          onTxReset={reset}
        >
          <AddressInput
            label="New Owner Address"
            value={newOwner}
            onChange={setNewOwner}
            required
            helperText="Warning: This will transfer full control of the registry"
          />
        </AdminFunctionForm>

        {/* Set Fallback Pool Factory */}
        <AdminFunctionForm
          title="Set Fallback Pool Factory"
          description="Set the fallback pool factory for unregistered pools"
          permission="owner"
          hasPermission={isOwner}
          onSubmit={handleSetFallbackPoolFactory}
          submitLabel="Set Fallback Factory"
          isLoading={isPending || isConfirming}
          txStatus={getTxStatus()}
          txHash={hash}
          onTxReset={reset}
        >
          <AddressInput
            label="Fallback Pool Factory Address"
            value={newFallbackPoolFactory}
            onChange={setNewFallbackPoolFactory}
            required
          />
        </AdminFunctionForm>
      </div>

      {/* Factory Approval */}
      <h3 className="text-sm font-semibold text-ds-gray-1000 mt-8">Factory Approval</h3>
      <div className="grid grid-cols-1 gap-6">
        {/* Approve Factory */}
        <AdminFunctionForm
          title="Approve Factory"
          description="Approve a new pool factory with its associated gauge and voting rewards factories"
          permission="owner"
          hasPermission={isOwner}
          onSubmit={handleApproveFactory}
          submitLabel={isCL ? "Approve CL Factory" : "Approve Factory"}
          isLoading={isPending || isConfirming}
          txStatus={getTxStatus()}
          txHash={hash}
          onTxReset={reset}
        >
          <div className="space-y-4">
            {/* CL Toggle */}
            <div className="flex items-center gap-3 mb-4">
              <Toggle
                checked={isCL}
                onChange={setIsCL}
                label={isCL ? "Concentrated Liquidity Factory" : "Basic AMM Factory"}
              />
            </div>

            <AddressInput
              label="Pool Factory Address"
              value={approvePoolFactory}
              onChange={setApprovePoolFactory}
              required
            />
            <AddressInput
              label="Voting Rewards Factory Address"
              value={approveVotingRewardsFactory}
              onChange={setApproveVotingRewardsFactory}
              required
            />
            <AddressInput
              label="Gauge Factory Address"
              value={approveGaugeFactory}
              onChange={setApproveGaugeFactory}
              required
            />
          </div>
        </AdminFunctionForm>

        {/* Unapprove Factory */}
        <AdminFunctionForm
          title="Unapprove Factory"
          description="Remove approval for a pool factory"
          permission="owner"
          hasPermission={isOwner}
          onSubmit={handleUnapproveFactory}
          submitLabel="Unapprove Factory"
          isLoading={isPending || isConfirming}
          txStatus={getTxStatus()}
          txHash={hash}
          onTxReset={reset}
        >
          <AddressInput
            label="Pool Factory Address to Unapprove"
            value={unapprovePoolFactory}
            onChange={setUnapprovePoolFactory}
            required
            helperText="Warning: This will remove the factory from the approved list"
          />
        </AdminFunctionForm>
      </div>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        onConfirm={confirmAction?.onConfirm || (() => {})}
        title={
          confirmAction?.type === "setOwner"
            ? "Confirm Ownership Transfer"
            : "Confirm Factory Unapproval"
        }
        description={
          confirmAction?.type === "setOwner"
            ? "This action will transfer full ownership of the FactoryRegistry to a new address. This cannot be undone without the new owner's cooperation."
            : "This will remove the factory from the approved list. Existing pools will continue to work, but new gauges cannot be created for this factory."
        }
        variant="danger"
        confirmLabel={
          confirmAction?.type === "setOwner"
            ? "Transfer Ownership"
            : "Unapprove Factory"
        }
      />
    </div>
  );
}
