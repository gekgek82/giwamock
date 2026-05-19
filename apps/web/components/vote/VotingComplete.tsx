"use client";

import { useMemo } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { TokenPairIcon } from "@/components/common/TokenIcon";
import { Button } from "@/components/common/Button";
import { useLockData } from "@/hooks/useVotingEscrow";
import { useTPointLockData } from "@/hooks/useTPointLocks";
import { useVotePools } from "@/hooks/useVotePools";
import { IS_PRE_TGE } from "@/lib/config";

const POINT_SYMBOL = IS_PRE_TGE ? "vePOINT" : "veTER";

export function VotingComplete() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations();

  const poolId = searchParams.get("poolId");
  const lockId = searchParams.get("lockId");
  const percentageParam = searchParams.get("percentage");
  const votePercentage = percentageParam ? parseFloat(percentageParam) : 0;

  const { pools } = useVotePools();
  const poolData = useMemo(
    () => pools.find((p) => p.poolAddress === poolId),
    [pools, poolId],
  );

  const { lockData: onchainLockData, isLoading: onchainLockLoading } =
    useLockData(!IS_PRE_TGE && lockId ? BigInt(lockId) : undefined);
  const { lockData: tpointLockData, isLoading: tpointLockLoading } =
    useTPointLockData(IS_PRE_TGE && lockId ? Number(lockId) : undefined);

  const lockData = IS_PRE_TGE ? tpointLockData : onchainLockData;
  const lockLoading = IS_PRE_TGE ? tpointLockLoading : onchainLockLoading;

  if (lockLoading || !poolData || !lockData) {
    return (
      <div className="mx-auto w-full max-w-[670px] px-4 md:px-10 py-5">
        <div className="h-[700px] bg-gray-20 rounded-[40px] animate-pulse" />
      </div>
    );
  }

  const poolType = poolData.poolType === "CL" ? "Concentrated" : "Standard";
  const volatility =
    poolData.poolType === "CL"
      ? `CL${poolData.tickSpacing ?? ""}`
      : poolData.isStable
        ? "Stable"
        : "Volatile";

  const allocatedVotingPower =
    (parseFloat(lockData.votingPower) * votePercentage) / 100;
  const allocatedVotingPowerDisplay = allocatedVotingPower.toFixed(6);
  const allocatedPercentDisplay = `(${votePercentage.toFixed(2)}%)`;

  const vAPR = poolData.vAPR;

  const handleViewConfirmation = () => {
    router.push("/vote");
  };

  const handleGoPortfolio = () => {
    router.push("/portfolio");
  };

  return (
    <div className="mx-auto w-full max-w-[670px] px-4 md:px-0 py-5">
      <section className="bg-white rounded-[40px] flex flex-col items-center">
        <div className="flex flex-col gap-5 items-center w-full">
          {/* Page header */}
          <div className="flex flex-col gap-3 pt-[30px] w-full">
            <div className="flex flex-col gap-2.5 justify-center px-[30px] w-full">
              <h1 className="heading-6 text-gray-90 w-full">
                {t("vote.thankYouForVoting")}
              </h1>
              <div className="body-14-medium text-gray-90 w-full">
                <p className="leading-[21px]">
                  {t("vote.votingCompleteDescription1")}
                </p>
                <p className="leading-[21px]">
                  {t("vote.votingCompleteDescription2")}
                </p>
              </div>
            </div>
            <div className="h-px w-full bg-gray-30" />
          </div>

          {/* Voted Pool row */}
          <div className="w-[calc(100%-60px)] max-w-[610px] bg-gray-20 rounded-[10px] px-5 py-5 flex items-center justify-between gap-3">
            <span className="body-16-bold text-gray-100">
              {t("vote.votedPool")}
            </span>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <TokenPairIcon
                  leftAddress={poolData.token0.address}
                  leftSymbol={poolData.token0.symbol}
                  rightAddress={poolData.token1.address}
                  rightSymbol={poolData.token1.symbol}
                  size={24}
                />
                <span className="body-14-bold text-gray-100 whitespace-nowrap">
                  {poolData.token0.symbol} - {poolData.token1.symbol}
                </span>
              </div>
              <span className="body-14-medium text-gray-100 whitespace-nowrap">
                {poolType}
              </span>
              <span className="body-14-medium text-gray-100 whitespace-nowrap">
                {volatility}
              </span>
            </div>
          </div>

          {/* Locked Inventory / Voting Details card */}
          <div className="w-full px-[30px]">
            <div className="bg-gray-20 rounded-[20px] p-5 flex flex-col gap-5 items-end w-full">
              <div className="flex items-center justify-between w-full">
                <span className="flex-1 body-16-semibold text-gray-100">
                  {t("vote.lockedInventoryForVoting")}
                </span>
                <div className="flex items-center gap-2.5 text-right">
                  <span className="heading-6 text-black whitespace-nowrap">
                    {lockData.lockNo}
                  </span>
                  <span className="heading-6 text-gray-100 whitespace-nowrap">
                    {lockData.lockPeriod}
                  </span>
                </div>
              </div>

              <div className="flex items-start justify-between w-full text-gray-100">
                <span className="flex-1 body-16-semibold">
                  {t("vote.votingPower")}
                </span>
                <div className="flex flex-col gap-1 items-end justify-center text-right">
                  <div className="flex items-center gap-1">
                    <span className="heading-6 whitespace-nowrap">
                      {allocatedVotingPowerDisplay}
                    </span>
                    <span className="body-16 whitespace-nowrap">
                      {POINT_SYMBOL}
                    </span>
                  </div>
                  <span className="body-14-medium whitespace-nowrap">
                    {allocatedPercentDisplay}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between w-full">
                <span className="flex-1 body-16-semibold text-gray-100">
                  {t("vote.estVotingPower")}
                </span>
                <span className="heading-6 text-gray-100 text-right whitespace-nowrap">
                  ~${formatCompact(parseFloat(lockData.votingPower))}
                </span>
              </div>

              <div className="flex items-center justify-between w-full">
                <span className="flex-1 body-16-semibold text-gray-100">
                  {t("vote.votingAPR")}
                </span>
                <span className="heading-6 text-gray-100 text-right whitespace-nowrap">
                  {vAPR}%
                </span>
              </div>
            </div>
          </div>

          {/* Voting complete gradient banner */}
          <div className="w-[calc(100%-60px)] max-w-[610px] relative h-[192px] rounded-[20px] overflow-hidden bg-gradient-to-b from-white from-[12.683%] to-[#00fea2] to-[111.46%]">
            <div className="absolute left-1/2 top-[20px] -translate-x-1/2 w-[169px] h-[151px] opacity-60">
              <Image
                src="/logo.svg"
                alt=""
                fill
                className="object-contain"
                aria-hidden="true"
              />
            </div>
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col gap-2.5 items-center text-gray-100 text-center">
              <p className="heading-6 min-w-full">
                {t("vote.votingComplete")}
              </p>
              <p className="body-16-medium whitespace-nowrap">
                {t("vote.votingCompleteSubtitle")}
              </p>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-center gap-5 px-[30px] pb-[30px] pt-10 w-full">
          <Button
            size="lg"
            variant="secondary"
            className="max-w-[295px] bg-gray-100 hover:bg-gray-90 text-gray-10"
            onClick={handleViewConfirmation}
          >
            {t("vote.viewConfirmation")}
          </Button>
          <Button
            size="lg"
            className="max-w-[295px]"
            onClick={handleGoPortfolio}
          >
            {t("vote.goPortfolio")}
          </Button>
        </div>
      </section>
    </div>
  );
}

function formatCompact(n: number): string {
  if (!isFinite(n)) return "0.00";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return n.toFixed(2);
}
