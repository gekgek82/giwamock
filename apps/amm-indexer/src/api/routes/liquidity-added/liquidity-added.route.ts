import { createRoute } from "@hono/zod-openapi";
import { eventIdParamsSchema } from "../_shared/event-id.params.request.schema.js";
import { liquidityAddedListQuerySchema } from "./liquidity-added.request.schema.js";
import {
  liquidityAddedGetResponses,
  liquidityAddedListResponses,
} from "./liquidity-added.response.schema.js";

export const listLiquidityAddedRoute = createRoute({
  method: "get",
  path: "/liquidity-added",
  tags: ["LiquidityAdded"],
  summary: "List LiquidityAdded events",
  request: { query: liquidityAddedListQuerySchema },
  responses: liquidityAddedListResponses,
});

export const getLiquidityAddedRoute = createRoute({
  method: "get",
  path: "/liquidity-added/{id}",
  tags: ["LiquidityAdded"],
  summary: "Get LiquidityAdded by event id",
  request: { params: eventIdParamsSchema },
  responses: liquidityAddedGetResponses,
});
