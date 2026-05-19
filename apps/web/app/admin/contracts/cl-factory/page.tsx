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
  NumberInput,
  ConfirmDialog,
  TxStatus,
} from "@/components/admin/contracts";
import { useContractAddresses } from "@/hooks/useContractAddresses";
import { ABIs } from "@giwater/shared/abis";
import toast from "react-hot-toast";
import {
  Card,
  CardHeader,
  CardContent,
} from "@/components/admin/ui/Card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/admin/ui/Table";

// ============================================================================
// Constants
// ============================================================================

const TICK_SPACINGS = [
  { tickSpacing: 1, description: "0.01% fee tier" },
  { tickSpacing: 10, description: "0.05% fee tier" },
  { tickSpacing: 50, description: "0.30% fee tier" },
  { tickSpacing: 100, description: "1.00% fee tier" },
  { tickSpacing: 200, description: "2.00% fee tier" },
];

// ============================================================================
// Component
// ============================================================================

export default function CLFactoryPage() {
  const { address: userAddress } = useAccount();
  const { contracts } = useContractAddresses();

  // Form states
  const [newOwner, setNewOwner] = useState("");
  const [newSwapFeeModule, setNewSwapFeeModule] = useState("");
  const [newUnstakedFeeModule, setNewUnstakedFeeModule] = useState("");
  const [newDefaultUnstakedFee, setNewDefaultUnstakedFee] = useState("");
  const [newTickSpacing, setNewTickSpacing] = useState("");
  const [newTickSpacingFee, setNewTickSpacingFee] = useState("");

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
        address: contracts?.clPoolFactory as `0x${string}`,
        abi: ABIs.CLFactory,
        functionName: "owner",
      },
      {
        address: contracts?.clPoolFactory as `0x${string}`,
        abi: ABIs.CLFactory,
        functionName: "swapFeeModule",
      },
      {
        address: contracts?.clPoolFactory as `0x${string}`,
        abi: ABIs.CLFactory,
        functionName: "unstakedFeeModule",
      },
      {
        address: contracts?.clPoolFactory as `0x${string}`,
        abi: ABIs.CLFactory,
        functionName: "defaultUnstakedFee",
      },
      {
        address: contracts?.clPoolFactory as `0x${string}`,
        abi: ABIs.CLFactory,
        functionName: "allPoolsLength",
      },
      // Read tick spacing fees
      {
        address: contracts?.clPoolFactory as `0x${string}`,
        abi: ABIs.CLFactory,
        functionName: "tickSpacingToFee",
        args: [1],
      },
      {
        address: contracts?.clPoolFactory as `0x${string}`,
        abi: ABIs.CLFactory,
        functionName: "tickSpacingToFee",
        args: [10],
      },
      {
        address: contracts?.clPoolFactory as `0x${string}`,
        abi: ABIs.CLFactory,
        functionName: "tickSpacingToFee",
        args: [50],
      },
      {
        address: contracts?.clPoolFactory as `0x${string}`,
        abi: ABIs.CLFactory,
        functionName: "tickSpacingToFee",
        args: [100],
      },
      {
        address: contracts?.clPoolFactory as `0x${string}`,
        abi: ABIs.CLFactory,
        functionName: "tickSpacingToFee",
        args: [200],
      },
    ],
    query: {
      enabled: !!contracts?.clPoolFactory,
    },
  });

  // Extract data
  const owner = contractData?.[0]?.result as string | undefined;
  const swapFeeModule = contractData?.[1]?.result as string | undefined;
  const unstakedFeeModule = contractData?.[2]?.result as string | undefined;
  const defaultUnstakedFee = contractData?.[3]?.result as number | undefined;
  const poolCount = contractData?.[4]?.result as bigint | undefined;
  const tickSpacingFees = [
    contractData?.[5]?.result as number | undefined,
    contractData?.[6]?.result as number | undefined,
    contractData?.[7]?.result as number | undefined,
    contractData?.[8]?.result as number | undefined,
    contractData?.[9]?.result as number | undefined,
  ];

  // Check permissions
  const isOwner =
    userAddress && owner?.toLowerCase() === userAddress.toLowerCase();

  // Write handlers
  const handleSetOwner = useCallback(() => {
    if (!contracts?.clPoolFactory || !newOwner) return;
    setConfirmAction({
      type: "setOwner",
      onConfirm: () => {
        writeContract({
          address: contracts.clPoolFactory as `0x${string}`,
          abi: ABIs.CLFactory,
          functionName: "setOwner",
          args: [newOwner as `0x${string}`],
        });
        setConfirmAction(null);
        toast.success("Transaction submitted");
      },
    });
  }, [contracts?.clPoolFactory, newOwner, writeContract]);

  const handleSetSwapFeeModule = useCallback(() => {
    if (!contracts?.clPoolFactory || !newSwapFeeModule) return;
    writeContract({
      address: contracts.clPoolFactory as `0x${string}`,
      abi: ABIs.CLFactory,
      functionName: "setSwapFeeModule",
      args: [newSwapFeeModule as `0x${string}`],
    });
    toast.success("Transaction submitted");
  }, [contracts?.clPoolFactory, newSwapFeeModule, writeContract]);

  const handleSetUnstakedFeeModule = useCallback(() => {
    if (!contracts?.clPoolFactory || !newUnstakedFeeModule) return;
    writeContract({
      address: contracts.clPoolFactory as `0x${string}`,
      abi: ABIs.CLFactory,
      functionName: "setUnstakedFeeModule",
      args: [newUnstakedFeeModule as `0x${string}`],
    });
    toast.success("Transaction submitted");
  }, [contracts?.clPoolFactory, newUnstakedFeeModule, writeContract]);

  const handleSetDefaultUnstakedFee = useCallback(() => {
    if (!contracts?.clPoolFactory || !newDefaultUnstakedFee) return;
    const fee = parseInt(newDefaultUnstakedFee);
    if (fee > 500000) {
      toast.error("Default unstaked fee cannot exceed 500000 (50%)");
      return;
    }
    writeContract({
      address: contracts.clPoolFactory as `0x${string}`,
      abi: ABIs.CLFactory,
      functionName: "setDefaultUnstakedFee",
      args: [fee],
    });
    toast.success("Transaction submitted");
  }, [contracts?.clPoolFactory, newDefaultUnstakedFee, writeContract]);

  const handleEnableTickSpacing = useCallback(() => {
    if (!contracts?.clPoolFactory || !newTickSpacing || !newTickSpacingFee)
      return;
    const tickSpacing = parseInt(newTickSpacing);
    const fee = parseInt(newTickSpacingFee);
    if (tickSpacing < 1 || tickSpacing > 16383) {
      toast.error("Tick spacing must be between 1 and 16383");
      return;
    }
    if (fee > 1000000) {
      toast.error("Fee cannot exceed 1000000 (100%)");
      return;
    }
    writeContract({
      address: contracts.clPoolFactory as `0x${string}`,
      abi: ABIs.CLFactory,
      functionName: "enableTickSpacing",
      args: [tickSpacing, fee],
    });
    toast.success("Transaction submitted");
  }, [
    contracts?.clPoolFactory,
    newTickSpacing,
    newTickSpacingFee,
    writeContract,
  ]);

  const stateItems = [
    { label: "Owner", value: owner || "-", type: "address" as const },
    {
      label: "Swap Fee Module",
      value: swapFeeModule || "-",
      type: "address" as const,
    },
    {
      label: "Unstaked Fee Module",
      value: unstakedFeeModule || "-",
      type: "address" as const,
    },
    {
      label: "Default Unstaked Fee",
      value:
        defaultUnstakedFee !== undefined
          ? `${defaultUnstakedFee} (${(defaultUnstakedFee / 10000).toFixed(
              2
            )}%)`
          : "-",
      type: "text" as const,
    },
    {
      label: "Total CL Pools",
      value: poolCount?.toString() || "-",
      type: "number" as const,
    },
  ];

  return (
    <div className="space-y-6">
      {/* State Card */}
      <ContractStateCard
        title="CLFactory State"
        description="Current state of the Concentrated Liquidity Factory contract"
        contractAddress={contracts?.clPoolFactory}
        items={stateItems}
        isLoading={isLoadingData}
        onRefresh={() => refetch()}
      />

      {/* Tick Spacing Fees */}
      <Card>
        <CardHeader>
          <h3 className="text-sm font-semibold text-ds-gray-1000">
            Tick Spacing Fee Configuration
          </h3>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tick Spacing</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Fee</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {TICK_SPACINGS.map((ts, index) => (
                <TableRow key={ts.tickSpacing}>
                  <TableCell className="font-geist-mono">
                    {ts.tickSpacing}
                  </TableCell>
                  <TableCell className="text-ds-gray-700">
                    {ts.description}
                  </TableCell>
                  <TableCell className="text-right">
                    {tickSpacingFees[index] !== undefined
                      ? `${tickSpacingFees[index]} (${(
                          (tickSpacingFees[index] ?? 0) / 10000
                        ).toFixed(2)}%)`
                      : "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
            helperText="Warning: This will transfer full control of the factory"
          />
        </AdminFunctionForm>
      </div>

      {/* Fee Module Settings */}
      <h3 className="text-sm font-semibold text-ds-gray-1000 mt-8">Fee Module Settings</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Set Swap Fee Module */}
        <AdminFunctionForm
          title="Set Swap Fee Module"
          description="Set the swap fee calculation module"
          permission="owner"
          hasPermission={isOwner}
          onSubmit={handleSetSwapFeeModule}
          submitLabel="Set Swap Fee Module"
          isLoading={isPending || isConfirming}
          txStatus={getTxStatus()}
          txHash={hash}
          onTxReset={reset}
        >
          <AddressInput
            label="Swap Fee Module Address"
            value={newSwapFeeModule}
            onChange={setNewSwapFeeModule}
            required
          />
        </AdminFunctionForm>

        {/* Set Unstaked Fee Module */}
        <AdminFunctionForm
          title="Set Unstaked Fee Module"
          description="Set the unstaked fee calculation module"
          permission="owner"
          hasPermission={isOwner}
          onSubmit={handleSetUnstakedFeeModule}
          submitLabel="Set Unstaked Fee Module"
          isLoading={isPending || isConfirming}
          txStatus={getTxStatus()}
          txHash={hash}
          onTxReset={reset}
        >
          <AddressInput
            label="Unstaked Fee Module Address"
            value={newUnstakedFeeModule}
            onChange={setNewUnstakedFeeModule}
            required
          />
        </AdminFunctionForm>

        {/* Set Default Unstaked Fee */}
        <AdminFunctionForm
          title="Set Default Unstaked Fee"
          description="Set the default unstaked fee for new pools"
          permission="owner"
          hasPermission={isOwner}
          onSubmit={handleSetDefaultUnstakedFee}
          submitLabel="Set Default Unstaked Fee"
          isLoading={isPending || isConfirming}
          txStatus={getTxStatus()}
          txHash={hash}
          onTxReset={reset}
        >
          <NumberInput
            label="Default Unstaked Fee"
            value={newDefaultUnstakedFee}
            onChange={setNewDefaultUnstakedFee}
            required
            max={500000}
            helperText={`Current: ${
              defaultUnstakedFee !== undefined
                ? `${defaultUnstakedFee} (${(
                    defaultUnstakedFee / 10000
                  ).toFixed(2)}%)`
                : "-"
            }. Max: 500000 (50%)`}
          />
        </AdminFunctionForm>

        {/* Enable Tick Spacing */}
        <AdminFunctionForm
          title="Enable Tick Spacing"
          description="Enable a new tick spacing with its fee"
          permission="owner"
          hasPermission={isOwner}
          onSubmit={handleEnableTickSpacing}
          submitLabel="Enable Tick Spacing"
          isLoading={isPending || isConfirming}
          txStatus={getTxStatus()}
          txHash={hash}
          onTxReset={reset}
        >
          <div className="space-y-4">
            <NumberInput
              label="Tick Spacing"
              value={newTickSpacing}
              onChange={setNewTickSpacing}
              required
              min={1}
              max={16383}
              helperText="Range: 1 - 16383"
            />
            <NumberInput
              label="Fee"
              value={newTickSpacingFee}
              onChange={setNewTickSpacingFee}
              required
              max={1000000}
              helperText="Max: 1000000 (100%)"
            />
          </div>
        </AdminFunctionForm>
      </div>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        onConfirm={confirmAction?.onConfirm || (() => {})}
        title="Confirm Ownership Transfer"
        description="This action will transfer full ownership of the CLFactory to a new address. This cannot be undone without the new owner's cooperation."
        variant="danger"
        confirmLabel="Transfer Ownership"
      />
    </div>
  );
}
