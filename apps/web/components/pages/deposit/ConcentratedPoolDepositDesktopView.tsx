"use client";

import { useTranslations } from "next-intl";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { PoolInfoHeader } from "@/components/deposit/PoolInfoHeader";
import { PageHeader } from "@/components/common/PageHeader";
import { PriceRangeSelector } from "@/components/deposit/PriceRangeSelector";
import { InitialPriceSelector } from "@/components/deposit/InitialPriceSelector";
import { TokenDepositInputs } from "@/components/deposit/TokenDepositInputs";
import { LiquidityLockSettings } from "@/components/deposit/LiquidityLockSettings";
import { ApprovalModal } from "@/components/pool/ApprovalModal";
import { DepositGradeWarningModal } from "@/components/deposit/DepositGradeWarningModal";
import { DepositActionPanel } from "@/components/deposit/DepositActionPanel";
import { Button } from "@/components/common/Button";
import { useConcentratedPoolDeposit } from "./useConcentratedPoolDeposit";

export function ConcentratedPoolDepositDesktopView() {
  const t = useTranslations();
  const d = useConcentratedPoolDeposit();

  if (
    !d.selectedPool ||
    d.isCLPoolLoading ||
    (d.clPoolAddress && d.isSlot0Loading && d.sqrtPriceX96 === null)
  ) {
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
            poolAddress={d.selectedPool.address}
            isStable={false}
            strategy="Concentrated"
            tickSpacing={d.tickSpacing}
          />
        </div>

        {d.isPoolImbalanced && (
          <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-xl flex items-start gap-3">
            <svg
              className="w-5 h-5 text-orange-600 shrink-0 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <h3 className="body-14-bold text-orange-800 mb-1">
                {t("deposit.imbalancedPoolTitle")}
              </h3>
              <p className="body-12 text-orange-700">
                {t("deposit.imbalancedPoolBody", {
                  availableToken: d.imbalancedTokens?.available ?? "",
                  depletedToken: d.imbalancedTokens?.depleted ?? "",
                })}
              </p>
            </div>
          </div>
        )}

        {d.isPoolUninitialized && d.userInitialSqrtPriceX96 === null ? (
          <InitialPriceSelector
            token0Symbol={d.selectedPool.token0.symbol}
            token1Symbol={d.selectedPool.token1.symbol}
            token0Decimals={d.selectedPool.token0.decimals}
            token1Decimals={d.selectedPool.token1.decimals}
            onContinue={d.handleInitialPriceConfirm}
            onChangePool={d.handleChangePool}
          />
        ) : (
          // Figma 934-18889 (idle) puts PriceRangeSelector on the LEFT and the
          // deposit/lock/CTA card on the RIGHT. Figma 934-20050/20210/20369
          // (Approve / Confirm / Success) swap that: the deposit inputs slide
          // to the LEFT (frozen, no lock + no buttons) and the inline action
          // panel takes the RIGHT half. We render the two layouts separately
          // because the cells contain different components per state.
          d.desktopFlowPhase === "idle" ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PriceRangeSelector
                token0Symbol={d.selectedPool.token0.symbol}
                token1Symbol={d.selectedPool.token1.symbol}
                token0Decimals={d.selectedPool.token0.decimals}
                token1Decimals={d.selectedPool.token1.decimals}
                tickSpacing={d.selectedPool.tickSpacing ?? 50}
                currentTick={d.effectiveTick}
                poolAddress={d.selectedPool.address}
                onRangeChange={d.handleRangeChange}
                defaultFullRange={d.isPoolImbalanced}
              />

              <div className="flex flex-col">
                <TokenDepositInputs
                  token0={d.selectedPool.token0}
                  token1={d.selectedPool.token1}
                  amount0={d.amount0}
                  amount1={d.amount1}
                  onAmount0Change={d.handleAmount0Change}
                  onAmount1Change={d.handleAmount1Change}
                  depositRatio={d.depositRatio}
                  disableToken0={d.disableToken0}
                  disableToken1={d.disableToken1}
                >
                  <LiquidityLockSettings
                    value={d.lockOption}
                    onChange={d.setLockOption}
                  />

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
                </TokenDepositInputs>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="flex flex-col">
                <TokenDepositInputs
                  token0={d.selectedPool.token0}
                  token1={d.selectedPool.token1}
                  amount0={d.amount0}
                  amount1={d.amount1}
                  onAmount0Change={d.handleAmount0Change}
                  onAmount1Change={d.handleAmount1Change}
                  depositRatio={d.depositRatio}
                  disableToken0={d.disableToken0}
                  disableToken1={d.disableToken1}
                />
              </div>
              <DepositActionPanel
                phase={d.desktopFlowPhase}
                onEdit={d.handleDesktopEdit}
                onConfirm={d.handleDesktopConfirm}
                txHash={d.desktopTxHash}
              />
            </div>
          )
        )}
      </main>

      <Footer />

      <ApprovalModal
        isOpen={d.isApprovalModalOpen}
        onClose={() => d.setIsApprovalModalOpen(false)}
        steps={d.approvalStepsWithStatus}
        onApprove={d.handleApprove}
        onAddLiquidity={d.handleMintPosition}
        isAddingLiquidity={d.isMinting || d.isConfirming || d.isMockSubmitting}
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
