import { createRoute } from "@hono/zod-openapi";
import { eventIdParamsSchema } from "../_shared/event-id.params.request.schema.js";
import { clLiquidityAddedListQuerySchema } from "./cl-liquidity-added.request.schema.js";
import {
  clLiquidityAddedGetResponses,
  clLiquidityAddedListResponses,
} from "./cl-liquidity-added.response.schema.js";

export const listCLLiquidityAddedRoute = createRoute({
  method: "get",
  path: "/cl-liquidity-added",
  tags: ["CLLiquidityAdded"],
  summary: "List CLLiquidityAdded events",
  request: { query: clLiquidityAddedListQuerySchema },
  responses: clLiquidityAddedListResponses,
});

export const getCLLiquidityAddedRoute = createRoute({
  method: "get",
  path: "/cl-liquidity-added/{id}",
  tags: ["CLLiquidityAdded"],
  summary: "Get CLLiquidityAdded by event id",
  request: { params: eventIdParamsSchema },
  responses: clLiquidityAddedGetResponses,
});
