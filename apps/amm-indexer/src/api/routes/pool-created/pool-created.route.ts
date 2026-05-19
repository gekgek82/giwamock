import { createRoute } from "@hono/zod-openapi";
import { eventIdParamsSchema } from "../_shared/event-id.params.request.schema.js";
import { poolCreatedListQuerySchema } from "./pool-created.request.schema.js";
import {
  poolCreatedGetResponses,
  poolCreatedListResponses,
} from "./pool-created.response.schema.js";

export const listPoolCreatedRoute = createRoute({
  method: "get",
  path: "/pool-created",
  tags: ["PoolCreated"],
  summary: "List PoolCreated events",
  request: { query: poolCreatedListQuerySchema },
  responses: poolCreatedListResponses,
});

export const getPoolCreatedRoute = createRoute({
  method: "get",
  path: "/pool-created/{id}",
  tags: ["PoolCreated"],
  summary: "Get PoolCreated by event id",
  request: { params: eventIdParamsSchema },
  responses: poolCreatedGetResponses,
});
