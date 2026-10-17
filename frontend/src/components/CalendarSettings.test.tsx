// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { CalendarSettings } from './CalendarSettings'
import { api, ApiError } from '../api'

vi.mock('../api', async (original) => {
  const actual = await original<typeof import('../api')>()
  return {
    ...actual,
    api: {
      calendarStatus: vi.fn(),
      calendarBusy: vi.fn(),
      disconnectCalendar: vi.fn(),
      connectCalendar: vi.fn(),
    },
  }
})
beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
  vi.mocked(api.calendarBusy).mockResolvedValue({
    connected: true,
    source: 'google-calendar',
    checkedAt: '2030-01-01T12:00:00Z',
    periods: [],
  })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.resetAllMocks()
})

it('keeps settings locked when an incorrect host key is rejected', async () => {
  vi.mocked(api.calendarStatus).mockRejectedValue(
    new ApiError('Incorrect host admin key', 401),
  )
  const screen = render(<CalendarSettings onChanged={() => {}} />)
  fireEvent.change(screen.getByLabelText('Host admin key'), {
    target: { value: 'wrong-key' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Unlock settings' }))
  expect(await screen.findByRole('alert')).toHaveProperty(
    'textContent',
    'Incorrect host admin key',
  )
  expect(
    screen.queryByRole('button', { name: 'Connect Google Calendar' }),
  ).toBeNull()
})

it('shows missing setup fields only after authentication and disables connection', async () => {
  vi.mocked(api.calendarStatus).mockResolvedValue({
    connected: false,
    configured: false,
    missing: ['GOOGLE_CLIENT_ID'],
    connectedAt: null,
    calendar: 'primary',
  })
  const screen = render(<CalendarSettings onChanged={() => {}} />)
  expect(screen.queryByText('GOOGLE_CLIENT_ID')).toBeNull()
  fireEvent.change(screen.getByLabelText('Host admin key'), {
    target: { value: 'private-test-key' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Unlock settings' }))
  expect(await screen.findByText('GOOGLE_CLIENT_ID')).toBeTruthy()
  expect(
    screen.getByRole('button', { name: 'Connect Google Calendar' }),
  ).toHaveProperty('disabled', true)
  expect(window.localStorage.length).toBe(0)
  expect(window.sessionStorage.length).toBe(0)
})

it('requires a deliberate disconnect and refreshes availability afterward', async () => {
  vi.mocked(api.calendarStatus).mockResolvedValue({
    connected: true,
    configured: true,
    missing: [],
    connectedAt: '2030-01-01T00:00:00Z',
    calendar: 'primary',
  })
  vi.mocked(api.disconnectCalendar).mockResolvedValue({ revoked: true })
  const changed = vi.fn()
  const screen = render(<CalendarSettings onChanged={changed} />)
  fireEvent.change(screen.getByLabelText('Host admin key'), {
    target: { value: 'private-test-key' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Unlock settings' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Disconnect' }))
  expect(api.disconnectCalendar).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Confirm disconnect' }))
  expect(
    await screen.findByText(
      'Calendar disconnected. Published slots are available without Google checks.',
    ),
  ).toBeTruthy()
  expect(api.disconnectCalendar).toHaveBeenCalledWith('private-test-key')
  expect(changed).toHaveBeenCalledOnce()
})
