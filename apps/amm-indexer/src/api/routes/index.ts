import type { OpenAPIHono } from "@hono/zod-openapi";
import {
  getCLLiquidityAddedHandler,
  listCLLiquidityAddedHandler,
} from "./cl-liquidity-added/cl-liquidity-added.handler.js";
import {
  getCLLiquidityAddedRoute,
  listCLLiquidityAddedRoute,
} from "./cl-liquidity-added/cl-liquidity-added.route.js";
import {
  getCLPoolCreatedHandler,
  listCLPoolCreatedHandler,
} from "./cl-pool-created/cl-pool-created.handler.js";
import {
  getCLPoolCreatedRoute,
  listCLPoolCreatedRoute,
} from "./cl-pool-created/cl-pool-created.route.js";
import {
  getLiquidityAddedHandler,
  listLiquidityAddedHandler,
} from "./liquidity-added/liquidity-added.handler.js";
import {
  getLiquidityAddedRoute,
  listLiquidityAddedRoute,
} from "./liquidity-added/liquidity-added.route.js";
import {
  getPoolCreatedHandler,
  listPoolCreatedHandler,
} from "./pool-created/pool-created.handler.js";
import {
  getPoolCreatedRoute,
  listPoolCreatedRoute,
} from "./pool-created/pool-created.route.js";
import {
  getDynamicSwapFeeEventHandler,
  listDynamicSwapFeeEventsHandler,
} from "./dynamic-swap-fee-events/dynamic-swap-fee-events.handler.js";
import {
  getDynamicSwapFeeEventRoute,
  listDynamicSwapFeeEventsRoute,
} from "./dynamic-swap-fee-events/dynamic-swap-fee-events.route.js";
import { getSwapHandler, listSwapsHandler } from "./swaps/swaps.handler.js";
import { getSwapRoute, listSwapsRoute } from "./swaps/swaps.route.js";

/** Register all OpenAPI-documented REST routes on the app. */
export function registerRoutes(app: OpenAPIHono) {
  app.openapi(listPoolCreatedRoute, listPoolCreatedHandler);
  app.openapi(getPoolCreatedRoute, getPoolCreatedHandler);

  app.openapi(listCLPoolCreatedRoute, listCLPoolCreatedHandler);
  app.openapi(getCLPoolCreatedRoute, getCLPoolCreatedHandler);

  app.openapi(listLiquidityAddedRoute, listLiquidityAddedHandler);
  app.openapi(getLiquidityAddedRoute, getLiquidityAddedHandler);

  app.openapi(listCLLiquidityAddedRoute, listCLLiquidityAddedHandler);
  app.openapi(getCLLiquidityAddedRoute, getCLLiquidityAddedHandler);

  app.openapi(listSwapsRoute, listSwapsHandler);
  app.openapi(getSwapRoute, getSwapHandler);

  app.openapi(listDynamicSwapFeeEventsRoute, listDynamicSwapFeeEventsHandler);
  app.openapi(getDynamicSwapFeeEventRoute, getDynamicSwapFeeEventHandler);
}
