import { z } from "../../schemas/zod.js";
import { addressQuerySchema } from "../_shared/ethereum-address.request.schema.js";
import { createListResponseSchema } from "../_shared/list.response.schema.js";
import {
  simpleErrorResponseSchema,
  zodValidationErrorResponseSchema,
} from "../_shared/error.response.schema.js";

const hexAddr = addressQuerySchema;

export const clLiquidityAddedRowSchema = z.object({
  id: z.string(),
  sender: hexAddr,
  token0: hexAddr,
  token1: hexAddr,
  tickSpacing: z.string(),
  tickLower: z.string(),
  tickUpper: z.string(),
  liquidity: z.string(),
  amount0: z.string(),
  amount1: z.string(),
  to: hexAddr,
  blockNumber: z.string(),
  blockTimestamp: z.string(),
  transactionHash: z.string(),
  logIndex: z.string(),
});

export const clLiquidityAddedListResponseSchema = createListResponseSchema(
  clLiquidityAddedRowSchema,
);

export const clLiquidityAddedListResponses = {
  200: {
    description: "Paginated CLLiquidityAdded rows",
    content: {
      "application/json": { schema: clLiquidityAddedListResponseSchema },
    },
  },
  400: {
    description: "Invalid query parameters",
    content: {
      "application/json": { schema: zodValidationErrorResponseSchema },
    },
  },
} as const;

export const clLiquidityAddedGetResponses = {
  200: {
    description: "Single CLLiquidityAdded row",
    content: {
      "application/json": { schema: clLiquidityAddedRowSchema },
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
