import { z } from "../../schemas/zod.js";
import { addressQuerySchema } from "../_shared/ethereum-address.request.schema.js";
import { createListResponseSchema } from "../_shared/list.response.schema.js";
import {
  simpleErrorResponseSchema,
  zodValidationErrorResponseSchema,
} from "../_shared/error.response.schema.js";

const hexAddr = addressQuerySchema;

export const dynamicSwapFeeEventRowSchema = z.object({
  id: z.string(),
  pool: hexAddr,
  dynamicFee: z.boolean(),
  fee: z.string().nullable(),
  blockNumber: z.string(),
  blockTimestamp: z.string(),
  transactionHash: z.string(),
  logIndex: z.string(),
});

export const dynamicSwapFeeEventListResponseSchema = createListResponseSchema(
  dynamicSwapFeeEventRowSchema,
);

export const dynamicSwapFeeEventListResponses = {
  200: {
    description: "Paginated DynamicSwapFeeModule rows",
    content: {
      "application/json": { schema: dynamicSwapFeeEventListResponseSchema },
    },
  },
  400: {
    description: "Invalid query parameters",
    content: {
      "application/json": { schema: zodValidationErrorResponseSchema },
    },
  },
} as const;

export const dynamicSwapFeeEventGetResponses = {
  200: {
    description: "Single DynamicSwapFeeModule row",
    content: {
      "application/json": { schema: dynamicSwapFeeEventRowSchema },
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
