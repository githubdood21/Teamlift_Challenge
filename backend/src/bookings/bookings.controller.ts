import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { BookingsService } from './bookings.service.js';
import { CreateBookingDto } from './dto/create-booking.dto.js';

@Controller('slots/:slotId/bookings')
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Post()
  create(
    @Param('slotId', new ParseUUIDPipe({ version: '4' })) slotId: string,
    @Body() input: CreateBookingDto,
  ) {
    return this.bookings.create(slotId, input);
  }
}
