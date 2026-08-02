import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { AiService } from './ai.service';
import { AiChatDto } from './dto/chat.dto';

@ApiTags('ai')
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat')
  @RequirePermission('ai_assistant:use')
  @ApiOperation({
    summary: 'Trimite o conversație către AI Assistant și primește următorul răspuns',
  })
  chat(@Body() dto: AiChatDto) {
    return this.aiService.chat(dto.messages);
  }
}
