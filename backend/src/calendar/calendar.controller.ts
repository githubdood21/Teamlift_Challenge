import {
  Controller,
  Delete,
  Get,
  Header,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { CalendarService } from './calendar.service.js';
import { HostAdminGuard } from './host-admin.guard.js';
import { CalendarRangeDto } from './calendar-range.dto.js';

const STATE_COOKIE = 'common_time_google_state';

@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendar: CalendarService) {}

  @Get('status')
  @Header('Cache-Control', 'no-store')
  @UseGuards(HostAdminGuard)
  status() {
    return this.calendar.status();
  }

  @Post('connect')
  @Header('Cache-Control', 'no-store')
  @UseGuards(HostAdminGuard)
  async connect(@Res({ passthrough: true }) response: Response) {
    const result = await this.calendar.begin();
    response.cookie(STATE_COOKIE, result.state, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/api/calendar',
      maxAge: 10 * 60000,
      secure: process.env.GOOGLE_REDIRECT_URI?.startsWith('https:') ?? false,
    });
    return { url: result.url };
  }

  @Get('busy')
  @Header('Cache-Control', 'no-store')
  busy(@Query() range: CalendarRangeDto) {
    return this.calendar.busyPeriods(
      new Date(range.start),
      new Date(range.end),
    );
  }

  @Delete('connection')
  @Header('Cache-Control', 'no-store')
  @UseGuards(HostAdminGuard)
  disconnect() {
    return this.calendar.disconnect();
  }

  @Get('callback')
  @Header('Cache-Control', 'no-store')
  async callback(@Req() request: Request, @Res() response: Response) {
    let result = 'failed';
    try {
      const state =
        typeof request.query.state === 'string' ? request.query.state : '';
      const cookie =
        request.headers.cookie
          ?.split(';')
          .map((value) => value.trim())
          .find((value) => value.startsWith(STATE_COOKIE + '='))
          ?.slice(STATE_COOKIE.length + 1) ?? '';
      const code =
        typeof request.query.code === 'string' ? request.query.code : undefined;
      await this.calendar.complete(
        state,
        decodeURIComponent(cookie),
        code,
        Boolean(request.query.error),
      );
      result = 'connected';
    } catch {
      // Do not expose Google errors, authorization codes, or tokens in redirects.
      if (request.query.error === 'access_denied') result = 'denied';
    }
    response.clearCookie(STATE_COOKIE, { path: '/api/calendar' });
    const redirect = new URL(process.env.APP_ORIGIN || 'http://localhost:5173');
    redirect.search = '';
    redirect.searchParams.set('calendar', result);
    response.redirect(303, redirect.toString());
  }
}
