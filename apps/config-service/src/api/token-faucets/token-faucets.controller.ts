import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { TokenFaucetsService } from './token-faucets.service.js';
import type { RegisterFaucetRequest } from '@giwater/shared';

@Controller('token-faucets')
export class TokenFaucetsController {
  constructor(private readonly service: TokenFaucetsService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Post()
  register(@Body() dto: RegisterFaucetRequest) {
    return this.service.register(dto);
  }

  @Delete(':address')
  remove(@Param('address') address: string) {
    return this.service.remove(address);
  }
}
