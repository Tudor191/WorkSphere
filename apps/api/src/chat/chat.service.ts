import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { SAFE_USER_SELECT } from '../common/constants/safe-user-select';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateChannelDto } from './dto/create-channel.dto';
import { CreateMessageDto } from './dto/create-message.dto';

const MESSAGE_PREVIEW_MAX_LENGTH = 120;

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Canale vizibile userului curent: toate cele publice + cele private din care face parte. */
  findChannels(userId: string) {
    return this.prisma.tenantScoped.chatChannel.findMany({
      where: {
        companyId: TenantContext.requireCompanyId(),
        OR: [{ isPrivate: false }, { members: { some: { userId } } }],
      },
      include: { _count: { select: { messages: true, members: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async createChannel(dto: CreateChannelDto, creatorId: string) {
    const companyId = TenantContext.requireCompanyId();
    const requestedIds = Array.from(new Set([creatorId, ...(dto.memberIds ?? [])]));
    // Nu avem încredere orbește în `memberIds` din request — un id din altă
    // companie nu ar putea fi exploatat mai departe (assertAccess tot
    // filtrează canalul după compania curentă a userului care îl citește),
    // dar tot ar rămâne un rând de membru orfan, cross-tenant, în DB.
    const validUsers = await this.prisma.tenantScoped.user.findMany({
      where: { id: { in: requestedIds }, companyId },
      select: { id: true },
    });
    const memberIds = validUsers.map((u) => u.id);
    try {
      return await this.prisma.tenantScoped.chatChannel.create({
        data: {
          name: dto.name,
          isPrivate: dto.isPrivate ?? false,
          companyId: TenantContext.requireCompanyId(),
          members: { createMany: { data: memberIds.map((userId) => ({ userId })) } },
        },
      });
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'
      ) {
        throw new ConflictException('Există deja un canal cu acest nume.');
      }
      throw error;
    }
  }

  /**
   * Verificare de acces per-canal — deliberat separată de `@RequirePermission('chat:use')`
   * (care doar confirmă că rolul userului are voie să folosească chatul în general).
   * Un canal privat rămâne izolat de restul companiei chiar dacă cineva îi ghicește ID-ul.
   */
  private async assertAccess(channelId: string, userId: string) {
    const channel = await this.prisma.tenantScoped.chatChannel.findFirst({
      where: { id: channelId, companyId: TenantContext.requireCompanyId() },
      include: { members: { where: { userId } } },
    });
    if (!channel) throw new NotFoundException('Canal inexistent.');
    if (channel.isPrivate && channel.members.length === 0) {
      throw new ForbiddenException('Nu ești membru al acestui canal privat.');
    }
    return channel;
  }

  async findMessages(channelId: string, userId: string) {
    await this.assertAccess(channelId, userId);
    return this.prisma.tenantScoped.chatMessage.findMany({
      where: { channelId },
      include: { author: { select: SAFE_USER_SELECT } },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
  }

  async createMessage(channelId: string, userId: string, dto: CreateMessageDto) {
    const channel = await this.assertAccess(channelId, userId);
    const message = await this.prisma.tenantScoped.chatMessage.create({
      data: { channelId, authorId: userId, content: dto.content },
      include: { author: { select: SAFE_USER_SELECT } },
    });
    await this.notifyNewMessage(channel, message);
    return message;
  }

  /**
   * Notifică membrii canalului (mai puțin autorul) despre mesajul nou,
   * respectând preferința individuală `chatNotificationsEnabled`. Rulează
   * după ce mesajul e deja salvat — un eșec de notificare (push
   * neconfigurat, token invalid etc.) nu trebuie să blocheze trimiterea
   * mesajului în sine (`NotificationsService.notify` nu aruncă la eșec de
   * push, dar izolăm oricum apelul per-membru).
   */
  private async notifyNewMessage(
    channel: { id: string; name: string },
    message: {
      id: string;
      content: string;
      authorId: string | null;
      author: { firstName: string; lastName: string } | null;
    },
  ) {
    const members = await this.prisma.tenantScoped.chatChannelMember.findMany({
      where: { channelId: channel.id, user: { chatNotificationsEnabled: true } },
      select: { userId: true },
    });
    const preview =
      message.content.length > MESSAGE_PREVIEW_MAX_LENGTH
        ? `${message.content.slice(0, MESSAGE_PREVIEW_MAX_LENGTH - 3)}...`
        : message.content;
    // `author` poate fi null dacă a fost șters definitiv între trimiterea
    // mesajului (imposibil în practică, dar tipul Prisma reflectă acum
    // relația opțională — vezi migrația nullable User FKs) și această notificare.
    const authorName = message.author
      ? `${message.author.firstName} ${message.author.lastName}`
      : 'Utilizator șters';

    await Promise.all(
      members
        .filter((m) => m.userId !== message.authorId)
        .map((m) =>
          this.notifications
            .notify(m.userId, {
              type: 'chat_message',
              title: `${authorName} în #${channel.name}`,
              body: preview,
              metadata: { channelId: channel.id, messageId: message.id },
            })
            .catch(() => undefined),
        ),
    );
  }
}
