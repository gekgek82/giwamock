import type { RouteHandler } from "@hono/zod-openapi";
import {
  getDynamicSwapFeeEventById,
  listDynamicSwapFeeEvents,
} from "../../eventQueries.js";
import {
  getDynamicSwapFeeEventRoute,
  listDynamicSwapFeeEventsRoute,
} from "./dynamic-swap-fee-events.route.js";

export const listDynamicSwapFeeEventsHandler: RouteHandler<
  typeof listDynamicSwapFeeEventsRoute
> = async (c) => {
  const q = c.req.valid("query");
  const items = await listDynamicSwapFeeEvents(
    { limit: q.limit, offset: q.offset },
    {
      pool: q.pool as `0x${string}` | undefined,
      dynamicFee: q.dynamicFee,
    },
  );
  return c.json({ items, limit: q.limit, offset: q.offset }, 200);
};

export const getDynamicSwapFeeEventHandler: RouteHandler<
  typeof getDynamicSwapFeeEventRoute
> = async (c) => {
  const { id } = c.req.valid("param");
  const row = await getDynamicSwapFeeEventById(id);
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json(row, 200);
};
