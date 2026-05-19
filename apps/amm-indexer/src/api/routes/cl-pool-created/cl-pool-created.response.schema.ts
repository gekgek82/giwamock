import { z } from "../../schemas/zod.js";
import { indexerTokenInfoSchema } from "../../schemas/indexer-token-info.schema.js";
import { addressQuerySchema } from "../_shared/ethereum-address.request.schema.js";
import { createListResponseSchema } from "../_shared/list.response.schema.js";
import {
  simpleErrorResponseSchema,
  zodValidationErrorResponseSchema,
} from "../_shared/error.response.schema.js";

const hexAddr = addressQuerySchema;

const pairPriceAxisSchema = z.enum([
  "token1_per_token0",
  "display_quote_per_display_base",
]);

export const clPoolCreatedRowSchema = z.object({
  id: z.string(),
  token0: indexerTokenInfoSchema,
  token1: indexerTokenInfoSchema,
  tickSpacing: z.string(),
  pool: hexAddr,
  base: hexAddr,
  quote: hexAddr,
  pairPriceAxis: pairPriceAxisSchema,
  stable: z.boolean(),
  dynamicFee: z.boolean(),
  blockNumber: z.string(),
  blockTimestamp: z.string(),
  transactionHash: z.string(),
  logIndex: z.string(),
});

export const clPoolCreatedListResponseSchema = createListResponseSchema(
  clPoolCreatedRowSchema,
);

export const clPoolCreatedListResponses = {
  200: {
    description: "Paginated CLPoolCreated rows",
    content: {
      "application/json": { schema: clPoolCreatedListResponseSchema },
    },
  },
  400: {
    description: "Invalid query parameters",
    content: {
      "application/json": { schema: zodValidationErrorResponseSchema },
    },
  },
} as const;

export const clPoolCreatedGetResponses = {
  200: {
    description: "Single CLPoolCreated row",
    content: {
      "application/json": { schema: clPoolCreatedRowSchema },
    },
  },
  400: {
    description: "Invalid path parameters",
    content: {
      "application/json": { schema: zodValidationErrorResponseSchema },
    },
  },
  404: {
    description: "Not found",
    content: { "application/json": { schema: simpleErrorResponseSchema } },
  },
} as const;
