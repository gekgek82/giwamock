"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import {
  MOCK_PORTFOLIO_OVERVIEW,
  MOCK_SIMPLE_EARN,
  MOCK_VAULTS,
  formatUsd,
  formatUsdCompact,
} from "@/lib/earnMock";

const GRADIENT_DIVIDER_STYLE = {
  height: "1px",
  background:
    "linear-gradient(90deg, rgba(0, 254, 162, 0) -3.13%, rgb(0, 254, 162) 23.96%, rgba(0, 254, 162, 0) 105.22%)",
};

const BENTO_DOTS_STYLE = {
  backgroundImage:
    "radial-gradient(circle at 2px 2px, rgba(0, 254, 162, 0.25) 1px, transparent 0)",
  backgroundSize: "24px 24px",
};

export function EarnDesktopPageView() {
  const t = useTranslations();
  const [search, setSearch] = useState("");

  const filteredVaults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return MOCK_VAULTS;
    return MOCK_VAULTS.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        v.symbol.toLowerCase().includes(q) ||
        v.curator.name.toLowerCase().includes(q),
    );
  }, [search]);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {/* Portfolio Overview */}
        <section className="mb-8">
          <div className="bg-[#f8fafc] rounded-2xl p-6 shadow-sm">
            <h2 className="text-[#0c1117] text-lg font-bold mb-4">
              {t("earn.portfolioOverview")}
            </h2>
            <div className="mb-6" style={GRADIENT_DIVIDER_STYLE} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <OverviewStat
                label={t("earn.totalDeposit")}
                value={formatUsd(MOCK_PORTFOLIO_OVERVIEW.totalDepositUsd)}
              />
              <OverviewStat
                label={t("earn.totalInterest")}
                value={formatUsd(MOCK_PORTFOLIO_OVERVIEW.totalInterestUsd)}
              />
              <OverviewStat
                label={t("earn.last24hInterest")}
                value={formatUsd(MOCK_PORTFOLIO_OVERVIEW.last24hInterestUsd)}
              />
            </div>
          </div>
        </section>

        {/* Promotional Banner */}
        <section className="mb-8">
          <div className="bg-[#0c1117] rounded-2xl p-8 relative overflow-hidden flex items-center min-h-[140px]">
            <div className="absolute inset-0" style={BENTO_DOTS_STYLE} />
            <div
              className="absolute right-0 top-0 h-full w-2/5"
              style={{
                background:
                  "linear-gradient(135deg, transparent 0%, rgba(0,254,162,0.15) 100%)",
              }}
            />
            <div className="relative z-10 max-w-xl">
              <h2 className="text-xl font-bold text-white mb-2 leading-tight">
                {t("earn.bannerTitle")}
              </h2>
              <p className="text-[#64748b] text-sm">
                {t("earn.bannerDescription")}
              </p>
            </div>
          </div>
        </section>

        {/* Simple Earn Section */}
        <section className="mb-8">
          <div className="bg-[#f8fafc] rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-[#0c1117] text-lg font-bold">
                {t("earn.simpleEarn")}
              </h2>
              <button className="text-sm font-medium text-[#0c1117] hover:opacity-70 transition-all flex items-center gap-1">
                {t("earn.viewAll")}
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>
            <p className="text-xs text-[#475569] mb-4">
              {t("earn.simpleEarnDescription")}
            </p>
            <div className="mb-6" style={GRADIENT_DIVIDER_STYLE} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {MOCK_SIMPLE_EARN.map((product) => (
                <Link
                  key={product.id}
                  href={`/earn/${product.id}`}
                  className="bg-[#f1f5f9] rounded-2xl p-5 hover:shadow-md transition-all duration-300 block"
                >
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden bg-white">
                      <img
                        src={product.logo}
                        alt={product.symbol}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div>
                      <div className="font-bold text-[#0c1117] flex items-center gap-2">
                        {product.symbol}
                        {product.bonus && (
                          <span className="bg-primary-100 text-[#0c1117] text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">
                            {t("earn.bonus")}
                          </span>
                        )}
                      </div>
                      <div className="text-[#475569] text-xs">
                        {product.term}
                      </div>
                    </div>
                  </div>
                  <div className="mb-5">
                    <div className="text-[#475569] text-xs font-medium uppercase tracking-wider mb-1">
                      {t("earn.estimatedAPY")}
                    </div>
                    <div className="text-3xl font-black text-[#0c1117]">
                      {product.apy.toFixed(2)}%
                    </div>
                  </div>
                  <span className="block text-center w-full bg-primary-100 text-[#0c1117] py-3 rounded-2xl font-semibold text-sm hover:bg-primary-200 transition-all">
                    {t("earn.subscribe")}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Vaults Table Section */}
        <section className="mb-8">
          <div className="bg-[#f8fafc] rounded-2xl shadow-sm overflow-hidden">
            <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="text-primary-700 text-lg font-bold">
                {t("earn.vaults")}
              </h2>
              <div className="flex flex-wrap items-center gap-3">
                <FilterPill label={t("earn.allProducts")} />
                <FilterPill label={t("earn.allTerms")} />
                <div className="relative">
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10 pr-4 py-2 bg-[#f1f5f9] rounded-xl text-sm text-[#0c1117] placeholder:text-[#64748b] focus:outline-none focus:ring-2 w-52"
                    style={{ ["--tw-ring-color" as string]: "rgba(0,254,162,0.3)" }}
                    placeholder={t("earn.searchCryptoAssets")}
                    type="text"
                  />
                  <svg
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748b]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
              </div>
            </div>
            <div style={GRADIENT_DIVIDER_STYLE} />
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-[#f1f5f9]/60">
                    <Th>{t("earn.token")}</Th>
                    <Th>{t("earn.liquidity")}</Th>
                    <Th>{t("earn.exposure")}</Th>
                    <Th>{t("earn.curator")}</Th>
                    <Th>{t("earn.apy")}</Th>
                    <Th>{t("earn.action")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVaults.map((vault) => (
                    <tr
                      key={vault.id}
                      className="hover:bg-[#f1f5f9] transition-colors border-t border-[#f1f5f9]"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden bg-white">
                            <img
                              src={vault.logo}
                              alt={vault.symbol}
                              className="w-full h-full object-contain"
                            />
                          </div>
                          <span className="text-sm font-medium text-[#0c1117]">
                            {vault.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-[#0f172a]">
                          {formatUsdCompact(vault.liquidityUsd)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex -space-x-1">
                          {vault.exposureLogos.map((src) => (
                            <div
                              key={src}
                              className="w-6 h-6 rounded-full flex items-center justify-center overflow-hidden bg-white border-2 border-white"
                            >
                              <img
                                src={src}
                                alt=""
                                className="w-full h-full object-contain"
                              />
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded flex items-center justify-center overflow-hidden">
                            <img
                              src={vault.curator.logo}
                              alt={vault.curator.name}
                              className="w-full h-full object-contain"
                            />
                          </div>
                          <span className="text-sm text-[#0c1117]">
                            {vault.curator.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-[#0c1117]">
                          {vault.apy.toFixed(2)}%
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <Link
                          href={`/earn/${vault.id}`}
                          className="inline-block px-4 py-2 bg-primary-100 hover:bg-primary-200 text-black rounded-full text-sm font-medium transition-all"
                        >
                          {t("earn.deposit")}
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {filteredVaults.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-6 py-12 text-center text-sm text-[#64748b]"
                      >
                        {t("common.noResults")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4 bg-[#f1f5f9]/40 flex items-center justify-between border-t border-[#f1f5f9]">
              <div className="text-xs font-bold text-[#475569] uppercase tracking-wider">
                {t("earn.pageOf", { current: 1, total: 24 })}
              </div>
              <div className="flex gap-2">
                <button
                  className="w-8 h-8 rounded-full bg-[#f1f5f9] flex items-center justify-center text-[#64748b] hover:text-[#0c1117] transition-colors"
                  aria-label="Previous page"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>
                <button className="w-8 h-8 rounded-full bg-[#0c1117] text-white flex items-center justify-center text-xs font-bold">
                  1
                </button>
                <button className="w-8 h-8 rounded-full bg-[#f1f5f9] text-[#334155] flex items-center justify-center text-xs font-bold hover:bg-[#e2e8f0]">
                  2
                </button>
                <button className="w-8 h-8 rounded-full bg-[#f1f5f9] text-[#334155] flex items-center justify-center text-xs font-bold hover:bg-[#e2e8f0]">
                  3
                </button>
                <button
                  className="w-8 h-8 rounded-full bg-[#f1f5f9] flex items-center justify-center text-[#64748b] hover:text-[#0c1117] transition-colors"
                  aria-label="Next page"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

function OverviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#f1f5f9] rounded-xl p-4 flex items-center justify-between">
      <div>
        <div className="text-xs font-medium text-[#475569] uppercase tracking-wider mb-1">
          {label}
        </div>
        <div className="text-2xl font-bold text-[#0c1117]">{value}</div>
      </div>
    </div>
  );
}

function FilterPill({ label }: { label: string }) {
  return (
    <button className="bg-[#f1f5f9] rounded-full px-4 py-2 flex items-center gap-2 hover:bg-[#e2e8f0] transition-all">
      <span className="text-xs font-bold uppercase tracking-wider text-[#334155]">
        {label}
      </span>
      <svg
        className="w-3 h-3 text-[#475569]"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 9l-7 7-7-7"
        />
      </svg>
    </button>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-[#475569]">
      {children}
    </th>
  );
}
