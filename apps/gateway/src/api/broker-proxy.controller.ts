import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpException,
  Post,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import type {
  BrokerGatewayHttpLikeRequest,
  BrokerGatewayRpcResponseDto,
} from '@giwater/shared';
import { resolveBrokerTarget } from '@giwater/shared';
import { GatewayRabbitmqService } from '../rabbitmq/gateway-rabbitmq.service';

@ApiTags('broker')
@Controller('api/v1/broker')
export class BrokerProxyController {
  constructor(private readonly rabbit: GatewayRabbitmqService) {}

  @Get('ping')
  @ApiOperation({
    summary: 'Ping broker via RabbitMQ RPC (cached in Redis for GET)',
    description:
      'Returns legacy `{ ok, action, message }` JSON from the broker for backward compatibility.',
  })
  async ping(): Promise<unknown> {
    return this.rabbit.rpcToBroker({ action: 'ping' });
  }

  @Post('invoke')
  @ApiOperation({
    summary: 'Async broker API (HTTP-shaped RPC over RabbitMQ)',
    description:
      'Forwards `BrokerGatewayHttpLikeRequest` as `action: apiInvoke`. On success returns the broker `body` only; on failure throws `HttpException` with `BrokerGatewayRpcResponseDto` as the response payload.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['method', 'path'],
      properties: {
        method: { type: 'string', example: 'GET' },
        path: {
          type: 'string',
          example: '/spot-tokens/by-address/0x0000000000000000000000000000000000000000',
        },
        query: {
          type: 'object',
          additionalProperties: { type: 'string' },
          example: { offset: '0', limit: '10' },
        },
        body: {
          description: 'JSON body for POST-style broker routes',
          example: { listed: true },
        },
      },
    },
  })
  async invoke(@Body() body: BrokerGatewayHttpLikeRequest): Promise<unknown> {
    if (!body?.method?.trim() || !body?.path?.trim()) {
      throw new BadRequestException('`method` and `path` are required');
    }

    const target = resolveBrokerTarget(body.path);
    const rpcBody = {
      action: 'apiInvoke',
      request: {
        method: body.method,
        path: body.path,
        query: body.query ?? {},
        body: body.body ?? null,
      },
    };

    const raw = (
      target === 'config'
        ? await this.rabbit.rpcToConfigService(rpcBody)
        : await this.rabbit.rpcToBroker(rpcBody)
    ) as BrokerGatewayRpcResponseDto;

    if (!raw || typeof raw !== 'object' || typeof raw.ok !== 'boolean') {
      throw new HttpException('Invalid RPC response', 502);
    }
    if (!raw.ok) {
      throw new HttpException(raw, raw.statusCode ?? 500);
    }
    return raw.body;
  }
}
