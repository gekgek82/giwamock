"use client";

import { useTranslations } from "next-intl";
import { formatUnits } from "viem";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { PoolInfoHeader } from "@/components/deposit/PoolInfoHeader";
import { PageHeader } from "@/components/common/PageHeader";
import { TokenDepositInputs } from "@/components/deposit/TokenDepositInputs";
import { LiquidityLockSettings } from "@/components/deposit/LiquidityLockSettings";
import { ApprovalModal } from "@/components/pool/ApprovalModal";
import { DepositGradeWarningModal } from "@/components/deposit/DepositGradeWarningModal";
import { DepositActionPanel } from "@/components/deposit/DepositActionPanel";
import { Button } from "@/components/common/Button";
import { useBasicPoolDeposit } from "./useBasicPoolDeposit";

export function BasicPoolDepositDesktopView() {
  const t = useTranslations();
  const d = useBasicPoolDeposit();

  if (d.isLoading || (!d.selectedPool && d.isOnChainLoading)) {
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

  if (!d.selectedPool) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
          <div className="bg-white rounded-2xl p-8 text-center">
            <h2 className="text-2xl font-bold text-neutral-1000 mb-4">
              {t("common.loading")}
            </h2>
            <p className="text-neutral-700 mb-6">
              {t("deposit.tokenInfoRequired")}
            </p>
            <a
              href="/liquidity"
              className="inline-block px-6 py-3 bg-primary-100 hover:bg-primary-200 text-neutral-1000 rounded-xl font-semibold transition-all"
            >
              {t("common.backToPoolList")}
            </a>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <div className="mb-4">
          <PageHeader title={t("common.addLiquidity")} />
        </div>
        <div className="mb-6">
          <PoolInfoHeader
            token0Symbol={d.selectedPool.token0.symbol}
            token1Symbol={d.selectedPool.token1.symbol}
            token0Address={d.selectedPool.token0.address}
            token1Address={d.selectedPool.token1.address}
            token0Decimals={d.selectedPool.token0.decimals}
            token1Decimals={d.selectedPool.token1.decimals}
            poolAddress={d.poolHeaderAddress}
            isStable={d.isStableParam}
            strategy="Basic"
            brokerPoolStats={d.indexerPool?.gateway}
            effectiveFeeBps={d.indexerPool?.effectiveFeeBps ?? undefined}
          />
        </div>

        <div
          className={
            d.desktopFlowPhase === "idle"
              ? "flex justify-center"
              : "grid grid-cols-1 lg:grid-cols-[minmax(0,610px)_minmax(0,670px)] gap-5 justify-center"
          }
        >
          <div className="w-full max-w-[610px]">
            <TokenDepositInputs
              token0={d.selectedPool.token0}
              token1={d.selectedPool.token1}
              amount0={d.amount0}
              amount1={d.amount1}
              onAmount0Change={d.handleAmount0Change}
              onAmount1Change={d.handleAmount1Change}
              slippage={d.slippage}
              onSlippageChange={d.setSlippage}
              isAutoSlippage={d.isAutoSlippage}
              onAutoSlippageChange={d.setIsAutoSlippage}
              depositPriceRangeLabel={t("deposit.fullRange")}
            >
              <LiquidityLockSettings
                value={d.lockOption}
                onChange={d.setLockOption}
              />

              {d.isInitialLiquidity &&
                d.amount0 &&
                d.amount1 &&
                parseFloat(d.amount0) > 0 &&
                parseFloat(d.amount1) > 0 && (
                  <div className="flex items-start gap-3 text-red-30">
                    <svg
                      className="shrink-0 w-6 h-6"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    <p className="body-14-medium text-red-30">
                      {t("liquidity.initialPriceWarning")}
                    </p>
                  </div>
                )}

              {d.amount0 &&
                d.amount1 &&
                parseFloat(d.amount0) > 0 &&
                parseFloat(d.amount1) > 0 && (
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between items-center">
                      <span className="body-14 text-gray-80">
                        {t("liquidity.expectedLpTokens")}
                      </span>
                      <span className="body-16-bold text-gray-100">
                        {d.isQuoteLoading
                          ? t("common.calculating")
                          : (() => {
                              const q = parseFloat(d.expectedLpTokens || "0");
                              if (q > 0) {
                                return `${q.toFixed(6)} LP`;
                              }
                              const est = d.estimatedInitialLpHuman
                                ? parseFloat(d.estimatedInitialLpHuman)
                                : 0;
                              if (est > 0) {
                                return `~${est.toFixed(6)} LP`;
                              }
                              if (d.isQuoteError) {
                                return t("deposit.lpQuoteUnavailable");
                              }
                              return "-";
                            })()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="body-14 text-gray-80">
                        {t("liquidity.expectedPoolShare")}
                      </span>
                      <span className="body-14-medium text-gray-80">
                        {d.isQuoteLoading
                          ? "..."
                          : (() => {
                              const lpStr = d.expectedLpTokens || d.estimatedInitialLpHuman;
                              const lpVal = parseFloat(lpStr || "0");
                              if (lpVal <= 0) return "-";
                              const supply = d.poolTotalSupply ?? 0n;
                              if (supply === 0n) return "100%";
                              const supplyNum = parseFloat(formatUnits(supply, 18));
                              const share = (lpVal / (supplyNum + lpVal)) * 100;
                              return share < 0.0001 ? "<0.0001%" : `${share.toFixed(4)}%`;
                            })()}
                      </span>
                    </div>
                  </div>
                )}

              {d.desktopFlowPhase === "idle" && (
                <div className="grid grid-cols-2 gap-5">
                  <Button
                    variant="secondary"
                    size="lg"
                    onClick={d.handleChangePool}
                  >
                    {t("liquidity.changePool")}
                  </Button>
                  <Button
                    size="lg"
                    onClick={d.handleDesktopDepositClick}
                    disabled={d.buttonState.disabled}
                  >
                    {d.buttonState.text}
                  </Button>
                </div>
              )}
            </TokenDepositInputs>
          </div>

          {d.desktopFlowPhase !== "idle" && (
            <DepositActionPanel
              phase={d.desktopFlowPhase}
              onEdit={d.handleDesktopEdit}
              onConfirm={d.handleDesktopConfirm}
              txHash={d.desktopTxHash}
            />
          )}
        </div>
      </main>

      <Footer />

      {/* Desktop replaces the dark `ApprovalModal` overlay with the inline
          `DepositActionPanel` above. The modal is still mounted as a fallback
          for any legacy code paths that toggle `isApprovalModalOpen`, but in
          the normal desktop flow it stays closed. */}
      <ApprovalModal
        isOpen={d.isApprovalModalOpen}
        onClose={() => d.setIsApprovalModalOpen(false)}
        steps={d.approvalStepsWithStatus}
        onApprove={d.handleApprove}
        onAddLiquidity={d.handleAddLiquidity}
        isAddingLiquidity={d.isAdding || d.isConfirming}
      />

      <DepositGradeWarningModal
        grade={d.poolGrade}
        isOpen={d.isGradeWarningOpen}
        onConfirm={d.handleDesktopGradeWarningConfirm}
        onCancel={() => d.setIsGradeWarningOpen(false)}
      />
    </div>
  );
}
