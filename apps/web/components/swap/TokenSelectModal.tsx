"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Image from "next/image";
import { useAccount } from "wagmi";
import {
  useRegisteredTokens,
  usePopularTokens,
  useApiTokens,
  type TokenInfo,
} from "@/hooks/useContractAddresses";
import { useTokenSearch, useRegisterToken } from "@/hooks/useTokenSearch";
import { useTokenBalances } from "@/hooks/useTokenBalances";
import { useTokenPrices } from "@/hooks/useTokenPrices";
import { TokenIcon } from "@/components/common/TokenIcon";
import { Button } from "@/components/common/Button";

interface TokenSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (token: TokenInfo) => void;
  excludeToken?: string;
}

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatAmount(amount: string): string {
  const num = parseFloat(amount);
  if (!Number.isFinite(num) || num === 0) return "0";
  if (num >= 1) return num.toLocaleString(undefined, { maximumFractionDigits: 5 });
  return num.toPrecision(4);
}

function formatUsd(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "$0";
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 5,
  })}`;
}

function CloseIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M21 21l-4.35-4.35M17 10.5A6.5 6.5 0 1 1 4 10.5a6.5 6.5 0 0 1 13 0Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TokenChip({
  token,
  onClick,
}: {
  token: TokenInfo;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-1 h-[54px] items-center justify-center gap-1 rounded-[10px] bg-gray-20 px-[20px] py-[16px] hover:bg-gray-30 transition-colors"
    >
      <TokenIcon
        address={token.address}
        symbol={token.symbol}
        iconUrl={token.iconUrl}
        size={24}
      />
      <span className="body-14-bold text-gray-90 flex items-center gap-1">
        {token.symbol}
        {token.stickerUrl && (
          <Image
            src={token.stickerUrl}
            alt="sticker"
            width={16}
            height={16}
            className="object-contain"
          />
        )}
      </span>
    </button>
  );
}

function TokenCard({
  token,
  balance,
  usdValue,
  onClick,
  selected,
}: {
  token: TokenInfo;
  balance?: string;
  usdValue?: number;
  onClick: () => void;
  selected?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-[10px] p-4 transition-colors text-left ${
        selected
          ? "bg-gray-20 ring-2 ring-green-20"
          : "bg-gray-20 hover:bg-gray-30"
      }`}
    >
      <div className="flex flex-col items-center justify-center gap-1">
        <TokenIcon
          address={token.address}
          symbol={token.symbol}
          iconUrl={token.iconUrl}
          size={24}
        />
        <span className="body-14-bold text-gray-100 flex items-center gap-1">
          {token.symbol}
          {token.stickerUrl && (
            <Image
              src={token.stickerUrl}
              alt="sticker"
              width={14}
              height={14}
              className="object-contain"
            />
          )}
        </span>
      </div>
      <div className="flex flex-col items-end justify-center">
        <span className="text-[12px] leading-[18px] font-medium text-gray-70">
          {truncateAddress(token.address)}
        </span>
        <span className="body-16-bold text-gray-100">
          {balance !== undefined ? formatAmount(balance) : "-"}
        </span>
        <span className="text-[12px] leading-[18px] font-medium text-gray-70">
          {usdValue !== undefined ? formatUsd(usdValue) : ""}
        </span>
      </div>
    </button>
  );
}

function EmptyAssets({ message }: { message: string }) {
  return (
    <div className="w-full rounded-[10px] bg-gray-20 px-5 py-8">
      <p className="body-14-medium text-center text-gray-50">{message}</p>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="body-16-semibold text-gray-90">{children}</p>
  );
}

export function TokenSelectModal({
  isOpen,
  onClose,
  onSelect,
  excludeToken,
}: TokenSelectModalProps) {
  const { isConnected } = useAccount();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [pendingToken, setPendingToken] = useState<TokenInfo | null>(null);
  const [riskAccepted, setRiskAccepted] = useState(false);

  const allTokens = useRegisteredTokens();
  const popularTokens = usePopularTokens();
  const apiTokens = useApiTokens();
  const { data: searchResult, isLoading: isSearching } =
    useTokenSearch(debouncedQuery);
  const registerMutation = useRegisterToken();

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      setDebouncedQuery("");
      setPendingToken(null);
      setRiskAccepted(false);
      registerMutation.reset();
    }
  }, [isOpen]);

  // Filter excluded tokens
  const filteredAllTokens = useMemo(
    () =>
      excludeToken
        ? allTokens.filter(
            (t) => t.address.toLowerCase() !== excludeToken.toLowerCase(),
          )
        : allTokens,
    [allTokens, excludeToken],
  );
  const filteredPopularTokens = useMemo(
    () =>
      excludeToken
        ? popularTokens.filter(
            (t) => t.address.toLowerCase() !== excludeToken.toLowerCase(),
          )
        : popularTokens,
    [popularTokens, excludeToken],
  );

  // Load prices + balances for the "Your Assets" section
  const allSymbols = useMemo(
    () => filteredAllTokens.map((t) => t.symbol),
    [filteredAllTokens],
  );
  const { prices } = useTokenPrices(allSymbols);
  const { tokensWithBalance } = useTokenBalances(filteredAllTokens, prices);

  const filteredApiTokens = useMemo(
    () =>
      excludeToken
        ? apiTokens.filter(
            (t) => t.address.toLowerCase() !== excludeToken.toLowerCase(),
          )
        : apiTokens,
    [apiTokens, excludeToken],
  );

  // Top volume tokens: API-only tokens (no custom tokens) excluding popular chips.
  const topVolumeTokens = useMemo(() => {
    const popularSet = new Set(
      filteredPopularTokens.map((t) => t.address.toLowerCase()),
    );
    return filteredApiTokens.filter(
      (t) => !popularSet.has(t.address.toLowerCase()),
    );
  }, [filteredApiTokens, filteredPopularTokens]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  const handleTokenClick = useCallback(
    (token: TokenInfo) => {
      if (token.isWhitelisted) {
        onSelect(token);
        onClose();
      } else {
        setPendingToken(token);
        setRiskAccepted(false);
      }
    },
    [onSelect, onClose],
  );

  const handleConfirmPendingToken = useCallback(() => {
    if (pendingToken && riskAccepted) {
      onSelect(pendingToken);
      onClose();
    }
  }, [pendingToken, riskAccepted, onSelect, onClose]);

  const handleCancelPendingToken = useCallback(() => {
    setPendingToken(null);
    setRiskAccepted(false);
  }, []);

  const handleRegisterToken = useCallback(async () => {
    const result = await registerMutation.mutateAsync(searchQuery.trim());
    if (result.success && result.token) {
      onSelect(result.token);
      onClose();
    }
  }, [searchQuery, registerMutation, onSelect, onClose]);

  if (!isOpen) return null;

  const isSearchActive = debouncedQuery.length > 0;
  const searchTokens = excludeToken
    ? (searchResult?.tokens ?? []).filter(
        (t) => t.address.toLowerCase() !== excludeToken.toLowerCase(),
      )
    : (searchResult?.tokens ?? []);

  const isFullAddress = ADDRESS_REGEX.test(searchQuery.trim());
  const showAddToken =
    isSearchActive &&
    isFullAddress &&
    searchTokens.length === 0 &&
    !isSearching;

  const hasAssets = tokensWithBalance.length > 0;
  const searchBorderClass = isConnected ? "border-gray-60" : "border-gray-40";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="Select token"
      style={{ backgroundColor: "rgba(77, 77, 77, 0.8)" }}
    >
      {/* Modal */}
      <div className="relative flex w-full max-w-[520px] flex-col overflow-hidden rounded-[30px] bg-white max-h-[90vh]">
        {/* Header */}
        <div className="flex flex-col gap-3 pt-[30px]">
          <div className="relative flex items-center px-[30px]">
            <h2 className="text-gray-100 heading-6">Select token to sell</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="ml-auto text-gray-100 hover:text-gray-70 transition-colors"
            >
              <CloseIcon />
            </button>
          </div>
          <div className="h-px w-full bg-gray-30" />
        </div>

        {/* Scrollable content */}
        <div className="flex flex-col gap-5 overflow-y-auto px-[30px] pb-[30px] pt-5">
          {/* Search input */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by token or paste address"
              disabled={!!pendingToken}
              className={`w-full h-[64px] rounded-[100px] border ${searchBorderClass} bg-white px-5 pr-14 body-14-medium text-gray-100 placeholder:text-gray-50 focus:outline-none focus:border-gray-100 transition-colors disabled:opacity-60`}
            />
            <span className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-70">
              <SearchIcon />
            </span>
          </div>

          {pendingToken ? (
            /* Whitelist confirmation mode (Figma 1452:27401) — show popular chips +
               the selected token highlighted + verify-before-trading warning panel.
               Other sections (Your Assets, Top volume) are hidden so the user can
               focus on confirming or cancelling. CTAs move to the modal footer. */
            <>
              {isConnected && filteredPopularTokens.length > 0 && (
                <div className="flex flex-col gap-3">
                  <SectionLabel>Popular token</SectionLabel>
                  <div className="flex gap-2.5">
                    {filteredPopularTokens.slice(0, 4).map((token) => (
                      <TokenChip
                        key={token.address}
                        token={token}
                        onClick={() => handleTokenClick(token)}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-3">
                <SectionLabel>Token</SectionLabel>
                {(() => {
                  const withBalance = tokensWithBalance.find(
                    (t) =>
                      t.address.toLowerCase() ===
                      pendingToken.address.toLowerCase(),
                  );
                  return (
                    <TokenCard
                      token={pendingToken}
                      balance={withBalance?.balance}
                      usdValue={withBalance?.usdValue}
                      onClick={() => {}}
                      selected
                    />
                  );
                })()}

                {/* Verify-before-trading warning (Figma 625:25593) */}
                <div className="bg-gray-20 rounded-[10px] px-5 py-4 flex flex-col gap-2.5">
                  <div className="flex items-center gap-1">
                    <svg
                      className="size-6 text-red-30 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.072 16.5c-.77.833.192 2.5 1.732 2.5z"
                      />
                    </svg>
                    <span className="body-14-bold text-red-30">
                      Please verify before trading
                    </span>
                  </div>
                  <p className="body-14-medium text-red-30">
                    This token was issued in an open environment where anyone
                    can create tokens. The security of this asset has not been
                    verified, so please proceed with caution. Be sure to review
                    the{" "}
                    <a
                      href="/legal/disclaimer"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold hover:underline"
                    >
                      [Legal Disclaimer]
                    </a>{" "}
                    before trading.
                  </p>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={riskAccepted}
                    onClick={() => setRiskAccepted(!riskAccepted)}
                    className="flex items-center gap-1.5 text-left"
                  >
                    <span
                      className={`size-6 rounded-[5px] shrink-0 flex items-center justify-center transition-colors ${
                        riskAccepted ? "bg-green-20" : "bg-gray-30"
                      }`}
                    >
                      {riskAccepted && (
                        <svg
                          width="14"
                          height="11"
                          viewBox="0 0 14 11"
                          fill="none"
                          aria-hidden="true"
                        >
                          <path
                            d="M1.5 5.5L5 9L12.5 1.5"
                            stroke="white"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </span>
                    <span className="flex-1 body-14-bold text-gray-90">
                      I have read the risks above and agree that I am solely
                      responsible for this transaction.
                    </span>
                  </button>
                </div>
              </div>
            </>
          ) : isSearchActive ? (
            // Search results replace the default sections
            <div className="flex flex-col gap-3">
              {isSearching && (
                <p className="body-14-medium text-center text-gray-50 py-6">
                  Searching...
                </p>
              )}

              {!isSearching && searchTokens.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  {searchTokens.map((token) => {
                    const priceVal = prices[token.symbol] ?? 0;
                    const withBalance = tokensWithBalance.find(
                      (t) => t.address.toLowerCase() === token.address.toLowerCase(),
                    );
                    return (
                      <TokenCard
                        key={token.address}
                        token={token}
                        balance={withBalance?.balance}
                        usdValue={
                          withBalance
                            ? withBalance.usdValue
                            : priceVal
                            ? 0
                            : undefined
                        }
                        onClick={() => handleTokenClick(token)}
                        selected={false}
                      />
                    );
                  })}
                </div>
              )}

              {!isSearching &&
                searchTokens.length === 0 &&
                !showAddToken && (
                  <p className="body-14-medium text-center text-gray-50 py-6">
                    No tokens found
                  </p>
                )}

              {showAddToken && (
                <div className="flex flex-col items-center rounded-[10px] bg-gray-20 px-5 py-6 text-center">
                  <p className="body-14-medium text-gray-90 mb-1">
                    Token not found in the list.
                  </p>
                  <p className="body-12 break-all text-gray-50 mb-4">
                    {searchQuery.trim()}
                  </p>
                  <Button
                    size="sm"
                    onClick={handleRegisterToken}
                    loading={registerMutation.isPending}
                  >
                    {registerMutation.isPending
                      ? "Verifying..."
                      : "Add this token"}
                  </Button>
                  {registerMutation.isError && (
                    <p className="body-12 text-red-40 mt-2">
                      Failed to register token
                    </p>
                  )}
                  {registerMutation.data &&
                    !registerMutation.data.success && (
                      <p className="body-12 text-red-40 mt-2">
                        {registerMutation.data.error ||
                          "Address is not a valid ERC20 token"}
                      </p>
                    )}
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Popular tokens (only when wallet is connected) */}
              {isConnected && filteredPopularTokens.length > 0 && (
                <div className="flex flex-col gap-3">
                  <SectionLabel>Popular token</SectionLabel>
                  <div className="flex gap-2.5">
                    {filteredPopularTokens.slice(0, 4).map((token) => (
                      <TokenChip
                        key={token.address}
                        token={token}
                        onClick={() => handleTokenClick(token)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Your Assets */}
              <div className="flex flex-col gap-3">
                <SectionLabel>Your Assets</SectionLabel>
                {!isConnected ? (
                  <EmptyAssets message="Connect wallet to swap tokens" />
                ) : hasAssets ? (
                  <div className="grid grid-cols-2 gap-3">
                    {tokensWithBalance.map((token) => (
                      <TokenCard
                        key={token.address}
                        token={token}
                        balance={token.balance}
                        usdValue={token.usdValue}
                        onClick={() => handleTokenClick(token)}
                        selected={false}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyAssets message="No tokens found in your wallet" />
                )}
              </div>

              {/* Top volume tokens */}
              {topVolumeTokens.length > 0 && (
                <div className="flex flex-col gap-3">
                  <SectionLabel>Top volume tokens</SectionLabel>
                  <div className="grid grid-cols-2 gap-3">
                    {topVolumeTokens.map((token) => {
                      const withBalance = isConnected
                        ? tokensWithBalance.find(
                            (t) =>
                              t.address.toLowerCase() ===
                              token.address.toLowerCase(),
                          )
                        : undefined;
                      const price = prices[token.symbol] ?? 0;
                      return (
                        <TokenCard
                          key={token.address}
                          token={token}
                          balance={withBalance?.balance ?? "0"}
                          usdValue={withBalance ? withBalance.usdValue : price ? 0 : undefined}
                          onClick={() => handleTokenClick(token)}
                          selected={false}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

        </div>

        {/* Modal footer — only in whitelist confirmation mode (Figma 1452:27401 CTA row) */}
        {pendingToken && (
          <div className="border-t border-gray-30 px-[30px] py-5 flex justify-center gap-5">
            <Button
              variant="secondary"
              size="lg"
              className="w-[220px]"
              onClick={handleCancelPendingToken}
            >
              Cancel
            </Button>
            <Button
              size="lg"
              className="w-[220px]"
              onClick={handleConfirmPendingToken}
              disabled={!riskAccepted}
            >
              Continue
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
