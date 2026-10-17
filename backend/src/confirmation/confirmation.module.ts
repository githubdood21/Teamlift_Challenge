import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from '../bookings/booking.entity.js';
import { ConfirmationController } from './confirmation.controller.js';
import { ConfirmationService } from './confirmation.service.js';
import { GeminiClient } from './gemini.client.js';

@Module({
  imports: [TypeOrmModule.forFeature([Booking])],
  providers: [ConfirmationService, GeminiClient],
  controllers: [ConfirmationController],
})
export class ConfirmationModule {}
