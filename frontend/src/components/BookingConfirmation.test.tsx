// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { api } from '../api'
import { BookingConfirmation } from './BookingConfirmation'

vi.mock('../api', () => ({ api: { confirmation: vi.fn() } }))
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals() })
const slot = { id: 'slot', startsAt: '2026-11-01T10:00:00Z', durationMinutes: 30, createdAt: '2026-10-17T10:00:00Z' }

it('confirms the booking immediately while the optional message is pending', () => {
  vi.mocked(api.confirmation).mockReturnValue(new Promise(() => {}))
  vi.stubGlobal('matchMedia', () => ({ matches: true }))
  const close = vi.fn()
  const view = render(<BookingConfirmation slot={slot} name="Alex" bookingId="booking" onClose={close} />)
  expect(view.getByText('Your time is reserved. We look forward to the conversation.')).toBeTruthy()
  expect(view.getByText('Adding a friendly note…')).toBeTruthy()
  fireEvent.click(view.getByRole('button', { name: /Back to schedule/ }))
  expect(close).toHaveBeenCalledOnce()
});

it('displays a generated message with an AI label', async () => {
  vi.mocked(api.confirmation).mockResolvedValue({ message: 'Your next conversation is on the calendar!', source: 'ai' })
  const view = render(<BookingConfirmation slot={slot} name="Alex" bookingId="booking" onClose={() => {}} />)
  await waitFor(() => expect(view.getByText('AI-written confirmation')).toBeTruthy())
  expect(view.getByText('Your next conversation is on the calendar!')).toBeTruthy()
});

it('keeps the confirmed reservation visible if the message request fails', async () => {
  vi.mocked(api.confirmation).mockRejectedValue(new Error('Offline'))
  const view = render(<BookingConfirmation slot={slot} name="Alex" bookingId="booking" onClose={() => {}} />)
  await waitFor(() => expect(view.queryByText('Adding a friendly note…')).toBeNull())
  expect(view.getByText('Your time is reserved. We look forward to the conversation.')).toBeTruthy()
  expect(view.queryByText('AI-written confirmation')).toBeNull()
});
