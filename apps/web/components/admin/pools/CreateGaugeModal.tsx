"use client";

import { useState, useEffect, useCallback } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { Button } from "@/components/admin/ui/Button";
import { AddressInput } from "@/components/admin/contracts";
import { TransactionStatus, type TxStatus } from "@/components/admin/contracts";
import { useContractAddresses } from "@/hooks/useContractAddresses";
import { ABIs } from "@giwater/shared/abis";
import toast from "react-hot-toast";

interface CreateGaugeModalProps {
  isOpen: boolean;
  onClose: () => void;
  poolAddress: string;
  factoryAddress: string | null;
  /**
   * Must match `SpotPairRecordDto.baseSymbol` — BASE side of the ticker, not `token0Symbol`.
   * Parent should pass `spotPairBaseQuoteLabels(pool)` so empty DB symbols still resolve.
   */
  baseSymbol: string;
  /** Same as `SpotPairRecordDto.quoteSymbol` (QUOTE side). */
  quoteSymbol: string;
  onSuccess: () => void;
}

export function CreateGaugeModal({
  isOpen,
  onClose,
  poolAddress,
  factoryAddress,
  baseSymbol,
  quoteSymbol,
  onSuccess,
}: CreateGaugeModalProps) {
  const [factory, setFactory] = useState("");
  const { contracts } = useContractAddresses();
  const {
    data: gaugeHash,
    writeContract,
    isPending,
    error: writeError,
    reset: resetTx,
  } = useWriteContract();
  const { isLoading: isConfirming, isSuccess, error: receiptError } =
    useWaitForTransactionReceipt({ hash: gaugeHash });

  // Pre-fill factory address
  useEffect(() => {
    if (isOpen && factoryAddress) {
      setFactory(factoryAddress);
    }
  }, [isOpen, factoryAddress]);

  // Handle success
  useEffect(() => {
    if (isSuccess) {
      toast.success("Gauge created successfully");
      onSuccess();
      onClose();
    }
  }, [isSuccess, onSuccess, onClose]);

  const txError = writeError || receiptError;

  const getTxStatus = (): TxStatus => {
    if (isPending) return "pending";
    if (isConfirming) return "confirming";
    if (isSuccess) return "success";
    if (txError) return "error";
    return "idle";
  };

  const getTxErrorMessage = (): string | undefined => {
    if (!txError) return undefined;
    const msg = txError.message || String(txError);
    // Extract the short reason from verbose wallet/RPC errors
    const reasonMatch = msg.match(/reason:\s*(.+?)(?:\n|$)/);
    if (reasonMatch) return reasonMatch[1].trim();
    const revertMatch = msg.match(/reverted with.*?:\s*(.+?)(?:\n|"|$)/);
    if (revertMatch) return revertMatch[1].trim();
    // User rejected
    if (msg.includes("User rejected") || msg.includes("user rejected"))
      return "Transaction rejected by user";
    // Fallback: first line, truncated
    const firstLine = msg.split("\n")[0];
    return firstLine.length > 120 ? firstLine.slice(0, 120) + "..." : firstLine;
  };

  const handleSubmit = useCallback(() => {
    if (!contracts?.voter || !factory) return;
    writeContract({
      address: contracts.voter as `0x${string}`,
      abi: ABIs.Voter,
      functionName: "createGauge",
      args: [
        factory as `0x${string}`,
        poolAddress as `0x${string}`,
      ],
    });
    toast.success("Transaction submitted");
  }, [contracts?.voter, factory, poolAddress, writeContract]);

  const handleClose = () => {
    if (isPending || isConfirming) return;
    resetTx();
    onClose();
  };

  if (!isOpen) return null;

  const isLoading = isPending || isConfirming;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Dialog */}
      <div className="relative bg-ds-background-200 rounded-lg border border-ds-gray-400 p-6 max-w-md w-full mx-4 shadow-xl">
        {/* Icon */}
        <div className="w-12 h-12 rounded-full bg-ds-yellow-700/10 flex items-center justify-center mb-4">
          <svg
            className="w-6 h-6 text-ds-yellow-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold text-ds-gray-1000 mb-2">
          Gauge Required
        </h3>

        {/* Description */}
        <p className="text-ds-gray-700 text-sm mb-4">
          <span className="font-medium text-ds-gray-900">
            {baseSymbol} / {quoteSymbol}
          </span>{" "}
          pool does not have a gauge yet. A gauge must be created before voting
          can be enabled.
        </p>

        {/* Form */}
        <div className="space-y-4 mb-6">
          <AddressInput
            label="Pool Factory Address"
            value={factory}
            onChange={setFactory}
            required
            helperText="The factory that created this pool"
          />
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-ds-gray-800">
              Pool Address
            </span>
            <span className="text-sm font-geist-mono text-ds-gray-700">
              {poolAddress}
            </span>
          </div>

          {/* Transaction Status */}
          {getTxStatus() !== "idle" && (
            <TransactionStatus
              status={getTxStatus()}
              txHash={gaugeHash}
              error={getTxErrorMessage()}
              onReset={resetTx}
            />
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="secondary"
            size="lg"
            onClick={handleClose}
            disabled={isLoading}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="lg"
            onClick={handleSubmit}
            disabled={isLoading || !factory || !contracts?.voter}
            loading={isLoading}
            className="flex-1"
          >
            Create Gauge
          </Button>
        </div>
      </div>
    </div>
  );
}
