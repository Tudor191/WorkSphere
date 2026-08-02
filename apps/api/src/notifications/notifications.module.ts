import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { FirebaseService } from './firebase.service';
import { TwilioService } from './twilio.service';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, FirebaseService, TwilioService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
