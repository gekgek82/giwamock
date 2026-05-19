import type { RouteHandler } from "@hono/zod-openapi";
import {
  getLiquidityAddedById,
  listLiquidityAdded,
} from "../../eventQueries.js";
import {
  getLiquidityAddedRoute,
  listLiquidityAddedRoute,
} from "./liquidity-added.route.js";

export const listLiquidityAddedHandler: RouteHandler<
  typeof listLiquidityAddedRoute
> = async (c) => {
  const q = c.req.valid("query");
  const items = await listLiquidityAdded(
    { limit: q.limit, offset: q.offset },
    {
      token0: q.token0 as `0x${string}` | undefined,
      token1: q.token1 as `0x${string}` | undefined,
      to: q.to as `0x${string}` | undefined,
      stable: q.stable,
    },
  );
  return c.json({ items, limit: q.limit, offset: q.offset }, 200);
};

export const getLiquidityAddedHandler: RouteHandler<
  typeof getLiquidityAddedRoute
> = async (c) => {
  const { id } = c.req.valid("param");
  const row = await getLiquidityAddedById(id);
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json(row, 200);
};
