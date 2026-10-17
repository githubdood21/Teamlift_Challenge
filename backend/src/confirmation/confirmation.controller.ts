import { Controller, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ConfirmationService } from './confirmation.service.js';

@Controller('slots/:slotId/bookings/:bookingId/confirmation')
export class ConfirmationController {
  constructor(private readonly confirmations: ConfirmationService) {}

  @Post()
  @HttpCode(200)
  create(
    @Param('slotId', new ParseUUIDPipe({ version: '4' })) slotId: string,
    @Param('bookingId', new ParseUUIDPipe({ version: '4' })) bookingId: string,
  ) {
    return this.confirmations.forBooking(slotId, bookingId);
  }
}
