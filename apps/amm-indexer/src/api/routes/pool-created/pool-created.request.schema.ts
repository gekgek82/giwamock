import { addressQueryOptionalSchema } from "../_shared/ethereum-address.request.schema.js";
import { optionalBoolQuerySchema } from "../_shared/optional-bool-query.request.schema.js";
import { paginationQuerySchema } from "../_shared/pagination.request.schema.js";

export const poolCreatedListQuerySchema = paginationQuerySchema.extend({
  pool: addressQueryOptionalSchema.openapi({
    description: "Filter by created pool address",
  }),
  token0: addressQueryOptionalSchema.openapi({
    description: "Filter by token0",
  }),
  token1: addressQueryOptionalSchema.openapi({
    description: "Filter by token1",
  }),
  stable: optionalBoolQuerySchema,
});
