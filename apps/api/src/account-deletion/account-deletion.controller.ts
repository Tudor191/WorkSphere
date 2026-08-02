import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { AccountDeletionService } from './account-deletion.service';
import { ConfirmAccountDeletionDto } from './dto/confirm-account-deletion.dto';

@ApiTags('account-deletion')
@Controller('account-deletion')
export class AccountDeletionController {
  constructor(private readonly accountDeletionService: AccountDeletionService) {}

  @Public()
  @Post('confirm')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Accelerează ștergerea unui cont deja demis (email + cod + parolă), înainte de termenul automat de 7 zile',
  })
  async confirm(@Body() dto: ConfirmAccountDeletionDto): Promise<void> {
    await this.accountDeletionService.confirmEarlyDeletion(dto);
  }
}
