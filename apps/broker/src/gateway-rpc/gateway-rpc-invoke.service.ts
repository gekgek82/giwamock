import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CONTRACT_ADDRESSES,
  type AddPairToSpotGroupDto,
  type AddTokenToSpotGroupDto,
  type BrokerGatewayHttpLikeRequest,
  type BrokerGatewayRpcRequestDto,
  type BrokerGatewayRpcResponseDto,
  type CreateSpotGroupDto,
  type SetSpotListedDto,
} from '@giwater/shared';
import { SpotPairEntity } from '../models/pair/spot-pair.entity';
import { SpotTokenEntity } from '../models/token/spot-token.entity';
import { LiquidityHistogramBucketEntity } from '../models/tick/liquidity-histogram-bucket.entity';
import { VoterVotePositionEntity } from '../models/voting/voter-vote-position.entity';
import type { EpochInfo, GlobalStats, LiquidityBar, LiquidityDistributionResponse, PoolStats, PoolsStatsResponse, RegisterTokenResponse, TokenInfo, TokenPrice, TokenPricesResponse, TokenSearchResponse, VotePoolInfo, VotePoolsResponse } from '@giwater/shared';
import { DynamicSwapFeeReadModelService } from '../dynamic-fee/dynamic-swap-fee-read-model.service';
import { IndexerEventPersistenceService } from '../indexer-events/indexer-event-persistence.service';
import { VeLockService } from '../ve-lock/ve-lock.service';
import { VotingService } from '../voting/voting.service';
import { VotingClaimableService } from '../voting/voting-claimable.service';
import { BrokerSwapHopQueryService } from '../swap-hop/broker-swap-hop-query.service';
import { parseListedFromQueryRecord } from '../spot-catalog/parse-listed-query';
import {
  SpotCatalogService,
  type SpotLeaderboardSort,
} from '../spot-catalog/spot-catalog.service';
import { SpotGroupsService } from '../spot-catalog/spot-groups.service';
import { parseOptionalSwapRouteAmountInWei } from '../api/parse-swap-route-amount-in';
import { SwapLiquidityGraphService } from '../swap-liquidity/swap-liquidity-graph.service';
import { SwapRouteSpotPairQuoteService } from '../swap-liquidity/swap-route-spot-pair-quote.service';
import { UdfService } from '../api/udf/udf.service';
import { AdminLockService } from '../api/admin-lock/admin-lock.service';
import { AdminVoteService } from '../api/admin-vote/admin-vote.service';

function normalizeHttpPath(path: string): string {
  const t = path.trim();
  if (!t) {
    return '/';
  }
  return t.startsWith('/') ? t : `/${t}`;
}

function pathSegments(path: string): string[] {
  return normalizeHttpPath(path)
    .replace(/^\/+/, '')
    .split('/')
    .filter((s) => s.length > 0)
    .map((s) => {
      try {
        return decodeURIComponent(s);
      } catch {
        return s;
      }
    });
}

function intQuery(
  q: Record<string, string | undefined> | undefined,
  key: string,
  defaultVal: number,
): number {
  const v = q?.[key];
  if (v === undefined || v === '') {
    return defaultVal;
  }
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : defaultVal;
}

function parseLeaderboardSortSegment(
  raw: string | undefined,
): SpotLeaderboardSort | null {
  const s = raw?.trim().toLowerCase();
  if (s === 'asc' || s === 'desc') return s;
  return null;
}

function httpErrorToRpc(err: unknown): BrokerGatewayRpcResponseDto {
  if (err instanceof NotFoundException) {
    return { ok: false, statusCode: 404, error: err.message };
  }
  if (err instanceof BadRequestException) {
    return { ok: false, statusCode: 400, error: err.message };
  }
  if (err instanceof ConflictException) {
    return { ok: false, statusCode: 409, error: err.message };
  }
  if (err instanceof UnprocessableEntityException) {
    return { ok: false, statusCode: 422, error: err.message };
  }
  const msg = err instanceof Error ? err.message : String(err);
  return { ok: false, statusCode: 500, error: msg };
}

/**
 * Executes HTTP-shaped calls from the gateway RabbitMQ RPC path (`action: apiInvoke`).
 *
 * **Contract:** this service must stay in lockstep with broker HTTP controllers—the
 * gateway has no second implementation. When adding a broker API, extend here too;
 * see `apps/broker/prompts/gateway-rpc-fanout.md` (checklist + optional exchange fan-out).
 */
@Injectable()
export class GatewayRpcInvokeService {
  private readonly logger = new Logger(GatewayRpcInvokeService.name);

  constructor(
    @InjectRepository(SpotPairEntity) private readonly pairRepo: Repository<SpotPairEntity>,
    @InjectRepository(SpotTokenEntity) private readonly tokenRepo: Repository<SpotTokenEntity>,
    @InjectRepository(LiquidityHistogramBucketEntity) private readonly histogramRepo: Repository<LiquidityHistogramBucketEntity>,
    @InjectRepository(VoterVotePositionEntity) private readonly votePositions: Repository<VoterVotePositionEntity>,
    private readonly spotCatalog: SpotCatalogService,
    private readonly swapGraph: SwapLiquidityGraphService,
    private readonly swapRouteSpotPairQuote: SwapRouteSpotPairQuoteService,
    private readonly spotGroups: SpotGroupsService,
    private readonly indexerPersistence: IndexerEventPersistenceService,
    private readonly brokerSwapHopQuery: BrokerSwapHopQueryService,
    private readonly dynamicSwapFeeReadModel: DynamicSwapFeeReadModelService,
    private readonly veLock: VeLockService,
    private readonly voting: VotingService,
    private readonly votingClaimable: VotingClaimableService,
    private readonly udfService: UdfService,
    private readonly adminLock: AdminLockService,
    private readonly adminVote: AdminVoteService,
  ) {}

  async handleRpcEnvelope(
    envelope: BrokerGatewayRpcRequestDto,
  ): Promise<BrokerGatewayRpcResponseDto> {
    if (envelope.action === 'ping') {
      return {
        ok: true,
        statusCode: 200,
        body: { ok: true, action: 'ping', message: 'broker alive' },
      };
    }
    if (envelope.action !== 'apiInvoke') {
      return {
        ok: false,
        statusCode: 400,
        error: `Unknown action: ${String(envelope.action)}`,
      };
    }
    return this.invokeHttpLike(envelope.request);
  }

  private async invokeHttpLike(
    request: BrokerGatewayHttpLikeRequest | undefined,
  ): Promise<BrokerGatewayRpcResponseDto> {
    if (!request || typeof request.method !== 'string' || !request.path) {
      return {
        ok: false,
        statusCode: 400,
        error: 'request.method and request.path are required',
      };
    }
    const method = request.method.trim().toUpperCase();
    const path = normalizeHttpPath(request.path);
    const query = request.query ?? {};
    const body = request.body;

    try {
      if (method === 'GET' && pathSegments(path).join('/') === 'health') {
        return {
          ok: true,
          statusCode: 200,
          body: { status: 'ok', service: 'giwater-broker' },
        };
      }

      if (method === 'GET' && pathSegments(path).join('/') === 'contracts') {
        return {
          ok: true,
          statusCode: 200,
          body: { contracts: CONTRACT_ADDRESSES },
        };
      }

      if (method === 'GET' && pathSegments(path)[0] === 'swap-routes') {
        const from = query.from;
        const to = query.to;
        const debug = query.debug;
        if (!from?.trim() || !to?.trim()) {
          return {
            ok: false,
            statusCode: 400,
            error: 'Query parameters `from` and `to` are required',
          };
        }
        const fromAddr = await this.swapGraph.resolveTokenQuery(from);
        const toAddr = await this.swapGraph.resolveTokenQuery(to);
        const hops = await this.swapGraph.findShortestRoute(fromAddr, toAddr);
        const amt = parseOptionalSwapRouteAmountInWei(query.amountIn);
        const swapRouteBody: Record<string, unknown> = {
          fromToken: fromAddr,
          toToken: toAddr,
          hops,
        };
        if (amt) {
          swapRouteBody.amountInWei = amt.asString;
          await this.swapRouteSpotPairQuote.enrichHopQuotesFromSpotPairs(
            hops,
            amt.wei,
          );
          const agg = await this.swapRouteSpotPairQuote.computeRouteAggregates(
            hops,
          );
          swapRouteBody.totalFeeUsd = agg.totalFeeUsd;
          swapRouteBody.averageFeeBps = agg.averageFeeBps;
          swapRouteBody.routePriceImpactPercent = agg.routePriceImpactPercent;

          // Parity with broker HTTP controller: include amountOutWei + exchangeRate when amountIn is set.
          const outWei =
            await this.swapRouteSpotPairQuote.quoteRouteAmountOutWeiFromSpotPairs(
              hops,
              amt.wei,
            );
          if (outWei > 0n) {
            swapRouteBody.amountOutWei = outWei.toString();
            const wantDebug =
              typeof debug === 'string' &&
              ['1', 'true', 'yes', 'y'].includes(debug.trim().toLowerCase());
            if (wantDebug && process.env.NODE_ENV !== 'production') {
              const dbg =
                await this.swapRouteSpotPairQuote.debugRouteQuoteFromSpotPairs(
                  hops,
                  amt.wei,
                );
              // eslint-disable-next-line no-console
              console.log('[swap-routes][debug][rpc] hop quote trace', {
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
            swapRouteBody.exchangeRate = rate;
          } else {
            swapRouteBody.amountOutWei = '0';
            swapRouteBody.exchangeRate = null;
          }
        }
        return {
          ok: true,
          statusCode: 200,
          body: swapRouteBody,
        };
      }

      if (method === 'GET' && pathSegments(path)[0] === 'indexed-events') {
        const offset = intQuery(query, 'offset', 0);
        const limit = Math.min(200, Math.max(1, intQuery(query, 'limit', 50)));
        return {
          ok: true,
          statusCode: 200,
          body: await this.indexerPersistence.getRecentIndexedEvents(offset, limit),
        };
      }

      const segSwap = pathSegments(path);
      if (
        method === 'GET' &&
        segSwap[0] === 'swaps' &&
        segSwap[1] === 'by-transaction' &&
        segSwap[2]
      ) {
        const txHash = segSwap[2]!;
        const account = query.account;
        if (!account?.trim()) {
          return {
            ok: false,
            statusCode: 400,
            error: 'Query parameter `account` is required',
          };
        }
        if (!/^0x[a-fA-F0-9]{64}$/i.test(txHash.trim())) {
          return {
            ok: false,
            statusCode: 400,
            error:
              'transactionHash must be 0x-prefixed 32-byte hex (66 characters)',
          };
        }
        if (!/^0x[a-fA-F0-9]{40}$/i.test(String(account).trim())) {
          return {
            ok: false,
            statusCode: 400,
            error: 'account must be 0x-prefixed 20-byte hex (42 characters)',
          };
        }
        return {
          ok: true,
          statusCode: 200,
          body: await this.brokerSwapHopQuery.listByTransactionAndAccount(
            txHash,
            String(account),
          ),
        };
      }

      const listedOnly = parseListedFromQueryRecord(
        query as Record<string, string | boolean | number | undefined>,
      );

      const seg = pathSegments(path);
      const a = seg[0];
      const b = seg[1];
      const c = seg[2];
      const d = seg[3];
      const e = seg[4];

      if (a === 'spot-tokens') {
        if (method === 'GET' && b === 'recently-created' && !c) {
          const offset = intQuery(query, 'offset', 0);
          const limit = intQuery(query, 'limit', 50);
          const listedRecent = parseListedFromQueryRecord(
            query as Record<string, string | boolean | number | undefined>,
            true,
          );
          return {
            ok: true,
            statusCode: 200,
            body: await this.spotCatalog.listTokensRecentlyCreated(
              offset,
              limit,
              listedRecent,
            ),
          };
        }
        if (method === 'GET' && b === 'by-address' && c) {
          const row = await this.spotCatalog.findTokenByAddress(c, listedOnly);
          if (!row) {
            return {
              ok: false,
              statusCode: 404,
              error: 'No spot_tokens row for this address',
            };
          }
          return { ok: true, statusCode: 200, body: row };
        }
        if (method === 'GET' && b === 'by-symbol' && c) {
          const items = await this.spotCatalog.findTokensBySymbol(c, listedOnly);
          if (items.length === 0) {
            return {
              ok: false,
              statusCode: 404,
              error: 'No spot_tokens rows for this symbol',
            };
          }
          return { ok: true, statusCode: 200, body: { items } };
        }
        if (method === 'GET' && b === 'leaderboard' && c && d && !e) {
          const offset = intQuery(query, 'offset', 0);
          const limit = intQuery(query, 'limit', 50);
          const sort = parseLeaderboardSortSegment(d);
          if (!sort) {
            return {
              ok: false,
              statusCode: 400,
              error: 'sort path segment must be asc or desc',
            };
          }
          const metric = c.trim().toLowerCase();
          if (metric === 'day-change') {
            return {
              ok: true,
              statusCode: 200,
              body: await this.spotCatalog.listTokensLeaderboardDayChange(
                offset,
                limit,
                listedOnly,
                sort,
              ),
            };
          }
          if (metric === 'tvl') {
            return {
              ok: true,
              statusCode: 200,
              body: await this.spotCatalog.listTokensLeaderboardTvl(
                offset,
                limit,
                listedOnly,
                sort,
              ),
            };
          }
          if (metric === 'volume') {
            return {
              ok: true,
              statusCode: 200,
              body: await this.spotCatalog.listTokensLeaderboardVolume(
                offset,
                limit,
                listedOnly,
                sort,
              ),
            };
          }
          return {
            ok: false,
            statusCode: 404,
            error: `Unknown token leaderboard metric: ${c}`,
          };
        }
        if (
          method === 'POST' &&
          b === 'by-address' &&
          c &&
          d === 'listing' &&
          !e
        ) {
          const nextListed = (body as SetSpotListedDto | undefined)?.listed;
          if (typeof nextListed !== 'boolean') {
            return {
              ok: false,
              statusCode: 400,
              error: 'body.listed must be a boolean',
            };
          }
          const row = await this.spotCatalog.setTokenListed(c, nextListed);
          return { ok: true, statusCode: 200, body: row };
        }
        return {
          ok: false,
          statusCode: 404,
          error: `No route for ${method} ${path} under spot-tokens`,
        };
      }

      if (a === 'spot-pairs') {
        if (method === 'GET' && b === 'recently-created' && !c) {
          const offset = intQuery(query, 'offset', 0);
          const limit = intQuery(query, 'limit', 50);
          const listedRecent = parseListedFromQueryRecord(
            query as Record<string, string | boolean | number | undefined>,
            true,
          );
          return {
            ok: true,
            statusCode: 200,
            body: await this.spotCatalog.listPairsRecentlyCreated(
              offset,
              limit,
              listedRecent,
            ),
          };
        }
        if (
          method === 'GET' &&
          b === 'by-address' &&
          c &&
          d === 'cl-dynamic-fee'
        ) {
          const poolAddress = c.trim();
          if (!poolAddress) {
            return {
              ok: false,
              statusCode: 400,
              error: 'Path segment pool address is required',
            };
          }
          const sender = query.sender?.trim();
          const body = await this.dynamicSwapFeeReadModel.getClReadModel(
            poolAddress,
            sender || undefined,
          );
          return { ok: true, statusCode: 200, body };
        }
        if (method === 'GET' && b === 'by-address' && c && !d) {
          const row = await this.spotCatalog.findPairByAddress(c, listedOnly);
          if (!row) {
            return {
              ok: false,
              statusCode: 404,
              error: 'No spot_pairs row for this address',
            };
          }
          return { ok: true, statusCode: 200, body: row };
        }
        if (method === 'GET' && b === 'by-symbol' && c) {
          const items = await this.spotCatalog.findPairsBySymbol(c, listedOnly);
          if (items.length === 0) {
            return {
              ok: false,
              statusCode: 404,
              error: 'No spot_pairs rows for this symbol',
            };
          }
          return { ok: true, statusCode: 200, body: { items } };
        }
        if (method === 'GET' && b === 'leaderboard' && c && d && !e) {
          const offset = intQuery(query, 'offset', 0);
          const limit = intQuery(query, 'limit', 50);
          const sort = parseLeaderboardSortSegment(d);
          if (!sort) {
            return {
              ok: false,
              statusCode: 400,
              error: 'sort path segment must be asc or desc',
            };
          }
          const metric = c.trim().toLowerCase();
          if (metric === 'day-change') {
            return {
              ok: true,
              statusCode: 200,
              body: await this.spotCatalog.listPairsLeaderboardDayChange(
                offset,
                limit,
                listedOnly,
                sort,
              ),
            };
          }
          if (metric === 'tvl') {
            return {
              ok: true,
              statusCode: 200,
              body: await this.spotCatalog.listPairsLeaderboardTvl(
                offset,
                limit,
                listedOnly,
                sort,
              ),
            };
          }
          if (metric === 'volume') {
            return {
              ok: true,
              statusCode: 200,
              body: await this.spotCatalog.listPairsLeaderboardVolume(
                offset,
                limit,
                listedOnly,
                sort,
              ),
            };
          }
          return {
            ok: false,
            statusCode: 404,
            error: `Unknown pair leaderboard metric: ${c}`,
          };
        }
        if (
          method === 'POST' &&
          b === 'by-address' &&
          c &&
          d === 'listing' &&
          !e
        ) {
          const nextListed = (body as SetSpotListedDto | undefined)?.listed;
          if (typeof nextListed !== 'boolean') {
            return {
              ok: false,
              statusCode: 400,
              error: 'body.listed must be a boolean',
            };
          }
          const row = await this.spotCatalog.setPairListed(c, nextListed);
          return { ok: true, statusCode: 200, body: row };
        }
        return {
          ok: false,
          statusCode: 404,
          error: `No route for ${method} ${path} under spot-pairs`,
        };
      }

      if (a === 'spot-token-groups') {
        if (method === 'POST' && seg.length === 1) {
          const row = await this.spotGroups.createGroup(body as CreateSpotGroupDto);
          return { ok: true, statusCode: 201, body: row };
        }
        if (method === 'POST' && b && c === 'tokens' && seg.length === 3) {
          const row = await this.spotGroups.addTokenToGroup(
            b,
            body as AddTokenToSpotGroupDto,
          );
          return { ok: true, statusCode: 200, body: row };
        }
        return {
          ok: false,
          statusCode: 404,
          error: `No route for ${method} ${path} under spot-token-groups`,
        };
      }

      if (a === 'spot-pair-groups') {
        if (method === 'POST' && seg.length === 1) {
          const row = await this.spotGroups.createGroup(body as CreateSpotGroupDto);
          return { ok: true, statusCode: 201, body: row };
        }
        if (method === 'POST' && b && c === 'pairs' && seg.length === 3) {
          const row = await this.spotGroups.addPairToGroup(
            b,
            body as AddPairToSpotGroupDto,
          );
          return { ok: true, statusCode: 200, body: row };
        }
        return {
          ok: false,
          statusCode: 404,
          error: `No route for ${method} ${path} under spot-pair-groups`,
        };
      }

      if (a === 'voting') {
        if (method === 'GET' && b === 'positions' && !c) {
          const owner = query.owner as string | undefined;
          if (!owner?.trim()) {
            return { ok: false, statusCode: 400, error: '`owner` query param required' };
          }
          return { ok: true, statusCode: 200, body: await this.voting.getPositionsByOwner(owner) };
        }
        if (method === 'GET' && b === 'events' && !c) {
          const owner = query.owner as string | undefined;
          if (!owner?.trim()) {
            return { ok: false, statusCode: 400, error: '`owner` query param required' };
          }
          return { ok: true, statusCode: 200, body: await this.voting.getVoteEventsByOwner(owner) };
        }
        if (method === 'GET' && b === 'claimable' && c) {
          return { ok: true, statusCode: 200, body: await this.votingClaimable.getClaimableByTokenId(c) };
        }
        if (method === 'GET' && b === 'claims' && !c) {
          const owner = query.owner as string | undefined;
          if (!owner?.trim()) {
            return { ok: false, statusCode: 400, error: '`owner` query param required' };
          }
          return { ok: true, statusCode: 200, body: await this.voting.getClaimsByOwner(owner) };
        }
        return { ok: false, statusCode: 404, error: `No route for ${method} ${path} under voting` };
      }

      if (a === 've-locks') {
        if (method === 'GET' && !b) {
          const owner = query.owner as string | undefined;
          if (!owner?.trim()) {
            return { ok: false, statusCode: 400, error: '`owner` query param required' };
          }
          return { ok: true, statusCode: 200, body: await this.veLock.getPositionsByOwner(owner) };
        }
        if (method === 'GET' && b === 'history' && !c) {
          const owner = query.owner as string | undefined;
          if (!owner?.trim()) {
            return { ok: false, statusCode: 400, error: '`owner` query param required' };
          }
          return { ok: true, statusCode: 200, body: await this.veLock.getEventsByOwner(owner) };
        }
        if (method === 'GET' && b && c === 'history') {
          return { ok: true, statusCode: 200, body: await this.veLock.getEventsByTokenId(b) };
        }
        if (method === 'GET' && b && !c) {
          const pos = await this.veLock.getPositionByTokenId(b);
          if (!pos) return { ok: false, statusCode: 404, error: 'tokenId not found' };
          return { ok: true, statusCode: 200, body: pos };
        }
        return { ok: false, statusCode: 404, error: `No route for ${method} ${path} under ve-locks` };
      }

      if (a === 'udf') {
        if (method === 'GET' && b === 'config') {
          return { ok: true, statusCode: 200, body: this.udfService.getConfig() };
        }
        if (method === 'GET' && b === 'time') {
          return { ok: true, statusCode: 200, body: this.udfService.getTime() };
        }
        if (method === 'GET' && b === 'symbols') {
          const symbol = query.symbol;
          if (!symbol?.trim()) {
            return { ok: false, statusCode: 400, error: 'symbol parameter is required' };
          }
          return { ok: true, statusCode: 200, body: await this.udfService.resolveSymbol(String(symbol).trim()) };
        }
        if (method === 'GET' && b === 'search') {
          const q = String(query.query ?? '');
          const type = String(query.type ?? '');
          const limit = parseInt(String(query.limit ?? '30'), 10) || 30;
          return { ok: true, statusCode: 200, body: await this.udfService.search(q, type, limit) };
        }
        if (method === 'GET' && b === 'history') {
          const symbol = query.symbol;
          const resolution = query.resolution;
          const from = query.from;
          const to = query.to;
          if (!symbol?.trim() || !resolution?.trim() || !from || !to) {
            return { ok: false, statusCode: 400, error: 'symbol, resolution, from, to are required' };
          }
          return {
            ok: true,
            statusCode: 200,
            body: await this.udfService.getHistory(
              String(symbol).trim(),
              String(resolution).trim(),
              Number(from),
              Number(to),
              query.countback ? Number(query.countback) : undefined,
            ),
          };
        }
        return { ok: false, statusCode: 404, error: `No UDF route: ${method} ${path}` };
      }

      if (a === 'admin' && b === 'lock') {
        if (method === 'GET' && c === 'stats') {
          return { ok: true, statusCode: 200, body: await this.adminLock.getStats(query.pool as string | undefined) };
        }
        if (method === 'GET' && c === 'events') {
          return {
            ok: true,
            statusCode: 200,
            body: await this.adminLock.getEvents(
              query.pool as string | undefined,
              intQuery(query, 'limit', 20),
              intQuery(query, 'offset', 0),
            ),
          };
        }
        if (method === 'GET' && c === 'by-epoch') {
          return {
            ok: true,
            statusCode: 200,
            body: await this.adminLock.getByEpoch(
              query.pool as string | undefined,
              intQuery(query, 'epochs', 8),
            ),
          };
        }
        return { ok: false, statusCode: 404, error: `No admin/lock route: ${method} ${path}` };
      }

      if (a === 'admin' && b === 'vote') {
        if (method === 'GET' && c === 'stats') {
          return { ok: true, statusCode: 200, body: await this.adminVote.getStats(query.pool as string | undefined) };
        }
        if (method === 'GET' && c === 'events') {
          return {
            ok: true,
            statusCode: 200,
            body: await this.adminVote.getEvents(
              query.pool as string | undefined,
              intQuery(query, 'limit', 20),
              intQuery(query, 'offset', 0),
            ),
          };
        }
        if (method === 'GET' && c === 'distribution') {
          const epochVal = query.epoch ? Number(query.epoch) : undefined;
          return { ok: true, statusCode: 200, body: await this.adminVote.getDistribution(epochVal) };
        }
        if (method === 'GET' && c === 'by-epoch') {
          return {
            ok: true,
            statusCode: 200,
            body: await this.adminVote.getByEpoch(
              query.pool as string | undefined,
              intQuery(query, 'epochs', 8),
            ),
          };
        }
        return { ok: false, statusCode: 404, error: `No admin/vote route: ${method} ${path}` };
      }

      // ── stats ──
      if (a === 'stats' && !b && method === 'GET') {
        const row = await this.pairRepo
          .createQueryBuilder('p')
          .select('COALESCE(SUM(COALESCE(p.dayBaseTvlUSD, 0) + COALESCE(p.dayQuoteTvlUSD, 0)), 0)', 'totalTvl')
          .addSelect('COALESCE(SUM(COALESCE(p.dayBaseVolumeUSD, 0) + COALESCE(p.dayQuoteVolumeUSD, 0)), 0)', 'totalVolume24h')
          .addSelect('COALESCE(SUM(COALESCE(p.daySwapFeesUsd, 0)), 0)', 'totalFees24h')
          .addSelect('COUNT(*) FILTER (WHERE p.listed = true)', 'poolCount')
          .getRawOne<{ totalTvl: string | number | null; totalVolume24h: string | number | null; totalFees24h: string | number | null; poolCount: string | number | null }>();
        const statsBody: GlobalStats = {
          totalTVL: String(row?.totalTvl ?? 0),
          totalVolume24h: String(row?.totalVolume24h ?? 0),
          totalVolume7d: '0',
          totalFees24h: String(row?.totalFees24h ?? 0),
          totalFees7d: '0',
          poolCount: Number(row?.poolCount ?? 0),
          updatedAt: new Date().toISOString(),
        };
        return { ok: true, statusCode: 200, body: statsBody };
      }

      // ── pools ──
      if (a === 'pools') {
        const mapPair = (row: SpotPairEntity): PoolStats => {
          const baseIsToken0 = row.base.trim().toLowerCase() === row.token0.trim().toLowerCase();
          const tvl = (row.dayBaseTvlUSD ?? 0) + (row.dayQuoteTvlUSD ?? 0);
          const volume24h = (row.dayBaseVolumeUSD ?? 0) + (row.dayQuoteVolumeUSD ?? 0);
          return {
            poolAddress: row.id,
            token0Address: row.token0,
            token1Address: row.token1,
            token0Symbol: baseIsToken0 ? row.baseSymbol : row.quoteSymbol,
            token1Symbol: baseIsToken0 ? row.quoteSymbol : row.baseSymbol,
            token0Decimals: baseIsToken0 ? row.bDecimal : row.qDecimal,
            token1Decimals: baseIsToken0 ? row.qDecimal : row.bDecimal,
            token0Name: baseIsToken0 ? row.baseName : row.quoteName,
            token1Name: baseIsToken0 ? row.quoteName : row.baseName,
            isStable: false,
            poolType: row.isConcentratedLiquidity ? 'cl' : 'basic',
            tickSpacing: null,
            tvl: String(tvl),
            reserve0: String(row.baseLiquidity ?? 0),
            reserve1: String(row.quoteLiquidity ?? 0),
            reserve0Usd: String(row.dayBaseTvlUSD ?? 0),
            reserve1Usd: String(row.dayQuoteTvlUSD ?? 0),
            volume24h: String(volume24h),
            volume7d: '0',
            fees24h: String(row.daySwapFeesUsd ?? 0),
            fees7d: '0',
            feesTotal: String(row.totalSwapFeesUsd ?? 0),
            txCount24h: 0,
            apr24h: '0',
            apr7d: '0',
            feeBps: row.effectiveFeeBps ?? undefined,
            feePercent: row.effectiveFeeBps != null ? String(row.effectiveFeeBps / 100) : undefined,
            gaugeAddress: null,
            hasGauge: false,
            isGaugeAlive: false,
            emissionApr: null,
            annualEmissionUsd: null,
            grade: 0,
            updatedAt: new Date().toISOString(),
          };
        };

        if (method === 'GET' && b === 'stats' && !c) {
          const sortByRaw = query.sortBy;
          const sortOrderRaw = query.sortOrder;
          const sv = (typeof sortByRaw === 'string' ? sortByRaw : 'tvl').toLowerCase();
          const sortBy = ['tvl', 'volume24h', 'fees24h', 'apr'].includes(sv) ? sv : 'tvl';
          const ord: 'ASC' | 'DESC' = sortOrderRaw === 'asc' ? 'ASC' : 'DESC';
          const sortExpr = sortBy === 'tvl' ? 'COALESCE(p.dayBaseTvlUSD, 0) + COALESCE(p.dayQuoteTvlUSD, 0)'
            : sortBy === 'volume24h' ? 'COALESCE(p.dayBaseVolumeUSD, 0) + COALESCE(p.dayQuoteVolumeUSD, 0)'
            : sortBy === 'fees24h' ? 'COALESCE(p.daySwapFeesUsd, 0)'
            : 'COALESCE(p.dayBaseVolumeUSD, 0) + COALESCE(p.dayQuoteVolumeUSD, 0)';
          const clampedLimit = Math.min(200, Math.max(1, intQuery(query, 'limit', 50)));
          const clampedOffset = Math.max(0, intQuery(query, 'offset', 0));
          const qb = this.pairRepo.createQueryBuilder('p')
            .where('p.listed = :listed', { listed: true })
            .addSelect(sortExpr, 'pool_sort_key')
            .orderBy('pool_sort_key', ord)
            .addOrderBy('p.id', 'ASC');
          const total = await qb.getCount();
          const rows = await qb.clone().skip(clampedOffset).take(clampedLimit).getMany();
          const poolsStatsBody: PoolsStatsResponse = {
            pools: rows.map(mapPair),
            pagination: { total, limit: clampedLimit, offset: clampedOffset },
          };
          return { ok: true, statusCode: 200, body: poolsStatsBody };
        }

        if (method === 'GET' && b && c === 'stats' && !d) {
          const row = await this.pairRepo.findOne({ where: { id: b.toLowerCase() } });
          if (!row) return { ok: false, statusCode: 404, error: 'No spot_pairs row for this address' };
          return { ok: true, statusCode: 200, body: mapPair(row) };
        }

        if (method === 'GET' && b && c === 'liquidity-distribution' && !d) {
          const pair = await this.pairRepo.findOne({ where: { id: b.toLowerCase() } });
          if (!pair) return { ok: false, statusCode: 404, error: 'No spot_pairs row for this address' };
          const buckets = await this.histogramRepo.createQueryBuilder('b')
            .where('b.poolId = :id', { id: b.toLowerCase() })
            .andWhere("b.bucketType = :bucketType", { bucketType: 'tick' })
            .orderBy('b.bucketStartTick', 'ASC')
            .getMany();
          const bars: LiquidityBar[] = buckets.map((bkt) => ({
            tickLower: bkt.bucketStartTick,
            tickUpper: bkt.bucketEndTick,
            liquidity: bkt.liquidityAmount,
            price: bkt.priceLower,
          }));
          const liqDistBody: LiquidityDistributionResponse = {
            currentTick: 0,
            currentPrice: pair.price ?? 0,
            tickSpacing: 1,
            bars,
          };
          return { ok: true, statusCode: 200, body: liqDistBody };
        }
      }

      // ── tokens ──
      if (a === 'tokens') {
        const toInfo = (row: SpotTokenEntity): TokenInfo => ({
          address: row.id,
          symbol: row.symbol,
          name: row.name,
          decimals: row.decimals,
          iconUrl: row.logoURI && row.logoURI.length > 0 ? row.logoURI : null,
        });
        const toPrice = (row: SpotTokenEntity): TokenPrice => ({
          address: row.id,
          symbol: row.symbol,
          priceUSD: String(row.priceUSD ?? 0),
          updatedAt: new Date().toISOString(),
        });

        if (method === 'GET' && b === 'prices' && !c) {
          const rows = await this.tokenRepo.createQueryBuilder('t')
            .where('t.listed = :listed', { listed: true })
            .orderBy('t.id', 'ASC')
            .getMany();
          const pricesBody: TokenPricesResponse = { tokens: rows.map(toPrice) };
          return { ok: true, statusCode: 200, body: pricesBody };
        }

        if (method === 'GET' && b === 'search' && !c) {
          const q = (typeof query.q === 'string' ? query.q : '').trim();
          if (!q) return { ok: true, statusCode: 200, body: { tokens: [], total: 0 } as TokenSearchResponse };
          const rows = await this.tokenRepo.createQueryBuilder('t')
            .where('t.listed = :listed', { listed: true })
            .andWhere('(t.symbol ILIKE :q OR t.name ILIKE :q)', { q: `%${q}%` })
            .orderBy('t.symbol', 'ASC')
            .limit(20)
            .getMany();
          const tokens = rows.map(toInfo);
          const searchBody: TokenSearchResponse = { tokens, total: tokens.length };
          return { ok: true, statusCode: 200, body: searchBody };
        }

        if (method === 'POST' && b === 'register' && !c) {
          const addr = typeof (body as { address?: unknown })?.address === 'string'
            ? (body as { address: string }).address.trim() : '';
          if (!addr) return { ok: false, statusCode: 400, error: 'body.address must be a non-empty string' };
          const row = await this.tokenRepo.findOne({ where: { id: addr.toLowerCase() } });
          const regBody: RegisterTokenResponse = row
            ? { success: true, token: toInfo(row) }
            : { success: false, error: 'Token not found in catalog. Index it first via amm-indexer.' };
          return { ok: true, statusCode: 200, body: regBody };
        }

        if (method === 'GET' && b && c === 'price' && !d) {
          const row = await this.tokenRepo.findOne({ where: { id: b.toLowerCase() } });
          if (!row || !row.listed) return { ok: false, statusCode: 404, error: 'No spot_tokens row for this address' };
          return { ok: true, statusCode: 200, body: toPrice(row) };
        }
      }

      // ── vote ──
      if (a === 'vote') {
        const EPOCH_ZERO_TS = 1700697600;
        const WEEK_SECONDS = 7 * 24 * 3600;
        const DAY_SECONDS = 24 * 3600;

        if (method === 'GET' && b === 'epoch' && c === 'current' && !d) {
          const now = Math.floor(Date.now() / 1000);
          const epochNumber = Math.floor((now - EPOCH_ZERO_TS) / WEEK_SECONDS);
          const startsTs = EPOCH_ZERO_TS + epochNumber * WEEK_SECONDS;
          const endsTs = startsTs + WEEK_SECONDS;
          const endsInSeconds = Math.max(0, endsTs - now);
          const votingWindowStartTs = endsTs - DAY_SECONDS;
          const isVotingOpen = now >= votingWindowStartTs && now < endsTs;
          const epochTimestampStr = String(startsTs);
          const totalRow = await this.votePositions.createQueryBuilder('v')
            .select('COALESCE(SUM(v.weight::numeric), 0)', 'totalWeight')
            .where('v."isActive" = :isActive', { isActive: true })
            .andWhere('v."epochTimestamp" = :epoch', { epoch: epochTimestampStr })
            .getRawOne<{ totalWeight: string | number | null }>();
          const epochBody: EpochInfo = {
            epochNumber,
            startsAt: new Date(startsTs * 1000).toISOString(),
            endsAt: new Date(endsTs * 1000).toISOString(),
            endsInSeconds,
            endsInDays: endsInSeconds / DAY_SECONDS,
            votingWindowStart: new Date(votingWindowStartTs * 1000).toISOString(),
            votingWindowEnd: new Date(endsTs * 1000).toISOString(),
            isVotingOpen,
            totalVotingPower: String(totalRow?.totalWeight ?? 0),
            totalFees: '0',
            totalIncentives: '0',
            totalRewards: '0',
          };
          return { ok: true, statusCode: 200, body: epochBody };
        }

        if (method === 'GET' && b === 'pools' && !c) {
          const clampedLimit = Math.min(200, Math.max(1, intQuery(query, 'limit', 50)));
          const clampedOffset = Math.max(0, intQuery(query, 'offset', 0));
          const search = (typeof query.search === 'string' ? query.search : '').trim();
          const weightRows = await this.votePositions.manager.query<{ pool: string; pool_weight: string }[]>(
            `SELECT pool, SUM(weight::numeric) AS pool_weight FROM voter_vote_positions WHERE "isActive" = true GROUP BY pool`,
          );
          const weightMap = new Map<string, bigint>();
          let globalWeight = BigInt(0);
          for (const r of weightRows) {
            const w = BigInt(r.pool_weight ?? '0');
            weightMap.set(r.pool.toLowerCase(), w);
            globalWeight += w;
          }
          const qb = this.pairRepo.createQueryBuilder('p')
            .where('p.listed = :listed', { listed: true });
          if (search) qb.andWhere('p.symbol ILIKE :q', { q: `%${search}%` });
          qb.addSelect('COALESCE(p.dayBaseTvlUSD, 0) + COALESCE(p.dayQuoteTvlUSD, 0)', 'pair_tvl_usd')
            .orderBy('pair_tvl_usd', 'DESC')
            .addOrderBy('p.id', 'ASC');
          const total = await qb.getCount();
          const rows = await qb.clone().skip(clampedOffset).take(clampedLimit).getMany();
          const pools: VotePoolInfo[] = rows.map((row) => {
            const baseIsToken0 = row.base.trim().toLowerCase() === row.token0.trim().toLowerCase();
            const voteWeight = weightMap.get(row.id.toLowerCase()) ?? BigInt(0);
            const voteShare = globalWeight === BigInt(0)
              ? '0' : String(Number((voteWeight * BigInt(10000)) / globalWeight) / 100);
            return {
              poolAddress: row.id,
              token0: { address: row.token0, symbol: baseIsToken0 ? row.baseSymbol : row.quoteSymbol, decimals: baseIsToken0 ? row.bDecimal : row.qDecimal },
              token1: { address: row.token1, symbol: baseIsToken0 ? row.quoteSymbol : row.baseSymbol, decimals: baseIsToken0 ? row.qDecimal : row.bDecimal },
              isStable: false,
              poolType: row.isConcentratedLiquidity ? 'cl' : 'basic',
              tickSpacing: null,
              feePercent: row.effectiveFeeBps != null ? String(row.effectiveFeeBps / 100) : '0',
              tvl: String((row.dayBaseTvlUSD ?? 0) + (row.dayQuoteTvlUSD ?? 0)),
              gaugeAddress: '',
              voteWeight: voteWeight.toString(),
              voteShare,
              fees7d: '0',
              incentives: '0',
              totalRewards: '0',
              vAPR: '0',
              emissionApr: '0',
            };
          });
          const votePoolsBody: VotePoolsResponse = { pools, pagination: { total, limit: clampedLimit, offset: clampedOffset } };
          return { ok: true, statusCode: 200, body: votePoolsBody };
        }
      }

      this.logger.debug(`apiInvoke: no route for ${method} ${path}`);
      return {
        ok: false,
        statusCode: 501,
        error: `No RPC handler for ${method} ${path}`,
      };
    } catch (err) {
      this.logger.warn(
        `apiInvoke error ${method} ${path}: ${err instanceof Error ? err.message : err}`,
      );
      return httpErrorToRpc(err);
    }
  }
}
