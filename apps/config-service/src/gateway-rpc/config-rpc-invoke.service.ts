import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { BannerPage, BrokerGatewayRpcRequestDto, BrokerGatewayRpcResponseDto, RegisterFaucetRequest } from '@giwater/shared';
import { BannerService } from '../api/banner/banner.service.js';
import { ReferralService } from '../api/referral/referral.service.js';
import { AdminWatchedWalletsService } from '../api/admin-watched-wallets/admin-watched-wallets.service.js';
import { TokenFaucetsService } from '../api/token-faucets/token-faucets.service.js';
import type { BrokerGatewayHttpLikeRequest } from '@giwater/shared';

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
  const msg = err instanceof Error ? err.message : String(err);
  return { ok: false, statusCode: 500, error: msg };
}

@Injectable()
export class ConfigRpcInvokeService {
  private readonly logger = new Logger(ConfigRpcInvokeService.name);

  constructor(
    private readonly bannerSvc: BannerService,
    private readonly referralSvc: ReferralService,
    private readonly watchedWalletsSvc: AdminWatchedWalletsService,
    private readonly faucetSvc: TokenFaucetsService,
  ) {}

  async handleRpcEnvelope(
    envelope: BrokerGatewayRpcRequestDto,
  ): Promise<BrokerGatewayRpcResponseDto> {
    if (envelope.action === 'ping') {
      return {
        ok: true,
        statusCode: 200,
        body: { ok: true, action: 'ping', message: 'config-service alive' },
      };
    }
    if (envelope.action !== 'apiInvoke') {
      return { ok: false, statusCode: 400, error: 'Unknown action' };
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
    const body = request.body;

    try {
      const seg = pathSegments(path);
      const a = seg[0];
      const b = seg[1];
      const c = seg[2];

      if (method === 'GET' && seg.join('/') === 'health') {
        return {
          ok: true,
          statusCode: 200,
          body: { status: 'ok', service: 'giwater-config-service' },
        };
      }

      if (a === 'banners') {
        if (method === 'GET' && b) {
          const banners = await this.bannerSvc.getActiveBanners(b.toUpperCase() as BannerPage);
          return { ok: true, statusCode: 200, body: banners };
        }
        if (method === 'POST' && b && c === 'impression') {
          await this.bannerSvc.recordImpression(parseInt(b, 10));
          return { ok: true, statusCode: 204, body: null };
        }
        if (method === 'POST' && b && c === 'click') {
          await this.bannerSvc.recordClick(parseInt(b, 10));
          return { ok: true, statusCode: 204, body: null };
        }
        return { ok: false, statusCode: 404, error: `No banners route: ${method} ${path}` };
      }

      if (a === 'referral') {
        if (method === 'GET' && b === 'code' && c) {
          const result = await this.referralSvc.getOrCreateCode(c);
          return { ok: true, statusCode: 200, body: result };
        }
        if (method === 'POST' && b === 'claim') {
          const { refereeAddress, referralCode } = body as { refereeAddress: string; referralCode: string };
          const result = await this.referralSvc.claimReferral(refereeAddress, referralCode);
          return { ok: true, statusCode: 200, body: result };
        }
        return { ok: false, statusCode: 404, error: `No referral route: ${method} ${path}` };
      }

      if (a === 'admin' && b === 'watched-wallets') {
        if (method === 'GET' && !c) {
          const result = await this.watchedWalletsSvc.list();
          return { ok: true, statusCode: 200, body: result };
        }
        if (method === 'POST' && !c) {
          const result = await this.watchedWalletsSvc.upsert(body as { address?: string; label?: string });
          return { ok: true, statusCode: 200, body: result };
        }
        if (method === 'DELETE' && c) {
          const result = await this.watchedWalletsSvc.remove(c);
          return { ok: true, statusCode: 200, body: result };
        }
        return { ok: false, statusCode: 404, error: `No admin/watched-wallets route: ${method} ${path}` };
      }

      if (a === 'token-faucets') {
        if (method === 'GET' && !b) {
          const result = await this.faucetSvc.findAll();
          return { ok: true, statusCode: 200, body: result };
        }
        if (method === 'POST' && !b) {
          const result = await this.faucetSvc.register(body as RegisterFaucetRequest);
          return { ok: true, statusCode: 201, body: result };
        }
        if (method === 'DELETE' && b) {
          await this.faucetSvc.remove(b);
          return { ok: true, statusCode: 204, body: null };
        }
        return { ok: false, statusCode: 404, error: `No token-faucets route: ${method} ${path}` };
      }

      this.logger.debug(`apiInvoke: no route for ${method} ${path}`);
      return {
        ok: false,
        statusCode: 501,
        error: `No config-service RPC handler for ${method} ${path}`,
      };
    } catch (err) {
      this.logger.warn(
        `apiInvoke error ${method} ${path}: ${err instanceof Error ? err.message : err}`,
      );
      return httpErrorToRpc(err);
    }
  }
}
