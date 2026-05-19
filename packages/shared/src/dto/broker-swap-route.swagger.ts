import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { SwapRouteHopDto, SwapRouteResponseDto } from './broker-swap-route';

/**
 * OpenAPI schema for {@link SwapRouteHopDto} — used by broker `GET /swap-routes` and gateway parity route.
 */
export class SwapRouteHopSwaggerDto implements SwapRouteHopDto {
  @ApiProperty({ example: '0x1234567890123456789012345678901234567890' })
  pairAddress!: string;

  @ApiProperty({ example: '0x1111111111111111111111111111111111111111' })
  tokenIn!: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Optional logo URL for tokenIn (spot_tokens.logoURI).',
    example: 'https://.../token.png',
  })
  inputTokenLogo?: string | null;

  @ApiProperty({ example: '0x2222222222222222222222222222222222222222' })
  tokenOut!: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Optional logo URL for tokenOut (spot_tokens.logoURI).',
    example: 'https://.../token.png',
  })
  outputTokenLogo?: string | null;

  @ApiProperty({
    nullable: true,
    example: 30,
    description:
      'Raw read-model fee from DB when known; null for CL dynamic-fee mode when no static bps is stored.',
  })
  effectiveFeeBps!: number | null;

  @ApiProperty({
    example: 30,
    description:
      'Swap fee in **basis points** (1 bps = 0.01%) used for this hop. Always set; matches `feeOnInputWei` / price impact when `amountIn` is provided.',
  })
  feeBps!: number;

  @ApiProperty({
    example: 'factory_tier',
    description:
      'factory_tier | factory_custom | cl_module_fixed | cl_module_dynamic; empty if pair not materialized',
  })
  feeSource!: string;

  @ApiProperty({ enum: ['volatile', 'stable', 'cl'], example: 'volatile' })
  poolKind!: 'volatile' | 'stable' | 'cl';

  @ApiPropertyOptional({
    description: 'For CL hops only: tick spacing (int24). For non-CL hops: 0.',
    example: 60,
  })
  tickSpacing?: number;

  @ApiProperty({
    nullable: true,
    example: 0.12,
    description:
      'When `amountIn` is set: CP estimate from `spot_pairs` day TVL proxy (not on-chain reserves).',
  })
  priceImpactPercent!: number | null;

  @ApiProperty({
    nullable: true,
    example: '3000000000000000',
    description: 'Fee on hop input (wei), `amountIn * feeBps / 10000` using the hop’s `feeBps`.',
  })
  feeOnInputWei!: string | null;
}

/**
 * OpenAPI schema for {@link SwapRouteResponseDto} — matches broker implementation body shape.
 */
export class SwapRouteResponseSwaggerDto implements SwapRouteResponseDto {
  @ApiProperty({ description: 'Resolved input token address (checksummed or lower-case hex)' })
  fromToken!: string;

  @ApiProperty({ description: 'Resolved output token address' })
  toToken!: string;

  @ApiPropertyOptional({
    nullable: true,
    description: "Optional icon URL for fromToken (spot_tokens.logoURI).",
    example: "https://.../token.png",
  })
  fromTokenIconUrl?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: "Optional icon URL for toToken (spot_tokens.logoURI).",
    example: "https://.../token.png",
  })
  toTokenIconUrl?: string | null;

  @ApiProperty({
    required: false,
    description:
      'Present only when query `amountIn` was provided: echo as integer decimal string (wei of the **from** token).',
    example: '1000000000000000000',
  })
  amountInWei?: string;

  @ApiPropertyOptional({
    description:
      'When `amountIn` set: estimated output amount (wei, integer string) from walking hop quotes.',
    example: '123450000',
  })
  amountOutWei?: string;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'When `amountIn` set: exchange rate (human units) = from input per to output; proxy-reserve based with fallback from sized quote.',
    example: 123.4567,
  })
  exchangeRate?: number | null;

  @ApiPropertyOptional({
    nullable: true,
    example: 1.25,
    description:
      'When `amountIn` set: sum of hop swap fees in USD (each hop fee is in that hop’s `tokenIn`). Null if any fee token lacks a broker USD price.',
  })
  totalFeeUsd?: number | null;

  @ApiPropertyOptional({
    nullable: true,
    example: 25,
    description:
      'When `amountIn` set: arithmetic mean of hop `feeBps`. Null when there are no hops.',
  })
  averageFeeBps?: number | null;

  @ApiPropertyOptional({
    nullable: true,
    example: 4.94,
    description:
      'When `amountIn` set: compounded route price impact % = `1 − Π(1 − hop.priceImpactPercent/100)`. Null if any hop lacks impact.',
  })
  routePriceImpactPercent?: number | null;

  @ApiProperty({ type: [SwapRouteHopSwaggerDto], description: 'Ordered hops; empty when from === to' })
  hops!: SwapRouteHopDto[];

  @ApiPropertyOptional({
    description:
      'Optional pre-built UniversalGiwaRouter tx calldata (when requested).',
    example: {
      to: '0x20d851F85B43Fd7A5D96dd5b71bC11d6657B5E57',
      data: '0x38ed17390000000000000000000000000000000000000000000000000de0b6b3a7640000...',
      valueWei: '0',
      method: 'swapExactTokensForTokens',
    },
  })
  tx?: SwapRouteResponseDto['tx'];
}
