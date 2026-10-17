import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Slot } from './slot.entity.js';
import { SlotsController } from './slots.controller.js';
import { SlotsService } from './slots.service.js';
import { CalendarModule } from '../calendar/calendar.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([Slot]), CalendarModule],
  controllers: [SlotsController],
  providers: [SlotsService],
})
export class SlotsModule {}
