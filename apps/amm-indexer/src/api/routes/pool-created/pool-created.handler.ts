import type { RouteHandler } from "@hono/zod-openapi";
import {
  getPoolCreatedById,
  listPoolCreated,
} from "../../eventQueries.js";
import { getPoolCreatedRoute, listPoolCreatedRoute } from "./pool-created.route.js";

export const listPoolCreatedHandler: RouteHandler<
  typeof listPoolCreatedRoute
> = async (c) => {
  const q = c.req.valid("query");
  const items = await listPoolCreated(
    { limit: q.limit, offset: q.offset },
    {
      pool: q.pool as `0x${string}` | undefined,
      token0: q.token0 as `0x${string}` | undefined,
      token1: q.token1 as `0x${string}` | undefined,
      stable: q.stable,
    },
  );
  return c.json({ items, limit: q.limit, offset: q.offset }, 200);
};

export const getPoolCreatedHandler: RouteHandler<
  typeof getPoolCreatedRoute
> = async (c) => {
  const { id } = c.req.valid("param");
  const row = await getPoolCreatedById(id);
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json(row, 200);
};
