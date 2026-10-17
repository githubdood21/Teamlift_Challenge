import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CalendarConnection, CalendarOAuthAttempt } from './calendar.entity.js';
import { CalendarController } from './calendar.controller.js';
import { CalendarService } from './calendar.service.js';
import { GoogleCalendarClient } from './google-calendar.client.js';
import { HostAdminGuard } from './host-admin.guard.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([CalendarConnection, CalendarOAuthAttempt]),
  ],
  controllers: [CalendarController],
  providers: [CalendarService, GoogleCalendarClient, HostAdminGuard],
  exports: [CalendarService],
})
export class CalendarModule {}
