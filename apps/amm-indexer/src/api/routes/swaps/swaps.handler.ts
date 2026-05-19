import type { RouteHandler } from "@hono/zod-openapi";
import { getSwapById, listSwaps } from "../../eventQueries.js";
import { getSwapRoute, listSwapsRoute } from "./swaps.route.js";

export const listSwapsHandler: RouteHandler<typeof listSwapsRoute> = async (
  c,
) => {
  const q = c.req.valid("query");
  const items = await listSwaps(
    { limit: q.limit, offset: q.offset },
    {
      tokenIn: q.tokenIn as `0x${string}` | undefined,
      tokenOut: q.tokenOut as `0x${string}` | undefined,
      to: q.to as `0x${string}` | undefined,
      isCL: q.isCL,
    },
  );
  return c.json({ items, limit: q.limit, offset: q.offset }, 200);
};

export const getSwapHandler: RouteHandler<typeof getSwapRoute> = async (c) => {
  const { id } = c.req.valid("param");
  const row = await getSwapById(id);
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json(row, 200);
};
