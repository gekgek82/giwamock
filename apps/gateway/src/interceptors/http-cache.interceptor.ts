import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { Observable, defer, from, mergeMap, of, tap } from 'rxjs';
import type { GatewayConfig } from '../config/configuration';
import { SKIP_HTTP_CACHE } from '../http-cache/skip-http-cache.decorator';
import { RedisService } from '../redis/redis.service';

interface HttpCacheEnvelope {
  body: unknown;
  storedAtMs: number;
}

function isEnvelope(v: unknown): v is HttpCacheEnvelope {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return typeof o.storedAtMs === 'number' && 'body' in o;
}

/**
 * Global GET cache: Redis key = `method:originalUrl`, TTL = fresh + stale extra.
 * Fresh vs stale is exposed as `X-Gateway-Http-Cache: HIT | STALE` when applicable.
 */
@Injectable()
export class HttpCacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger(HttpCacheInterceptor.name);

  constructor(
    private readonly redis: RedisService,
    private readonly configService: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  private get redisCfg(): GatewayConfig['redis'] {
    return this.configService.getOrThrow<GatewayConfig['redis']>('redis');
  }

  private shouldBypass(req: Request): boolean {
    if (req.method !== 'GET') return true;
    const url = req.originalUrl ?? req.url;
    return this.redisCfg.excludeOriginalUrlPrefixes.some((p) =>
      url.startsWith(p),
    );
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    if (this.shouldBypass(req)) {
      return next.handle();
    }

    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_HTTP_CACHE, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip === true) {
      return next.handle();
    }

    const { defaultTtlSec: freshSec, staleExtraTtlSec } = this.redisCfg;
    const totalTtlSec = Math.max(1, freshSec) + Math.max(0, staleExtraTtlSec);
    const freshMs = Math.max(1, freshSec) * 1000;

    const cacheKey = `${req.method}:${req.originalUrl}`;

    return defer(() => from(this.redis.getJson(cacheKey))).pipe(
      mergeMap((cached) => {
        if (cached !== null && isEnvelope(cached)) {
          const age = Date.now() - cached.storedAtMs;
          const state = age <= freshMs ? 'HIT' : 'STALE';
          this.logger.debug(`Cache ${state} ${cacheKey}`);
          res.setHeader('X-Gateway-Http-Cache', state);
          return of(cached.body);
        }
        return next.handle().pipe(
          tap(() => {
            res.setHeader('X-Gateway-Http-Cache', 'MISS');
          }),
          mergeMap((body) => {
            const envelope: HttpCacheEnvelope = {
              body,
              storedAtMs: Date.now(),
            };
            return from(
              this.redis.setJson(cacheKey, envelope, totalTtlSec),
            ).pipe(mergeMap(() => of(body)));
          }),
        );
      }),
    );
  }
}
