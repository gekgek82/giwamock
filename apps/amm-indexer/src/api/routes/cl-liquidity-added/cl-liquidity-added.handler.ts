import type { RouteHandler } from "@hono/zod-openapi";
import {
  getCLLiquidityAddedById,
  listCLLiquidityAdded,
} from "../../eventQueries.js";
import {
  getCLLiquidityAddedRoute,
  listCLLiquidityAddedRoute,
} from "./cl-liquidity-added.route.js";

export const listCLLiquidityAddedHandler: RouteHandler<
  typeof listCLLiquidityAddedRoute
> = async (c) => {
  const q = c.req.valid("query");
  const items = await listCLLiquidityAdded(
    { limit: q.limit, offset: q.offset },
    {
      token0: q.token0 as `0x${string}` | undefined,
      token1: q.token1 as `0x${string}` | undefined,
      to: q.to as `0x${string}` | undefined,
    },
  );
  return c.json({ items, limit: q.limit, offset: q.offset }, 200);
};

export const getCLLiquidityAddedHandler: RouteHandler<
  typeof getCLLiquidityAddedRoute
> = async (c) => {
  const { id } = c.req.valid("param");
  const row = await getCLLiquidityAddedById(id);
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json(row, 200);
};
