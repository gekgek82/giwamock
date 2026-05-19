import { createRoute } from "@hono/zod-openapi";
import { eventIdParamsSchema } from "../_shared/event-id.params.request.schema.js";
import { clPoolCreatedListQuerySchema } from "./cl-pool-created.request.schema.js";
import {
  clPoolCreatedGetResponses,
  clPoolCreatedListResponses,
} from "./cl-pool-created.response.schema.js";

export const listCLPoolCreatedRoute = createRoute({
  method: "get",
  path: "/cl-pool-created",
  tags: ["CLPoolCreated"],
  summary: "List CLPoolCreated events",
  request: { query: clPoolCreatedListQuerySchema },
  responses: clPoolCreatedListResponses,
});

export const getCLPoolCreatedRoute = createRoute({
  method: "get",
  path: "/cl-pool-created/{id}",
  tags: ["CLPoolCreated"],
  summary: "Get CLPoolCreated by event id",
  request: { params: eventIdParamsSchema },
  responses: clPoolCreatedGetResponses,
});
