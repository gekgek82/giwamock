"use client";

import { useAccount } from "wagmi";
import { useTranslations } from "next-intl";
import { GIWASCAN_URL } from "@/lib/config";
import { useRegisteredTokens } from "@/hooks/useContractAddresses";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { useTokenMint } from "@/hooks/useTokenMint";
import { useCallback, useEffect, useRef, useState } from "react";
import { TokenIcon } from "@/components/common/TokenIcon";
import { AddTokenToWalletButton } from "@/components/wallet/AddTokenToWalletButton";

export function TokenBalances() {
  const { address, isConnected } = useAccount();
  const t = useTranslations();
  const tokens = useRegisteredTokens();

  if (!isConnected || !address) {
    return (
      <div className="py-8 text-center">
        <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-primary-700"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>
        <p className="text-neutral-700 body-14">
          {t("tokenBalances.connectWalletPrompt")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tokens.map((token) => (
        <TokenBalanceItem
          key={token.address}
          tokenAddress={token.address as `0x${string}`}
          symbol={token.symbol}
          name={token.name}
          decimals={token.decimals ?? 18}
          iconUrl={token.iconUrl}
          stickerUrl={token.stickerUrl}
          userAddress={address}
        />
      ))}
    </div>
  );
}

function TokenBalanceItem({
  tokenAddress,
  symbol,
  name,
  decimals,
  iconUrl,
  stickerUrl,
  userAddress,
}: {
  tokenAddress: `0x${string}`;
  symbol: string;
  name: string;
  decimals: number;
  iconUrl: string | null;
  stickerUrl?: string | null;
  userAddress: `0x${string}`;
}) {
  const t = useTranslations();
  const { data: balance, isLoading, refetch } = useTokenBalance({
    tokenAddress,
    decimals,
  });
  const { mint, isPending, isConfirming, isConfirmed, hash, error } =
    useTokenMint();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const previousHashRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    // Only refetch when we have a new confirmed transaction
    if (isConfirmed && hash && hash !== previousHashRef.current) {
      previousHashRef.current = hash;
      setIsRefetching(true);
      // Delay refetch to allow blockchain state propagation
      const timeoutId = setTimeout(async () => {
        await refetch();
        setIsRefetching(false);
      }, 2000);
      return () => clearTimeout(timeoutId);
    }
  }, [isConfirmed, hash, refetch]);

  const isBusy = isPending || isConfirming || isRefetching;

  const handleMintClick = () => {
    setShowConfirmDialog(true);
  };

  const handleConfirmMint = async () => {
    setShowConfirmDialog(false);
    try {
      await mint(tokenAddress, userAddress, "10000");
    } catch (err) {
      console.error("Mint failed:", err);
    }
  };

  const handleCancelMint = () => {
    setShowConfirmDialog(false);
  };

  return (
    <>
      <div className="flex items-center justify-between p-4 bg-neutral-100 rounded-xl border border-neutral-200 hover:border-neutral-400 transition-all">
        <div className="flex items-center gap-3">
          <TokenIcon
            address={tokenAddress}
            symbol={symbol}
            iconUrl={iconUrl}
            size={40}
          />
          <div>
            <div className="flex items-center gap-1">
              <span className="body-14-medium text-neutral-1000">{symbol}</span>
              {stickerUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={stickerUrl}
                  alt=""
                  width={18}
                  height={18}
                  className="object-contain"
                />
              )}
            </div>
            <div className="body-12 text-neutral-700">{name}</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
          <div className="text-right min-w-[5rem]">
            {isLoading ? (
              <div className="text-neutral-700 body-14">
                {t("common.loading")}
              </div>
            ) : (
              <div className="body-16-bold text-neutral-1000">
                {balance ? parseFloat(balance).toFixed(4) : "0.0000"}
              </div>
            )}
          </div>
          <AddTokenToWalletButton
            tokenAddress={tokenAddress}
            symbol={symbol}
            decimals={decimals}
            iconUrl={iconUrl}
            disabled={isBusy}
            className="px-3 py-2 border border-neutral-400 hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed text-neutral-1000 body-14-medium rounded-lg transition-all whitespace-nowrap"
          />
          <button
            type="button"
            onClick={handleMintClick}
            disabled={isBusy}
            className="px-4 py-2 bg-primary-100 hover:bg-primary-200 disabled:bg-neutral-400 disabled:cursor-not-allowed text-neutral-1000 body-14-medium rounded-lg transition-all whitespace-nowrap"
          >
            {isBusy ? t("tokenBalances.minting") : t("tokenBalances.mint")}
          </button>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="heading-6 text-primary-700 mb-4">
              {t("tokenBalances.mintConfirmTitle")}
            </h3>
            <p className="text-neutral-700 body-14 mb-6">
              {t("tokenBalances.mintConfirmMessage", {
                amount: "10,000",
                symbol: symbol,
              })}
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleCancelMint}
                className="flex-1 px-4 py-3 bg-neutral-200 hover:bg-neutral-300 text-neutral-1000 body-14-medium rounded-lg transition-all"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleConfirmMint}
                className="flex-1 px-4 py-3 bg-primary-100 hover:bg-primary-200 text-neutral-1000 body-14-medium rounded-lg transition-all"
              >
                {t("common.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success/Error Toast */}
      {isConfirmed && hash && (
        <div className="fixed bottom-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center gap-2">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
          {t("tokenBalances.mintSuccess")}
          <a
            href={`${GIWASCAN_URL}/tx/${hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 underline"
          >
            {t("common.viewTransaction")}
          </a>
        </div>
      )}
      {error && (
        <div className="fixed bottom-4 right-4 bg-red-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center gap-2">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
          {t("tokenBalances.mintFailed")}: {error.message}
        </div>
      )}
    </>
  );
}
