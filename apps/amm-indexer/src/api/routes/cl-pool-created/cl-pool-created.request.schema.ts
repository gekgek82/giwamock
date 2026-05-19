import { addressQueryOptionalSchema } from "../_shared/ethereum-address.request.schema.js";
import { paginationQuerySchema } from "../_shared/pagination.request.schema.js";

export const clPoolCreatedListQuerySchema = paginationQuerySchema.extend({
  pool: addressQueryOptionalSchema,
  token0: addressQueryOptionalSchema,
  token1: addressQueryOptionalSchema,
});
