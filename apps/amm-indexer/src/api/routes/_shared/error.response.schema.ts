import { z } from "../../schemas/zod.js";

export const simpleErrorResponseSchema = z.object({
  error: z.string().openapi({ example: "Not found" }),
});

export const zodValidationErrorResponseSchema = z.object({
  error: z
    .object({
      formErrors: z.array(z.string()),
      fieldErrors: z.record(z.array(z.string())),
    })
    .openapi({ description: "Zod flatten() shape from query/path validation" }),
});
