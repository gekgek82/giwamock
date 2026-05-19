"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/common/Button";

export interface BaseLockOption {
  id: string;
  lockNo: string;
  lockPeriod: string;
  vePointAmount: string;
}

interface ChangeBaseLockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (lock: BaseLockOption) => void;
  locks: BaseLockOption[];
  initialSelectedId?: string;
  title?: string;
}

export function ChangeBaseLockModal({
  isOpen,
  onClose,
  onSelect,
  locks,
  initialSelectedId,
  title,
}: ChangeBaseLockModalProps) {
  const t = useTranslations();
  const [selectedId, setSelectedId] = useState<string | undefined>(
    initialSelectedId,
  );

  useEffect(() => {
    if (isOpen) setSelectedId(initialSelectedId);
  }, [isOpen, initialSelectedId]);

  if (!isOpen) return null;

  const selectedLock = locks.find((lock) => lock.id === selectedId);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleConfirm = () => {
    if (selectedLock) onSelect(selectedLock);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-[rgba(77,77,77,0.8)]" />

      <div className="relative bg-brand-white rounded-[30px] w-[520px] max-w-full max-h-[90vh] flex flex-col gap-[30px] pb-[30px]">
        <div className="relative flex items-start justify-between px-[30px] pt-[30px] pb-[18px] gap-[10px]">
          <div className="flex-1 flex flex-col gap-[12px]">
            <h2 className="heading-6 text-gray-100">
              {title ?? t("portfolio.changeBaseLock")}
            </h2>
            <div className="h-px w-full bg-gray-30" />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 size-6 flex items-center justify-center text-gray-100"
            aria-label={t("common.close")}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-[10px] px-[30px]">
          <div className="bg-gray-20 rounded-[10px] px-[10px] py-[10px] grid grid-cols-[66px_1fr_1fr_1.3fr] gap-1 items-center">
            <div className="px-[10px] text-center body-14-bold text-gray-100">
              {t("portfolio.select")}
            </div>
            <div className="px-[10px] text-center body-14-bold text-gray-100">
              {t("portfolio.lockNo")}
            </div>
            <div className="px-[10px] text-center body-14-bold text-gray-100">
              {t("portfolio.lockPeriod")}
            </div>
            <div className="px-[10px] text-center body-14-bold text-gray-100">
              {t("portfolio.vePointAmount")}
            </div>
          </div>

          <div className="flex flex-col gap-[10px] overflow-y-auto max-h-[320px]">
            {locks.length === 0 ? (
              <div className="py-10 text-center body-14 text-gray-60">
                {t("portfolio.noLocks")}
              </div>
            ) : (
              locks.map((lock) => {
                const isSelected = selectedId === lock.id;
                return (
                  <button
                    key={lock.id}
                    type="button"
                    onClick={() => setSelectedId(lock.id)}
                    className={`bg-gray-20 rounded-[10px] px-[10px] py-[20px] grid grid-cols-[66px_1fr_1fr_1.3fr] gap-1 items-center border-2 transition-colors text-left ${
                      isSelected
                        ? "border-green-20"
                        : "border-transparent hover:bg-gray-30"
                    }`}
                    aria-pressed={isSelected}
                  >
                    <Checkbox checked={isSelected} />
                    <div className="px-[10px] text-center body-14-medium text-gray-100">
                      {lock.lockNo}
                    </div>
                    <div className="px-[10px] text-center body-14-medium text-gray-100">
                      {(() => {
                        const match = lock.lockPeriod.match(
                          /^(.+?)\s*(\[.+\])\s*$/,
                        );
                        if (!match) return lock.lockPeriod;
                        return (
                          <>
                            <span className="block">{match[1]}</span>
                            <span className="block">{match[2]}</span>
                          </>
                        );
                      })()}
                    </div>
                    <div className="px-[10px] text-center body-14-medium text-gray-100 flex items-center justify-center gap-1 whitespace-nowrap">
                      <span>{lock.vePointAmount}</span>
                      <span>vePoint</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-[20px] px-[30px]">
          <Button variant="secondary" size="lg" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button size="lg" onClick={handleConfirm} disabled={!selectedLock}>
            {t("portfolio.select")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <div className="w-[66px] flex items-center justify-center shrink-0">
      <div
        className={`size-6 rounded-[5px] flex items-center justify-center transition-colors ${
          checked ? "bg-red-40" : "bg-gray-30"
        }`}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke={checked ? "white" : "var(--color-gray-50)"}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 13l4 4L19 7" />
        </svg>
      </div>
    </div>
  );
}
