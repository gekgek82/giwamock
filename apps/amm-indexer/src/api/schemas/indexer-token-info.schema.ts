import { z } from "./zod.js";
import { addressQuerySchema } from "../routes/_shared/ethereum-address.request.schema.js";

const hexAddr = addressQuerySchema;

/** Mirrors `IGiwaUniversalRouter.TokenInfo` for OpenAPI / HTTP responses. */
export const indexerTokenInfoSchema = z.object({
  token: hexAddr,
  totalSupply: z.string(),
  decimals: z.number().int().min(0).max(255),
  name: z.string(),
  symbol: z.string(),
});
