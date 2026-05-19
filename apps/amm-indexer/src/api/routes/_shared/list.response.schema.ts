import { z } from "../../schemas/zod.js";

export function createListResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    items: z.array(itemSchema),
    limit: z.number().int(),
    offset: z.number().int(),
  });
}
