import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  Param,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type {
  BrokerGatewayHttpLikeRequest,
  BrokerGatewayRpcResponseDto,
  GetProtocolContractsResponseDto,
  SwapRouteResponseDto,
} from '@giwater/shared';
import {
  GetProtocolContractsResponseSwaggerDto,
  SwapRouteResponseSwaggerDto,
} from '@giwater/shared/nest/swagger';
import { GatewayRabbitmqService } from '../rabbitmq/gateway-rabbitmq.service';

@ApiTags('broker-parity')
@Controller()
export class BrokerHttpParityController {
  constructor(private readonly rabbit: GatewayRabbitmqService) {}

  private normalizeQuery(
    query: Record<string, unknown>,
  ): Record<string, string | undefined> {
    const out: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(query ?? {})) {
      if (v === undefined || v === null) continue;
      out[k] = String(v);
    }
    return out;
  }

  private async proxy(
    method: 'GET' | 'POST' | 'DELETE' | 'PUT',
    path: string,
    query: Record<string, unknown> = {},
    body: unknown = null,
  ): Promise<unknown> {
    const raw = (await this.rabbit.rpcToBroker({
      action: 'apiInvoke',
      request: {
        method,
        path,
        query: this.normalizeQuery(query),
        body,
      } satisfies BrokerGatewayHttpLikeRequest,
    })) as BrokerGatewayRpcResponseDto;

    if (!raw || typeof raw !== 'object' || typeof raw.ok !== 'boolean') {
      throw new HttpException('Invalid broker RPC response', 502);
    }
    if (!raw.ok) {
      throw new HttpException(raw, raw.statusCode ?? 500);
    }
    return raw.body;
  }

  @Get('health')
  @ApiOperation({ summary: 'Broker parity: GET /health' })
  async health(): Promise<unknown> {
    return this.proxy('GET', '/health');
  }

  @Get('contracts')
  @ApiOperation({
    summary: 'Broker parity: GET /contracts',
    description:
      'Static protocol contract map from `@giwater/shared` `CONTRACT_ADDRESSES` (same as main API `contracts` object; no token list).',
  })
  @ApiOkResponse({ type: GetProtocolContractsResponseSwaggerDto })
  async contracts(): Promise<GetProtocolContractsResponseDto> {
    const body = await this.proxy('GET', '/contracts');
    return body as GetProtocolContractsResponseDto;
  }

  @Get('swap-routes')
  @ApiOperation({
    summary: 'Broker parity: GET /swap-routes',
    description:
      'Same contract as broker `GET /swap-routes`: shortest hop path over indexed pools. ' +
      'Optional `amountIn` (wei string for the **from** token) enriches each hop with `priceImpactPercent` and `feeOnInputWei`.',
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
      'Optional: input amount as integer **wei** decimal string for the **from** token. When set, response includes `amountInWei` and per-hop `priceImpactPercent` / `feeOnInputWei`.',
    example: '1000000000000000000',
  })
  @ApiOkResponse({ type: SwapRouteResponseSwaggerDto })
  async swapRoutes(
    @Query() query: Record<string, unknown>,
  ): Promise<SwapRouteResponseDto> {
    const body = await this.proxy('GET', '/swap-routes', query);
    return body as SwapRouteResponseDto;
  }

  @Get('indexed-events')
  @ApiOperation({ summary: 'Broker parity: GET /indexed-events' })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'Number of rows to skip (default: 0)',
    example: 0,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Page size (default: 50, max: 200)',
    example: 50,
  })
  async indexedEvents(@Query() query: Record<string, unknown>): Promise<unknown> {
    return this.proxy('GET', '/indexed-events', query);
  }

  @Get('swaps/by-transaction/:transactionHash')
  @ApiOperation({
    summary: 'Broker parity: GET /swaps/by-transaction/:transactionHash',
    description:
      'Swap hops from broker `swap_hops` (materialized per Swap after OHLCV) for this tx where `account` is `sender` or `to`.',
  })
  @ApiParam({
    name: 'transactionHash',
    description: '32-byte transaction hash (0x + 64 hex)',
  })
  @ApiQuery({
    name: 'account',
    required: true,
    description: 'Wallet address (0x + 40 hex)',
  })
  async swapHopsByTransaction(
    @Param('transactionHash') transactionHash: string,
    @Query() query: Record<string, unknown>,
  ): Promise<unknown> {
    if (!transactionHash?.trim()) {
      throw new BadRequestException('transactionHash is required');
    }
    const path = `/swaps/by-transaction/${encodeURIComponent(transactionHash.trim())}`;
    return this.proxy('GET', path, query);
  }

  @Get('admin/pool/:address/time-buckets')
  @ApiOperation({
    summary: 'Broker parity: GET /admin/pool/:address/time-buckets',
    description:
      'Lists OHLCV-style time buckets from broker `spot_pair_time_buckets` for an admin pool page.',
  })
  @ApiParam({ name: 'address', description: 'Pool contract address' })
  @ApiQuery({
    name: 'resolution',
    required: true,
    description: 'Bucket resolution (e.g. 5m, 1h, 1d, 1w, 1M)',
    example: '1h',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Max buckets to return (default 200, max 2000)',
    example: 400,
  })
  async adminPoolTimeBuckets(
    @Param('address') address: string,
    @Query() query: Record<string, unknown>,
  ): Promise<unknown> {
    if (!address?.trim()) throw new BadRequestException('address is required');
    return this.proxy('GET', `/admin/pool/${address}/time-buckets`, query);
  }

  @Get('admin/exchange/:protocolId/time-buckets')
  @ApiOperation({
    summary: 'Broker parity: GET /admin/exchange/:protocolId/time-buckets',
    description:
      'Lists exchange-wide time buckets from broker `spot_exchange_time_buckets` (includes volume, TVL, and fee buckets when available).',
  })
  @ApiParam({ name: 'protocolId', description: 'Exchange/protocol id (e.g. giwater)' })
  @ApiQuery({
    name: 'resolution',
    required: true,
    description: 'Bucket resolution (e.g. 1d, 1w, 1mo)',
    example: '1d',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Max buckets to return (default 90, max 2000)',
    example: 90,
  })
  async adminExchangeTimeBuckets(
    @Param('protocolId') protocolId: string,
    @Query() query: Record<string, unknown>,
  ): Promise<unknown> {
    if (!protocolId?.trim()) throw new BadRequestException('protocolId is required');
    return this.proxy(
      'GET',
      `/admin/exchange/${encodeURIComponent(protocolId)}/time-buckets`,
      query,
    );
  }

  @Get('admin/events')
  @ApiOperation({ summary: 'Broker parity: GET /admin/events' })
  async adminEvents(@Query() query: Record<string, unknown>): Promise<unknown> {
    return this.proxy('GET', '/admin/events', query);
  }

  @Get('referral/code/:address')
  @ApiOperation({ summary: 'Broker parity: GET /referral/code/:address' })
  async referralCode(@Param('address') address: string): Promise<unknown> {
    return this.proxy('GET', `/referral/code/${encodeURIComponent(address)}`, {});
  }

  @Post('referral/claim')
  @ApiOperation({ summary: 'Broker parity: POST /referral/claim' })
  async referralClaim(@Body() body: unknown): Promise<unknown> {
    return this.proxy('POST', '/referral/claim', {}, body);
  }

  @Get('admin/referral/overview')
  @ApiOperation({ summary: 'Broker parity: GET /admin/referral/overview' })
  async adminReferralOverview(): Promise<unknown> {
    return this.proxy('GET', '/admin/referral/overview', {});
  }

  @Get('admin/referral/list')
  @ApiOperation({ summary: 'Broker parity: GET /admin/referral/list' })
  async adminReferralList(@Query() query: Record<string, string>): Promise<unknown> {
    return this.proxy('GET', '/admin/referral/list', query);
  }

  @Get('admin/referral/detail/:address')
  @ApiOperation({ summary: 'Broker parity: GET /admin/referral/detail/:address' })
  async adminReferralDetail(@Param('address') address: string): Promise<unknown> {
    return this.proxy('GET', `/admin/referral/detail/${encodeURIComponent(address)}`, {});
  }

  @Put('admin/referral/tier/:address')
  @ApiOperation({ summary: 'Broker parity: PUT /admin/referral/tier/:address' })
  async adminReferralUpdateTier(
    @Param('address') address: string,
    @Body() body: unknown,
  ): Promise<unknown> {
    return this.proxy('PUT', `/admin/referral/tier/${encodeURIComponent(address)}`, {}, body);
  }

  @Post('admin/referral/provision')
  @ApiOperation({ summary: 'Broker parity: POST /admin/referral/provision' })
  async adminReferralProvision(@Body() body: unknown): Promise<unknown> {
    return this.proxy('POST', '/admin/referral/provision', {}, body);
  }

  @Get('admin/faucet')
  @ApiOperation({ summary: 'Broker parity: GET /admin/faucet' })
  async adminFaucetList(): Promise<unknown> {
    return this.proxy('GET', '/admin/faucet', {});
  }

  @Post('admin/faucet')
  @ApiOperation({ summary: 'Broker parity: POST /admin/faucet' })
  async adminFaucetRegister(@Body() body: unknown): Promise<unknown> {
    return this.proxy('POST', '/admin/faucet', {}, body);
  }

  @Delete('admin/faucet/:address')
  @ApiOperation({ summary: 'Broker parity: DELETE /admin/faucet/:address' })
  async adminFaucetDelete(@Param('address') address: string): Promise<unknown> {
    return this.proxy('DELETE', `/admin/faucet/${encodeURIComponent(address)}`, {});
  }

  @Get('admin/lock/stats')
  @ApiOperation({ summary: 'Broker parity: GET /admin/lock/stats' })
  @ApiQuery({ name: 'pool', required: false })
  async adminLockStats(@Query() query: Record<string, unknown>): Promise<unknown> {
    return this.proxy('GET', '/admin/lock/stats', query);
  }

  @Get('admin/lock/events')
  @ApiOperation({ summary: 'Broker parity: GET /admin/lock/events' })
  @ApiQuery({ name: 'pool', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  async adminLockEvents(@Query() query: Record<string, unknown>): Promise<unknown> {
    return this.proxy('GET', '/admin/lock/events', query);
  }

  @Get('admin/lock/by-epoch')
  @ApiOperation({ summary: 'Broker parity: GET /admin/lock/by-epoch' })
  @ApiQuery({ name: 'pool', required: false })
  @ApiQuery({ name: 'epochs', required: false })
  async adminLockByEpoch(@Query() query: Record<string, unknown>): Promise<unknown> {
    return this.proxy('GET', '/admin/lock/by-epoch', query);
  }

  @Get('admin/vote/stats')
  @ApiOperation({ summary: 'Broker parity: GET /admin/vote/stats' })
  @ApiQuery({ name: 'pool', required: false })
  async adminVoteStats(@Query() query: Record<string, unknown>): Promise<unknown> {
    return this.proxy('GET', '/admin/vote/stats', query);
  }

  @Get('admin/vote/events')
  @ApiOperation({ summary: 'Broker parity: GET /admin/vote/events' })
  @ApiQuery({ name: 'pool', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  async adminVoteEvents(@Query() query: Record<string, unknown>): Promise<unknown> {
    return this.proxy('GET', '/admin/vote/events', query);
  }

  @Get('admin/vote/distribution')
  @ApiOperation({ summary: 'Broker parity: GET /admin/vote/distribution' })
  @ApiQuery({ name: 'epoch', required: false })
  async adminVoteDistribution(@Query() query: Record<string, unknown>): Promise<unknown> {
    return this.proxy('GET', '/admin/vote/distribution', query);
  }

  @Get('admin/vote/by-epoch')
  @ApiOperation({ summary: 'Broker parity: GET /admin/vote/by-epoch' })
  @ApiQuery({ name: 'pool', required: false })
  @ApiQuery({ name: 'epochs', required: false })
  async adminVoteByEpoch(@Query() query: Record<string, unknown>): Promise<unknown> {
    return this.proxy('GET', '/admin/vote/by-epoch', query);
  }

  @Post('spot-token-groups')
  @ApiOperation({ summary: 'Broker parity: POST /spot-token-groups' })
  async createSpotTokenGroup(
    @Body() body: unknown,
  ): Promise<unknown> {
    return this.proxy('POST', '/spot-token-groups', {}, body);
  }

  @Post('spot-token-groups/:groupId/tokens')
  @ApiOperation({ summary: 'Broker parity: POST /spot-token-groups/:groupId/tokens' })
  async addTokenToSpotGroup(
    @Param('groupId') groupId: string,
    @Body() body: unknown,
  ): Promise<unknown> {
    return this.proxy(
      'POST',
      `/spot-token-groups/${encodeURIComponent(groupId)}/tokens`,
      {},
      body,
    );
  }

  @Get('spot-token-groups/:groupId/tokens')
  @ApiOperation({ summary: 'Broker parity: GET /spot-token-groups/:groupId/tokens' })
  async listSpotGroupTokens(
    @Param('groupId') groupId: string,
    @Query() query: Record<string, unknown>,
  ): Promise<unknown> {
    return this.proxy(
      'GET',
      `/spot-token-groups/${encodeURIComponent(groupId)}/tokens`,
      query,
    );
  }

  @Delete('spot-token-groups/:groupId/tokens/:tokenAddress')
  @ApiOperation({
    summary:
      'Broker parity: DELETE /spot-token-groups/:groupId/tokens/:tokenAddress',
  })
  async removeTokenFromSpotGroup(
    @Param('groupId') groupId: string,
    @Param('tokenAddress') tokenAddress: string,
  ): Promise<unknown> {
    return this.proxy(
      'DELETE',
      `/spot-token-groups/${encodeURIComponent(groupId)}/tokens/${tokenAddress}`,
    );
  }

  @Get('spot-pair-groups/:groupId/pairs')
  @ApiOperation({ summary: 'Broker parity: GET /spot-pair-groups/:groupId/pairs' })
  async listSpotPairGroupPairs(
    @Param('groupId') groupId: string,
    @Query() query: Record<string, unknown>,
  ): Promise<unknown> {
    return this.proxy(
      'GET',
      `/spot-pair-groups/${encodeURIComponent(groupId)}/pairs`,
      query,
    );
  }

  @Get('spot-token-groups/:groupId/leaderboard/:metric/:sort')
  @ApiOperation({
    summary:
      'Broker parity: GET /spot-token-groups/:groupId/leaderboard/:metric/:sort',
  })
  async tokenGroupLeaderboard(
    @Param('groupId') groupId: string,
    @Param('metric') metric: string,
    @Param('sort') sort: string,
    @Query() query: Record<string, unknown>,
  ): Promise<unknown> {
    return this.proxy(
      'GET',
      `/spot-token-groups/${encodeURIComponent(groupId)}/leaderboard/${metric}/${sort}`,
      query,
    );
  }

  @Get('spot-pair-groups/:groupId/leaderboard/:metric/:sort')
  @ApiOperation({
    summary:
      'Broker parity: GET /spot-pair-groups/:groupId/leaderboard/:metric/:sort',
  })
  async pairGroupLeaderboard(
    @Param('groupId') groupId: string,
    @Param('metric') metric: string,
    @Param('sort') sort: string,
    @Query() query: Record<string, unknown>,
  ): Promise<unknown> {
    return this.proxy(
      'GET',
      `/spot-pair-groups/${encodeURIComponent(groupId)}/leaderboard/${metric}/${sort}`,
      query,
    );
  }

  @Get('spot-tokens/by-address/:address')
  @ApiOperation({ summary: 'Broker parity: GET /spot-tokens/by-address/:address' })
  @ApiParam({
    name: 'address',
    description: 'Token contract address (0x-prefixed hex)',
    example: '0x0000000000000000000000000000000000000000',
  })
  @ApiQuery({
    name: 'listed',
    required: false,
    type: Boolean,
    description:
      'When true (default), only return the row if `listed === true`. When false, only if `listed === false`.',
    example: true,
  })
  async tokenByAddress(@Param('address') address: string): Promise<unknown> {
    if (!address?.trim()) throw new BadRequestException('address is required');
    return this.proxy('GET', `/spot-tokens/by-address/${address}`);
  }

  @Get('spot-tokens/by-symbol/:symbol')
  @ApiOperation({ summary: 'Broker parity: GET /spot-tokens/by-symbol/:symbol' })
  @ApiParam({
    name: 'symbol',
    description: 'Token symbol as stored on the row',
    example: 'WETH',
  })
  @ApiQuery({
    name: 'listed',
    required: false,
    type: Boolean,
    description:
      'When true (default), only rows with `listed === true`. When false, only `listed === false`.',
    example: true,
  })
  async tokenBySymbol(@Param('symbol') symbol: string): Promise<unknown> {
    if (!symbol?.trim()) throw new BadRequestException('symbol is required');
    return this.proxy('GET', `/spot-tokens/by-symbol/${encodeURIComponent(symbol)}`);
  }

  @Get('spot-tokens/leaderboard/:metric/:sort')
  @ApiOperation({
    summary: 'Broker parity: GET /spot-tokens/leaderboard/:metric/:sort',
  })
  @ApiParam({
    name: 'metric',
    enum: ['day-change', 'tvl', 'volume'],
    description: '`day-change` — UTC day % move; `tvl` / `volume` — day aggregates on row.',
  })
  @ApiParam({ name: 'sort', enum: ['asc', 'desc'] })
  @ApiQuery({ name: 'offset', required: false, type: Number, example: 0 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  @ApiQuery({
    name: 'listed',
    required: false,
    type: Boolean,
    description:
      'When true (default), only rows with `listed === true`. When false, only `listed === false`.',
    example: true,
  })
  async tokenLeaderboard(
    @Param('metric') metric: string,
    @Param('sort') sort: string,
    @Query() query: Record<string, unknown>,
  ): Promise<unknown> {
    const m = metric?.trim().toLowerCase();
    if (m !== 'day-change' && m !== 'tvl' && m !== 'volume') {
      throw new BadRequestException(
        'metric must be day-change, tvl, or volume',
      );
    }
    const s = sort?.trim().toLowerCase();
    if (s !== 'asc' && s !== 'desc') {
      throw new BadRequestException('sort must be asc or desc');
    }
    return this.proxy('GET', `/spot-tokens/leaderboard/${m}/${s}`, query);
  }

  @Get('spot-pairs/by-address/:address')
  @ApiOperation({ summary: 'Broker parity: GET /spot-pairs/by-address/:address' })
  @ApiParam({
    name: 'address',
    description: 'Pair (pool) contract address',
    example: '0x0000000000000000000000000000000000000000',
  })
  @ApiQuery({
    name: 'listed',
    required: false,
    type: Boolean,
    description:
      'When true (default), only return the row if `listed === true`. When false, only if `listed === false`.',
    example: true,
  })
  async pairByAddress(@Param('address') address: string): Promise<unknown> {
    return this.proxy('GET', `/spot-pairs/by-address/${address}`);
  }

  @Get('spot-pairs/by-symbol/:symbol')
  @ApiOperation({ summary: 'Broker parity: GET /spot-pairs/by-symbol/:symbol' })
  @ApiParam({
    name: 'symbol',
    description: 'Pair symbol as stored on the row',
    example: 'WETH/USDC',
  })
  @ApiQuery({
    name: 'listed',
    required: false,
    type: Boolean,
    description:
      'When true (default), only rows with `listed === true`. When false, only `listed === false`.',
    example: true,
  })
  async pairBySymbol(@Param('symbol') symbol: string): Promise<unknown> {
    return this.proxy('GET', `/spot-pairs/by-symbol/${encodeURIComponent(symbol)}`);
  }

  @Get('spot-pairs/leaderboard/:metric/:sort')
  @ApiOperation({
    summary: 'Broker parity: GET /spot-pairs/leaderboard/:metric/:sort',
  })
  @ApiParam({
    name: 'metric',
    enum: ['day-change', 'tvl', 'volume'],
    description: '`day-change` — UTC day % move; `tvl` / `volume` — summed USD day columns on pair row.',
  })
  @ApiParam({ name: 'sort', enum: ['asc', 'desc'] })
  @ApiQuery({ name: 'offset', required: false, type: Number, example: 0 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  @ApiQuery({
    name: 'listed',
    required: false,
    type: Boolean,
    description:
      'When true (default), only rows with `listed === true`. When false, only `listed === false`.',
    example: true,
  })
  async pairLeaderboard(
    @Param('metric') metric: string,
    @Param('sort') sort: string,
    @Query() query: Record<string, unknown>,
  ): Promise<unknown> {
    const m = metric?.trim().toLowerCase();
    if (m !== 'day-change' && m !== 'tvl' && m !== 'volume') {
      throw new BadRequestException(
        'metric must be day-change, tvl, or volume',
      );
    }
    const s = sort?.trim().toLowerCase();
    if (s !== 'asc' && s !== 'desc') {
      throw new BadRequestException('sort must be asc or desc');
    }
    return this.proxy('GET', `/spot-pairs/leaderboard/${m}/${s}`, query);
  }

  @Get('spot-tokens/recently-created')
  @ApiOperation({
    summary: 'Broker parity: GET /spot-tokens/recently-created',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'Rows to skip (default 0)',
    example: 0,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Rows to return (default 50)',
    example: 50,
  })
  @ApiQuery({
    name: 'listed',
    required: false,
    type: Boolean,
    description:
      'When true (default), listed tokens only. When false, unlisted / curation queue.',
    example: true,
  })
  async recentlyCreatedTokens(
    @Query() query: Record<string, unknown>,
  ): Promise<unknown> {
    return this.proxy('GET', '/spot-tokens/recently-created', query);
  }

  @Get('spot-pairs/recently-created')
  @ApiOperation({ summary: 'Broker parity: GET /spot-pairs/recently-created' })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'Rows to skip (default 0)',
    example: 0,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Rows to return (default 50)',
    example: 50,
  })
  @ApiQuery({
    name: 'listed',
    required: false,
    type: Boolean,
    description:
      'When true (default), broker returns only listed pairs. When false, unlisted curation queue.',
    example: true,
  })
  async recentlyCreatedPairs(
    @Query() query: Record<string, unknown>,
  ): Promise<unknown> {
    return this.proxy('GET', '/spot-pairs/recently-created', query);
  }

  @Get('spot-pairs/by-address/:address/cl-dynamic-fee')
  @ApiOperation({
    summary:
      'Broker parity: GET /spot-pairs/by-address/:address/cl-dynamic-fee',
  })
  @ApiParam({
    name: 'address',
    description: 'Pool contract address',
    example: '0x0000000000000000000000000000000000000000',
  })
  @ApiQuery({
    name: 'sender',
    required: false,
    description: 'Optional wallet address to include sender discount data',
    example: '0x0000000000000000000000000000000000000000',
  })
  async clDynamicFee(
    @Param('address') address: string,
    @Query() query: Record<string, unknown>,
  ): Promise<unknown> {
    return this.proxy(
      'GET',
      `/spot-pairs/by-address/${address}/cl-dynamic-fee`,
      query,
    );
  }

  @Get('portfolio/:walletAddress/lp-positions')
  @ApiOperation({ summary: 'LP positions for a wallet (from broker add-liquidity events)' })
  @ApiParam({ name: 'walletAddress' })
  async getWalletLpPositions(
    @Param('walletAddress') walletAddress: string,
  ): Promise<unknown> {
    if (!walletAddress?.trim()) {
      throw new BadRequestException('walletAddress is required');
    }
    return this.proxy('GET', `/accounts/${encodeURIComponent(walletAddress.trim())}/lp-positions`);
  }

  @Get('portfolio/:walletAddress/stake-positions')
  @ApiOperation({ summary: 'Gauge staking positions for a wallet (from broker Deposit/Withdraw events)' })
  @ApiParam({ name: 'walletAddress' })
  async getWalletStakePositions(
    @Param('walletAddress') walletAddress: string,
  ): Promise<unknown> {
    if (!walletAddress?.trim()) {
      throw new BadRequestException('walletAddress is required');
    }
    return this.proxy('GET', `/accounts/${encodeURIComponent(walletAddress.trim())}/stake-positions`);
  }

  @Get('portfolio/:walletAddress/ve-locks')
  @ApiOperation({ summary: 'Active veNFT lock positions for a wallet' })
  @ApiParam({ name: 'walletAddress' })
  async getVeLocks(@Param('walletAddress') walletAddress: string): Promise<unknown> {
    if (!walletAddress?.trim()) throw new BadRequestException('walletAddress is required');
    return this.proxy('GET', '/ve-locks', { owner: walletAddress.trim() });
  }

  @Get('portfolio/:walletAddress/ve-locks/history')
  @ApiOperation({ summary: 'veNFT lock event history for a wallet' })
  @ApiParam({ name: 'walletAddress' })
  async getVeLocksHistory(@Param('walletAddress') walletAddress: string): Promise<unknown> {
    if (!walletAddress?.trim()) throw new BadRequestException('walletAddress is required');
    return this.proxy('GET', '/ve-locks/history', { owner: walletAddress.trim() });
  }

  @Get('portfolio/:walletAddress/ve-locks/:tokenId/history')
  @ApiOperation({ summary: 'Event history for a single veNFT tokenId' })
  @ApiParam({ name: 'walletAddress' })
  @ApiParam({ name: 'tokenId' })
  async getVeLockTokenHistory(
    @Param('walletAddress') walletAddress: string,
    @Param('tokenId') tokenId: string,
  ): Promise<unknown> {
    if (!walletAddress?.trim()) throw new BadRequestException('walletAddress is required');
    if (!tokenId?.trim()) throw new BadRequestException('tokenId is required');
    return this.proxy('GET', `/ve-locks/${encodeURIComponent(tokenId.trim())}/history`);
  }

  @Get('portfolio/:walletAddress/ve-locks/:tokenId')
  @ApiOperation({ summary: 'Single veNFT lock position by tokenId' })
  @ApiParam({ name: 'walletAddress' })
  @ApiParam({ name: 'tokenId' })
  async getVeLockByTokenId(
    @Param('walletAddress') walletAddress: string,
    @Param('tokenId') tokenId: string,
  ): Promise<unknown> {
    if (!walletAddress?.trim()) throw new BadRequestException('walletAddress is required');
    if (!tokenId?.trim()) throw new BadRequestException('tokenId is required');
    return this.proxy('GET', `/ve-locks/${encodeURIComponent(tokenId.trim())}`);
  }

  @Get('portfolio/:walletAddress/vote-positions')
  @ApiOperation({ summary: 'Active veNFT vote allocations for a wallet' })
  @ApiParam({ name: 'walletAddress' })
  async getVotePositions(@Param('walletAddress') walletAddress: string): Promise<unknown> {
    if (!walletAddress?.trim()) throw new BadRequestException('walletAddress is required');
    return this.proxy('GET', '/voting/positions', { owner: walletAddress.trim() });
  }

  @Get('portfolio/:walletAddress/vote-events')
  @ApiOperation({ summary: 'Voted/Abstained event history for a wallet' })
  @ApiParam({ name: 'walletAddress' })
  async getVoteEvents(@Param('walletAddress') walletAddress: string): Promise<unknown> {
    if (!walletAddress?.trim()) throw new BadRequestException('walletAddress is required');
    return this.proxy('GET', '/voting/events', { owner: walletAddress.trim() });
  }

  @Get('portfolio/:walletAddress/vote-claimable/:tokenId')
  @ApiOperation({ summary: 'Live on-chain fee and bribe claimable amounts for a veNFT tokenId' })
  @ApiParam({ name: 'walletAddress' })
  @ApiParam({ name: 'tokenId', description: 'veNFT tokenId as decimal integer string' })
  async getVoteClaimable(
    @Param('walletAddress') walletAddress: string,
    @Param('tokenId') tokenId: string,
  ): Promise<unknown> {
    if (!walletAddress?.trim()) throw new BadRequestException('walletAddress is required');
    if (!tokenId?.trim()) throw new BadRequestException('tokenId is required');
    return this.proxy('GET', `/voting/claimable/${encodeURIComponent(tokenId.trim())}`);
  }

  @Get('portfolio/:walletAddress/reward-claims')
  @ApiOperation({ summary: 'Fee and bribe reward claim history for a wallet' })
  @ApiParam({ name: 'walletAddress' })
  async getRewardClaims(@Param('walletAddress') walletAddress: string): Promise<unknown> {
    if (!walletAddress?.trim()) throw new BadRequestException('walletAddress is required');
    return this.proxy('GET', '/voting/claims', { owner: walletAddress.trim() });
  }

  @Get('banners/:page')
  @ApiOperation({ summary: 'Broker parity: GET /banners/:page — active banners for a page' })
  @ApiParam({ name: 'page', description: 'Page key (SWAP, LIQUIDITY, LOCK, PORTFOLIO)' })
  async activeBanners(@Param('page') page: string): Promise<unknown> {
    return this.proxy('GET', `/banners/${encodeURIComponent(page)}`);
  }

  @Post('banners/:id/impression')
  @ApiOperation({ summary: 'Broker parity: POST /banners/:id/impression' })
  @ApiParam({ name: 'id', type: Number })
  async recordBannerImpression(@Param('id') id: string): Promise<unknown> {
    return this.proxy('POST', `/banners/${encodeURIComponent(id)}/impression`);
  }

  @Post('banners/:id/click')
  @ApiOperation({ summary: 'Broker parity: POST /banners/:id/click' })
  @ApiParam({ name: 'id', type: Number })
  async recordBannerClick(@Param('id') id: string): Promise<unknown> {
    return this.proxy('POST', `/banners/${encodeURIComponent(id)}/click`);
  }

  @Get('udf/config')
  @ApiOperation({ summary: 'Broker parity: GET /udf/config' })
  async udfConfig(): Promise<unknown> {
    return this.proxy('GET', '/udf/config');
  }

  @Get('udf/time')
  @ApiOperation({ summary: 'Broker parity: GET /udf/time — plain integer response' })
  async udfTime(@Res() res: Response): Promise<void> {
    const body = await this.proxy('GET', '/udf/time');
    res.send(String(body));
  }

  @Get('udf/symbols')
  @ApiOperation({ summary: 'Broker parity: GET /udf/symbols' })
  @ApiQuery({ name: 'symbol', required: true, description: 'Ticker: PAIR:0x... or TOKEN:0x...' })
  async udfSymbols(@Query() query: Record<string, unknown>): Promise<unknown> {
    return this.proxy('GET', '/udf/symbols', query);
  }

  @Get('udf/search')
  @ApiOperation({ summary: 'Broker parity: GET /udf/search' })
  @ApiQuery({ name: 'query', required: false })
  @ApiQuery({ name: 'type', required: true, enum: ['pair', 'token'] })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async udfSearch(@Query() query: Record<string, unknown>): Promise<unknown> {
    return this.proxy('GET', '/udf/search', query);
  }

  @Get('udf/history')
  @ApiOperation({ summary: 'Broker parity: GET /udf/history' })
  @ApiQuery({ name: 'symbol', required: true })
  @ApiQuery({ name: 'resolution', required: true })
  @ApiQuery({ name: 'from', required: true, type: Number })
  @ApiQuery({ name: 'to', required: true, type: Number })
  @ApiQuery({ name: 'countback', required: false, type: Number })
  async udfHistory(@Query() query: Record<string, unknown>): Promise<unknown> {
    return this.proxy('GET', '/udf/history', query);
  }

  // ── Indexer parity ──

  @Get('stats')
  @ApiOperation({ summary: 'Broker parity: GET /stats' })
  async stats(): Promise<unknown> {
    return this.proxy('GET', '/stats');
  }

  @Get('pools/stats')
  @ApiOperation({ summary: 'Broker parity: GET /pools/stats' })
  async poolsStats(@Query() query: Record<string, unknown>): Promise<unknown> {
    return this.proxy('GET', '/pools/stats', query);
  }

  @Get('pools/:address/stats')
  @ApiOperation({ summary: 'Broker parity: GET /pools/:address/stats' })
  @ApiParam({ name: 'address', description: 'Pool contract address' })
  async poolStats(@Param('address') address: string): Promise<unknown> {
    return this.proxy('GET', `/pools/${encodeURIComponent(address)}/stats`);
  }

  @Get('pools/:address/liquidity-distribution')
  @ApiOperation({ summary: 'Broker parity: GET /pools/:address/liquidity-distribution' })
  @ApiParam({ name: 'address', description: 'Pool contract address' })
  async liquidityDistribution(@Param('address') address: string): Promise<unknown> {
    return this.proxy(
      'GET',
      `/pools/${encodeURIComponent(address)}/liquidity-distribution`,
    );
  }

  @Get('tokens/prices')
  @ApiOperation({ summary: 'Broker parity: GET /tokens/prices' })
  async tokenPrices(): Promise<unknown> {
    return this.proxy('GET', '/tokens/prices');
  }

  @Get('tokens/search')
  @ApiOperation({ summary: 'Broker parity: GET /tokens/search' })
  @ApiQuery({ name: 'q', required: true })
  async tokenSearch(@Query() query: Record<string, unknown>): Promise<unknown> {
    return this.proxy('GET', '/tokens/search', query);
  }

  @Get('tokens/:address/price')
  @ApiOperation({ summary: 'Broker parity: GET /tokens/:address/price' })
  @ApiParam({ name: 'address', description: 'Token contract address' })
  async tokenPrice(@Param('address') address: string): Promise<unknown> {
    return this.proxy('GET', `/tokens/${encodeURIComponent(address)}/price`);
  }

  @Post('tokens/register')
  @ApiOperation({ summary: 'Broker parity: POST /tokens/register' })
  async registerToken(@Body() body: unknown): Promise<unknown> {
    return this.proxy('POST', '/tokens/register', {}, body);
  }

  @Get('vote/epoch/current')
  @ApiOperation({ summary: 'Broker parity: GET /vote/epoch/current' })
  async voteEpochCurrent(): Promise<unknown> {
    return this.proxy('GET', '/vote/epoch/current');
  }

  @Get('vote/pools')
  @ApiOperation({ summary: 'Broker parity: GET /vote/pools' })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['rewards', 'votes', 'fees', 'tvl'] })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async votePools(@Query() query: Record<string, unknown>): Promise<unknown> {
    return this.proxy('GET', '/vote/pools', query);
  }

}

