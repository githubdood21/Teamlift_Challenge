import { afterEach, describe, expect, it, vi } from 'vitest'
import { calendarWeek, dateKey, dayLabel, timeLabel, toStartsAt } from './time'

afterEach(() => vi.useRealTimers())

describe('Europe/Warsaw scheduling', () => {
  it('uses local midnights for a calendar week across a daylight-saving change', () => {
    const range = calendarWeek('2026-10-24')
    expect(range.start).toBe('2026-10-23T22:00:00Z')
    expect(range.end).toBe('2026-10-30T23:00:00Z')
  })
  it('converts host input to UTC independently of the browser time zone', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    expect(toStartsAt('2026-07-15', '10:00')).toBe('2026-07-15T08:00:00Z')
    expect(toStartsAt('2026-12-15', '10:00')).toBe('2026-12-15T09:00:00Z')
  })
  it('rejects skipped and repeated daylight-saving clock times', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    expect(() => toStartsAt('2026-03-29', '02:30')).toThrow()
    expect(() => toStartsAt('2026-10-25', '02:30')).toThrow()
  })
  it('rejects past times', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-17T12:00:00Z'))
    expect(() => toStartsAt('2026-10-17', '10:00')).toThrow('future')
  })
  it('groups and displays dates in the same Warsaw time zone', () => {
    expect(dateKey('2026-07-15T23:00:00Z')).toBe('2026-07-16')
    expect(timeLabel('2026-07-15T23:00:00Z')).toBe('01:00')
    expect(dayLabel('2026-07-15T23:00:00Z')).toBe('Thursday 16 July')
  })
})
