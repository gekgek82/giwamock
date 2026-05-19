import { z } from "../../schemas/zod.js";
import { indexerTokenInfoSchema } from "../../schemas/indexer-token-info.schema.js";
import { addressQuerySchema } from "../_shared/ethereum-address.request.schema.js";
import { createListResponseSchema } from "../_shared/list.response.schema.js";
import {
  simpleErrorResponseSchema,
  zodValidationErrorResponseSchema,
} from "../_shared/error.response.schema.js";

const hexAddr = addressQuerySchema;

/** JSON row: numeric chain fields as decimal strings. */
const pairPriceAxisSchema = z.enum([
  "token1_per_token0",
  "display_quote_per_display_base",
]);

export const poolCreatedRowSchema = z.object({
  id: z.string(),
  token0: indexerTokenInfoSchema,
  token1: indexerTokenInfoSchema,
  stable: z.boolean(),
  pool: hexAddr,
  base: hexAddr,
  quote: hexAddr,
  pairPriceAxis: pairPriceAxisSchema,
  blockNumber: z.string(),
  blockTimestamp: z.string(),
  transactionHash: z.string(),
  logIndex: z.string(),
});

export const poolCreatedListResponseSchema = createListResponseSchema(
  poolCreatedRowSchema,
);

export const poolCreatedListResponses = {
  200: {
    description: "Paginated PoolCreated rows",
    content: {
      "application/json": { schema: poolCreatedListResponseSchema },
    },
  },
  400: {
    description: "Invalid query parameters",
    content: {
      "application/json": { schema: zodValidationErrorResponseSchema },
    },
  },
} as const;

export const poolCreatedGetResponses = {
  200: {
    description: "Single PoolCreated row",
    content: {
      "application/json": { schema: poolCreatedRowSchema },
    },
  },
  400: {
    description: "Invalid path parameters",
    content: {
      "application/json": { schema: zodValidationErrorResponseSchema },
    },
  },
  404: {
    description: "No row for this id",
    content: { "application/json": { schema: simpleErrorResponseSchema } },
  },
} as const;
