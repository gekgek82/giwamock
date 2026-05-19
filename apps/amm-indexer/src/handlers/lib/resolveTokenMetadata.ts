import { createPublicClient, http } from "viem";
import type { ParsedTokenSide } from "./parseAddressOrTokenInfo";

const rpcUrl = process.env.PONDER_RPC_URL_1 ?? "";
const client = rpcUrl ? createPublicClient({ transport: http(rpcUrl) }) : null;

const ERC20_ABI = [
  { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "totalSupply", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;

export async function resolveTokenMetadata(
  address: `0x${string}`,
): Promise<Omit<ParsedTokenSide, "address">> {
  if (!client) return {};
  try {
    const [name, symbol, decimals, totalSupply] = await Promise.allSettled([
      client.readContract({ address, abi: ERC20_ABI, functionName: "name" }),
      client.readContract({ address, abi: ERC20_ABI, functionName: "symbol" }),
      client.readContract({ address, abi: ERC20_ABI, functionName: "decimals" }),
      client.readContract({ address, abi: ERC20_ABI, functionName: "totalSupply" }),
    ]);
    return {
      name: name.status === "fulfilled" ? String(name.value) : undefined,
      symbol: symbol.status === "fulfilled" ? String(symbol.value) : undefined,
      decimals: decimals.status === "fulfilled" ? Number(decimals.value) : undefined,
      totalSupply: totalSupply.status === "fulfilled" ? BigInt(totalSupply.value as bigint) : undefined,
    };
  } catch {
    return {};
  }
}
