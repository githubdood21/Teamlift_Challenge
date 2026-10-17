import { Temporal } from '@js-temporal/polyfill'
import type { Slot } from './api'

export const TIME_ZONE = 'Europe/Warsaw'
const dayFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})
const timeFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

export function today(): string {
  return Temporal.Now.plainDateISO(TIME_ZONE).toString()
}

export function calendarWeek(date: string): { start: string; end: string } {
  const first = Temporal.PlainDate.from(date)
  const midnight = (day: Temporal.PlainDate) =>
    day
      .toZonedDateTime({ timeZone: TIME_ZONE, plainTime: '00:00' })
      .toInstant()
      .toString()
  return { start: midnight(first), end: midnight(first.add({ days: 7 })) }
}
export function dateKey(iso: string): string {
  return Temporal.Instant.from(iso)
    .toZonedDateTimeISO(TIME_ZONE)
    .toPlainDate()
    .toString()
}
export function dayLabel(iso: string): string {
  return dayFormat.format(new Date(iso))
}
export function timeLabel(iso: string): string {
  return timeFormat.format(new Date(iso))
}
export function timeRange(slot: Slot): string {
  const end = new Date(
    new Date(slot.startsAt).getTime() + slot.durationMinutes * 60000,
  ).toISOString()
  return timeLabel(slot.startsAt) + ' – ' + timeLabel(end)
}
export function toStartsAt(date: string, time: string): string {
  // Reject skipped/repeated clock times rather than silently shifting a host’s slot.
  const zoned = Temporal.ZonedDateTime.from(
    date + 'T' + time + '[' + TIME_ZONE + ']',
    { disambiguation: 'reject' },
  )
  if (zoned.epochMilliseconds <= Date.now())
    throw new Error('Choose a time in the future.')
  return zoned.toInstant().toString()
}
