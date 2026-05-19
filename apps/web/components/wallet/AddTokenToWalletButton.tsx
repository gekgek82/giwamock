"use client";

import { useCallback } from "react";
import { useAccount, useWatchAsset, useWalletClient } from "wagmi";
import { getAddress, type WalletClient } from "viem";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";

const WALLET_SYMBOL_MAX_LEN = 11;

/** Wallets often reject non-HTTPS `image` (SSRF rules). */
function httpsTokenIconUrl(raw: string | null | undefined): string | undefined {
  if (!raw?.trim()) return undefined;
  try {
    const u = new URL(
      raw.trim(),
      typeof window !== "undefined" ? window.location.origin : "https://localhost",
    );
    if (u.protocol === "https:") return u.href;
    return undefined;
  } catch {
    return undefined;
  }
}

export type AddTokenToWalletButtonProps = {
  tokenAddress: string;
  symbol: string;
  decimals: number;
  iconUrl?: string | null;
  className?: string;
  disabled?: boolean;
};

export function AddTokenToWalletButton({
  tokenAddress,
  symbol,
  decimals,
  iconUrl,
  className,
  disabled = false,
}: AddTokenToWalletButtonProps) {
  const t = useTranslations();
  const {
    isConnected,
    status,
    address: activeAddress,
    isConnecting,
    isReconnecting,
  } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { watchAssetAsync, isPending: isWatchAssetPending } = useWatchAsset();

  const walletReadyForWatchAsset =
    isConnected &&
    status === "connected" &&
    Boolean(activeAddress) &&
    Boolean(walletClient) &&
    !isConnecting &&
    !isReconnecting;

  const handleAddToWallet = useCallback(async () => {
    const toastId = toast.loading(t("tokenBalances.addToWalletPending"));
    if (!walletReadyForWatchAsset || !walletClient) {
      toast.dismiss(toastId);
      toast.error(t("tokenBalances.addToWalletNoAccount"));
      return;
    }

    try {
      const accts = (await (walletClient as WalletClient).request({
        method: "eth_accounts",
      })) as unknown;
      if (!Array.isArray(accts) || accts.length === 0) {
        toast.dismiss(toastId);
        toast.error(t("tokenBalances.addToWalletNoAccount"));
        return;
      }
    } catch {
      toast.dismiss(toastId);
      toast.error(t("tokenBalances.addToWalletNoAccount"));
      return;
    }

    let checksummed: `0x${string}`;
    try {
      checksummed = getAddress(tokenAddress as `0x${string}`);
    } catch {
      toast.dismiss(toastId);
      toast.error(t("tokenBalances.addToWalletFailed"));
      return;
    }

    const sym =
      (symbol || "TOKEN").trim().slice(0, WALLET_SYMBOL_MAX_LEN) || "TOKEN";
    const dec = Math.min(255, Math.max(0, Math.floor(decimals)));
    const imageUrl = httpsTokenIconUrl(iconUrl);

    const callWatch = (withImage: boolean) =>
      watchAssetAsync({
        type: "ERC20",
        options: {
          address: checksummed,
          symbol: sym,
          decimals: dec,
          ...(withImage && imageUrl ? { image: imageUrl } : {}),
        },
      });

    try {
      let wasAdded: boolean | undefined;
      try {
        wasAdded = (await callWatch(!!imageUrl)) as boolean | undefined;
      } catch (firstErr) {
        if (imageUrl) {
          wasAdded = (await callWatch(false)) as boolean | undefined;
        } else {
          throw firstErr;
        }
      }
      toast.dismiss(toastId);
      if (wasAdded === false) {
        toast(t("tokenBalances.addToWalletRejected"));
      } else {
        toast.success(t("tokenBalances.addToWalletSuccess"));
      }
    } catch (e) {
      toast.dismiss(toastId);
      console.error("watchAsset failed:", e);
      const msg =
        typeof e === "object" && e !== null && "message" in e
          ? String((e as { message?: unknown }).message)
          : e instanceof Error
            ? e.message
            : String(e);
      const noAccount =
        /at least one account|must has at least one account/i.test(msg);
      const rejected =
        /rejected|denied|cancel|user rejected/i.test(msg) ||
        (typeof e === "object" &&
          e !== null &&
          "code" in e &&
          (e as { code?: number }).code === 4001);
      if (noAccount) {
        toast.error(t("tokenBalances.addToWalletNoAccount"));
      } else if (rejected) {
        toast(t("tokenBalances.addToWalletRejected"));
      } else {
        toast.error(
          `${t("tokenBalances.addToWalletFailed")}: ${msg.slice(0, 160)}`,
        );
      }
    }
  }, [
    tokenAddress,
    symbol,
    decimals,
    iconUrl,
    t,
    watchAssetAsync,
    walletClient,
    walletReadyForWatchAsset,
  ]);

  const defaultClass =
    "px-3 py-2 border border-neutral-400 hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed text-neutral-1000 body-14-medium rounded-lg transition-all whitespace-nowrap";

  return (
    <button
      type="button"
      onClick={() => {
        void handleAddToWallet().catch((err) => {
          console.error("[AddToWallet] unhandled:", err);
        });
      }}
      disabled={
        disabled ||
        !walletReadyForWatchAsset ||
        isWatchAssetPending
      }
      className={className ?? defaultClass}
    >
      {isWatchAssetPending
        ? t("tokenBalances.addToWalletPending")
        : t("tokenBalances.addToWallet")}
    </button>
  );
}
