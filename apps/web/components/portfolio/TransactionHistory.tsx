"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useAccount } from "wagmi";
import {
  portfolioApi,
  type PortfolioTransaction,
  type TransactionType,
} from "@/lib/portfolioApi";
import { getMockDemoAddress, isMockMode } from "@/lib/mockTransactions";
import { Pagination } from "./Pagination";

// Transaction type display names
const transactionTypeLabels: Record<TransactionType, string> = {
  SWAP: "SWAP",
  ADD_LIQUIDITY: "Add liquidity",
  REMOVE_LIQUIDITY: "Removed liquidity",
  CLAIM: "Claimed",
  LIQUIDITY_STAKE: "Liquidity Stake",
  LIQUIDITY_UNSTAKE: "Liquidity Unstake",
  LOCK: "Lock",
  UNLOCK: "Unlock",
  RECEIVED_VOTE_POWER: "Received Vote Power",
};

// Bold transaction types
const boldTypes: TransactionType[] = ["LIQUIDITY_STAKE", "LIQUIDITY_UNSTAKE"];

// Format date and time separately
function formatDate(timestamp: string): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

// Format USD value
function formatUsd(value: string | null): string {
  if (!value) return "-";
  const num = parseFloat(value);
  if (isNaN(num)) return "-";
  return `$ ${num.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

// Shorten transaction hash
function shortenAddress(address: string): string {
  if (address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Get token amounts display (amount and symbol separately)
function getTokenAmounts(tx: PortfolioTransaction): {
  token1Amount: string | null;
  token1Symbol: string | null;
  token2Amount: string | null;
  token2Symbol: string | null;
} {
  if (!tx.tokens || tx.tokens.length === 0) {
    return {
      token1Amount: null,
      token1Symbol: null,
      token2Amount: null,
      token2Symbol: null,
    };
  }

  const token1 = tx.tokens[0];
  const token2 = tx.tokens[1];

  return {
    token1Amount: token1 ? token1.amount : null,
    token1Symbol: token1 ? token1.symbol : null,
    token2Amount: token2 ? token2.amount : null,
    token2Symbol: token2 ? token2.symbol : null,
  };
}

// Loading skeleton
function TableSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="px-2 h-9 bg-gray-20 rounded animate-pulse" />
      <div className="bg-white rounded-[40px] py-[30px] flex flex-col items-center animate-pulse">
        <div className="w-full max-w-[1300px] bg-gray-20 rounded-[20px] h-[61px]" />
        <div className="w-full max-w-[1360px] mt-5 space-y-5">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-[46px] bg-gray-20 rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}

// Header column component
function HeaderColumn({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 p-2.5 flex items-center justify-center gap-1">
      <span className="text-center text-gray-100 text-sm font-bold leading-[21px]">
        {children}
      </span>
    </div>
  );
}

interface TransactionHistoryProps {
  /** Bumped by the parent after a claim succeeds so the new CLAIM row
   *  appears without waiting for the next natural refresh. */
  refreshKey?: number;
}

export function TransactionHistory({
  refreshKey,
}: TransactionHistoryProps = {}) {
  const t = useTranslations();
  const { address, isConnected } = useAccount();
  const effectiveAddress = address ?? (isMockMode() ? getMockDemoAddress() : undefined);
  const effectiveIsConnected = isConnected || isMockMode();
  const [transactions, setTransactions] = useState<PortfolioTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    if (!effectiveIsConnected || !effectiveAddress) {
      setTransactions([]);
      return;
    }

    const fetchTransactions = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const offset = (currentPage - 1) * itemsPerPage;
        const data = await portfolioApi.getTransactions(effectiveAddress, {
          limit: itemsPerPage,
          offset,
        });
        setTransactions(data.transactions);
        setTotalPages(
          data.pagination.totalPages ||
            Math.ceil(data.pagination.total / itemsPerPage),
        );
      } catch (err) {
        if (
          err instanceof Error &&
          "statusCode" in err &&
          (err as { statusCode?: number }).statusCode === 404
        ) {
          setTransactions([]);
        } else {
          setError(
            err instanceof Error ? err.message : "Failed to fetch transactions",
          );
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchTransactions();
  }, [effectiveAddress, effectiveIsConnected, currentPage, refreshKey]);

  const renderWrapper = (content: React.ReactNode) => (
    <div className="flex flex-col gap-3">
      {/* Section Title */}
      <div className="px-2 flex items-center gap-2.5">
        <h2 className="flex-1 text-gray-100 text-2xl font-bold leading-9">
          Transaction
        </h2>
      </div>
      {content}
    </div>
  );

  if (!effectiveIsConnected) {
    return renderWrapper(
      <div className="bg-white rounded-[40px] py-[30px] px-8 text-center">
        <p className="text-gray-70 text-sm">{t("common.connectWallet")}</p>
      </div>,
    );
  }

  if (isLoading) {
    return <TableSkeleton />;
  }

  if (error) {
    return renderWrapper(
      <div className="bg-white rounded-[40px] py-[30px] px-8 text-center">
        <p className="text-red-30 text-sm">{error}</p>
      </div>,
    );
  }

  if (transactions.length === 0) {
    return renderWrapper(
      <div className="bg-white rounded-[40px] py-[30px] px-8 text-center">
        <p className="text-gray-70 text-sm">
          {t("portfolio.noTransactions")}
        </p>
      </div>,
    );
  }

  return renderWrapper(
    <div className="bg-white rounded-[40px] py-[30px] flex flex-col items-center">
      {/* Table Header */}
      <div className="w-full max-w-[1300px] py-5 bg-gray-20 rounded-[20px] flex flex-col gap-5">
        <div className="flex items-center gap-2.5">
          <HeaderColumn>Date & Time</HeaderColumn>
          <HeaderColumn>Type</HeaderColumn>
          <HeaderColumn>USD</HeaderColumn>
          <HeaderColumn>TokenA Amount</HeaderColumn>
          <HeaderColumn>TokenB Amount</HeaderColumn>
          <HeaderColumn>Transaction ID</HeaderColumn>
        </div>
      </div>

      {/* Data Rows */}
      <div className="w-full max-w-[1360px] flex flex-col">
        {transactions.map((tx, index) => {
          const { token1Amount, token1Symbol, token2Amount, token2Symbol } =
            getTokenAmounts(tx);
          const isLast = index === transactions.length - 1;
          return (
            <div key={tx.id} className="pt-5 flex flex-col items-center gap-5">
              <div className="w-full flex items-center gap-5">
                {/* Date & Time */}
                <div className="flex-1 h-[46px] px-2.5 flex items-center justify-center gap-1">
                  <span className="text-right text-gray-100 text-sm font-medium leading-[21px]">
                    {formatDate(tx.timestamp)}
                  </span>
                  <span className="text-right text-gray-100 text-sm font-medium leading-[21px]">
                    {formatTime(tx.timestamp)}
                  </span>
                </div>

                {/* Type */}
                <div className="flex-1 h-[46px] px-2.5 flex items-center justify-center gap-2.5">
                  <span
                    className={`text-right text-gray-100 text-sm leading-[21px] ${
                      boldTypes.includes(tx.type) ? "font-bold" : "font-medium"
                    }`}
                  >
                    {transactionTypeLabels[tx.type] || tx.type}
                  </span>
                </div>

                {/* USD */}
                <div className="flex-1 h-[46px] px-2.5 flex items-center justify-center gap-2.5">
                  <span className="text-right text-gray-100 text-sm font-medium leading-[21px]">
                    {formatUsd(tx.usdValue)}
                  </span>
                </div>

                {/* TokenA Amount */}
                <div className="flex-1 h-[46px] px-2.5 flex items-center justify-center gap-1">
                  {token1Amount ? (
                    <>
                      <span className="text-right text-gray-100 text-sm font-medium leading-[21px]">
                        {token1Amount}
                      </span>
                      <span className="text-right text-gray-100 text-sm font-medium leading-[21px]">
                        {token1Symbol}
                      </span>
                    </>
                  ) : (
                    <span className="text-right text-gray-100 text-sm font-medium leading-[21px]">
                      -
                    </span>
                  )}
                </div>

                {/* TokenB Amount */}
                <div className="flex-1 h-[46px] px-2.5 flex items-center justify-center gap-1">
                  {token2Amount ? (
                    <>
                      <span className="text-right text-gray-100 text-sm font-medium leading-[21px]">
                        {token2Amount}
                      </span>
                      <span className="text-right text-gray-100 text-sm font-medium leading-[21px]">
                        {token2Symbol}
                      </span>
                    </>
                  ) : null}
                </div>

                {/* Transaction ID */}
                <div className="flex-1 h-[46px] px-2.5 flex items-center justify-center gap-2.5">
                  <a
                    href={`https://sepolia-explorer.giwa.io/tx/${tx.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-right text-gray-100 text-sm font-medium leading-[21px] hover:text-primary-300 transition-colors"
                  >
                    {shortenAddress(tx.txHash)}
                  </a>
                </div>
              </div>

              {/* Row Divider */}
              {!isLast && (
                <div className="w-full h-0 border-t border-gray-30" />
              )}
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex justify-center">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>
      )}
    </div>,
  );
}
