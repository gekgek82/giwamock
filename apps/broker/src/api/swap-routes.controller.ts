import {
  BadRequestException,
  Controller,
  Get,
  Query,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { SwapRouteResponseDto } from '@giwater/shared';
import { SwapRouteResponseSwaggerDto } from '@giwater/shared/nest/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import {
  GiwaUniversalRouterAbi,
  POOL_FACTORY_ADDRESS,
  ROUTER_ADDRESS,
  WGIWA_ADDRESS,
} from '@giwater/shared';
import { encodeFunctionData, isAddress } from 'viem';
import { parseOptionalSwapRouteAmountInWei } from './parse-swap-route-amount-in';
import { SwapLiquidityGraphService } from '../swap-liquidity/swap-liquidity-graph.service';
import { SwapRouteSpotPairQuoteService } from '../swap-liquidity/swap-route-spot-pair-quote.service';
import { SpotTokenEntity } from '../models/token/spot-token.entity';

type SwapRouteResponseWithIcons = SwapRouteResponseDto & {
  fromTokenIconUrl?: string | null;
  toTokenIconUrl?: string | null;
};

@ApiTags('swap-routes')
@Controller('swap-routes')
export class SwapRoutesController {
  constructor(
    private readonly swapGraph: SwapLiquidityGraphService,
    private readonly swapRouteSpotPairQuote: SwapRouteSpotPairQuoteService,
    @InjectRepository(SpotTokenEntity)
    private readonly spotTokens: Repository<SpotTokenEntity>,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Shortest multi-hop swap route',
    description:
      'Resolves `from` and `to` as `0x` addresses or token symbols (`spot_tokens`). ' +
      'Computes the minimum-hop path over indexed pool liquidity (PoolCreated / CLPoolCreated). ' +
      'Each hop includes the pair address, pool kind, fee metadata from `spot_pairs`, and when `amountIn` is set ' +
      'optional per-hop `priceImpactPercent` + `feeOnInputWei`, plus route-level `totalFeeUsd`, `averageFeeBps`, and compounded `routePriceImpactPercent` ' +
      '(proxy liquidity + broker USD quotes; no chain RPC).',
  })
  @ApiQuery({
    name: 'from',
    required: true,
    description: 'Input token: hex address (0x + 40 hex) or symbol (e.g. ETH)',
    example: 'ETH',
  })
  @ApiQuery({
    name: 'to',
    required: true,
    description: 'Output token: hex address or symbol (e.g. USDC)',
    example: 'USDC',
  })
  @ApiQuery({
    name: 'amountIn',
    required: false,
    description:
      'Optional: input amount as integer wei string for the **from** token. When set, each hop gets `priceImpactPercent` and `feeOnInputWei` from broker DB estimates.',
    example: '1000000000000000000',
  })
  @ApiOkResponse({ type: SwapRouteResponseSwaggerDto })
  async getSwapRoute(
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('amountIn') amountIn: string | undefined,
    @Query('buildCalldata') buildCalldata: string | undefined,
    @Query('recipient') recipient: string | undefined,
    @Query('deadline') deadline: string | undefined,
    @Query('amountOutMin') amountOutMin: string | undefined,
    @Query('fromIsNative') fromIsNative: string | undefined,
    @Query('toIsNative') toIsNative: string | undefined,
    @Query('permitSignature') permitSignature: string | undefined,
    @Query('permitExpiration') permitExpiration: string | undefined,
    @Query('permitNonce') permitNonce: string | undefined,
    @Query('permitSigDeadline') permitSigDeadline: string | undefined,
    @Query('debug') debug: string | undefined,
  ): Promise<SwapRouteResponseDto> {
    if (typeof from !== 'string' || !from.trim()) {
      throw new BadRequestException('Query parameter `from` is required');
    }
    if (typeof to !== 'string' || !to.trim()) {
      throw new BadRequestException('Query parameter `to` is required');
    }
    const fromAddr = await this.swapGraph.resolveTokenQuery(from);
    const toAddr = await this.swapGraph.resolveTokenQuery(to);
    const hops = await this.swapGraph.findShortestRoute(fromAddr, toAddr);
    const amt = parseOptionalSwapRouteAmountInWei(amountIn);
    const [fromRow, toRow] = await Promise.all([
      this.spotTokens.findOne({ where: { id: fromAddr } }),
      this.spotTokens.findOne({ where: { id: toAddr } }),
    ]);
    const body: SwapRouteResponseWithIcons = {
      fromToken: fromAddr,
      toToken: toAddr,
      fromTokenIconUrl: fromRow?.logoURI || null,
      toTokenIconUrl: toRow?.logoURI || null,
      hops,
    };
    if (amt) {
      body.amountInWei = amt.asString;
      await this.swapRouteSpotPairQuote.enrichHopQuotesFromSpotPairs(
        hops,
        amt.wei,
      );
      const agg = await this.swapRouteSpotPairQuote.computeRouteAggregates(hops);
      body.totalFeeUsd = agg.totalFeeUsd;
      body.averageFeeBps = agg.averageFeeBps;
      body.routePriceImpactPercent = agg.routePriceImpactPercent;

      const outWei = await this.swapRouteSpotPairQuote.quoteRouteAmountOutWeiFromSpotPairs(
        hops,
        amt.wei,
      );
      if (outWei > 0n) {
        body.amountOutWei = outWei.toString();
        const wantDebug =
          typeof debug === 'string' &&
          ['1', 'true', 'yes', 'y'].includes(debug.trim().toLowerCase());
        if (wantDebug && process.env.NODE_ENV !== 'production') {
          const dbg = await this.swapRouteSpotPairQuote.debugRouteQuoteFromSpotPairs(
            hops,
            amt.wei,
          );
          // eslint-disable-next-line no-console
          console.log('[swap-routes][debug] hop quote trace', {
            fromToken: fromAddr,
            toToken: toAddr,
            amountInWei: amt.asString,
            amountOutWei: outWei.toString(),
            hops: dbg,
          });
        }
        let rate =
          await this.swapRouteSpotPairQuote.computeRouteExchangeRateInPerOutFromProxyReserves(
            hops,
          );
        if (
          rate === null ||
          rate === undefined ||
          !Number.isFinite(rate) ||
          rate <= 0
        ) {
          rate =
            await this.swapRouteSpotPairQuote.computeRouteExchangeRateFromSizedQuoteWei(
              fromAddr,
              toAddr,
              amt.wei,
              outWei,
            );
        }
        body.exchangeRate = rate;
      } else {
        body.amountOutWei = '0';
        body.exchangeRate = null;
      }
    }

    const wantTx =
      typeof buildCalldata === 'string' &&
      ['1', 'true', 'yes', 'y'].includes(buildCalldata.trim().toLowerCase());
    if (wantTx) {
      if (!body.amountInWei) {
        throw new BadRequestException('`amountIn` is required when buildCalldata=true');
      }
      if (typeof amountOutMin !== 'string' || !amountOutMin.trim()) {
        throw new BadRequestException(
          '`amountOutMin` (wei string) is required when buildCalldata=true',
        );
      }
      if (typeof recipient !== 'string' || !recipient.trim() || !isAddress(recipient)) {
        throw new BadRequestException('`recipient` (0x address) is required when buildCalldata=true');
      }
      const dl = typeof deadline === 'string' && deadline.trim() ? Number(deadline) : NaN;
      if (!Number.isFinite(dl) || dl <= 0) {
        throw new BadRequestException('`deadline` (unix seconds) is required when buildCalldata=true');
      }

      const yn = (v: string | undefined): boolean =>
        typeof v === 'string' && ['1', 'true', 'yes', 'y'].includes(v.trim().toLowerCase());
      const isNativeIn = yn(fromIsNative);
      const isNativeOut = yn(toIsNative);

      const hasCl = hops.some((h) => h.poolKind === 'cl');
      const amountInWei = BigInt(body.amountInWei);
      const amountOutMinWei = BigInt(amountOutMin);
      const deadlineWei = BigInt(Math.floor(dl));

      if ((isNativeIn || isNativeOut) && hasCl) {
        throw new BadRequestException(
          'buildCalldata for CL/mixed routes currently supports ERC20-only (use WGIWA instead of native flags)',
        );
      }

      const routes = hops.map((h) => ({
        from: h.tokenIn,
        to: h.tokenOut,
        stable: h.poolKind === 'stable',
        factory: POOL_FACTORY_ADDRESS,
      }));

      const permitWanted =
        typeof permitSignature === 'string' && permitSignature.trim().startsWith('0x');
      const permitExp = permitWanted ? BigInt(permitExpiration ?? '0') : 0n;
      const permitNon = permitWanted ? BigInt(permitNonce ?? '0') : 0n;
      const permitDl = permitWanted ? BigInt(permitSigDeadline ?? '0') : 0n;
      if (permitWanted && hasCl) {
        throw new BadRequestException('permitSignature is not supported for CL/mixed calldata yet');
      }
      if (permitWanted && isNativeIn) {
        throw new BadRequestException('permitSignature is not applicable for native input swaps');
      }

      let data: `0x${string}`;
      let valueWei = '0';
      let method = '';

      if (hasCl) {
        // Mixed route (volatile/stable + CL) via mixedExactInput
        const mixedHops = hops.map((h) => ({
          tokenIn: h.tokenIn,
          tokenOut: h.tokenOut,
          isCL: h.poolKind === 'cl',
          stable: h.poolKind === 'stable',
          tickSpacing: h.poolKind === 'cl' ? (h.tickSpacing ?? 0) : 0,
        }));
        const missingSpacing = mixedHops.some((h) => h.isCL && (!Number.isFinite(h.tickSpacing) || h.tickSpacing === 0));
        if (missingSpacing) {
          throw new BadRequestException('CL hop missing tickSpacing; cannot build calldata');
        }
        data = encodeFunctionData({
          abi: GiwaUniversalRouterAbi as any,
          functionName: 'mixedExactInput',
          args: [
            {
              hops: mixedHops,
              recipient,
              deadline: deadlineWei,
              amountIn: amountInWei,
              amountOutMinimum: amountOutMinWei,
            },
          ],
        });
        method = 'mixedExactInput';
      } else if (isNativeIn) {
        // ETH -> tokens (payable)
        if (hops.length > 0 && hops[0]!.tokenIn.toLowerCase() !== WGIWA_ADDRESS.toLowerCase()) {
          throw new BadRequestException('fromIsNative=true requires first hop tokenIn to be WGIWA');
        }
        data = encodeFunctionData({
          abi: GiwaUniversalRouterAbi as any,
          functionName: 'swapExactETHForTokens',
          args: [amountOutMinWei, routes, recipient, deadlineWei],
        });
        valueWei = body.amountInWei;
        method = 'swapExactETHForTokens';
      } else if (isNativeOut) {
        // tokens -> ETH
        if (
          hops.length > 0 &&
          hops[hops.length - 1]!.tokenOut.toLowerCase() !== WGIWA_ADDRESS.toLowerCase()
        ) {
          throw new BadRequestException('toIsNative=true requires last hop tokenOut to be WGIWA');
        }
        if (permitWanted) {
          data = encodeFunctionData({
            abi: GiwaUniversalRouterAbi as any,
            functionName: 'swapExactTokensForETHWithPermit',
            args: [
              amountInWei,
              amountOutMinWei,
              routes,
              recipient,
              deadlineWei,
              {
                details: {
                  token: body.fromToken,
                  amount: amountInWei,
                  expiration: permitExp,
                  nonce: permitNon,
                },
                spender: ROUTER_ADDRESS,
                sigDeadline: permitDl,
              },
              permitSignature as `0x${string}`,
            ],
          });
          method = 'swapExactTokensForETHWithPermit';
        } else {
          data = encodeFunctionData({
            abi: GiwaUniversalRouterAbi as any,
            functionName: 'swapExactTokensForETH',
            args: [amountInWei, amountOutMinWei, routes, recipient, deadlineWei],
          });
          method = 'swapExactTokensForETH';
        }
      } else {
        // tokens -> tokens
        if (permitWanted) {
          data = encodeFunctionData({
            abi: GiwaUniversalRouterAbi as any,
            functionName: 'swapExactTokensForTokensWithPermit',
            args: [
              amountInWei,
              amountOutMinWei,
              routes,
              recipient,
              deadlineWei,
              {
                details: {
                  token: body.fromToken,
                  amount: amountInWei,
                  expiration: permitExp,
                  nonce: permitNon,
                },
                spender: ROUTER_ADDRESS,
                sigDeadline: permitDl,
              },
              permitSignature as `0x${string}`,
            ],
          });
          method = 'swapExactTokensForTokensWithPermit';
        } else {
          data = encodeFunctionData({
            abi: GiwaUniversalRouterAbi as any,
            functionName: 'swapExactTokensForTokens',
            args: [amountInWei, amountOutMinWei, routes, recipient, deadlineWei],
          });
          method = 'swapExactTokensForTokens';
        }
      }

      body.tx = {
        to: ROUTER_ADDRESS,
        data,
        valueWei,
        method,
      };
    }
    return body;
  }
}
