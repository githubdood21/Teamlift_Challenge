import { Module } from '@nestjs/common';
import { BookingsController } from './bookings.controller.js';
import { BookingsService } from './bookings.service.js';
import { CalendarModule } from '../calendar/calendar.module.js';
import { ConfirmationModule } from '../confirmation/confirmation.module.js';

@Module({
  imports: [CalendarModule, ConfirmationModule],
  controllers: [BookingsController],
  providers: [BookingsService],
})
export class BookingsModule {}
