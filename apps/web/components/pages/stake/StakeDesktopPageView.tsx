"use client";

import { Suspense, useMemo, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useAccount, useReadContract } from "wagmi";
import { useTranslations } from "next-intl";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { PoolInfoHeader } from "@/components/deposit/PoolInfoHeader";
import { PageHeader } from "@/components/common/PageHeader";
import { DepositInfoCard } from "@/components/withdraw/DepositInfoCard";
import { StakeFlow } from "@/components/stake/StakeFlow";
import {
  useTokenByAddress,
  useNftPositionManagerAddress,
} from "@/hooks/useContractAddresses";
import { useCheckPoolExists } from "@/hooks/usePoolFactory";
import { useCheckCLPoolExists } from "@/hooks/useCLPoolFactory";
import { usePools } from "@/hooks/usePools";
import { useLpBalance } from "@/hooks/useLpBalance";
import { usePoolReserves } from "@/hooks/usePoolReserves";
import { useTokenPrices } from "@/hooks/useTokenPrices";
import { useLpStakeIntent } from "@/hooks/useLpStakeIntent";
import { NonfungiblePositionManagerAbi } from "@giwater/shared/abis";
import { portfolioApi } from "@/lib/portfolioApi";

const ZERO_ADDRESS =
  "0x0000000000000000000000000000000000000000" as `0x${string}`;

function StakeLoading() {
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

export function StakeDesktopPageView() {
  return (
    <Suspense fallback={<StakeLoading />}>
      <StakeContent />
    </Suspense>
  );
}

function StakeContent() {
  const searchParams = useSearchParams();
  const tokenId = searchParams.get("tokenId");

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {tokenId ? <CLStake tokenId={tokenId} /> : <BasicStake />}
      </main>
      <Footer />
    </div>
  );
}

function BasicStake() {
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

  // Basic pool: balance = ERC20 balanceOf(user); token amounts derived from
  // pool reserves (reserve * balance / totalSupply).
  const {
    balanceRaw,
    totalSupply,
    isLoading: isLoadingBalance,
  } = useLpBalance(selectedPool?.address);
  const { reserve0Raw, reserve1Raw } = usePoolReserves(selectedPool?.address);
  const { prices } = useTokenPrices([
    selectedPool?.token0.symbol,
    selectedPool?.token1.symbol,
  ]);
  const { stakedAmountRaw } = useLpStakeIntent(selectedPool?.address);

  const availableBalanceRaw =
    balanceRaw !== undefined
      ? balanceRaw > stakedAmountRaw
        ? balanceRaw - stakedAmountRaw
        : 0n
      : 0n;
  const dec0 = selectedPool?.token0.decimals ?? 18;
  const dec1 = selectedPool?.token1.decimals ?? 18;
  const token0ForBalance =
    balanceRaw && totalSupply && totalSupply > 0n && reserve0Raw
      ? Number((reserve0Raw * balanceRaw) / totalSupply) / 10 ** dec0
      : 0;
  const token1ForBalance =
    balanceRaw && totalSupply && totalSupply > 0n && reserve1Raw
      ? Number((reserve1Raw * balanceRaw) / totalSupply) / 10 ** dec1
      : 0;

  // DepositInfoCard shows the *available* (unstaked) slice.
  const availToken0 =
    balanceRaw && balanceRaw > 0n
      ? (token0ForBalance * Number(availableBalanceRaw)) / Number(balanceRaw)
      : 0;
  const availToken1 =
    balanceRaw && balanceRaw > 0n
      ? (token1ForBalance * Number(availableBalanceRaw)) / Number(balanceRaw)
      : 0;
  const price0 = selectedPool
    ? (prices[selectedPool.token0.symbol] ?? 0)
    : 0;
  const price1 = selectedPool
    ? (prices[selectedPool.token1.symbol] ?? 0)
    : 0;
  const depositUsd = availToken0 * price0 + availToken1 * price1;
  const hasDeposit = availToken0 > 0 || availToken1 > 0;

  const fmt = (n: number) =>
    n.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  if (!selectedPool) {
    return (
      <div className="text-center py-20 text-neutral-700">Loading pool…</div>
    );
  }

  return (
    <>
      <div className="mb-4">
        <PageHeader
          title={t("stake.title")}
          description={t("stake.description")}
        />
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
            tokenInfo={`${selectedPool.token0.symbol} ${fmt(availToken0)} / ${selectedPool.token1.symbol} ${fmt(availToken1)}`}
            status="Deposited"
            usdValue={`~$${fmt(depositUsd)}`}
            isLoading={isLoadingBalance}
          />
        </div>
      )}
      <StakeFlow
        poolAddress={selectedPool.address}
        token0Symbol={selectedPool.token0.symbol}
        token0Decimals={selectedPool.token0.decimals}
        token1Symbol={selectedPool.token1.symbol}
        token1Decimals={selectedPool.token1.decimals}
        balanceRaw={balanceRaw}
        token0AmountForBalance={token0ForBalance}
        token1AmountForBalance={token1ForBalance}
        isLoadingBalance={isLoadingBalance}
      />
    </>
  );
}

function CLStake({ tokenId }: { tokenId: string }) {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const { address } = useAccount();
  const nftManager = useNftPositionManagerAddress();

  const rawToken0 = searchParams.get("token0");
  const rawToken1 = searchParams.get("token1");
  const typeParam = searchParams.get("type");
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

  // NFT liquidity is the denominator for stake / available math.
  const { data: positionData, isLoading: isLoadingPosition } = useReadContract({
    address: nftManager,
    abi: NonfungiblePositionManagerAbi,
    functionName: "positions",
    args: [BigInt(tokenId)],
    query: { enabled: !!nftManager },
  });
  const nftLiquidity = useMemo<bigint>(() => {
    if (!positionData) return 0n;
    const liq = Array.isArray(positionData)
      ? (positionData as unknown[])[7]
      : (positionData as { liquidity?: bigint }).liquidity;
    return typeof liq === "bigint" ? liq : 0n;
  }, [positionData]);

  // CL can't derive token amounts from pool reserves (liquidity isn't
  // proportional to reserves outside the active tick range). Use the
  // portfolio API's server-computed `deposited` totals — those represent
  // the NFT's full underlying value, matching `nftLiquidity` as the
  // denominator. Scaling for the staked slice is done inside StakeFlow.
  const [deposited, setDeposited] = useState<{
    token0Amount: number;
    token1Amount: number;
    usdValue: number;
  } | null>(null);
  const [isLoadingDeposit, setIsLoadingDeposit] = useState(true);

  useEffect(() => {
    if (!address) {
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
        if (!match) {
          setDeposited(null);
          return;
        }
        // "deposited" from the portfolio is the AVAILABLE slice (total -
        // staked). Re-derive the total so scaling inside StakeFlow lines
        // up with `nftLiquidity`.
        const token0Total =
          (parseFloat(match.deposited.token0Amount) || 0) +
          (parseFloat(match.stake.token0Amount) || 0);
        const token1Total =
          (parseFloat(match.deposited.token1Amount) || 0) +
          (parseFloat(match.stake.token1Amount) || 0);
        const usdTotal =
          (parseFloat(match.deposited.usdValue) || 0) +
          (parseFloat(match.stake.usdValue) || 0);
        setDeposited({
          token0Amount: token0Total,
          token1Amount: token1Total,
          usdValue: usdTotal,
        });
      })
      .catch(() => {
        if (!cancelled) setDeposited(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingDeposit(false);
      });
    return () => {
      cancelled = true;
    };
  }, [address, tokenId]);

  const { stakedAmountRaw } = useLpStakeIntent(
    clPoolAddress ?? undefined,
    tokenId,
  );

  if (!token0Info || !token1Info) {
    return (
      <div className="text-center py-20 text-neutral-700">Loading pool…</div>
    );
  }

  const availLiquidity =
    nftLiquidity > stakedAmountRaw ? nftLiquidity - stakedAmountRaw : 0n;
  const availRatio =
    nftLiquidity > 0n ? Number(availLiquidity) / Number(nftLiquidity) : 0;
  const availToken0 = deposited ? deposited.token0Amount * availRatio : 0;
  const availToken1 = deposited ? deposited.token1Amount * availRatio : 0;
  const availUsd = deposited ? deposited.usdValue * availRatio : 0;
  const hasDeposit = availToken0 > 0 || availToken1 > 0;

  const fmt = (n: number) =>
    n.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  return (
    <>
      <div className="mb-4">
        <PageHeader
          title={t("stake.title")}
          description={t("stake.description")}
        />
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
      {(hasDeposit || isLoadingPosition || isLoadingDeposit) && (
        <div className="mb-6">
          <DepositInfoCard
            depositNumber={tokenId}
            tags={[
              { label: "Concentrated" },
              {
                label: tickSpacing !== undefined ? `CL ${tickSpacing}` : "CL",
              },
              { label: "No Lock", variant: "muted" },
            ]}
            tokenInfo={`${token0Info.symbol} ${fmt(availToken0)} / ${token1Info.symbol} ${fmt(availToken1)}`}
            status="Deposited"
            usdValue={`~$${fmt(availUsd)}`}
            isLoading={isLoadingPosition || isLoadingDeposit}
          />
        </div>
      )}
      <StakeFlow
        poolAddress={(clPoolAddress ?? ZERO_ADDRESS) as `0x${string}`}
        tokenId={tokenId}
        token0Symbol={token0Info.symbol}
        token0Decimals={token0Info.decimals}
        token1Symbol={token1Info.symbol}
        token1Decimals={token1Info.decimals}
        balanceRaw={nftLiquidity}
        token0AmountForBalance={deposited?.token0Amount ?? 0}
        token1AmountForBalance={deposited?.token1Amount ?? 0}
        isLoadingBalance={isLoadingPosition || isLoadingDeposit}
      />
    </>
  );
}
