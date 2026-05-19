"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { portfolioApi } from "@/lib/portfolioApi";
import { useMergeTPointLocks } from "@/hooks/useMergeTPointLocks";
import { Button } from "@/components/common/Button";
import { Checkbox } from "@/components/common/Checkbox";
import { DecorativeBanner } from "@/components/common/DecorativeBanner";
import {
  ChangeBaseLockModal,
  type BaseLockOption,
} from "@/components/vote/ChangeBaseLockModal";
import type { TPointLockPosition } from "@/types/portfolio";

const MAX_LOCK_DAYS = 1456;

type Step = "select" | "review" | "confirm" | "success";

function formatAmount(value: string | number, maxFraction = 5): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0";
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFraction,
  });
}

function formatPeriodLabel(lockDays: number, lockEnd: string): string {
  const years = Math.round(lockDays / 365);
  const remainingDays = Math.max(
    0,
    Math.ceil(
      (new Date(lockEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    ),
  );
  const yearsLabel = lockDays >= 365 ? `${years} years` : `${lockDays} days`;
  return `${yearsLabel}[D-${remainingDays}]`;
}

function formatYearsOnly(lockEnd: string): string {
  const remainingMs = new Date(lockEnd).getTime() - Date.now();
  const remainingDays = Math.max(0, remainingMs / (1000 * 60 * 60 * 24));
  if (remainingDays >= 365) {
    return `${Math.round(remainingDays / 365)} Years`;
  }
  if (remainingDays >= 30) {
    return `${Math.round(remainingDays / 30)} Months`;
  }
  return `${Math.ceil(remainingDays)} Days`;
}

function calcRemainingDays(lockEnd: string): number {
  const remainingMs = new Date(lockEnd).getTime() - Date.now();
  return Math.max(0, remainingMs / (1000 * 60 * 60 * 24));
}

interface Props {
  initialBaseLockId?: number;
}

export function MergeTPointLocksForm({ initialBaseLockId }: Props) {
  const router = useRouter();
  const t = useTranslations();
  const queryClient = useQueryClient();
  const { address } = useAccount();

  const { signMerge, submitMerge, isSigning, isSubmitting } =
    useMergeTPointLocks();

  const { data: locksList, isLoading } = useQuery({
    queryKey: ["tpoint-locks", address],
    queryFn: () => portfolioApi.getTPointLocks(address!),
    enabled: !!address,
    staleTime: 15_000,
  });

  const activeLocks = useMemo<TPointLockPosition[]>(() => {
    const all = locksList?.locks ?? [];
    const now = Date.now();
    return all.filter(
      (lock) => lock.isActive && new Date(lock.lockEnd).getTime() > now,
    );
  }, [locksList]);

  const [step, setStep] = useState<Step>("select");
  const [baseLockId, setBaseLockId] = useState<number | null>(
    initialBaseLockId ?? null,
  );
  const [selectedSourceIds, setSelectedSourceIds] = useState<Set<number>>(
    new Set(),
  );
  const [isChangeModalOpen, setIsChangeModalOpen] = useState(false);
  // Snapshot of merge inputs at submit-time so the success view stays stable
  // after the underlying lock list refetches.
  const [submittedSnapshot, setSubmittedSnapshot] = useState<{
    base: TPointLockPosition;
    sources: TPointLockPosition[];
    finalLockEnd: string;
    totalAmount: string;
    totalVotingPower: string;
  } | null>(null);

  // Default base lock: first active lock if not provided / invalid
  useEffect(() => {
    if (baseLockId !== null) {
      const stillValid = activeLocks.some((lock) => lock.id === baseLockId);
      if (stillValid) return;
    }
    if (activeLocks.length > 0) {
      setBaseLockId(activeLocks[0].id);
    } else {
      setBaseLockId(null);
    }
  }, [activeLocks, baseLockId]);

  // Drop any selected source that matches the current base
  useEffect(() => {
    if (baseLockId === null) return;
    setSelectedSourceIds((prev) => {
      if (!prev.has(baseLockId)) return prev;
      const next = new Set(prev);
      next.delete(baseLockId);
      return next;
    });
  }, [baseLockId]);

  const baseLock = useMemo(
    () => activeLocks.find((lock) => lock.id === baseLockId) ?? null,
    [activeLocks, baseLockId],
  );

  const sourceCandidates = useMemo(
    () => activeLocks.filter((lock) => lock.id !== baseLockId),
    [activeLocks, baseLockId],
  );

  const selectedSources = useMemo(
    () => sourceCandidates.filter((lock) => selectedSourceIds.has(lock.id)),
    [sourceCandidates, selectedSourceIds],
  );

  const baseLockOptions = useMemo<BaseLockOption[]>(
    () =>
      activeLocks.map((lock) => ({
        id: lock.id.toString(),
        lockNo: `#${lock.id}`,
        lockPeriod: formatPeriodLabel(lock.lockDays, lock.lockEnd),
        vePointAmount: formatAmount(lock.amount),
      })),
    [activeLocks],
  );

  // Derived merge result preview (mirrors backend math).
  const mergePreview = useMemo(() => {
    if (!baseLock || selectedSources.length === 0) return null;
    const all = [baseLock, ...selectedSources];
    const finalLockEnd = all.reduce(
      (max, lock) => (new Date(lock.lockEnd) > new Date(max) ? lock.lockEnd : max),
      baseLock.lockEnd,
    );
    const remainingDays = calcRemainingDays(finalLockEnd);
    const totalAmount = all.reduce(
      (sum, lock) => sum + parseFloat(lock.amount || "0"),
      0,
    );
    const totalVotingPower = totalAmount * (remainingDays / MAX_LOCK_DAYS);
    return {
      finalLockEnd,
      totalAmount,
      totalVotingPower,
    };
  }, [baseLock, selectedSources]);

  const handleToggleSource = (id: number) => {
    setSelectedSourceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCancel = () => {
    router.push("/portfolio");
  };

  const handleProceedToReview = () => {
    if (selectedSources.length === 0) return;
    setStep("review");
  };

  const handleBackToSelect = () => {
    setStep("select");
  };

  const handleProceedToConfirm = () => {
    if (!baseLock || selectedSources.length === 0) return;
    setStep("confirm");
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  };

  const handleBackToReview = () => {
    setStep("review");
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  };

  const handleConfirmMerge = async () => {
    if (!baseLock || selectedSources.length === 0) return;
    const sourceIds = selectedSources.map((s) => s.id);
    const finalLockEnd =
      mergePreview?.finalLockEnd ?? baseLock.lockEnd;
    const totalAmount = (mergePreview?.totalAmount ?? 0).toString();
    const totalVotingPower = (mergePreview?.totalVotingPower ?? 0).toString();

    try {
      const { signature, message } = await signMerge(baseLock.id, sourceIds);
      await submitMerge(baseLock.id, sourceIds, signature, message);
      setSubmittedSnapshot({
        base: baseLock,
        sources: [...selectedSources],
        finalLockEnd,
        totalAmount,
        totalVotingPower,
      });
      setStep("success");
      queryClient.invalidateQueries({ queryKey: ["tpoint-locks"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio", "locks"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio", "points"] });
    } catch {
      // Toast is handled inside the hook; user stays on the confirm page to retry.
    }
  };

  const handleSelectBaseLock = (selected: BaseLockOption) => {
    const id = parseInt(selected.id, 10);
    if (!isNaN(id)) setBaseLockId(id);
    setIsChangeModalOpen(false);
  };

  const handleGoPortfolio = () => {
    router.push("/portfolio");
  };

  if (isLoading) {
    return (
      <div className="py-12 text-center text-neutral-700 body-14">
        {t("common.loading")}
      </div>
    );
  }

  if (!address) {
    return (
      <div className="py-12 text-center text-neutral-700 body-14">
        {t("common.connectWallet")}
      </div>
    );
  }

  if (step !== "success" && activeLocks.length < 2) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center">
        <p className="text-neutral-700 body-14 mb-4">
          {t("portfolio.needTwoLocksForMerge")}
        </p>
        <Button variant="secondary" size="md" onClick={handleGoPortfolio}>
          {t("portfolio.goPortfolio")}
        </Button>
      </div>
    );
  }

  // ----- Render: Select step -----

  if (step === "select" && baseLock) {
    return (
      <div className="mx-auto flex w-full max-w-[670px] flex-col gap-5">
        <ChangeBaseLockModal
          isOpen={isChangeModalOpen}
          onClose={() => setIsChangeModalOpen(false)}
          onSelect={handleSelectBaseLock}
          locks={baseLockOptions}
          initialSelectedId={baseLock.id.toString()}
        />

        {/* Card 1: Selected Base Lock */}
        <div className="flex w-full flex-col gap-5 rounded-[40px] bg-white pb-[30px]">
          <div className="flex flex-col gap-3 pt-[30px]">
            <div className="flex items-center gap-2.5 px-[30px]">
              <h2 className="flex-1 text-[20px] font-bold leading-[30px] text-gray-100">
                1. {t("portfolio.selectedBaseLock")}
              </h2>
            </div>
            <div className="h-px w-full bg-gray-30" />
          </div>

          <div className="flex flex-col gap-2.5 px-[30px]">
            <div className="flex items-center rounded-[10px] bg-gray-20 px-5 py-2.5">
              <div className="flex flex-1 items-center">
                <ColumnHeader label={t("portfolio.no")} />
                <ColumnHeader label={t("portfolio.lockPeriod")} />
                <ColumnHeader label={t("portfolio.vePointAmount")} />
              </div>
              <div className="w-[72px] shrink-0" />
            </div>

            <div className="flex items-center rounded-[10px] bg-gray-20 p-5">
              <div className="flex flex-1 items-center">
                <ColumnCell text={`#${baseLock.id}`} />
                <ColumnCell
                  text={formatPeriodLabel(baseLock.lockDays, baseLock.lockEnd)}
                />
                <ColumnCell
                  value={formatAmount(baseLock.votingPower)}
                  unit="vePoint"
                />
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsChangeModalOpen(true)}
              >
                {t("portfolio.change")}
              </Button>
            </div>
          </div>
        </div>

        {/* Card 2: Select Locks to Merge */}
        <div className="flex w-full flex-col items-center gap-10 rounded-[40px] bg-white pb-[30px]">
          <div className="flex w-full flex-col items-center gap-5">
            <div className="flex w-full flex-col gap-3 pt-[30px]">
              <div className="flex flex-col gap-2.5 px-[30px]">
                <h2 className="text-[20px] font-bold leading-[30px] text-gray-100">
                  2. {t("portfolio.selectLocksToMerge")}
                </h2>
                <p className="body-14-medium text-gray-90">
                  {t("portfolio.selectLocksToMergeHint")}
                </p>
              </div>
              <div className="h-px w-full bg-gray-30" />
            </div>

            <div className="flex w-full flex-col gap-2.5 px-[30px]">
              <div className="flex items-center rounded-[10px] bg-gray-20 p-2.5">
                <div className="w-[98px] shrink-0 text-center">
                  <span className="body-14-bold text-gray-70">
                    {t("portfolio.select")}
                  </span>
                </div>
                <div className="flex flex-1 items-center">
                  <ColumnHeader label={t("portfolio.lockNo")} />
                  <ColumnHeader label={t("portfolio.lockPeriod")} />
                  <ColumnHeader label={t("portfolio.vePointAmount")} />
                </div>
              </div>

              {sourceCandidates.length === 0 ? (
                <div className="rounded-[10px] bg-gray-20 py-10 text-center body-14-medium text-gray-70">
                  {t("portfolio.noLocksAvailableToMerge")}
                </div>
              ) : (
                sourceCandidates.map((lock) => {
                  const isSelected = selectedSourceIds.has(lock.id);
                  return (
                    <button
                      key={lock.id}
                      type="button"
                      onClick={() => handleToggleSource(lock.id)}
                      className={`flex items-center gap-4 rounded-[10px] bg-gray-20 p-5 text-left transition-colors ${
                        isSelected
                          ? "border-2 border-green-10"
                          : "border-2 border-transparent hover:bg-gray-30"
                      }`}
                    >
                      <Checkbox checked={isSelected} />
                      <div className="flex flex-1 items-center">
                        <ColumnCell text={`#${lock.id}`} />
                        <ColumnCell
                          text={formatPeriodLabel(lock.lockDays, lock.lockEnd)}
                        />
                        <ColumnCell
                          value={formatAmount(lock.votingPower)}
                          unit="vePoint"
                        />
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className="w-full px-[30px]">
              <div className="flex flex-col gap-2.5 rounded-[10px] border border-gray-30 p-2.5">
                <div className="flex items-center gap-1">
                  <AlertTriangleIcon className="size-6 shrink-0 text-red-30" />
                  <p className="body-14-bold text-red-30">
                    {t("vote.warningTitle")}
                  </p>
                </div>
                <p className="body-14-medium text-red-30">
                  {t("portfolio.mergeWarningMessage")}
                </p>
              </div>
            </div>
          </div>

          <div className="flex w-full items-center justify-center gap-5 px-[30px]">
            <Button
              variant="secondary"
              size="lg"
              className="max-w-[295px]"
              onClick={handleCancel}
            >
              {t("common.cancel")}
            </Button>
            <Button
              size="lg"
              className="max-w-[295px]"
              onClick={handleProceedToReview}
              disabled={selectedSources.length === 0}
            >
              {t("portfolio.select")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ----- Render: Review step -----

  if (step === "review" && baseLock && mergePreview) {
    const [newLockValue, newLockUnit] = formatYearsOnly(
      mergePreview.finalLockEnd,
    ).split(" ");

    return (
      <div className="mx-auto flex w-full max-w-[670px] flex-col gap-5">
        <ChangeBaseLockModal
          isOpen={isChangeModalOpen}
          onClose={() => setIsChangeModalOpen(false)}
          onSelect={handleSelectBaseLock}
          locks={baseLockOptions}
          initialSelectedId={baseLock.id.toString()}
        />

        {/* Card 1: Selected Base Lock */}
        <div className="flex w-full flex-col gap-5 rounded-[40px] bg-white pb-[30px]">
          <div className="flex flex-col gap-3 pt-[30px]">
            <div className="flex items-center gap-2.5 px-[30px]">
              <h2 className="flex-1 text-[20px] font-bold leading-[30px] text-gray-100">
                1. {t("portfolio.selectedBaseLock")}
              </h2>
            </div>
            <div className="h-px w-full bg-gray-30" />
          </div>

          <div className="flex flex-col gap-2.5 px-[30px]">
            <div className="flex items-center rounded-[10px] bg-gray-20 px-5 py-2.5">
              <div className="flex flex-1 items-center">
                <ColumnHeader label={t("portfolio.no")} />
                <ColumnHeader label={t("portfolio.lockPeriod")} />
                <ColumnHeader label={t("portfolio.vePointAmount")} />
              </div>
              <div className="w-[72px] shrink-0" />
            </div>

            <div className="flex items-center rounded-[10px] bg-gray-20 p-5">
              <div className="flex flex-1 items-center">
                <ColumnCell text={`#${baseLock.id}`} />
                <ColumnCell
                  text={formatPeriodLabel(baseLock.lockDays, baseLock.lockEnd)}
                />
                <ColumnCell
                  value={formatAmount(baseLock.votingPower)}
                  unit="vePoint"
                />
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsChangeModalOpen(true)}
                disabled={isSigning || isSubmitting}
              >
                {t("portfolio.change")}
              </Button>
            </div>
          </div>
        </div>

        {/* Card 2: Selected Locks to Merge */}
        <div className="flex w-full flex-col gap-5 rounded-[40px] bg-white pb-[30px]">
          <div className="flex flex-col gap-3 pt-[30px]">
            <div className="flex items-center gap-2.5 px-[30px]">
              <h2 className="flex-1 text-[20px] font-bold leading-[30px] text-gray-100">
                2. {t("portfolio.selectedLocksToMerge")}
              </h2>
            </div>
            <div className="h-px w-full bg-gray-30" />
          </div>

          <div className="flex flex-col gap-2.5 px-[30px]">
            <div className="grid grid-cols-[80px_1fr_1fr_1.3fr] gap-1 items-center rounded-[10px] bg-gray-20 p-2.5">
              <div className="px-2.5 text-center body-14-bold text-gray-100">
                {t("portfolio.no")}
              </div>
              <div className="px-2.5 text-center body-14-bold text-gray-100">
                {t("portfolio.lockNo")}
              </div>
              <div className="px-2.5 text-center body-14-bold text-gray-100">
                {t("portfolio.lockPeriod")}
              </div>
              <div className="px-2.5 text-center body-14-bold text-gray-100">
                {t("portfolio.vePointAmount")}
              </div>
            </div>

            {selectedSources.map((lock, idx) => (
              <div
                key={lock.id}
                className="grid grid-cols-[80px_1fr_1fr_1.3fr] gap-1 items-center rounded-[10px] bg-gray-20 px-2.5 py-5"
              >
                <div className="px-2.5 text-center body-14-medium text-gray-100">
                  {idx + 1}
                </div>
                <div className="px-2.5 text-center body-14-medium text-gray-100">
                  #{lock.id}
                </div>
                <div className="px-2.5 text-center body-14-medium text-gray-100">
                  {(() => {
                    const period = formatPeriodLabel(
                      lock.lockDays,
                      lock.lockEnd,
                    );
                    const match = period.match(/^(.+?)\s*(\[.+\])\s*$/);
                    if (!match) return period;
                    return (
                      <>
                        <span className="block">{match[1]}</span>
                        <span className="block">{match[2]}</span>
                      </>
                    );
                  })()}
                </div>
                <div className="px-2.5 text-center body-14-medium text-gray-100 flex items-center justify-center gap-1 whitespace-nowrap">
                  <span>{formatAmount(lock.votingPower)}</span>
                  <span>vePoint</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Card 3: Final Merge Result */}
        <div className="flex w-full flex-col items-center gap-10 rounded-[40px] bg-white pb-[30px]">
          <div className="flex w-full flex-col items-center gap-5">
            <div className="flex w-full flex-col gap-3 pt-[30px]">
              <div className="flex items-center gap-2.5 px-[30px]">
                <h2 className="flex-1 text-[20px] font-bold leading-[30px] text-gray-100">
                  3. {t("portfolio.finalMergeResult")}
                </h2>
              </div>
              <div className="h-px w-full bg-gray-30" />
            </div>

            <div className="flex items-center gap-5 px-[30px]">
              <div className="flex w-[295px] flex-col gap-2.5">
                <p className="body-16-semibold text-gray-100">
                  {t("vote.newLockTime")}
                </p>
                <div className="flex items-center justify-center gap-2 rounded-[20px] bg-gray-20 px-2.5 py-5 whitespace-nowrap">
                  <span className="text-[20px] font-bold leading-[30px] text-gray-100">
                    {newLockValue}
                  </span>
                  <span className="body-14-medium text-gray-100">
                    {newLockUnit}
                  </span>
                </div>
              </div>
              <div className="flex w-[295px] flex-col gap-2.5">
                <p className="body-16-semibold text-gray-100">
                  {t("portfolio.totalVePointAmount")}
                </p>
                <div className="flex items-center justify-center gap-2.5 rounded-[20px] bg-gray-20 px-2.5 py-5 whitespace-nowrap">
                  <span className="text-[20px] font-bold leading-[30px] text-gray-100">
                    {formatAmount(mergePreview.totalVotingPower)}
                  </span>
                  <span className="body-14-medium text-gray-100">vePoint</span>
                </div>
              </div>
            </div>

            <div className="px-[30px] w-full">
              <div className="flex flex-col gap-2.5 rounded-[10px] border border-gray-30 p-2.5">
                <div className="flex items-center gap-1">
                  <AlertTriangleIcon className="size-6 shrink-0 text-red-30" />
                  <p className="body-14-bold text-red-30">
                    {t("vote.warningTitle")}
                  </p>
                </div>
                <p className="body-14-medium text-red-30">
                  {t("portfolio.mergeWarningMessage")}
                </p>
              </div>
            </div>
          </div>

          <div className="grid w-full grid-cols-2 gap-5 px-[30px]">
            <Button
              variant="secondary"
              size="lg"
              onClick={handleBackToSelect}
              disabled={isSigning || isSubmitting}
            >
              {t("common.cancel")}
            </Button>
            <Button
              size="lg"
              onClick={handleProceedToConfirm}
              disabled={isSigning || isSubmitting}
            >
              {t("portfolio.merge")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ----- Render: Confirm step -----

  if (step === "confirm" && baseLock && mergePreview) {
    const finalLock = [baseLock, ...selectedSources].reduce(
      (longest, lock) =>
        new Date(lock.lockEnd) > new Date(longest.lockEnd) ? lock : longest,
      baseLock,
    );
    const remainingDays = Math.max(
      0,
      Math.ceil(
        (new Date(mergePreview.finalLockEnd).getTime() - Date.now()) /
          (1000 * 60 * 60 * 24),
      ),
    );
    const yearsValue = Math.round(finalLock.lockDays / 365);
    const newLockPeriodLabel =
      finalLock.lockDays >= 365
        ? `${yearsValue} years(D-${remainingDays.toLocaleString()})`
        : `${finalLock.lockDays} days(D-${remainingDays.toLocaleString()})`;

    const isWorking = isSigning || isSubmitting;

    return (
      <div className="mx-auto flex w-full max-w-[670px] flex-col">
        <div className="flex w-full flex-col items-center gap-10 rounded-[40px] bg-white pb-[30px]">
          <div className="flex w-full flex-col items-center gap-5">
            <div className="flex w-full flex-col gap-3 pt-[30px]">
              <div className="flex flex-col gap-2.5 px-[30px]">
                <h2 className="text-[20px] font-bold leading-[30px] text-gray-100">
                  {t("portfolio.confirmMergeTitle")}
                </h2>
                <p className="body-14-medium whitespace-pre-line text-gray-90">
                  {t("portfolio.confirmMergeDescription")}
                </p>
              </div>
              <div className="h-px w-full bg-gray-30" />
            </div>

            <MergeSummaryCard
              baseLockNo={`#${baseLock.id}`}
              intoLockNos={selectedSources.map((s) => `#${s.id}`)}
              newLockPeriod={newLockPeriodLabel}
              totalVePointAmount={formatAmount(mergePreview.totalVotingPower)}
              labels={{
                baseLock: t("portfolio.baseLock"),
                intoLock: t("portfolio.intoLock"),
                newLockPeriod: t("portfolio.newLockPeriod"),
                totalVePointAmount: t("portfolio.totalVePointAmount"),
                andOthers: (count: number) =>
                  t("portfolio.andOthers", { count }),
              }}
            />

            <div className="w-[610px]">
              <DecorativeBanner>
                <h3 className="body-16-bold text-white text-center">
                  {t("portfolio.powerUpYourVotingInfluence")}
                </h3>
                <p className="body-14-medium text-white text-center whitespace-pre-line">
                  {t("portfolio.powerUpYourVotingInfluenceDescription")}
                </p>
              </DecorativeBanner>
            </div>
          </div>

          <div className="grid w-full grid-cols-2 gap-5 px-[30px]">
            <Button
              variant="secondary"
              size="lg"
              onClick={handleBackToReview}
              disabled={isWorking}
            >
              {t("portfolio.edit")}
            </Button>
            <Button
              size="lg"
              onClick={handleConfirmMerge}
              loading={isWorking}
              disabled={isWorking}
            >
              {isWorking ? t("vote.confirming") : t("common.confirm")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ----- Render: Success step -----

  if (step === "success" && submittedSnapshot) {
    const { base, sources, finalLockEnd, totalVotingPower } = submittedSnapshot;
    const finalLock = [base, ...sources].reduce(
      (longest, lock) =>
        new Date(lock.lockEnd) > new Date(longest.lockEnd) ? lock : longest,
      base,
    );
    const remainingDays = Math.max(
      0,
      Math.ceil(
        (new Date(finalLockEnd).getTime() - Date.now()) /
          (1000 * 60 * 60 * 24),
      ),
    );
    const yearsValue = Math.round(finalLock.lockDays / 365);
    const newLockPeriodLabel =
      finalLock.lockDays >= 365
        ? `${yearsValue} years(D-${remainingDays.toLocaleString()})`
        : `${finalLock.lockDays} days(D-${remainingDays.toLocaleString()})`;

    return (
      <div className="mx-auto flex w-full max-w-[670px] flex-col">
        <div className="flex w-full flex-col items-center gap-10 rounded-[40px] bg-white pb-[30px]">
          <div className="flex w-full flex-col items-center gap-5">
            <div className="flex w-full flex-col gap-3 pt-[30px]">
              <div className="flex flex-col gap-2.5 px-[30px]">
                <h2 className="text-[20px] font-bold leading-[30px] text-gray-100">
                  {t("portfolio.mergeSuccessTitle")}
                </h2>
                <p className="body-14-medium whitespace-pre-line text-gray-90">
                  {t("portfolio.mergeSuccessDescription")}
                </p>
              </div>
              <div className="h-px w-full bg-gray-30" />
            </div>

            <MergeSummaryCard
              baseLockNo={`#${base.id}`}
              intoLockNos={sources.map((s) => `#${s.id}`)}
              newLockPeriod={newLockPeriodLabel}
              totalVePointAmount={formatAmount(totalVotingPower)}
              labels={{
                baseLock: t("portfolio.baseLock"),
                intoLock: t("portfolio.intoLock"),
                newLockPeriod: t("portfolio.newLockPeriod"),
                totalVePointAmount: t("portfolio.totalVePointAmount"),
                andOthers: (count: number) =>
                  t("portfolio.andOthers", { count }),
              }}
            />

            <div className="w-[610px]">
              <DecorativeBanner>
                <h3 className="body-16-bold text-white text-center">
                  {t("portfolio.mergeProcessedSuccessfully")}
                </h3>
                <p className="body-14-medium text-white text-center whitespace-pre-line">
                  {t("portfolio.mergeProcessedSuccessfullyDescription")}
                </p>
              </DecorativeBanner>
            </div>
          </div>

          <div className="grid w-full grid-cols-2 gap-5 px-[30px]">
            <Button
              variant="secondary"
              size="lg"
              onClick={handleGoPortfolio}
            >
              {t("vote.viewConfirmation")}
            </Button>
            <Button size="lg" onClick={handleGoPortfolio}>
              {t("portfolio.goPortfolio")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

interface MergeSummaryCardProps {
  baseLockNo: string;
  intoLockNos: string[];
  newLockPeriod: string;
  totalVePointAmount: string;
  labels: {
    baseLock: string;
    intoLock: string;
    newLockPeriod: string;
    totalVePointAmount: string;
    andOthers: (count: number) => string;
  };
}

function MergeSummaryCard({
  baseLockNo,
  intoLockNos,
  newLockPeriod,
  totalVePointAmount,
  labels,
}: MergeSummaryCardProps) {
  const VISIBLE_INTO_LOCKS = 3;
  const visibleInto = intoLockNos.slice(0, VISIBLE_INTO_LOCKS);
  const remainingCount = Math.max(0, intoLockNos.length - VISIBLE_INTO_LOCKS);

  return (
    <div className="flex w-full max-w-[610px] flex-col gap-5">
      <div className="flex flex-col gap-5 rounded-[20px] bg-gray-20 p-5">
        <div className="flex items-center justify-between">
          <span className="body-16-semibold text-gray-100">
            {labels.baseLock}
          </span>
          <span className="body-16-bold text-gray-100">{baseLockNo}</span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <span className="body-16-semibold text-gray-100">
            {labels.intoLock}
          </span>
          <div className="flex flex-col items-end gap-1 text-right">
            <div className="flex flex-wrap justify-end gap-2.5">
              {visibleInto.map((lockNo) => (
                <span key={lockNo} className="body-16-bold text-gray-100">
                  {lockNo}
                </span>
              ))}
            </div>
            {remainingCount > 0 && (
              <span className="body-16 text-gray-100">
                {labels.andOthers(remainingCount)}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-5 rounded-[20px] bg-gray-20 p-5">
        <div className="flex items-center justify-between">
          <span className="body-16-semibold text-gray-100">
            {labels.newLockPeriod}
          </span>
          <span className="body-16-bold text-gray-100 whitespace-nowrap">
            {newLockPeriod}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="body-16-semibold text-gray-100">
            {labels.totalVePointAmount}
          </span>
          <span className="flex items-center gap-1 whitespace-nowrap">
            <span className="body-16-bold text-gray-100">
              {totalVePointAmount}
            </span>
            <span className="body-16 text-gray-100">vePoint</span>
          </span>
        </div>
      </div>
    </div>
  );
}

interface ColumnCellProps {
  text?: string;
  value?: string;
  unit?: string;
}

function ColumnHeader({ label }: { label: string }) {
  return (
    <div className="flex-1 min-w-0 px-1 text-center">
      <span className="body-14-bold text-gray-70">{label}</span>
    </div>
  );
}

function ColumnCell({ text, value, unit }: ColumnCellProps) {
  return (
    <div className="flex-1 min-w-0 px-1 text-center">
      {unit ? (
        <span className="whitespace-nowrap">
          <span className="body-14-medium text-gray-70">{value}</span>{" "}
          <span className="body-14-medium text-gray-70">{unit}</span>
        </span>
      ) : (
        <span className="body-14-medium text-gray-70">{text}</span>
      )}
    </div>
  );
}

function AlertTriangleIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

