import { IsISO8601, Matches } from 'class-validator';

export class CalendarRangeDto {
  @IsISO8601({ strict: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/)
  start: string;

  @IsISO8601({ strict: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/)
  end: string;
}
