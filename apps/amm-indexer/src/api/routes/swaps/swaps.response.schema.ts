import { z } from "../../schemas/zod.js";
import { addressQuerySchema } from "../_shared/ethereum-address.request.schema.js";
import { createListResponseSchema } from "../_shared/list.response.schema.js";
import {
  simpleErrorResponseSchema,
  zodValidationErrorResponseSchema,
} from "../_shared/error.response.schema.js";

const hexAddr = addressQuerySchema;

export const swapRowSchema = z.object({
  id: z.string(),
  sender: hexAddr,
  tokenIn: hexAddr,
  tokenOut: hexAddr,
  isCL: z.boolean(),
  stable: z.boolean(),
  hopIndex: z.string(),
  amountIn: z.string(),
  amountOut: z.string(),
  feeAmount: z.string(),
  feeToken: hexAddr,
  to: hexAddr,
  blockNumber: z.string(),
  blockTimestamp: z.string(),
  transactionHash: z.string(),
  logIndex: z.string(),
});

export const swapListResponseSchema = createListResponseSchema(swapRowSchema);

export const swapListResponses = {
  200: {
    description: "Paginated Swap rows",
    content: {
      "application/json": { schema: swapListResponseSchema },
    },
  },
  400: {
    description: "Invalid query parameters",
    content: {
      "application/json": { schema: zodValidationErrorResponseSchema },
    },
  },
} as const;

export const swapGetResponses = {
  200: {
    description: "Single Swap row",
    content: {
      "application/json": { schema: swapRowSchema },
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
