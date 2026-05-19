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

export default function RewardsDistributorPage() {
  const { address: userAddress } = useAccount();
  const { contracts } = useContractAddresses();

  // Form states
  const [newMinter, setNewMinter] = useState("");

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
        address: contracts?.rewardsDistributor as `0x${string}`,
        abi: ABIs.RewardsDistributor,
        functionName: "ve",
      },
      {
        address: contracts?.rewardsDistributor as `0x${string}`,
        abi: ABIs.RewardsDistributor,
        functionName: "token",
      },
      {
        address: contracts?.rewardsDistributor as `0x${string}`,
        abi: ABIs.RewardsDistributor,
        functionName: "minter",
      },
      {
        address: contracts?.rewardsDistributor as `0x${string}`,
        abi: ABIs.RewardsDistributor,
        functionName: "startTime",
      },
      {
        address: contracts?.rewardsDistributor as `0x${string}`,
        abi: ABIs.RewardsDistributor,
        functionName: "timeCursor",
      },
      {
        address: contracts?.rewardsDistributor as `0x${string}`,
        abi: ABIs.RewardsDistributor,
        functionName: "lastTokenTime",
      },
      {
        address: contracts?.rewardsDistributor as `0x${string}`,
        abi: ABIs.RewardsDistributor,
        functionName: "tokenLastBalance",
      },
    ],
    query: {
      enabled: !!contracts?.rewardsDistributor,
    },
  });

  // Extract data
  const ve = contractData?.[0]?.result as string | undefined;
  const token = contractData?.[1]?.result as string | undefined;
  const minter = contractData?.[2]?.result as string | undefined;
  const startTime = contractData?.[3]?.result as bigint | undefined;
  const timeCursor = contractData?.[4]?.result as bigint | undefined;
  const lastTokenTime = contractData?.[5]?.result as bigint | undefined;
  const tokenLastBalance = contractData?.[6]?.result as bigint | undefined;

  // Check permissions
  const isMinter =
    userAddress && minter?.toLowerCase() === userAddress.toLowerCase();
  // Also allow if minter is zero address (initial setup)
  const canSetMinter =
    isMinter || minter === "0x0000000000000000000000000000000000000000";

  // Format timestamp
  const formatTimestamp = (timestamp: bigint | undefined) => {
    if (!timestamp) return "-";
    const date = new Date(Number(timestamp) * 1000);
    return date.toLocaleString();
  };

  // Write handlers
  const handleSetMinter = useCallback(() => {
    if (!contracts?.rewardsDistributor || !newMinter) return;
    writeContract({
      address: contracts.rewardsDistributor as `0x${string}`,
      abi: ABIs.RewardsDistributor,
      functionName: "setMinter",
      args: [newMinter as `0x${string}`],
    });
    toast.success("Transaction submitted");
  }, [contracts?.rewardsDistributor, newMinter, writeContract]);

  const stateItems = [
    { label: "VotingEscrow", value: ve || "-", type: "address" as const },
    {
      label: "Reward Token (TER)",
      value: token || "-",
      type: "address" as const,
    },
    { label: "Minter", value: minter || "-", type: "address" as const },
    {
      label: "Start Time",
      value: formatTimestamp(startTime),
      type: "text" as const,
    },
    {
      label: "Time Cursor",
      value: formatTimestamp(timeCursor),
      type: "text" as const,
    },
    {
      label: "Last Token Time",
      value: formatTimestamp(lastTokenTime),
      type: "text" as const,
    },
    {
      label: "Token Last Balance",
      value: tokenLastBalance
        ? `${Number(formatEther(tokenLastBalance)).toLocaleString()} TER`
        : "-",
      type: "text" as const,
    },
  ];

  return (
    <div className="space-y-6">
      {/* State Card */}
      <ContractStateCard
        title="RewardsDistributor State"
        description="Current state of the RewardsDistributor contract"
        contractAddress={contracts?.rewardsDistributor}
        items={stateItems}
        isLoading={isLoadingData}
        onRefresh={() => refetch()}
      />

      {/* Info Card */}
      <Card>
        <CardHeader>
          <h3 className="text-sm font-semibold text-ds-gray-1000">
            About RewardsDistributor
          </h3>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-ds-gray-700">
            <p>
              The RewardsDistributor contract is responsible for distributing
              rebase rewards to veTER holders. It receives TER tokens from the
              Minter and distributes them proportionally to veTER holders based on
              their voting power.
            </p>
            <div className="mt-4 p-4 bg-ds-gray-200 rounded-lg">
              <h4 className="text-ds-gray-1000 font-medium mb-2">How it works:</h4>
              <ol className="list-decimal list-inside space-y-1 text-ds-gray-700">
                <li>
                  Minter sends TER tokens to the RewardsDistributor each epoch
                </li>
                <li>
                  Tokens are distributed based on veTER voting power at each
                  checkpoint
                </li>
                <li>
                  veTER holders can claim their share of rewards at any time
                </li>
                <li>
                  Rewards accumulate if not claimed and can be claimed later
                </li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Admin Functions */}
      <h3 className="text-sm font-semibold text-ds-gray-1000">Minter Settings</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Set Minter */}
        <AdminFunctionForm
          title="Set Minter"
          description="Set the Minter contract address"
          permission="minter"
          hasPermission={canSetMinter}
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
            helperText={
              minter === "0x0000000000000000000000000000000000000000"
                ? "Minter not set yet. Anyone can set the initial minter."
                : "Only the current minter can change this setting."
            }
          />
        </AdminFunctionForm>

        {/* Info about claiming */}
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-ds-gray-1000">
              Claiming Rewards
            </h3>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-ds-gray-700 mb-4">
              veTER holders can claim their rebase rewards directly through the
              user interface. Admin functions for claiming are not needed as users
              claim their own rewards.
            </p>
            <div className="p-3 bg-ds-gray-200 rounded-lg">
              <p className="text-xs text-ds-gray-600">
                <strong>Claim Functions:</strong>
              </p>
              <ul className="text-xs text-ds-gray-600 mt-2 space-y-1">
                <li>
                  - <code className="text-ds-blue-400">claim(tokenId)</code> -
                  Claim for single veTER
                </li>
                <li>
                  - <code className="text-ds-blue-400">claimMany(tokenIds)</code>{" "}
                  - Claim for multiple veTERs
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
