import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ChatService } from './chat.service';
import { CreateChannelDto } from './dto/create-channel.dto';
import { CreateMessageDto } from './dto/create-message.dto';

@ApiTags('chat')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('channels')
  @RequirePermission('chat:use')
  @ApiOperation({ summary: 'Listă canale vizibile (publice + private din care faci parte)' })
  findChannels(@CurrentUser() user: AuthenticatedUser) {
    return this.chatService.findChannels(user.userId);
  }

  @Post('channels')
  @RequirePermission('chat:use')
  @ApiOperation({ summary: 'Creează canal (public sau privat, cu membri invitați)' })
  createChannel(@Body() dto: CreateChannelDto, @CurrentUser() user: AuthenticatedUser) {
    return this.chatService.createChannel(dto, user.userId);
  }

  @Get('channels/:id/messages')
  @RequirePermission('chat:use')
  @ApiOperation({ summary: 'Listă mesaje dintr-un canal' })
  findMessages(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.chatService.findMessages(id, user.userId);
  }

  @Post('channels/:id/messages')
  @RequirePermission('chat:use')
  @ApiOperation({ summary: 'Trimite mesaj într-un canal' })
  createMessage(
    @Param('id') id: string,
    @Body() dto: CreateMessageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.chatService.createMessage(id, user.userId, dto);
  }
}
