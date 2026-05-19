import type { PublicClient } from "viem";
import { ERC20Abi } from "@giwater/shared/abis";

import type { Address, TokenMetadata } from "@/lib/datasources/types";
import type { TokenDataSource } from "@/lib/datasources/token/types";

/**
 * On-chain implementation of `TokenDataSource`. Reads via viem. Metadata is
 * fetched via `multicall(allowFailure: true)` so a partial ERC-20
 * (e.g. missing `name`) still yields a usable result.
 */
export class WagmiTokenDataSource implements TokenDataSource {
  constructor(private readonly publicClient: PublicClient) {}

  async getBalance(
    tokenAddress: Address,
    walletAddress: Address,
  ): Promise<bigint> {
    return (await this.publicClient.readContract({
      address: tokenAddress,
      abi: ERC20Abi,
      functionName: "balanceOf",
      args: [walletAddress],
    })) as bigint;
  }

  async getAllowance(
    tokenAddress: Address,
    owner: Address,
    spender: Address,
  ): Promise<bigint> {
    return (await this.publicClient.readContract({
      address: tokenAddress,
      abi: ERC20Abi,
      functionName: "allowance",
      args: [owner, spender],
    })) as bigint;
  }

  async getMetadata(tokenAddress: Address): Promise<TokenMetadata | null> {
    const [sym, name, decimals] = await this.publicClient.multicall({
      contracts: [
        { address: tokenAddress, abi: ERC20Abi, functionName: "symbol" },
        { address: tokenAddress, abi: ERC20Abi, functionName: "name" },
        { address: tokenAddress, abi: ERC20Abi, functionName: "decimals" },
      ],
      allowFailure: true,
    });

    // Symbol is the one required marker for "valid ERC-20". Name/decimals
    // have tolerated fallbacks.
    if (sym.status !== "success" || typeof sym.result !== "string" || !sym.result) {
      return null;
    }

    return {
      address: tokenAddress,
      symbol: sym.result,
      name:
        name.status === "success" && typeof name.result === "string"
          ? name.result
          : sym.result,
      decimals:
        decimals.status === "success" ? Number(decimals.result) || 18 : 18,
    };
  }
}
