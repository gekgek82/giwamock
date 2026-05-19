import { apiReference } from "@scalar/hono-api-reference";
import { OpenAPIHono } from "@hono/zod-openapi";
import { db } from "ponder:api";
import schema from "ponder:schema";
import { client, graphql } from "ponder";
import type { Context } from "hono";
import type { ZodError } from "zod";
import "./schemas/zod.js";
import { registerRoutes } from "./routes/index.js";

const app = new OpenAPIHono({
  defaultHook: (result, c: Context) => {
    if (!result.success) {
      const err = result.error as ZodError;
      return c.json({ error: err.flatten() }, 400);
    }
  },
});

registerRoutes(app);

app.doc("/doc", {
  openapi: "3.0.0",
  info: {
    title: "GiWaTer AMM indexer API",
    version: "1.0.0",
    description:
      "Read-only REST access to indexed GiwaTer Universal Router events. On-chain integers are returned as decimal strings in JSON.",
  },
});

app.get(
  "/ui",
  apiReference({
    theme: "kepler",
    layout: "modern",
    url: "/doc",
  }),
);

app.use("/sql/*", client({ db, schema }));

app.use("/graphql", graphql({ db, schema }));
app.use("/", graphql({ db, schema }));

export default app;
