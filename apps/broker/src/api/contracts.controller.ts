import { Controller, Get } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  CONTRACT_ADDRESSES,
  type GetProtocolContractsResponseDto,
} from '@giwater/shared';
import { GetProtocolContractsResponseSwaggerDto } from '@giwater/shared/nest/swagger';

@ApiTags('contracts')
@Controller('contracts')
export class ContractsController {
  @Get()
  @ApiOperation({
    summary: 'Protocol contract addresses',
    description:
      'Returns `CONTRACT_ADDRESSES` from `@giwater/shared`: includes every field from the main API `ContractsAddressesDto` (TER, factories, governors, router, points, Permit2, Universal Router, WGIWA) plus deployment extras (`poolImplementation`, `clPoolImplementation`, `clGaugeImplementation`, `managedRewardsFactory`, `dynamicSwapFeeModule`). No database.',
  })
  @ApiOkResponse({ type: GetProtocolContractsResponseSwaggerDto })
  getContracts(): GetProtocolContractsResponseDto {
    return { contracts: CONTRACT_ADDRESSES };
  }
}
