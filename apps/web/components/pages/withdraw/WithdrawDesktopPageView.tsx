"use client";

import { Suspense, useMemo, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useAccount } from "wagmi";
import { useTranslations } from "next-intl";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { PoolInfoHeader } from "@/components/deposit/PoolInfoHeader";
import { PageHeader } from "@/components/common/PageHeader";
import { DepositInfoCard } from "@/components/withdraw/DepositInfoCard";
import { RemoveLiquidity } from "@/components/pool/RemoveLiquidity";
import { CLRemoveLiquidity } from "@/components/pool/CLRemoveLiquidity";
import { useTokenByAddress } from "@/hooks/useContractAddresses";
import { useCheckPoolExists } from "@/hooks/usePoolFactory";
import { useCheckCLPoolExists } from "@/hooks/useCLPoolFactory";
import { usePools } from "@/hooks/usePools";
import { useLpBalance } from "@/hooks/useLpBalance";
import { usePoolReserves } from "@/hooks/usePoolReserves";
import { useTokenPrices } from "@/hooks/useTokenPrices";
import { useLpStakeIntent } from "@/hooks/useLpStakeIntent";
import { portfolioApi } from "@/lib/portfolioApi";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as `0x${string}`;

function WithdrawLoading() {
  const t = useTranslations();
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        <div className="flex items-center justify-center py-20">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-700"></div>
          <span className="ml-4 text-neutral-700">{t("common.loading")}</span>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export function WithdrawDesktopPageView() {
  return (
    <Suspense fallback={<WithdrawLoading />}>
      <WithdrawContent />
    </Suspense>
  );
}

function WithdrawContent() {
  const searchParams = useSearchParams();

  const typeParam = searchParams.get("type");
  const poolType = typeParam !== null ? parseInt(typeParam, 10) : 1;
  const isBasicPool = poolType <= 0;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {isBasicPool ? <BasicWithdraw /> : <CLWithdraw />}
      </main>
      <Footer />
    </div>
  );
}

function BasicWithdraw() {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const { pools } = usePools();

  const rawToken0 = searchParams.get("token0");
  const rawToken1 = searchParams.get("token1");
  const typeParam = searchParams.get("type");
  const isStableParam = typeParam === "0";

  const [token0Address, token1Address] = useMemo<
    [string | null, string | null]
  >(() => {
    if (!rawToken0 || !rawToken1) return [rawToken0, rawToken1];
    return rawToken0.toLowerCase() < rawToken1.toLowerCase()
      ? [rawToken0, rawToken1]
      : [rawToken1, rawToken0];
  }, [rawToken0, rawToken1]);

  const indexerPool = useMemo(() => {
    if (!token0Address || !token1Address) return undefined;
    const t0 = token0Address.toLowerCase();
    const t1 = token1Address.toLowerCase();
    return pools.find((p) => {
      const a = p.token0.address.toLowerCase();
      const b = p.token1.address.toLowerCase();
      const pairMatches = (a === t0 && b === t1) || (a === t1 && b === t0);
      if (!pairMatches) return false;
      if ((p.poolType || "BASIC") !== "BASIC") return false;
      return p.isStable === isStableParam;
    });
  }, [pools, token0Address, token1Address, isStableParam]);

  const { poolAddress: onChainPoolAddress } = useCheckPoolExists(
    token0Address ? (token0Address as `0x${string}`) : undefined,
    token1Address ? (token1Address as `0x${string}`) : undefined,
    isStableParam,
  );

  const token0Info = useTokenByAddress(token0Address ?? undefined);
  const token1Info = useTokenByAddress(token1Address ?? undefined);

  const fallbackPool = useMemo(() => {
    if (indexerPool || !token0Info || !token1Info) return null;
    return {
      address: (onChainPoolAddress ?? ZERO_ADDRESS) as `0x${string}`,
      token0: {
        address: token0Info.address as `0x${string}`,
        symbol: token0Info.symbol,
        name: token0Info.name,
        decimals: token0Info.decimals,
      },
      token1: {
        address: token1Info.address as `0x${string}`,
        symbol: token1Info.symbol,
        name: token1Info.name,
        decimals: token1Info.decimals,
      },
      name: `${token0Info.symbol}-${token1Info.symbol} Pool`,
      isStable: isStableParam,
      poolType: "BASIC",
      tickSpacing: null,
      hasGauge: false,
      reserve0: "0",
      reserve1: "0",
    };
  }, [indexerPool, onChainPoolAddress, token0Info, token1Info, isStableParam]);

  const selectedPool = indexerPool ?? fallbackPool;

  // Deposit info (for DepositInfoCard) — show the AVAILABLE (unstaked) portion
  // so "My liquidity" stays consistent with the portfolio column and with the
  // withdraw slider's effective range.
  const { balanceRaw, totalSupply, isLoading: isLoadingBalance } = useLpBalance(
    selectedPool?.address,
  );
  const { reserve0Raw, reserve1Raw } = usePoolReserves(selectedPool?.address);
  const { prices } = useTokenPrices([
    selectedPool?.token0.symbol,
    selectedPool?.token1.symbol,
  ]);
  const { stakedAmountRaw } = useLpStakeIntent(selectedPool?.address);

  if (!selectedPool) {
    return (
      <div className="text-center py-20 text-neutral-700">Loading pool…</div>
    );
  }

  // Available (unstaked) LP = balance - stakedAmount, floored at 0.
  const availableBalanceRaw =
    balanceRaw !== undefined
      ? balanceRaw > stakedAmountRaw
        ? balanceRaw - stakedAmountRaw
        : 0n
      : 0n;
  const myToken0Amount =
    availableBalanceRaw && totalSupply && totalSupply > 0n && reserve0Raw
      ? Number((reserve0Raw * availableBalanceRaw) / totalSupply) / 1e18
      : 0;
  const myToken1Amount =
    availableBalanceRaw && totalSupply && totalSupply > 0n && reserve1Raw
      ? Number((reserve1Raw * availableBalanceRaw) / totalSupply) / 1e18
      : 0;
  const price0 = prices[selectedPool.token0.symbol] ?? 0;
  const price1 = prices[selectedPool.token1.symbol] ?? 0;
  const depositUsd = myToken0Amount * price0 + myToken1Amount * price1;
  const hasDeposit = myToken0Amount > 0 || myToken1Amount > 0;

  const fmt = (n: number) =>
    n.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  return (
    <>
      <div className="mb-4">
        <PageHeader title={t("liquidity.removeLiquidity")} />
      </div>
      <div className="mb-6">
        <PoolInfoHeader
          token0Symbol={selectedPool.token0.symbol}
          token1Symbol={selectedPool.token1.symbol}
          token0Address={selectedPool.token0.address}
          token1Address={selectedPool.token1.address}
          token0Decimals={selectedPool.token0.decimals}
          token1Decimals={selectedPool.token1.decimals}
          poolAddress={selectedPool.address}
          isStable={isStableParam}
          strategy="Basic"
        />
      </div>
      {(hasDeposit || isLoadingBalance) && (
        <div className="mb-6">
          <DepositInfoCard
            depositNumber={1}
            tags={[
              { label: "Basic" },
              { label: isStableParam ? "Stable" : "Volatile" },
              { label: "No Lock", variant: "muted" },
            ]}
            tokenInfo={`${selectedPool.token0.symbol} ${fmt(myToken0Amount)} / ${selectedPool.token1.symbol} ${fmt(myToken1Amount)}`}
            status="Deposited"
            usdValue={`~$${fmt(depositUsd)}`}
            isLoading={isLoadingBalance}
          />
        </div>
      )}
      <div className="flex justify-center">
        <div className="w-full max-w-[560px]">
          <RemoveLiquidity initialPool={selectedPool} />
        </div>
      </div>
    </>
  );
}

function CLWithdraw() {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const { address } = useAccount();

  const rawToken0 = searchParams.get("token0");
  const rawToken1 = searchParams.get("token1");
  const typeParam = searchParams.get("type");
  const tokenId = searchParams.get("tokenId");
  const tickSpacing =
    typeParam !== null ? parseInt(typeParam, 10) : undefined;

  const [token0Address, token1Address] = useMemo<
    [string | null, string | null]
  >(() => {
    if (!rawToken0 || !rawToken1) return [rawToken0, rawToken1];
    return rawToken0.toLowerCase() < rawToken1.toLowerCase()
      ? [rawToken0, rawToken1]
      : [rawToken1, rawToken0];
  }, [rawToken0, rawToken1]);

  const { poolAddress: clPoolAddress } = useCheckCLPoolExists(
    token0Address ? (token0Address as `0x${string}`) : undefined,
    token1Address ? (token1Address as `0x${string}`) : undefined,
    tickSpacing,
  );

  const token0Info = useTokenByAddress(token0Address ?? undefined);
  const token1Info = useTokenByAddress(token1Address ?? undefined);

  // Fetch deposited amounts and USD value from the portfolio API (best-effort)
  const [depositData, setDepositData] = useState<{
    token0Amount: string;
    token1Amount: string;
    usdValue: string;
  } | null>(null);
  const [isLoadingDeposit, setIsLoadingDeposit] = useState(true);

  useEffect(() => {
    if (!address || !tokenId) {
      setIsLoadingDeposit(false);
      return;
    }
    let cancelled = false;
    setIsLoadingDeposit(true);
    portfolioApi
      .getLiquidityPositions(address)
      .then((data) => {
        if (cancelled) return;
        const match = data.positions.find((p) => p.tokenId === tokenId);
        if (match) {
          setDepositData({
            token0Amount: match.deposited.token0Amount,
            token1Amount: match.deposited.token1Amount,
            usdValue: match.deposited.usdValue,
          });
        } else {
          setDepositData(null);
        }
      })
      .catch(() => {
        if (!cancelled) setDepositData(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingDeposit(false);
      });
    return () => {
      cancelled = true;
    };
  }, [address, tokenId]);

  if (!tokenId || !token0Address || !token1Address) {
    return (
      <div className="text-center py-20 text-neutral-700">
        Missing position information.
      </div>
    );
  }

  if (!token0Info || !token1Info) {
    return (
      <div className="text-center py-20 text-neutral-700">Loading pool…</div>
    );
  }

  const fmt = (value: string | number) => {
    const n = typeof value === "string" ? parseFloat(value) : value;
    if (!Number.isFinite(n)) return "0.00";
    return n.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const tokenInfoText = depositData
    ? `${token0Info.symbol} ${fmt(depositData.token0Amount)} / ${token1Info.symbol} ${fmt(depositData.token1Amount)}`
    : `${token0Info.symbol} / ${token1Info.symbol}`;

  const usdValueText = depositData ? `~$${fmt(depositData.usdValue)}` : "—";

  return (
    <>
      <div className="mb-4">
        <PageHeader title={t("liquidity.removeLiquidity")} />
      </div>
      <div className="mb-6">
        <PoolInfoHeader
          token0Symbol={token0Info.symbol}
          token1Symbol={token1Info.symbol}
          token0Address={token0Info.address}
          token1Address={token1Info.address}
          token0Decimals={token0Info.decimals}
          token1Decimals={token1Info.decimals}
          poolAddress={(clPoolAddress ?? ZERO_ADDRESS) as `0x${string}`}
          isStable={false}
          strategy="Concentrated"
          tickSpacing={tickSpacing}
        />
      </div>
      <div className="mb-6">
        <DepositInfoCard
          depositNumber={tokenId}
          tags={[
            { label: "Concentrated" },
            {
              label:
                tickSpacing !== undefined ? `CL ${tickSpacing}` : "CL",
            },
            { label: "No Lock", variant: "muted" },
          ]}
          tokenInfo={tokenInfoText}
          status="Deposited"
          usdValue={usdValueText}
          isLoading={isLoadingDeposit}
        />
      </div>
      <div className="flex justify-center">
        <div className="w-full max-w-[560px]">
          <CLRemoveLiquidity
            tokenId={tokenId}
            token0Address={token0Address as `0x${string}`}
            token1Address={token1Address as `0x${string}`}
            poolAddress={
              (clPoolAddress ?? undefined) as `0x${string}` | undefined
            }
          />
        </div>
      </div>
    </>
  );
}
