import { z } from "../../schemas/zod.js";

export const paginationQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(500)
    .optional()
    .default(50)
    .openapi({
      description: "Max rows to return (1–500)",
      example: 50,
    }),
  offset: z.coerce
    .number()
    .int()
    .min(0)
    .optional()
    .default(0)
    .openapi({ description: "Rows to skip", example: 0 }),
});
