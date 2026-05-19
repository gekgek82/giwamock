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
import {
  Card,
  CardHeader,
  CardContent,
} from "@/components/admin/ui/Card";

// ============================================================================
// Component
// ============================================================================

export default function TerTokenPage() {
  const { address: userAddress } = useAccount();
  const { contracts } = useContractAddresses();

  // Form states
  const [newMinter, setNewMinter] = useState("");

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
        address: contracts?.terToken as `0x${string}`,
        abi: ABIs.Ter,
        functionName: "minter",
      },
      {
        address: contracts?.terToken as `0x${string}`,
        abi: ABIs.Ter,
        functionName: "name",
      },
      {
        address: contracts?.terToken as `0x${string}`,
        abi: ABIs.Ter,
        functionName: "symbol",
      },
      {
        address: contracts?.terToken as `0x${string}`,
        abi: ABIs.Ter,
        functionName: "decimals",
      },
      {
        address: contracts?.terToken as `0x${string}`,
        abi: ABIs.Ter,
        functionName: "totalSupply",
      },
    ],
    query: {
      enabled: !!contracts?.terToken,
    },
  });

  // Extract data
  const minter = contractData?.[0]?.result as string | undefined;
  const name = contractData?.[1]?.result as string | undefined;
  const symbol = contractData?.[2]?.result as string | undefined;
  const decimals = contractData?.[3]?.result as number | undefined;
  const totalSupply = contractData?.[4]?.result as bigint | undefined;

  // Check permissions
  const isMinter =
    userAddress && minter?.toLowerCase() === userAddress.toLowerCase();

  // Write handlers
  const handleSetMinter = useCallback(() => {
    if (!contracts?.terToken || !newMinter) return;
    setConfirmAction({
      type: "setMinter",
      onConfirm: () => {
        writeContract({
          address: contracts.terToken as `0x${string}`,
          abi: ABIs.Ter,
          functionName: "setMinter",
          args: [newMinter as `0x${string}`],
        });
        setConfirmAction(null);
        toast.success("Transaction submitted");
      },
    });
  }, [contracts?.terToken, newMinter, writeContract]);

  const stateItems = [
    { label: "Token Name", value: name || "-", type: "text" as const },
    { label: "Symbol", value: symbol || "-", type: "text" as const },
    {
      label: "Decimals",
      value: decimals?.toString() || "-",
      type: "number" as const,
    },
    {
      label: "Total Supply",
      value: totalSupply
        ? `${Number(formatEther(totalSupply)).toLocaleString()} ${
            symbol || "TER"
          }`
        : "-",
      type: "text" as const,
    },
    { label: "Minter", value: minter || "-", type: "address" as const },
  ];

  return (
    <div className="space-y-6">
      {/* State Card */}
      <ContractStateCard
        title="TER Token State"
        description="Current state of the TER token contract"
        contractAddress={contracts?.terToken}
        items={stateItems}
        isLoading={isLoadingData}
        onRefresh={() => refetch()}
      />

      {/* Info Card */}
      <Card>
        <CardHeader>
          <h3 className="text-sm font-semibold text-ds-gray-1000">About TER Token</h3>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-ds-gray-700">
            <p>
              TER is the native governance and utility token of the GiwaTer
              protocol. It is used for:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>
                Locking in VotingEscrow to receive veTER (vote-escrowed TER)
              </li>
              <li>Gauge voting rewards and emissions</li>
              <li>Protocol governance participation</li>
            </ul>
            <p className="mt-4">
              Only the designated Minter contract can mint new TER tokens. The
              Minter controls the emission schedule and distribution of newly
              minted tokens to gauges and the rewards distributor.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Admin Functions */}
      <h3 className="text-sm font-semibold text-ds-gray-1000">Minter Settings</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Set Minter */}
        <AdminFunctionForm
          title="Set Minter"
          description="Change the minter contract address"
          permission="minter"
          hasPermission={isMinter}
          onSubmit={handleSetMinter}
          submitLabel="Set Minter"
          isLoading={isPending || isConfirming}
          txStatus={getTxStatus()}
          txHash={hash}
          onTxReset={reset}
        >
          <AddressInput
            label="New Minter Address"
            value={newMinter}
            onChange={setNewMinter}
            required
            helperText="Warning: Only the minter can change this setting"
          />
        </AdminFunctionForm>

        {/* Info about mint function */}
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-ds-gray-1000">Mint Function</h3>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-ds-gray-700 mb-4">
              The mint function can only be called by the Minter contract. It is
              used to:
            </p>
            <ul className="list-disc list-inside text-sm text-ds-gray-700 space-y-1">
              <li>Distribute weekly emissions to gauges</li>
              <li>Allocate team share of emissions</li>
              <li>Fund the RewardsDistributor for veTER rebases</li>
            </ul>
            <div className="mt-4 p-3 bg-ds-gray-200 rounded-lg">
              <p className="text-xs text-ds-gray-600">
                <strong>Note:</strong> Direct minting through this admin interface
                is not supported. Token minting occurs automatically through the
                Minter contract's update_period function.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        onConfirm={confirmAction?.onConfirm || (() => {})}
        title="Confirm Minter Change"
        description="This action will change the minter address. The new minter will have exclusive rights to mint new TER tokens. This cannot be undone without the new minter's cooperation."
        variant="danger"
        confirmLabel="Change Minter"
      />
    </div>
  );
}
