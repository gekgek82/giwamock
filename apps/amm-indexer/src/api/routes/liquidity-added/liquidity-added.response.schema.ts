import { z } from "../../schemas/zod.js";
import { addressQuerySchema } from "../_shared/ethereum-address.request.schema.js";
import { createListResponseSchema } from "../_shared/list.response.schema.js";
import {
  simpleErrorResponseSchema,
  zodValidationErrorResponseSchema,
} from "../_shared/error.response.schema.js";

const hexAddr = addressQuerySchema;

export const liquidityAddedRowSchema = z.object({
  id: z.string(),
  sender: hexAddr,
  token0: hexAddr,
  token1: hexAddr,
  stable: z.boolean(),
  amount0: z.string(),
  amount1: z.string(),
  liquidity: z.string(),
  to: hexAddr,
  blockNumber: z.string(),
  blockTimestamp: z.string(),
  transactionHash: z.string(),
  logIndex: z.string(),
});

export const liquidityAddedListResponseSchema = createListResponseSchema(
  liquidityAddedRowSchema,
);

export const liquidityAddedListResponses = {
  200: {
    description: "Paginated LiquidityAdded rows",
    content: {
      "application/json": { schema: liquidityAddedListResponseSchema },
    },
  },
  400: {
    description: "Invalid query parameters",
    content: {
      "application/json": { schema: zodValidationErrorResponseSchema },
    },
  },
} as const;

export const liquidityAddedGetResponses = {
  200: {
    description: "Single LiquidityAdded row",
    content: {
      "application/json": { schema: liquidityAddedRowSchema },
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
