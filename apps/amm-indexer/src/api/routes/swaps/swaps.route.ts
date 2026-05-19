import { createRoute } from "@hono/zod-openapi";
import { eventIdParamsSchema } from "../_shared/event-id.params.request.schema.js";
import { swapListQuerySchema } from "./swaps.request.schema.js";
import { swapGetResponses, swapListResponses } from "./swaps.response.schema.js";

export const listSwapsRoute = createRoute({
  method: "get",
  path: "/swaps",
  tags: ["Swap"],
  summary: "List Swap events",
  request: { query: swapListQuerySchema },
  responses: swapListResponses,
});

export const getSwapRoute = createRoute({
  method: "get",
  path: "/swaps/{id}",
  tags: ["Swap"],
  summary: "Get Swap by event id",
  request: { params: eventIdParamsSchema },
  responses: swapGetResponses,
});
