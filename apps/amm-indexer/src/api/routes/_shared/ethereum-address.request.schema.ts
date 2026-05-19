import { z } from "../../schemas/zod.js";

export const addressQuerySchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/)
  .openapi({
    description: "20-byte hex address (with 0x prefix)",
    example: "0x0000000000000000000000000000000000000000",
  });

export const addressQueryOptionalSchema = addressQuerySchema.optional();
