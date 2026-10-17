// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { CalendarBusyPeriods } from './CalendarBusyPeriods'
import { api } from '../api'

vi.mock('../api', async (original) => {
  const actual = await original<typeof import('../api')>()
  return { ...actual, api: { calendarBusy: vi.fn() } }
})
beforeEach(() =>
  vi.stubGlobal('matchMedia', () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })),
)
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
  vi.unstubAllGlobals()
})

it('labels Google busy intervals separately and displays them in Warsaw time', async () => {
  vi.mocked(api.calendarBusy).mockResolvedValue({
    connected: true,
    source: 'google-calendar',
    checkedAt: '2030-01-15T12:00:00Z',
    periods: [{ start: '2030-01-15T14:00:00Z', end: '2030-01-15T15:00:00Z' }],
  })
  const screen = render(<CalendarBusyPeriods refreshKey={0} busy={false} />)
  expect(await screen.findByText('15:00 – 16:00')).toBeTruthy()
  expect(screen.getByText('Busy in Google Calendar')).toBeTruthy()
  expect(screen.getByText('Unavailable')).toBeTruthy()
  expect(screen.queryByRole('button', { name: /Book/ })).toBeNull()
})

it('refetches when the selected week or schedule refresh changes', async () => {
  vi.mocked(api.calendarBusy).mockResolvedValue({
    connected: true,
    source: 'google-calendar',
    checkedAt: '2030-01-01T12:00:00Z',
    periods: [],
  })
  const screen = render(<CalendarBusyPeriods refreshKey={0} busy={false} />)
  await screen.findByText('No busy periods reported for this week.')
  fireEvent.change(screen.getByLabelText('Week starting'), {
    target: { value: '2030-01-15' },
  })
  await waitFor(() =>
    expect(api.calendarBusy).toHaveBeenCalledWith(
      '2030-01-14T23:00:00Z',
      '2030-01-21T23:00:00Z',
      expect.any(AbortSignal),
    ),
  )
  const count = vi.mocked(api.calendarBusy).mock.calls.length
  screen.rerender(<CalendarBusyPeriods refreshKey={1} busy={false} />)
  await waitFor(() => expect(api.calendarBusy).toHaveBeenCalledTimes(count + 1))
})

it('shows a failed lookup without falsely claiming the calendar is free', async () => {
  vi.mocked(api.calendarBusy).mockRejectedValue(
    new Error('Calendar unavailable'),
  )
  const screen = render(<CalendarBusyPeriods refreshKey={0} busy={false} />)
  expect(await screen.findByRole('alert')).toHaveProperty(
    'textContent',
    'Calendar unavailable',
  )
  expect(
    screen.queryByText('No busy periods reported for this week.'),
  ).toBeNull()
})
