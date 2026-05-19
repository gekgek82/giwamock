export interface SimpleEarnProduct {
  id: string;
  symbol: string;
  name: string;
  logo: string;
  term: string;
  apy: number;
  bonus?: boolean;
  description: string;
  price: number;
  tvl: number;
  conversionRate: { from: string; to: string; rate: number };
  basicInformation: string[];
  underlyingAssets: {
    asset: string;
    allocation: number;
    yield: number;
    maturity: string;
  }[];
  apyHistory: { date: string; value: number }[];
}

export interface Vault {
  id: string;
  symbol: string;
  name: string;
  logo: string;
  liquidityUsd: number;
  exposureLogos: string[];
  curator: { name: string; logo: string };
  apy: number;
}

export interface PortfolioOverview {
  totalDepositUsd: number;
  totalInterestUsd: number;
  last24hInterestUsd: number;
}

export const MOCK_PORTFOLIO_OVERVIEW: PortfolioOverview = {
  totalDepositUsd: 1000.0,
  totalInterestUsd: 126.42,
  last24hInterestUsd: 32.18,
};

export const MOCK_SIMPLE_EARN: SimpleEarnProduct[] = [
  {
    id: "amcash-plus",
    symbol: "AMCASH+",
    name: "AMCASH+",
    logo: "/earn/amcash-plus.svg",
    term: "Flexible Term",
    apy: 18.42,
    bonus: true,
    description:
      "Lock apxUSD to receive apyUSD, a yield bearing asset backed by variable rate perpetual preferred stock.",
    price: 102.7978,
    tvl: 48_294_087,
    conversionRate: { from: "USDC", to: "AMCASH+", rate: 0.8382 },
    basicInformation: [
      'AMCASH+ is a 1:1 asset-backed token collateralized by the ChinaAMC USD Digital Money Market Fund Class B USD, which invests in short-term deposits and high quality money market instruments to achieve long-term return in US Dollars in line with prevailing money market rates, with primary considerations of both capital security and liquidity. There can be no assurance that the Sub-Fund will achieve its investment objective. The Sub-Fund seeks to provide investors with a stable and consistent investment return over medium to long term.',
      'AMCASH+ is issued by Reale Assets Limited ("Reale"), a BVI private company acting as bare trust, with tokenisation and token administrative services delivered by Asseto Fintech Limited (together with its affiliates, "Asseto").',
      'ChinaAMC USD Digital Money Market Fund Class B USD (the "Sub-Fund") is a sub-fund of ChinaAMC Digital OFC (the "Company"), which is a public umbrella open-ended fund company ("OFC") established under Hong Kong law with variable capital and with segregated liability between sub-funds.',
    ],
    underlyingAssets: [
      { asset: "US Treasury Bills", allocation: 42.5, yield: 5.28, maturity: "< 90 days" },
      { asset: "Bitcoin", allocation: 31.2, yield: 4.95, maturity: "Overnight" },
      { asset: "Ethereum", allocation: 18.7, yield: 5.12, maturity: "< 60 days" },
      { asset: "Cash & Equivalents", allocation: 7.6, yield: 4.8, maturity: "Daily" },
    ],
    apyHistory: [
      { date: "9 Apr", value: 88 },
      { date: "10 Apr", value: 89 },
      { date: "11 Apr", value: 90.5 },
      { date: "12 Apr", value: 91 },
      { date: "13 Apr", value: 93 },
      { date: "14 Apr", value: 96 },
      { date: "15 Apr", value: 98.5 },
      { date: "16 Apr", value: 100 },
    ],
  },
  {
    id: "usdc",
    symbol: "USDC",
    name: "USDC",
    logo: "/earn/usd-coin-usdc-logo.svg",
    term: "Flexible Term",
    apy: 12.15,
    description:
      "Earn variable interest on USDC deposits with flexible access to funds.",
    price: 1.0,
    tvl: 128_450_912,
    conversionRate: { from: "USDC", to: "aUSDC", rate: 1.0 },
    basicInformation: [
      "USDC Simple Earn provides stable yield on USD Coin deposits through curated strategies across decentralized lending protocols.",
    ],
    underlyingAssets: [
      { asset: "Aave v3", allocation: 45.0, yield: 4.2, maturity: "Daily" },
      { asset: "Compound v3", allocation: 30.0, yield: 3.9, maturity: "Daily" },
      { asset: "Morpho Blue", allocation: 25.0, yield: 5.1, maturity: "Daily" },
    ],
    apyHistory: [
      { date: "9 Apr", value: 11.8 },
      { date: "10 Apr", value: 11.9 },
      { date: "11 Apr", value: 12.0 },
      { date: "12 Apr", value: 12.05 },
      { date: "13 Apr", value: 12.1 },
      { date: "14 Apr", value: 12.15 },
      { date: "15 Apr", value: 12.12 },
      { date: "16 Apr", value: 12.15 },
    ],
  },
  {
    id: "usdt",
    symbol: "USDT",
    name: "USDT",
    logo: "/earn/tether-usdt-logo.svg",
    term: "Flexible Term",
    apy: 8.94,
    description:
      "Flexible term Tether deposits with competitive yields from curated strategies.",
    price: 1.0,
    tvl: 42_910_241,
    conversionRate: { from: "USDT", to: "aUSDT", rate: 1.0 },
    basicInformation: [
      "USDT Simple Earn aggregates yields across major on-chain lending markets with daily compounding.",
    ],
    underlyingAssets: [
      { asset: "Aave v3", allocation: 50.0, yield: 3.8, maturity: "Daily" },
      { asset: "Compound v3", allocation: 30.0, yield: 3.4, maturity: "Daily" },
      { asset: "Morpho Blue", allocation: 20.0, yield: 4.2, maturity: "Daily" },
    ],
    apyHistory: [
      { date: "9 Apr", value: 8.5 },
      { date: "10 Apr", value: 8.6 },
      { date: "11 Apr", value: 8.7 },
      { date: "12 Apr", value: 8.8 },
      { date: "13 Apr", value: 8.85 },
      { date: "14 Apr", value: 8.9 },
      { date: "15 Apr", value: 8.92 },
      { date: "16 Apr", value: 8.94 },
    ],
  },
];

export const MOCK_VAULTS: Vault[] = [
  {
    id: "usdt-presto",
    symbol: "USDT",
    name: "Tether USD",
    logo: "/earn/tether-usdt-logo.svg",
    liquidityUsd: 42_910_241,
    exposureLogos: ["/earn/btc.svg", "/earn/eth.svg", "/earn/xrp.svg"],
    curator: { name: "Presto Labs", logo: "/earn/presto.svg" },
    apy: 30.34,
  },
  {
    id: "usdc-gauntlet",
    symbol: "USDC",
    name: "USD Coin",
    logo: "/earn/usd-coin-usdc-logo.svg",
    liquidityUsd: 128_450_912,
    exposureLogos: [
      "/earn/btc.svg",
      "/earn/eth.svg",
      "/earn/tether-usdt-logo.svg",
      "/earn/usd-coin-usdc-logo.svg",
      "/earn/xrp.svg",
    ],
    curator: { name: "Gauntlet", logo: "/earn/gauntlet.svg" },
    apy: 28.13,
  },
  {
    id: "pyusd-steakhouse",
    symbol: "PYUSD",
    name: "PayPal USD",
    logo: "/earn/paypal-usd-pyusd-logo.svg",
    liquidityUsd: 12_019_234,
    exposureLogos: [
      "/earn/btc.svg",
      "/earn/eth.svg",
      "/earn/tether-usdt-logo.svg",
      "/earn/usd-coin-usdc-logo.svg",
      "/earn/xrp.svg",
      "/earn/paypal-usd-pyusd-logo.svg",
    ],
    curator: { name: "Steakhouse", logo: "/earn/steakhouse.svg" },
    apy: 32.9,
  },
];

export function getEarnProductById(id: string): SimpleEarnProduct | undefined {
  return MOCK_SIMPLE_EARN.find((p) => p.id === id);
}

export function formatUsd(n: number, digits = 2): string {
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

export function formatUsdCompact(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}
