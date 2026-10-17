import { IsInt, IsISO8601, Matches, Max, Min } from 'class-validator';

export class CreateSlotDto {
  @IsISO8601({ strict: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/, {
    message: 'startsAt must include a time and timezone (Z or an explicit offset)',
  })
  startsAt: string;

  @IsInt()
  @Min(1)
  @Max(1440)
  durationMinutes: number;
}
