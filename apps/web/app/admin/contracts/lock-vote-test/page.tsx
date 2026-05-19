"use client";

import { useState, useCallback } from "react";
import {
  useAccount,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatEther, parseEther } from "viem";
import {
  ContractStateCard,
  AdminFunctionForm,
  AddressInput,
  NumberInput,
  TxStatus,
} from "@/components/admin/contracts";
import { useContractAddresses } from "@/hooks/useContractAddresses";
import { ABIs } from "@giwater/shared/abis";
import toast from "react-hot-toast";

// ============================================================================
// Constants
// ============================================================================

const DURATION_OPTIONS = [
  { label: "1 week", seconds: 7 * 86400 },
  { label: "1 month (28d)", seconds: 28 * 86400 },
  { label: "3 months", seconds: 91 * 86400 },
  { label: "6 months", seconds: 182 * 86400 },
  { label: "1 year", seconds: 365 * 86400 },
  { label: "2 years", seconds: 730 * 86400 },
  { label: "4 years (max)", seconds: 1460 * 86400 },
];

// ============================================================================
// Component
// ============================================================================

export default function LockVoteTestPage() {
  const { address: userAddress } = useAccount();
  const { contracts } = useContractAddresses();

  // Lock form state
  const [approveAmount, setApproveAmount] = useState("");
  const [lockAmount, setLockAmount] = useState("");
  const [lockDuration, setLockDuration] = useState(String(DURATION_OPTIONS[3].seconds));

  // Query lock state
  const [queryTokenId, setQueryTokenId] = useState("");

  // Vote state
  const [voteTokenId, setVoteTokenId] = useState("");
  const [votePools, setVotePools] = useState([{ pool: "", weight: "100" }]);

  // Reset/Poke state
  const [resetTokenId, setResetTokenId] = useState("");
  const [pokeTokenId, setPokeTokenId] = useState("");

  const { data: hash, writeContract, isPending, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const getTxStatus = (): TxStatus => {
    if (isPending) return "pending";
    if (isConfirming) return "confirming";
    if (isSuccess) return "success";
    return "idle";
  };

  // Read state
  const { data: stateData, isLoading, refetch } = useReadContracts({
    contracts: [
      {
        address: contracts?.terToken as `0x${string}`,
        abi: ABIs.ERC20,
        functionName: "balanceOf",
        args: [userAddress!],
      },
      {
        address: contracts?.terToken as `0x${string}`,
        abi: ABIs.ERC20,
        functionName: "allowance",
        args: [userAddress!, contracts?.votingEscrow as `0x${string}`],
      },
      {
        address: contracts?.votingEscrow as `0x${string}`,
        abi: ABIs.VotingEscrow,
        functionName: "balanceOf",
        args: [userAddress!],
      },
    ],
    query: { enabled: !!userAddress && !!contracts },
  });

  const terBalance = stateData?.[0]?.result as bigint | undefined;
  const terAllowance = stateData?.[1]?.result as bigint | undefined;
  const veNftCount = stateData?.[2]?.result as bigint | undefined;

  // Query specific token
  const { data: tokenData, refetch: refetchToken } = useReadContracts({
    contracts: queryTokenId
      ? [
          {
            address: contracts?.votingEscrow as `0x${string}`,
            abi: ABIs.VotingEscrow,
            functionName: "locked",
            args: [BigInt(queryTokenId)],
          },
          {
            address: contracts?.votingEscrow as `0x${string}`,
            abi: ABIs.VotingEscrow,
            functionName: "balanceOfNFT",
            args: [BigInt(queryTokenId)],
          },
          {
            address: contracts?.votingEscrow as `0x${string}`,
            abi: ABIs.VotingEscrow,
            functionName: "ownerOf",
            args: [BigInt(queryTokenId)],
          },
        ]
      : [],
    query: { enabled: !!queryTokenId && !!contracts },
  });

  const lockedData = tokenData?.[0]?.result as { amount: bigint; end: bigint } | undefined;
  const votingPower = tokenData?.[1]?.result as bigint | undefined;
  const nftOwner = tokenData?.[2]?.result as string | undefined;

  // Handlers
  const handleApprove = useCallback(() => {
    if (!contracts?.terToken || !contracts?.votingEscrow || !approveAmount) return;
    writeContract({
      address: contracts.terToken as `0x${string}`,
      abi: ABIs.ERC20,
      functionName: "approve",
      args: [contracts.votingEscrow as `0x${string}`, parseEther(approveAmount)],
    });
    toast.success("Approve transaction submitted");
  }, [contracts, approveAmount, writeContract]);

  const handleCreateLock = useCallback(() => {
    if (!contracts?.votingEscrow || !lockAmount || !lockDuration) return;
    writeContract({
      address: contracts.votingEscrow as `0x${string}`,
      abi: ABIs.VotingEscrow,
      functionName: "createLock",
      args: [parseEther(lockAmount), BigInt(lockDuration)],
    });
    toast.success("CreateLock transaction submitted");
  }, [contracts, lockAmount, lockDuration, writeContract]);

  const handleVote = useCallback(() => {
    if (!contracts?.voter || !voteTokenId || votePools.length === 0) return;
    const validPools = votePools.filter((p) => p.pool.startsWith("0x") && p.weight);
    if (validPools.length === 0) return;
    writeContract({
      address: contracts.voter as `0x${string}`,
      abi: ABIs.Voter,
      functionName: "vote",
      args: [
        BigInt(voteTokenId),
        validPools.map((p) => p.pool as `0x${string}`),
        validPools.map((p) => BigInt(p.weight)),
      ],
    });
    toast.success("Vote transaction submitted");
  }, [contracts, voteTokenId, votePools, writeContract]);

  const handleReset = useCallback(() => {
    if (!contracts?.voter || !resetTokenId) return;
    writeContract({
      address: contracts.voter as `0x${string}`,
      abi: ABIs.Voter,
      functionName: "reset",
      args: [BigInt(resetTokenId)],
    });
    toast.success("Reset transaction submitted");
  }, [contracts, resetTokenId, writeContract]);

  const handlePoke = useCallback(() => {
    if (!contracts?.voter || !pokeTokenId) return;
    writeContract({
      address: contracts.voter as `0x${string}`,
      abi: ABIs.Voter,
      functionName: "poke",
      args: [BigInt(pokeTokenId)],
    });
    toast.success("Poke transaction submitted");
  }, [contracts, pokeTokenId, writeContract]);

  const stateItems = [
    {
      label: "TER Balance",
      value: terBalance !== undefined ? `${parseFloat(formatEther(terBalance)).toLocaleString(undefined, { maximumFractionDigits: 4 })} TER` : "-",
      type: "text" as const,
    },
    {
      label: "TER Allowance (VotingEscrow)",
      value: terAllowance !== undefined ? `${parseFloat(formatEther(terAllowance)).toLocaleString(undefined, { maximumFractionDigits: 4 })} TER` : "-",
      type: "text" as const,
    },
    {
      label: "veNFT Count",
      value: veNftCount?.toString() ?? "-",
      type: "number" as const,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Wallet State */}
      <ContractStateCard
        title="Wallet State"
        description="TER balance and existing lock positions for the connected wallet"
        contractAddress={contracts?.votingEscrow}
        items={stateItems}
        isLoading={isLoading}
        onRefresh={() => refetch()}
      />

      {/* Step 1: Approve TER */}
      <h3 className="text-sm font-semibold text-ds-gray-1000">Step 1 — Approve TER</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AdminFunctionForm
          title="Approve TER for VotingEscrow"
          description="Allow VotingEscrow to spend TER before creating a lock"
          permission="voter"
          hasPermission={!!userAddress}
          onSubmit={handleApprove}
          submitLabel="Approve"
          isLoading={isPending || isConfirming}
          txStatus={getTxStatus()}
          txHash={hash}
          onTxReset={reset}
        >
          <NumberInput
            label="Amount (TER)"
            value={approveAmount}
            onChange={setApproveAmount}
            required
            helperText={`Current allowance: ${terAllowance !== undefined ? formatEther(terAllowance) : "?"} TER`}
          />
        </AdminFunctionForm>
      </div>

      {/* Step 2: Create Lock */}
      <h3 className="text-sm font-semibold text-ds-gray-1000">Step 2 — Create Lock</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AdminFunctionForm
          title="Create Lock (createLock)"
          description="Lock TER tokens to receive a veNFT with voting power"
          permission="voter"
          hasPermission={!!userAddress}
          onSubmit={handleCreateLock}
          submitLabel="Create Lock"
          isLoading={isPending || isConfirming}
          txStatus={getTxStatus()}
          txHash={hash}
          onTxReset={reset}
        >
          <NumberInput
            label="Amount (TER)"
            value={lockAmount}
            onChange={setLockAmount}
            required
            helperText={`Balance: ${terBalance !== undefined ? parseFloat(formatEther(terBalance)).toLocaleString(undefined, { maximumFractionDigits: 4 }) : "?"} TER`}
          />
          <div className="mt-4">
            <label className="block text-xs font-medium text-ds-gray-900 mb-1">
              Lock Duration
            </label>
            <select
              value={lockDuration}
              onChange={(e) => setLockDuration(e.target.value)}
              className="w-full rounded-md border border-ds-gray-400 bg-ds-background-100 px-3 py-2 text-sm text-ds-gray-1000 focus:outline-none focus:ring-2 focus:ring-ds-blue-700"
            >
              {DURATION_OPTIONS.map((opt) => (
                <option key={opt.seconds} value={String(opt.seconds)}>
                  {opt.label} ({opt.seconds.toLocaleString()} sec)
                </option>
              ))}
            </select>
          </div>
        </AdminFunctionForm>
      </div>

      {/* Query Lock */}
      <h3 className="text-sm font-semibold text-ds-gray-1000">Query Lock by Token ID</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AdminFunctionForm
          title="Query veNFT"
          description="Look up locked amount, end time, and voting power for a token ID"
          permission="voter"
          hasPermission={!!userAddress}
          onSubmit={() => refetchToken()}
          submitLabel="Query"
          isLoading={false}
          txStatus="idle"
          txHash={undefined}
          onTxReset={() => {}}
        >
          <NumberInput
            label="Token ID"
            value={queryTokenId}
            onChange={setQueryTokenId}
            required
            helperText="Enter the veNFT token ID to inspect"
          />
          {lockedData && (
            <div className="mt-4 space-y-2 text-sm text-ds-gray-900 bg-ds-background-200 rounded-md p-3">
              <div><span className="font-medium">Owner:</span> {nftOwner ?? "-"}</div>
              <div><span className="font-medium">Locked:</span> {formatEther(lockedData.amount)} TER</div>
              <div><span className="font-medium">End:</span> {new Date(Number(lockedData.end) * 1000).toLocaleString()}</div>
              <div><span className="font-medium">Voting Power:</span> {votingPower !== undefined ? formatEther(votingPower) : "-"}</div>
            </div>
          )}
        </AdminFunctionForm>
      </div>

      {/* Step 3: Vote */}
      <h3 className="text-sm font-semibold text-ds-gray-1000">Step 3 — Vote</h3>
      <div className="grid grid-cols-1 gap-6">
        <AdminFunctionForm
          title="Vote (Voter.vote)"
          description="Allocate voting weight from a veNFT across pools"
          permission="voter"
          hasPermission={!!userAddress}
          onSubmit={handleVote}
          submitLabel="Vote"
          isLoading={isPending || isConfirming}
          txStatus={getTxStatus()}
          txHash={hash}
          onTxReset={reset}
        >
          <NumberInput
            label="Token ID"
            value={voteTokenId}
            onChange={setVoteTokenId}
            required
            helperText="The veNFT token ID to vote with"
          />
          <div className="mt-4 space-y-3">
            <label className="block text-xs font-medium text-ds-gray-900">
              Pool / Weight pairs
            </label>
            {votePools.map((entry, i) => (
              <div key={i} className="flex gap-2 items-start">
                <div className="flex-1">
                  <input
                    placeholder="Pool address (0x…)"
                    value={entry.pool}
                    onChange={(e) =>
                      setVotePools((prev) =>
                        prev.map((p, j) => j === i ? { ...p, pool: e.target.value } : p),
                      )
                    }
                    className="w-full rounded-md border border-ds-gray-400 bg-ds-background-100 px-3 py-2 text-sm text-ds-gray-1000 focus:outline-none focus:ring-2 focus:ring-ds-blue-700"
                  />
                </div>
                <div className="w-24">
                  <input
                    placeholder="Weight"
                    value={entry.weight}
                    onChange={(e) =>
                      setVotePools((prev) =>
                        prev.map((p, j) => j === i ? { ...p, weight: e.target.value } : p),
                      )
                    }
                    className="w-full rounded-md border border-ds-gray-400 bg-ds-background-100 px-3 py-2 text-sm text-ds-gray-1000 focus:outline-none focus:ring-2 focus:ring-ds-blue-700"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setVotePools((prev) => prev.filter((_, j) => j !== i))}
                  disabled={votePools.length <= 1}
                  className="mt-0.5 text-ds-gray-700 hover:text-red-500 disabled:opacity-30 text-lg leading-none"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setVotePools((prev) => [...prev, { pool: "", weight: "100" }])}
              className="text-xs text-ds-blue-700 hover:underline"
            >
              + Add pool
            </button>
            <p className="text-xs text-ds-gray-700">Weights are relative — they don&apos;t need to sum to any specific value.</p>
          </div>
        </AdminFunctionForm>
      </div>

      {/* Reset / Poke */}
      <h3 className="text-sm font-semibold text-ds-gray-1000">Manage Votes</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AdminFunctionForm
          title="Reset Votes"
          description="Clear all votes for a veNFT (required before re-voting)"
          permission="voter"
          hasPermission={!!userAddress}
          onSubmit={handleReset}
          submitLabel="Reset"
          isLoading={isPending || isConfirming}
          txStatus={getTxStatus()}
          txHash={hash}
          onTxReset={reset}
        >
          <NumberInput
            label="Token ID"
            value={resetTokenId}
            onChange={setResetTokenId}
            required
          />
        </AdminFunctionForm>

        <AdminFunctionForm
          title="Poke"
          description="Refresh vote weights without changing pool allocation (use after balance changes)"
          permission="voter"
          hasPermission={!!userAddress}
          onSubmit={handlePoke}
          submitLabel="Poke"
          isLoading={isPending || isConfirming}
          txStatus={getTxStatus()}
          txHash={hash}
          onTxReset={reset}
        >
          <NumberInput
            label="Token ID"
            value={pokeTokenId}
            onChange={setPokeTokenId}
            required
          />
        </AdminFunctionForm>
      </div>
    </div>
  );
}
