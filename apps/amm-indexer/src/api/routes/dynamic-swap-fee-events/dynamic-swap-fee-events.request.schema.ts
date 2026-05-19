import { addressQueryOptionalSchema } from "../_shared/ethereum-address.request.schema.js";
import { optionalBoolQuerySchema } from "../_shared/optional-bool-query.request.schema.js";
import { paginationQuerySchema } from "../_shared/pagination.request.schema.js";

export const dynamicSwapFeeEventListQuerySchema = paginationQuerySchema.extend({
  pool: addressQueryOptionalSchema,
  dynamicFee: optionalBoolQuerySchema,
});
