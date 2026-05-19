import { createPublicClient, http, type Address } from "viem";
import { ERC20Abi } from "@giwater/shared/abis";
import { giwaSepolia } from "@/lib/wagmi";
import type { TokenInfo } from "@/types/indexer";

export async function fetchErc20TokenInfo(address: string): Promise<TokenInfo | null> {
  try {
    const client = createPublicClient({ chain: giwaSepolia, transport: http() });
    const [sym, name, decimals] = await client.multicall({
      contracts: [
        { address: address as Address, abi: ERC20Abi, functionName: "symbol" },
        { address: address as Address, abi: ERC20Abi, functionName: "name" },
        { address: address as Address, abi: ERC20Abi, functionName: "decimals" },
      ],
      allowFailure: true,
    });
    if (sym.status !== "success" || typeof sym.result !== "string" || !sym.result) {
      return null;
    }
    return {
      address,
      symbol: sym.result,
      name: name.status === "success" && typeof name.result === "string" ? name.result : sym.result,
      decimals: decimals.status === "success" ? Number(decimals.result) : 18,
      iconUrl: null,
      isWhitelisted: false,
      isVerified: false,
    };
  } catch {
    return null;
  }
}
