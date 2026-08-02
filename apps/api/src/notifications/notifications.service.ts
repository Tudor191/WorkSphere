import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@worksphere/database';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { FirebaseService } from './firebase.service';
import { TwilioService } from './twilio.service';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly firebase: FirebaseService,
    private readonly twilio: TwilioService,
  ) {}

  findMine(userId: string) {
    return this.prisma.tenantScoped.notification.findMany({
      where: { companyId: TenantContext.requireCompanyId(), userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async unreadCount(userId: string) {
    const count = await this.prisma.tenantScoped.notification.count({
      where: { companyId: TenantContext.requireCompanyId(), userId, isRead: false },
    });
    return { count };
  }

  async markRead(id: string, userId: string) {
    const { count } = await this.prisma.tenantScoped.notification.updateMany({
      where: { id, userId, companyId: TenantContext.requireCompanyId() },
      data: { isRead: true },
    });
    if (count === 0) throw new NotFoundException('Notificare inexistentă.');
  }

  async markAllRead(userId: string) {
    await this.prisma.tenantScoped.notification.updateMany({
      where: { userId, companyId: TenantContext.requireCompanyId(), isRead: false },
      data: { isRead: true },
    });
  }

  async registerDeviceToken(userId: string, dto: RegisterDeviceTokenDto) {
    await this.prisma.tenantScoped.deviceToken.upsert({
      where: { fcmToken: dto.fcmToken },
      create: { userId, fcmToken: dto.fcmToken, platform: dto.platform },
      update: { userId, platform: dto.platform },
    });
  }

  async unregisterDeviceToken(userId: string, fcmToken: string) {
    await this.prisma.tenantScoped.deviceToken.deleteMany({ where: { fcmToken, userId } });
  }

  async getPreferences(userId: string) {
    const user = await this.prisma.tenantScoped.user.findUniqueOrThrow({
      where: { id: userId },
      select: { chatNotificationsEnabled: true, smsNotificationsEnabled: true, phone: true },
    });
    return user;
  }

  async updatePreferences(userId: string, dto: UpdateNotificationPreferencesDto) {
    return this.prisma.tenantScoped.user.update({
      where: { id: userId },
      data: {
        chatNotificationsEnabled: dto.chatNotificationsEnabled,
        smsNotificationsEnabled: dto.smsNotificationsEnabled,
      },
      select: { chatNotificationsEnabled: true, smsNotificationsEnabled: true, phone: true },
    });
  }

  /**
   * Punct de intrare folosit de alte module (ex. aprobare/respingere
   * concediu) — salvează notificarea (mereu vizibilă în aplicație) și
   * încearcă, opțional, push-ul către device-urile înregistrate ale
   * userului. Rulează sub contextul de tenant normal al cererii curente —
   * spre deosebire de webhook-ul Stripe, aici există deja un JWT
   * autentificat, deci niciun bypass nu e necesar.
   *
   * `allowSms`: SMS-ul costă bani per mesaj, spre deosebire de push — de
   * aceea NU e încercat implicit pentru orice notificare, doar când
   * apelantul marchează explicit evenimentul ca suficient de important
   * (ex. respingerea unei cereri de concediu, nu un mesaj de chat).
   * Necesită și `smsNotificationsEnabled` + un `phone` setat de user.
   */
  async notify(
    userId: string,
    input: {
      type: string;
      title: string;
      body: string;
      metadata?: Record<string, unknown>;
      allowSms?: boolean;
    },
  ) {
    const companyId = TenantContext.requireCompanyId();
    const notification = await this.prisma.tenantScoped.notification.create({
      data: {
        companyId,
        userId,
        channel: 'IN_APP',
        type: input.type,
        title: input.title,
        body: input.body,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
      },
    });

    if (this.firebase.isConfigured) {
      const tokens = await this.prisma.tenantScoped.deviceToken.findMany({ where: { userId } });
      if (tokens.length > 0) {
        const { invalidTokens } = await this.firebase.sendToTokens(
          tokens.map((t) => t.fcmToken),
          { title: input.title, body: input.body },
          { type: input.type },
        );
        if (invalidTokens.length > 0) {
          await this.prisma.tenantScoped.deviceToken.deleteMany({
            where: { fcmToken: { in: invalidTokens } },
          });
        }
      }
    }

    if (input.allowSms && this.twilio.isConfigured) {
      const user = await this.prisma.tenantScoped.user.findUnique({
        where: { id: userId },
        select: { phone: true, smsNotificationsEnabled: true },
      });
      if (user?.phone && user.smsNotificationsEnabled) {
        await this.twilio.sendSms(user.phone, `${input.title}: ${input.body}`);
      }
    }

    return notification;
  }
}
