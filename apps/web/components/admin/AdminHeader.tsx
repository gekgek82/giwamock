"use client";

import Link from "next/link";
import {
  useConnectModal,
  useAccountModal,
  useChainModal,
} from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { GIWA_SEPOLIA_CHAIN_ID } from "@/lib/config";

export function AdminHeader() {
  const { chain, address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { openAccountModal } = useAccountModal();
  const { openChainModal } = useChainModal();

  const isWrongNetwork =
    Boolean(isConnected && chain && chain.id !== GIWA_SEPOLIA_CHAIN_ID);

  const handleWalletAreaClick = () => {
    if (!isConnected) {
      openConnectModal?.();
      return;
    }
    if (isWrongNetwork) {
      openChainModal?.();
      return;
    }
    openAccountModal?.();
  };

  const displayLabel = address
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : "…";

  return (
    <header className="flex items-center justify-between h-14 px-6 border-b border-ds-gray-400 bg-ds-background-100 shrink-0">
      <Link href="/admin" className="flex items-center gap-2.5">
        <img src="/header-logo.svg" alt="GIWATER" height={24} />
        <span className="text-[11px] text-ds-gray-600 font-medium">Admin</span>
      </Link>

      <div className="flex items-center gap-3">
        {isWrongNetwork && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-ds-yellow-700/10 text-ds-yellow-400 text-xs font-medium rounded-md border border-ds-yellow-700/20">
            <span>⚠</span>
            <span>Switch to GIWA Sepolia</span>
          </div>
        )}

        {!isConnected ? (
          <button
            type="button"
            onClick={() => openConnectModal?.()}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-ds-gray-1000 text-ds-background-100 text-xs font-medium hover:bg-ds-gray-900 transition-colors"
          >
            Connect Wallet
          </button>
        ) : (
          <button
            type="button"
            onClick={handleWalletAreaClick}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${
              isWrongNetwork
                ? "bg-ds-yellow-700/10 text-ds-yellow-400 border-ds-yellow-700/20 hover:bg-ds-yellow-700/20"
                : "bg-ds-background-200 text-ds-gray-900 border-ds-gray-400 hover:border-ds-gray-500 hover:bg-ds-gray-200"
            }`}
          >
            {isWrongNetwork ? (
              <>
                <span>⚠</span>
                <span>Wrong Network</span>
              </>
            ) : (
              <>
                <div className="w-4 h-4 bg-ds-green-700 rounded-full shrink-0" />
                <span className="font-geist-mono">{displayLabel}</span>
              </>
            )}
          </button>
        )}
      </div>
    </header>
  );
}
