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
import { Toggle } from "@/components/admin/ui/Toggle";

// ============================================================================
// Component
// ============================================================================

export default function PoolFactoryPage() {
  const { address: userAddress } = useAccount();
  const { contracts } = useContractAddresses();

  // Form states
  const [newVoter, setNewVoter] = useState("");
  const [newPauser, setNewPauser] = useState("");
  const [newFeeManager, setNewFeeManager] = useState("");
  const [stableFee, setStableFee] = useState("");
  const [volatileFee, setVolatileFee] = useState("");
  const [customFeePool, setCustomFeePool] = useState("");
  const [customFeeValue, setCustomFeeValue] = useState("");
  const [pauseState, setPauseState] = useState(false);

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
        address: contracts?.poolFactory as `0x${string}`,
        abi: ABIs.PoolFactory,
        functionName: "voter",
      },
      {
        address: contracts?.poolFactory as `0x${string}`,
        abi: ABIs.PoolFactory,
        functionName: "feeManager",
      },
      {
        address: contracts?.poolFactory as `0x${string}`,
        abi: ABIs.PoolFactory,
        functionName: "pauser",
      },
      {
        address: contracts?.poolFactory as `0x${string}`,
        abi: ABIs.PoolFactory,
        functionName: "isPaused",
      },
      {
        address: contracts?.poolFactory as `0x${string}`,
        abi: ABIs.PoolFactory,
        functionName: "stableFee",
      },
      {
        address: contracts?.poolFactory as `0x${string}`,
        abi: ABIs.PoolFactory,
        functionName: "volatileFee",
      },
      {
        address: contracts?.poolFactory as `0x${string}`,
        abi: ABIs.PoolFactory,
        functionName: "MAX_FEE",
      },
      {
        address: contracts?.poolFactory as `0x${string}`,
        abi: ABIs.PoolFactory,
        functionName: "allPoolsLength",
      },
    ],
    query: {
      enabled: !!contracts?.poolFactory,
    },
  });

  // Extract data
  const voter = contractData?.[0]?.result as string | undefined;
  const feeManager = contractData?.[1]?.result as string | undefined;
  const pauser = contractData?.[2]?.result as string | undefined;
  const isPaused = contractData?.[3]?.result as boolean | undefined;
  const currentStableFee = contractData?.[4]?.result as bigint | undefined;
  const currentVolatileFee = contractData?.[5]?.result as bigint | undefined;
  const maxFee = contractData?.[6]?.result as bigint | undefined;
  const poolCount = contractData?.[7]?.result as bigint | undefined;

  // Check permissions
  const isVoter =
    userAddress && voter?.toLowerCase() === userAddress.toLowerCase();
  const isFeeManager =
    userAddress && feeManager?.toLowerCase() === userAddress.toLowerCase();
  const isPauserRole =
    userAddress && pauser?.toLowerCase() === userAddress.toLowerCase();

  // Write handlers
  const handleSetVoter = useCallback(() => {
    if (!contracts?.poolFactory || !newVoter) return;
    writeContract({
      address: contracts.poolFactory as `0x${string}`,
      abi: ABIs.PoolFactory,
      functionName: "setVoter",
      args: [newVoter as `0x${string}`],
    });
    toast.success("Transaction submitted");
  }, [contracts?.poolFactory, newVoter, writeContract]);

  const handleSetPauser = useCallback(() => {
    if (!contracts?.poolFactory || !newPauser) return;
    writeContract({
      address: contracts.poolFactory as `0x${string}`,
      abi: ABIs.PoolFactory,
      functionName: "setPauser",
      args: [newPauser as `0x${string}`],
    });
    toast.success("Transaction submitted");
  }, [contracts?.poolFactory, newPauser, writeContract]);

  const handleSetPauseState = useCallback(() => {
    if (!contracts?.poolFactory) return;
    if (pauseState) {
      setConfirmAction({
        type: "pause",
        onConfirm: () => {
          writeContract({
            address: contracts.poolFactory as `0x${string}`,
            abi: ABIs.PoolFactory,
            functionName: "setPauseState",
            args: [true],
          });
          setConfirmAction(null);
          toast.success("Transaction submitted");
        },
      });
    } else {
      writeContract({
        address: contracts.poolFactory as `0x${string}`,
        abi: ABIs.PoolFactory,
        functionName: "setPauseState",
        args: [false],
      });
      toast.success("Transaction submitted");
    }
  }, [contracts?.poolFactory, pauseState, writeContract]);

  const handleSetFeeManager = useCallback(() => {
    if (!contracts?.poolFactory || !newFeeManager) return;
    writeContract({
      address: contracts.poolFactory as `0x${string}`,
      abi: ABIs.PoolFactory,
      functionName: "setFeeManager",
      args: [newFeeManager as `0x${string}`],
    });
    toast.success("Transaction submitted");
  }, [contracts?.poolFactory, newFeeManager, writeContract]);

  const handleSetStableFee = useCallback(() => {
    if (!contracts?.poolFactory || !stableFee) return;
    const fee = parseInt(stableFee);
    if (maxFee && fee > Number(maxFee)) {
      toast.error(`Fee cannot exceed ${maxFee} bps`);
      return;
    }
    writeContract({
      address: contracts.poolFactory as `0x${string}`,
      abi: ABIs.PoolFactory,
      functionName: "setFee",
      args: [true, BigInt(fee)],
    });
    toast.success("Transaction submitted");
  }, [contracts?.poolFactory, stableFee, maxFee, writeContract]);

  const handleSetVolatileFee = useCallback(() => {
    if (!contracts?.poolFactory || !volatileFee) return;
    const fee = parseInt(volatileFee);
    if (maxFee && fee > Number(maxFee)) {
      toast.error(`Fee cannot exceed ${maxFee} bps`);
      return;
    }
    writeContract({
      address: contracts.poolFactory as `0x${string}`,
      abi: ABIs.PoolFactory,
      functionName: "setFee",
      args: [false, BigInt(fee)],
    });
    toast.success("Transaction submitted");
  }, [contracts?.poolFactory, volatileFee, maxFee, writeContract]);

  const handleSetCustomFee = useCallback(() => {
    if (!contracts?.poolFactory || !customFeePool || !customFeeValue) return;
    const fee = parseInt(customFeeValue);
    if (maxFee && fee > Number(maxFee)) {
      toast.error(`Fee cannot exceed ${maxFee} bps`);
      return;
    }
    writeContract({
      address: contracts.poolFactory as `0x${string}`,
      abi: ABIs.PoolFactory,
      functionName: "setCustomFee",
      args: [customFeePool as `0x${string}`, BigInt(fee)],
    });
    toast.success("Transaction submitted");
  }, [
    contracts?.poolFactory,
    customFeePool,
    customFeeValue,
    maxFee,
    writeContract,
  ]);

  const stateItems = [
    { label: "Voter", value: voter || "-", type: "address" as const },
    {
      label: "Fee Manager",
      value: feeManager || "-",
      type: "address" as const,
    },
    { label: "Pauser", value: pauser || "-", type: "address" as const },
    {
      label: "Is Paused",
      value: isPaused !== undefined ? String(isPaused) : "-",
      type: "boolean" as const,
    },
    {
      label: "Stable Fee",
      value:
        currentStableFee !== undefined
          ? `${Number(currentStableFee)} bps (${(
              Number(currentStableFee) / 100
            ).toFixed(2)}%)`
          : "-",
      type: "text" as const,
    },
    {
      label: "Volatile Fee",
      value:
        currentVolatileFee !== undefined
          ? `${Number(currentVolatileFee)} bps (${(
              Number(currentVolatileFee) / 100
            ).toFixed(2)}%)`
          : "-",
      type: "text" as const,
    },
    {
      label: "Max Fee",
      value:
        maxFee !== undefined
          ? `${Number(maxFee)} bps (${(Number(maxFee) / 100).toFixed(2)}%)`
          : "-",
      type: "text" as const,
    },
    {
      label: "Total Pools",
      value: poolCount?.toString() || "-",
      type: "number" as const,
    },
  ];

  return (
    <div className="space-y-6">
      {/* State Card */}
      <ContractStateCard
        title="PoolFactory State"
        description="Current state of the PoolFactory contract (Basic AMM)"
        contractAddress={contracts?.poolFactory}
        items={stateItems}
        isLoading={isLoadingData}
        onRefresh={() => refetch()}
      />

      {/* Role Management */}
      <h3 className="text-sm font-semibold text-ds-gray-1000">Role Management</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Set Voter */}
        <AdminFunctionForm
          title="Set Voter"
          description="Set the Voter contract address"
          permission="voter"
          hasPermission={isVoter}
          onSubmit={handleSetVoter}
          submitLabel="Set Voter"
          isLoading={isPending || isConfirming}
          txStatus={getTxStatus()}
          txHash={hash}
          onTxReset={reset}
        >
          <AddressInput
            label="New Voter Address"
            value={newVoter}
            onChange={setNewVoter}
            required
          />
        </AdminFunctionForm>

        {/* Set Pauser */}
        <AdminFunctionForm
          title="Set Pauser"
          description="Set the pauser address"
          permission="pauser"
          hasPermission={isPauserRole}
          onSubmit={handleSetPauser}
          submitLabel="Set Pauser"
          isLoading={isPending || isConfirming}
          txStatus={getTxStatus()}
          txHash={hash}
          onTxReset={reset}
        >
          <AddressInput
            label="New Pauser Address"
            value={newPauser}
            onChange={setNewPauser}
            required
          />
        </AdminFunctionForm>

        {/* Set Fee Manager */}
        <AdminFunctionForm
          title="Set Fee Manager"
          description="Set the fee manager address"
          permission="feeManager"
          hasPermission={isFeeManager}
          onSubmit={handleSetFeeManager}
          submitLabel="Set Fee Manager"
          isLoading={isPending || isConfirming}
          txStatus={getTxStatus()}
          txHash={hash}
          onTxReset={reset}
        >
          <AddressInput
            label="New Fee Manager Address"
            value={newFeeManager}
            onChange={setNewFeeManager}
            required
          />
        </AdminFunctionForm>

        {/* Set Pause State */}
        <AdminFunctionForm
          title="Set Pause State"
          description="Pause or unpause pool creation"
          permission="pauser"
          hasPermission={isPauserRole}
          onSubmit={handleSetPauseState}
          submitLabel={
            pauseState ? "Pause Pool Creation" : "Unpause Pool Creation"
          }
          isLoading={isPending || isConfirming}
          txStatus={getTxStatus()}
          txHash={hash}
          onTxReset={reset}
        >
          <div className="flex items-center gap-3">
            <Toggle
              checked={pauseState}
              onChange={setPauseState}
              label={pauseState ? "Pause" : "Active"}
            />
          </div>
          <p className="text-xs text-ds-gray-600 mt-2">
            Current status: {isPaused ? "Paused" : "Active"}
          </p>
        </AdminFunctionForm>
      </div>

      {/* Fee Management */}
      <h3 className="text-sm font-semibold text-ds-gray-1000 mt-8">Fee Management</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Set Stable Fee */}
        <AdminFunctionForm
          title="Set Stable Fee"
          description="Set the default fee for stable pools"
          permission="feeManager"
          hasPermission={isFeeManager}
          onSubmit={handleSetStableFee}
          submitLabel="Set Stable Fee"
          isLoading={isPending || isConfirming}
          txStatus={getTxStatus()}
          txHash={hash}
          onTxReset={reset}
        >
          <NumberInput
            label="Stable Fee (basis points)"
            value={stableFee}
            onChange={setStableFee}
            required
            max={maxFee ? Number(maxFee) : 300}
            helperText={`Current: ${
              currentStableFee !== undefined ? Number(currentStableFee) : "-"
            } bps. Max: ${maxFee ? Number(maxFee) : 300} bps`}
            suffix="bps"
          />
        </AdminFunctionForm>

        {/* Set Volatile Fee */}
        <AdminFunctionForm
          title="Set Volatile Fee"
          description="Set the default fee for volatile pools"
          permission="feeManager"
          hasPermission={isFeeManager}
          onSubmit={handleSetVolatileFee}
          submitLabel="Set Volatile Fee"
          isLoading={isPending || isConfirming}
          txStatus={getTxStatus()}
          txHash={hash}
          onTxReset={reset}
        >
          <NumberInput
            label="Volatile Fee (basis points)"
            value={volatileFee}
            onChange={setVolatileFee}
            required
            max={maxFee ? Number(maxFee) : 300}
            helperText={`Current: ${
              currentVolatileFee !== undefined
                ? Number(currentVolatileFee)
                : "-"
            } bps. Max: ${maxFee ? Number(maxFee) : 300} bps`}
            suffix="bps"
          />
        </AdminFunctionForm>

        {/* Set Custom Fee */}
        <AdminFunctionForm
          title="Set Custom Fee"
          description="Set a custom fee for a specific pool (0 to use default)"
          permission="feeManager"
          hasPermission={isFeeManager}
          onSubmit={handleSetCustomFee}
          submitLabel="Set Custom Fee"
          isLoading={isPending || isConfirming}
          txStatus={getTxStatus()}
          txHash={hash}
          onTxReset={reset}
        >
          <div className="space-y-4">
            <AddressInput
              label="Pool Address"
              value={customFeePool}
              onChange={setCustomFeePool}
              required
            />
            <NumberInput
              label="Custom Fee (basis points)"
              value={customFeeValue}
              onChange={setCustomFeeValue}
              required
              max={maxFee ? Number(maxFee) : 300}
              helperText="Set to 0 to use default fee"
              suffix="bps"
            />
          </div>
        </AdminFunctionForm>
      </div>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        onConfirm={confirmAction?.onConfirm || (() => {})}
        title="Confirm Pool Creation Pause"
        description="This will pause pool creation on the factory. Users will not be able to create new pools until unpaused."
        variant="danger"
        confirmLabel="Pause Pool Creation"
      />
    </div>
  );
}
