import { z } from "../../schemas/zod.js";

export const eventIdParamsSchema = z.object({
  id: z.string().min(1).openapi({
    param: { name: "id", in: "path" },
    description: "Ponder event id (unique per log)",
  }),
});
