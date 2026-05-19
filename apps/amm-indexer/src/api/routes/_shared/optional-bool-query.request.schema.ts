import { z } from "../../schemas/zod.js";

/** Query string `true` / `false` → boolean for filters. */
export const optionalBoolQuerySchema = z
  .enum(["true", "false"])
  .optional()
  .openapi({ description: "Pass literal string true or false" })
  .transform((v: "true" | "false" | undefined) =>
    v === undefined ? undefined : v === "true",
  );
