import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Booking } from '../bookings/booking.entity.js';
import { GeminiClient, STANDARD_CONFIRMATION } from './gemini.client.js';
import type { Confirmation } from './gemini.client.js';

@Injectable()
export class ConfirmationService {
  private readonly pending = new Map<string, Promise<Confirmation>>();
  private activeGenerations = 0;

  constructor(
    @InjectRepository(Booking) private readonly bookings: Repository<Booking>,
    @Inject(GeminiClient) private readonly gemini: GeminiClient,
  ) {}

  forBooking(slotId: string, bookingId: string): Promise<Confirmation> {
    const key = slotId + ':' + bookingId;
    const existing = this.pending.get(key);
    if (existing) return existing;
    const request = this.generate(slotId, bookingId).finally(() => this.pending.delete(key));
    this.pending.set(key, request);
    return request;
  }

  private async generate(slotId: string, bookingId: string): Promise<Confirmation> {
    // Do not select the attendee's name or email, or accept free-form prompts.
    const booking = await this.bookings.findOne({
      where: { id: bookingId, slotId }, relations: { slot: true },
      select: { id: true, confirmationMessage: true, confirmationSource: true,
        slot: { startsAt: true, durationMinutes: true } },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.confirmationMessage && booking.confirmationSource) {
      return { message: booking.confirmationMessage, source: booking.confirmationSource };
    }
    let result: Confirmation = { message: STANDARD_CONFIRMATION, source: 'standard' };
    // This single-instance demo caps provider concurrency instead of accumulating a queue.
    if (this.activeGenerations < 2) {
      this.activeGenerations++;
      try {
        result = await this.gemini.generate({ startsAt: booking.slot.startsAt, durationMinutes: booking.slot.durationMinutes });
      } finally { this.activeGenerations--; }
    }
    await this.bookings.update({ id: bookingId, confirmationMessage: IsNull() }, {
      confirmationMessage: result.message, confirmationSource: result.source,
    });
    // Preserve the first saved response if another application instance raced us.
    const saved = await this.bookings.findOneOrFail({ where: { id: bookingId },
      select: { confirmationMessage: true, confirmationSource: true } });
    return { message: saved.confirmationMessage!, source: saved.confirmationSource! };
  }
}
