import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { defineChain } from "viem";
import type { Config } from "wagmi";

const DEFAULT_RPC_URL = "https://giwa-sepolia.nodit.io/p_hEf~9kuaf3OrQ0x5JEhqS7SvtBFRZz";

function getCustomRpcUrl(): string {
  if (typeof window === "undefined") return DEFAULT_RPC_URL;
  try {
    const stored = localStorage.getItem("giwater-settings");
    if (stored) {
      const parsed = JSON.parse(stored);
      const customUrl = parsed?.state?.customRpcUrl;
      if (customUrl && typeof customUrl === "string" && customUrl.trim()) {
        return customUrl.trim();
      }
    }
  } catch {
    // ignore parse errors
  }
  return DEFAULT_RPC_URL;
}

export const giwaSepolia = defineChain({
  id: 91342,
  name: "GIWA Sepolia",
  nativeCurrency: { name: "GIWA", symbol: "GIWA", decimals: 18 },
  rpcUrls: {
    default: { http: [getCustomRpcUrl()] },
  },
  blockExplorers: {
    default: { name: "GiwaScan", url: "https://sepolia-explorer.giwa.io" },
  },
  contracts: {
    // Canonical Multicall3 deployment. Without this, viem's publicClient.multicall()
    // throws "Chain does not support contract multicall3", which silently breaks
    // every data-source path (getCLSlot0, token reads, lock reads, etc.).
    multicall3: {
      address: "0xcA11bde05977b3631167028862bE2a173976CA11",
    },
  },
  testnet: true,
});

// Fallback Project ID for development (replace with your own)
const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
  "a01e2f3b4c5d6e7f8g9h0i1j2k3l4m5n";

// Lazy-initialize config to avoid WalletConnect accessing indexedDB during SSR
let _config: Config | undefined;

export function getConfig(): Config {
  if (!_config) {
    _config = getDefaultConfig({
      appName: "GiwaSwapTest",
      projectId,
      chains: [giwaSepolia],
      ssr: true,
    });
  }
  return _config;
}
