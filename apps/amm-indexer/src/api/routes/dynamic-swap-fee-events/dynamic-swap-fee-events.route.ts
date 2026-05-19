import { createRoute } from "@hono/zod-openapi";
import { eventIdParamsSchema } from "../_shared/event-id.params.request.schema.js";
import { dynamicSwapFeeEventListQuerySchema } from "./dynamic-swap-fee-events.request.schema.js";
import {
  dynamicSwapFeeEventGetResponses,
  dynamicSwapFeeEventListResponses,
} from "./dynamic-swap-fee-events.response.schema.js";

export const listDynamicSwapFeeEventsRoute = createRoute({
  method: "get",
  path: "/dynamic-swap-fee-events",
  tags: ["DynamicSwapFeeModule"],
  summary: "List DynamicSwapFeeModule events",
  request: { query: dynamicSwapFeeEventListQuerySchema },
  responses: dynamicSwapFeeEventListResponses,
});

export const getDynamicSwapFeeEventRoute = createRoute({
  method: "get",
  path: "/dynamic-swap-fee-events/{id}",
  tags: ["DynamicSwapFeeModule"],
  summary: "Get DynamicSwapFeeModule event by id",
  request: { params: eventIdParamsSchema },
  responses: dynamicSwapFeeEventGetResponses,
});
