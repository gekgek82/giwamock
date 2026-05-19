"use client";

import { useMemo, useState, use } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { useTranslations } from "next-intl";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { APYChart } from "@/components/earn/APYChart";
import {
  MOCK_SIMPLE_EARN,
  getEarnProductById,
  formatUsdCompact,
} from "@/lib/earnMock";

type RangeKey = "1M" | "6M" | "1Y" | "All";
const RANGES: RangeKey[] = ["1M", "6M", "1Y", "All"];

export default function EarnDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const t = useTranslations();
  const [tab, setTab] = useState<"subscribe" | "redeem">("subscribe");
  const [range, setRange] = useState<RangeKey>("All");
  const [amount, setAmount] = useState("");

  const product = useMemo(() => getEarnProductById(id), [id]);
  if (!product) notFound();

  const receiveAmount = useMemo(() => {
    const n = parseFloat(amount);
    if (!isFinite(n) || n <= 0) return "";
    return (n * product.conversionRate.rate).toFixed(4);
  }, [amount, product.conversionRate.rate]);

  const latestApy = product.apyHistory[product.apyHistory.length - 1].value;

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {/* Back + Title */}
        <div className="mb-4 flex items-center gap-3">
          <Link
            href="/earn"
            className="text-sm text-[#64748b] hover:text-[#0c1117] transition-colors"
          >
            ← {t("earn.backToList")}
          </Link>
        </div>
        <div className="flex items-center gap-4 mb-4">
          <h1 className="text-2xl font-bold text-[#0c1117]">
            {t("earn.simpleEarn")}
          </h1>
        </div>

        {/* Product Selector */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden bg-white border border-[#e2e8f0]">
              <img
                src={product.logo}
                alt={product.symbol}
                className="w-full h-full object-contain"
              />
            </div>
            <ProductDropdown currentId={product.id} />
          </div>
        </div>

        <p className="text-sm text-[#475569] mb-6">{product.description}</p>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-3">
          <StatCard label={t("earn.myProtocolBalance")} value="$0.00" />
          <StatCard
            label={t("earn.price")}
            value={`$${product.price.toFixed(4)}`}
          />
          <StatCard
            label={t("earn.apy")}
            value={`${product.apy.toFixed(2)}%`}
          />
          <StatCard
            label={t("earn.tvl")}
            value={formatUsdCompact(product.tvl)}
          />
        </div>
        <p className="text-xs text-[#64748b] mb-8">{t("earn.aggregatedNote")}</p>

        {/* Chart + Subscribe Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-10">
          {/* Chart */}
          <div className="lg:col-span-3 border border-[#e2e8f0] rounded-2xl p-6 flex flex-col">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-[#64748b] font-medium">
                {product.symbol} {t("earn.apy")}
              </span>
              <div className="flex items-center gap-2">
                {RANGES.map((r) => {
                  const active = r === range;
                  return (
                    <button
                      key={r}
                      onClick={() => setRange(r)}
                      className={`text-xs px-2 py-1 rounded transition-colors ${
                        active
                          ? "font-semibold text-[#0c1117] bg-[#f1f5f9]"
                          : "text-[#64748b] hover:text-[#0c1117]"
                      }`}
                    >
                      {r}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="text-3xl font-bold text-[#0c1117] mb-4">
              {latestApy.toFixed(2)}%
            </div>
            <div className="relative flex-1 h-64">
              <APYChart data={product.apyHistory} />
            </div>
            <div className="flex justify-between mt-2 px-1">
              {product.apyHistory.map((p) => (
                <span key={p.date} className="text-[10px] text-[#94a3b8]">
                  {p.date}
                </span>
              ))}
            </div>
          </div>

          {/* Subscribe / Redeem Panel */}
          <div className="lg:col-span-2 border border-[#e2e8f0] rounded-2xl overflow-hidden">
            <div className="flex border-b border-[#e2e8f0]">
              <TabButton
                active={tab === "subscribe"}
                onClick={() => setTab("subscribe")}
              >
                {t("earn.subscribe")}
              </TabButton>
              <TabButton
                active={tab === "redeem"}
                onClick={() => setTab("redeem")}
              >
                {t("earn.redeem")}
              </TabButton>
            </div>

            <div className="p-5 space-y-4">
              {/* Network */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-[#64748b]">
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <circle cx="12" cy="12" r="10" strokeWidth={2} />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"
                    />
                  </svg>
                  <span className="leading-none self-center">
                    {t("earn.network")}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-medium text-[#334155]">
                  <div className="flex-shrink-0 w-4 h-4 rounded-full overflow-hidden bg-white">
                    <img
                      src="/earn/giwa.svg"
                      alt="GIWA"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <span className="leading-none self-center">GIWA</span>
                </div>
              </div>

              {/* Enter Amount */}
              <AmountBox
                label={t("earn.enterAmount")}
                amount={amount}
                onChange={setAmount}
                tokenSymbol={product.conversionRate.from}
                tokenLogo="/earn/usd-coin-usdc-logo.svg"
                readOnly={false}
                showMax
              />

              {/* Arrow */}
              <div className="flex justify-center">
                <div className="w-8 h-8 border border-[#e2e8f0] rounded-full flex items-center justify-center">
                  <svg
                    className="w-4 h-4 text-[#475569]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"
                    />
                  </svg>
                </div>
              </div>

              {/* Receive Amount */}
              <AmountBox
                label={t("earn.receiveAmount")}
                amount={receiveAmount}
                onChange={() => {}}
                tokenSymbol={product.symbol}
                tokenLogo={product.logo}
                readOnly
              />

              {/* Conversion rate */}
              <p className="text-xs text-[#64748b] text-left">
                1 {product.conversionRate.from} ={" "}
                {product.conversionRate.rate.toFixed(4)}{" "}
                {product.conversionRate.to}
              </p>

              {/* Information */}
              <div className="border border-[#e2e8f0] rounded-xl p-3.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[#334155] mb-1.5">
                  <svg
                    className="w-3.5 h-3.5 text-[#64748b]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <circle cx="12" cy="12" r="10" strokeWidth={2} />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 16v-4M12 8h.01"
                    />
                  </svg>
                  {t("earn.information")}
                </div>
                <p className="text-xs text-[#64748b] leading-relaxed">
                  {t("earn.informationText")}
                </p>
              </div>

              <button className="w-full py-3.5 font-semibold rounded-xl transition-colors text-sm text-[#0c1117] bg-primary-100 hover:bg-primary-200">
                {tab === "subscribe" ? t("earn.subscribe") : t("earn.redeem")}
              </button>
            </div>
          </div>
        </div>

        {/* Basic Information */}
        <div className="mb-10">
          <h2 className="text-lg font-bold text-[#0c1117] mb-4">
            {t("earn.basicInformation")}
          </h2>
          <div className="space-y-3 text-sm text-[#475569] leading-relaxed">
            {product.basicInformation.map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>
        </div>

        {/* Underlying Assets */}
        <div className="mb-10">
          <h2 className="text-lg font-bold text-[#0c1117] mb-4">
            {t("earn.underlyingAssetsDetails")}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#f1f5f9]">
                  <th className="pb-3 pr-6 text-xs font-semibold uppercase tracking-wider text-[#64748b]">
                    {t("earn.asset")}
                  </th>
                  <th className="pb-3 pr-6 text-xs font-semibold uppercase tracking-wider text-[#64748b]">
                    {t("earn.allocation")}
                  </th>
                  <th className="pb-3 pr-6 text-xs font-semibold uppercase tracking-wider text-[#64748b]">
                    {t("earn.yield")}
                  </th>
                  <th className="pb-3 text-xs font-semibold uppercase tracking-wider text-[#64748b]">
                    {t("earn.maturity")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9]">
                {product.underlyingAssets.map((row) => (
                  <tr key={row.asset}>
                    <td className="py-3 pr-6 font-medium text-[#334155]">
                      {row.asset}
                    </td>
                    <td className="py-3 pr-6 text-[#334155]">
                      {row.allocation.toFixed(1)}%
                    </td>
                    <td className="py-3 pr-6 text-[#334155]">
                      {row.yield.toFixed(2)}%
                    </td>
                    <td className="py-3 text-[#334155]">{row.maturity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[#e2e8f0] rounded-xl p-4">
      <div className="text-xs text-[#64748b] mb-2">{label}</div>
      <div className="text-xl font-bold text-[#0c1117]">{value}</div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-3.5 text-sm transition-all ${
        active
          ? "font-semibold text-[#0c1117] border-b-2 border-[#0c1117]"
          : "font-medium text-[#94a3b8] hover:text-[#334155]"
      }`}
    >
      {children}
    </button>
  );
}

function AmountBox({
  label,
  amount,
  onChange,
  tokenSymbol,
  tokenLogo,
  readOnly,
  showMax,
}: {
  label: string;
  amount: string;
  onChange: (v: string) => void;
  tokenSymbol: string;
  tokenLogo: string;
  readOnly?: boolean;
  showMax?: boolean;
}) {
  const t = useTranslations();
  return (
    <div className="border border-[#e2e8f0] rounded-xl p-3.5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-[#64748b]">{label}</span>
        <button className="text-xs font-normal" style={{ color: "#949494" }}>
          + {t("earn.addToWallet")}
        </button>
      </div>
      <div className="flex items-center justify-between gap-2">
        <input
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          readOnly={readOnly}
          value={amount}
          onChange={(e) => onChange(e.target.value)}
          className="bg-transparent outline-none w-full text-lg font-semibold text-[#0c1117] placeholder:text-[#cbd5e1]"
        />
        <button className="flex items-center gap-1.5 bg-[#f1f5f9] hover:bg-[#e2e8f0] rounded-full px-3 py-1.5 text-sm font-semibold text-[#0c1117] transition-colors whitespace-nowrap">
          <div className="w-4 h-4 rounded-full overflow-hidden bg-white">
            <img
              src={tokenLogo}
              alt={tokenSymbol}
              className="w-full h-full object-contain"
            />
          </div>
          {tokenSymbol}
          {!readOnly && (
            <svg
              className="w-3.5 h-3.5 text-[#64748b]"
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
          )}
        </button>
      </div>
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-[#94a3b8]">$0.00</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#94a3b8]">
            {t("common.balance")}: 0.00
          </span>
          {showMax && (
            <button className="text-xs font-normal text-black bg-primary-100 hover:bg-primary-200 rounded px-1.5 py-0.5 transition-colors">
              {t("common.max")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ProductDropdown({ currentId }: { currentId: string }) {
  const [open, setOpen] = useState(false);
  const current = MOCK_SIMPLE_EARN.find((p) => p.id === currentId);
  if (!current) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-base font-semibold text-[#0c1117]"
      >
        {current.symbol}
        <svg
          className="w-4 h-4 text-[#64748b]"
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
      {open && (
        <div className="absolute top-full left-0 mt-2 z-20 min-w-[200px] rounded-xl border border-[#e2e8f0] bg-white shadow-lg py-1">
          {MOCK_SIMPLE_EARN.map((p) => (
            <Link
              key={p.id}
              href={`/earn/${p.id}`}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-2 px-3 py-2 text-sm hover:bg-[#f1f5f9] ${
                p.id === currentId ? "font-semibold" : ""
              }`}
            >
              <div className="w-5 h-5 rounded-full overflow-hidden bg-white">
                <img
                  src={p.logo}
                  alt={p.symbol}
                  className="w-full h-full object-contain"
                />
              </div>
              <span className="text-[#0c1117]">{p.symbol}</span>
              <span className="ml-auto text-xs text-[#64748b]">
                {p.apy.toFixed(2)}%
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
