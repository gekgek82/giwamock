"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useVotePools } from "@/hooks/useVotePools";
import { PoolInfoHeader } from "@/components/deposit/PoolInfoHeader";
import { AddIncentiveForm } from "@/components/vote/AddIncentiveForm";
import { Button } from "@/components/common/Button";

interface AddIncentivePageProps {
  poolAddress: string;
}

/**
 * Page-level shell for the Add Incentive flow. Loads the pool via
 * `useVotePools` — the same source the vote listing uses — so data is
 * already cached when the user clicks "+ Add" from the list.
 */
export function AddIncentivePage({ poolAddress }: AddIncentivePageProps) {
  const router = useRouter();
  const t = useTranslations();
  const { pools, isLoading } = useVotePools();

  const pool = useMemo(
    () =>
      pools.find(
        (p) => p.poolAddress.toLowerCase() === poolAddress.toLowerCase(),
      ),
    [pools, poolAddress],
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-5">
        <div className="bg-white rounded-[20px] h-[220px] animate-pulse" />
        <div className="bg-white rounded-[20px] h-[600px] animate-pulse" />
      </div>
    );
  }

  if (!pool) {
    return (
      <div className="mx-auto flex w-full max-w-[670px] flex-col items-center gap-5 bg-white rounded-[20px] p-10">
        <h1 className="heading-5 text-gray-100">
          {t("voteIncentive.poolNotFoundTitle")}
        </h1>
        <p className="body-14-medium text-gray-70 text-center">
          {t("voteIncentive.poolNotFoundBody")}
        </p>
        <Button size="md" onClick={() => router.push("/vote")}>
          {t("common.goBack")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <PoolInfoHeader
        token0Symbol={pool.token0.symbol}
        token1Symbol={pool.token1.symbol}
        token0Address={pool.token0.address}
        token1Address={pool.token1.address}
        token0Decimals={pool.token0.decimals}
        token1Decimals={pool.token1.decimals}
        poolAddress={pool.poolAddress as `0x${string}`}
        isStable={pool.isStable}
        strategy={pool.poolType === "CL" ? "Concentrated" : "Basic"}
        poolType={pool.poolType}
        tickSpacing={pool.tickSpacing ?? undefined}
      />
      <AddIncentiveForm pool={pool} />
    </div>
  );
}
