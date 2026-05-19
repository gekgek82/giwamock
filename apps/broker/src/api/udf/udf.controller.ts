// apps/broker/src/api/udf/udf.controller.ts
import {
  Controller,
  Get,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type {
  UdfConfigResponseDto,
  UdfHistoryResponseDto,
  UdfSearchResultItemDto,
  UdfSymbolInfoDto,
} from '@giwater/shared';
import { UdfService } from './udf.service';

@ApiTags('udf')
@Controller('udf')
export class UdfController {
  constructor(private readonly udf: UdfService) {}

  @Get('config')
  @ApiOperation({ summary: 'TradingView UDF: datafeed capabilities' })
  config(): UdfConfigResponseDto {
    return this.udf.getConfig();
  }

  @Get('time')
  @ApiOperation({ summary: 'TradingView UDF: current server unix timestamp (plain integer)' })
  time(@Res() res: Response): void {
    res.send(String(this.udf.getTime()));
  }

  @Get('symbols')
  @ApiOperation({ summary: 'TradingView UDF: resolve ticker to SymbolInfo' })
  @ApiQuery({ name: 'symbol', required: true, description: 'Ticker: PAIR:0x... or TOKEN:0x...' })
  async symbols(
    @Query('symbol') symbol: string,
  ): Promise<UdfSymbolInfoDto | { s: 'error'; errmsg: string }> {
    if (!symbol?.trim()) {
      return { s: 'error', errmsg: 'symbol parameter is required' };
    }
    return this.udf.resolveSymbol(symbol.trim());
  }

  @Get('search')
  @ApiOperation({ summary: 'TradingView UDF: symbol search' })
  @ApiQuery({ name: 'query', required: false, description: 'Search string' })
  @ApiQuery({ name: 'type', required: true, enum: ['pair', 'token'] })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Max results (default 30, max 100)' })
  async search(
    @Query('query') query: string = '',
    @Query('type') type: string = '',
    @Query('limit') limit: string = '30',
  ): Promise<UdfSearchResultItemDto[]> {
    return this.udf.search(query ?? '', type ?? '', parseInt(limit, 10) || 30);
  }

  @Get('history')
  @ApiOperation({ summary: 'TradingView UDF: OHLCV bars' })
  @ApiQuery({ name: 'symbol', required: true })
  @ApiQuery({ name: 'resolution', required: true, enum: ['5', '60', '1D', '1W', '1M'] })
  @ApiQuery({ name: 'from', required: true, type: Number, description: 'Unix timestamp (seconds)' })
  @ApiQuery({ name: 'to', required: true, type: Number, description: 'Unix timestamp (seconds)' })
  @ApiQuery({ name: 'countback', required: false, type: Number })
  async history(
    @Query('symbol') symbol: string,
    @Query('resolution') resolution: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('countback') countback?: string,
  ): Promise<UdfHistoryResponseDto> {
    if (!symbol?.trim() || !resolution?.trim() || !from || !to) {
      return { s: 'error', errmsg: 'symbol, resolution, from, to are required' };
    }
    return this.udf.getHistory(
      symbol.trim(),
      resolution.trim(),
      Number(from),
      Number(to),
      countback ? Number(countback) : undefined,
    );
  }
}
