import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller('api/health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Liveness probe' })
  getHealth() {
    return { status: 'ok', service: 'giwater-gateway' };
  }
}
