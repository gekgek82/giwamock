import type { RouteHandler } from "@hono/zod-openapi";
import {
  getCLPoolCreatedById,
  listCLPoolCreated,
} from "../../eventQueries.js";
import {
  getCLPoolCreatedRoute,
  listCLPoolCreatedRoute,
} from "./cl-pool-created.route.js";

export const listCLPoolCreatedHandler: RouteHandler<
  typeof listCLPoolCreatedRoute
> = async (c) => {
  const q = c.req.valid("query");
  const items = await listCLPoolCreated(
    { limit: q.limit, offset: q.offset },
    {
      pool: q.pool as `0x${string}` | undefined,
      token0: q.token0 as `0x${string}` | undefined,
      token1: q.token1 as `0x${string}` | undefined,
    },
  );
  return c.json({ items, limit: q.limit, offset: q.offset }, 200);
};

export const getCLPoolCreatedHandler: RouteHandler<
  typeof getCLPoolCreatedRoute
> = async (c) => {
  const { id } = c.req.valid("param");
  const row = await getCLPoolCreatedById(id);
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json(row, 200);
};
