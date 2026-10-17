import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking } from '../bookings/booking.entity.js';
import { CreateSlotDto } from './dto/create-slot.dto.js';
import { Slot } from './slot.entity.js';
import { CalendarService } from '../calendar/calendar.service.js';

@Injectable()
export class SlotsService {
  constructor(
    @InjectRepository(Slot) private readonly slots: Repository<Slot>,
    @Inject(CalendarService) private readonly calendar: CalendarService,
  ) {}

  async create(input: CreateSlotDto): Promise<Slot> {
    const startsAt = new Date(input.startsAt);
    if (!Number.isFinite(startsAt.getTime()) || startsAt.getTime() <= Date.now()) {
      throw new BadRequestException('Slot must start in the future');
    }
    const slot = this.slots.create({
      startsAt,
      durationMinutes: input.durationMinutes,
    });
    await this.calendar.assertAvailable(slot);
    return this.slots.save(slot);
  }

  async findAvailable(): Promise<Slot[]> {
    const slots = await this.slots.createQueryBuilder('slot')
      .leftJoin(Booking, 'booking', 'booking.slotId = slot.id')
      .where('booking.id IS NULL')
      .andWhere('slot.startsAt > CURRENT_TIMESTAMP')
      .orderBy('slot.startsAt', 'ASC')
      .addOrderBy('slot.id', 'ASC')
      .getMany();
    return this.calendar.filterAvailable(slots);
  }
}
