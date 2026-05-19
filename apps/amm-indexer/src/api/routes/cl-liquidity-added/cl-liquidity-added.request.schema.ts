import { addressQueryOptionalSchema } from "../_shared/ethereum-address.request.schema.js";
import { paginationQuerySchema } from "../_shared/pagination.request.schema.js";

export const clLiquidityAddedListQuerySchema = paginationQuerySchema.extend({
  token0: addressQueryOptionalSchema,
  token1: addressQueryOptionalSchema,
  to: addressQueryOptionalSchema,
});
