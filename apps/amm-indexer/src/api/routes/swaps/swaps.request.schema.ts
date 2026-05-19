import { addressQueryOptionalSchema } from "../_shared/ethereum-address.request.schema.js";
import { optionalBoolQuerySchema } from "../_shared/optional-bool-query.request.schema.js";
import { paginationQuerySchema } from "../_shared/pagination.request.schema.js";

export const swapListQuerySchema = paginationQuerySchema.extend({
  tokenIn: addressQueryOptionalSchema,
  tokenOut: addressQueryOptionalSchema,
  to: addressQueryOptionalSchema,
  isCL: optionalBoolQuerySchema,
});
