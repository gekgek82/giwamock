import type { Abi, PublicClient } from "viem";
import { Permit2Abi as Permit2AbiRaw } from "@giwater/shared/abis";

import type { Address } from "@/lib/datasources/types";
import type {
  Permit2DataSource,
  Permit2SubAllowance,
} from "@/lib/datasources/permit2/types";

const Permit2Abi = Permit2AbiRaw as Abi;

/**
 * On-chain implementation of `Permit2DataSource`. Reads
 * `Permit2.allowance(owner, token, spender)` which returns the triple
 * `[uint160 amount, uint48 expiration, uint48 nonce]`.
 */
export class WagmiPermit2DataSource implements Permit2DataSource {
  constructor(private readonly publicClient: PublicClient) {}

  async getAllowance(
    permit2Address: Address,
    tokenAddress: Address,
    owner: Address,
    spender: Address,
  ): Promise<Permit2SubAllowance> {
    const result = (await this.publicClient.readContract({
      address: permit2Address,
      abi: Permit2Abi,
      functionName: "allowance",
      args: [owner, tokenAddress, spender],
    })) as readonly [bigint, number, number];

    return {
      amount: result[0],
      expiration: Number(result[1]),
      nonce: Number(result[2]),
    };
  }
}
