"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/common/Button";
import { Checkbox } from "@/components/common/Checkbox";
import { useUserLocks } from "@/hooks/useVotingEscrow";
import { useTPointUserLocks } from "@/hooks/useTPointLocks";
import { IS_PRE_TGE } from "@/lib/config";

interface Lock {
  id: string;
  lockNo: string;
  lockedAmount: string;
  lockPeriod: string;
  votingWeight: string;
}

export function SelectLockForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations();
  const poolId = searchParams.get("poolId");

  const { locks: onchainLocks } = useUserLocks();
  const { locks: tpointLocks } = useTPointUserLocks();

  const locks: Lock[] = useMemo(() => {
    const source = IS_PRE_TGE ? tpointLocks : onchainLocks;
    return source
      .filter((lock) => !lock.isExpired)
      .map((lock) => ({
        id: lock.id,
        lockNo: lock.lockNo,
        lockedAmount: lock.lockedAmount,
        lockPeriod: lock.lockPeriod,
        votingWeight: lock.votingWeight,
      }));
  }, [onchainLocks, tpointLocks]);

  const [selectedLockId, setSelectedLockId] = useState<string | null>(null);
  const hasLocks = locks.length > 0;
  const selectedLock = locks.find((lock) => lock.id === selectedLockId);

  const handleSelectLock = () => {
    if (!selectedLock || !poolId) return;
    const params = new URLSearchParams({ poolId, lockId: selectedLock.id });
    router.push(`/vote/allocate?${params.toString()}`);
  };

  const handleCancel = () => {
    router.push("/vote");
  };

  const handleGoToMerge = () => {
    router.push("/portfolio?tab=lock");
  };

  const handleGoToLock = () => {
    router.push("/vote/lock");
  };

  return (
    <div className="mx-auto w-full max-w-[670px] bg-white rounded-[30px] flex flex-col">
      {/* Header */}
      <div className="flex flex-col gap-3 pt-[30px]">
        <div className="flex flex-col gap-2.5 px-[30px]">
          <h1 className="heading-5 text-gray-100">
            {t("vote.selectLockToVote")}
          </h1>
          <div className="body-14-medium text-gray-90 space-y-0">
            <p>{t("vote.pickLockPosition")}</p>
            <p>{t("vote.higherPowerHigherRewards")}</p>
          </div>
        </div>
        <div className="h-px w-full bg-gray-30" />
      </div>

      {/* Merge Banner */}
      <div className="px-[30px] pt-5">
        <div className="flex items-center gap-2.5 border border-gray-30 rounded-[10px] px-2.5 py-3.5">
          <p className="flex-1 body-14-medium text-gray-100">
            {t("vote.needMorePower")}
          </p>
          <Button variant="secondary" size="sm" onClick={handleGoToMerge}>
            {t("vote.goToMerge")}
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="px-[30px] pt-5">
        {hasLocks ? (
          <div className="flex flex-col gap-2.5">
            {/* Table Header */}
            <div className="flex items-center px-2.5 py-5 bg-gray-10 rounded-[10px]">
              <div className="w-[42px]" />
              <div className="flex flex-1 items-center">
                <ColumnHeader label={t("vote.lockNo")} />
                <ColumnHeader label={t("vote.lockedAmount")} />
                <ColumnHeader label={t("vote.lockPeriod")} />
                <ColumnHeader label={t("vote.votingWeight")} />
              </div>
            </div>

            {/* Rows */}
            {locks.map((lock) => {
              const isSelected = selectedLockId === lock.id;
              return (
                <button
                  key={lock.id}
                  type="button"
                  onClick={() => setSelectedLockId(lock.id)}
                  className={`flex items-center p-5 rounded-[10px] bg-gray-20 transition-colors text-left ${
                    isSelected
                      ? "ring-2 ring-green-10"
                      : "hover:bg-gray-30"
                  }`}
                >
                  <Checkbox checked={isSelected} />
                  <div className="flex flex-1 items-center">
                    <ColumnCell text={lock.lockNo} />
                    <ColumnCell text={lock.lockedAmount} />
                    <ColumnCell text={lock.lockPeriod} />
                    <ColumnCell text={lock.votingWeight} />
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-[537px] flex-col items-center gap-10 py-[50px] text-center text-gray-100">
            <div className="heading-5 leading-[30px]">
              <p>{t("vote.noVotingPermission")}</p>
              <p>{t("vote.toParticipateCheck")}</p>
            </div>

            <div className="flex w-full max-w-[398px] flex-col items-center gap-5">
              <div className="flex w-full flex-col gap-1">
                <p className="body-16-bold">{t("vote.step1GetPoints")}</p>
                <p className="body-16 whitespace-pre-line">
                  {t("vote.step1Description")}
                </p>
              </div>
              <div className="flex w-full flex-col gap-1">
                <p className="body-16-bold">{t("vote.step2LockAssets")}</p>
                <p className="body-16 whitespace-pre-line">
                  {t("vote.step2Description")}
                </p>
              </div>
            </div>

            <p className="body-16-bold">{t("vote.alreadyHaveProceed")}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-center gap-5 px-[30px] pt-10 pb-[30px]">
        <Button
          variant="secondary"
          size="lg"
          className="max-w-[295px] bg-gray-100 hover:bg-gray-90"
          onClick={handleCancel}
        >
          {t("common.cancel")}
        </Button>
        {hasLocks ? (
          <Button
            size="lg"
            className="max-w-[295px]"
            onClick={handleSelectLock}
            disabled={!selectedLock || !poolId}
          >
            {t("vote.selectLock")}
          </Button>
        ) : (
          <Button
            size="lg"
            className="max-w-[295px]"
            onClick={handleGoToLock}
          >
            {t("vote.lockNow")}
          </Button>
        )}
      </div>
    </div>
  );
}

function ColumnHeader({ label }: { label: string }) {
  return (
    <div className="flex-1 min-w-0 px-2.5 text-center">
      <span className="body-16-semibold text-gray-100">{label}</span>
    </div>
  );
}

function ColumnCell({ text }: { text: string }) {
  return (
    <div className="flex-1 min-w-0 px-2.5 text-center">
      <span className="body-14-medium text-gray-100 truncate block">
        {text}
      </span>
    </div>
  );
}

