import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, QueryFailedError } from 'typeorm';
import { Slot } from '../slots/slot.entity.js';
import { Booking } from './booking.entity.js';
import { CreateBookingDto } from './dto/create-booking.dto.js';
import { CalendarService } from '../calendar/calendar.service.js';

@Injectable()
export class BookingsService {
  constructor(
    @InjectDataSource() private readonly database: DataSource,
    @Inject(CalendarService) private readonly calendar: CalendarService,
  ) {}

  async create(slotId: string, input: CreateBookingDto) {
    try {
      return await this.database.transaction(async (manager) => {
        // Serialize booking attempts for this slot across every API instance.
        const slot = await manager.getRepository(Slot).findOne({
          where: { id: slotId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!slot) throw new NotFoundException('Slot not found');
        if (slot.startsAt.getTime() <= Date.now()) {
          throw new ConflictException('This slot has already started');
        }
        const bookings = manager.getRepository(Booking);
        if (await bookings.existsBy({ slotId })) {
          throw new ConflictException('This slot is already booked');
        }
        await this.calendar.assertAvailable(slot, manager);
        if (slot.startsAt.getTime() <= Date.now()) {
          throw new ConflictException('This slot has already started');
        }
        const booking = await bookings.save(bookings.create({
          slotId, name: input.name, email: input.email,
        }));
        // Return a receipt, without adding attendee details to any public slot response.
        return { id: booking.id, slotId: booking.slotId, createdAt: booking.createdAt };
      });
    } catch (error) {
      // Also handle writes from code paths that did not acquire the slot lock.
      if (error instanceof QueryFailedError &&
          error.driverError.code === '23505' &&
          error.driverError.constraint === 'bookings_slot_id_unique') {
        throw new ConflictException('This slot is already booked');
      }
      throw error;
    }
  }
}
