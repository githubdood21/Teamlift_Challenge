export interface Slot {
  id: string
  startsAt: string
  durationMinutes: number
  createdAt: string
}

export interface BookingReceipt {
  id: string
  slotId: string
  createdAt: string
}

export interface ConfirmationMessage {
  message: string
  source: 'ai' | 'standard'
}

export interface CalendarStatus {
  connected: boolean
  configured: boolean
  missing: string[]
  connectedAt: string | null
  calendar: string
}

export interface CalendarBusyResult {
  connected: boolean
  source: 'google-calendar'
  checkedAt: string
  periods: { start: string; end: string }[]
}

export class ApiError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch('/api' + path, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError')
      throw error
    throw new Error(
      'We couldn’t reach the server. Check your connection and try again.',
    )
  }
  if (!response.ok) {
    let message = 'Something went wrong. Please try again.'
    if (response.status === 503)
      message =
        'This service is temporarily unavailable. Please try again shortly.'
    if (response.status < 500) {
      const body: unknown = await response.json().catch(() => null)
      if (body && typeof body === 'object' && 'message' in body) {
        if (typeof body.message === 'string') message = body.message
        if (Array.isArray(body.message))
          message = body.message.filter((v) => typeof v === 'string').join('. ')
      }
    }
    throw new ApiError(message, response.status)
  }
  return response.json() as Promise<T>
}

export const api = {
  confirmation: (slotId: string, bookingId: string, signal?: AbortSignal) =>
    request<ConfirmationMessage>('/slots/' + slotId + '/bookings/' + bookingId + '/confirmation', {
      method: 'POST', signal,
    }),
  calendarBusy: (start: string, end: string, signal?: AbortSignal) =>
    request<CalendarBusyResult>(
      '/calendar/busy?' + new URLSearchParams({ start, end }),
      {
        signal,
      },
    ),
  calendarStatus: (key: string) =>
    request<CalendarStatus>('/calendar/status', {
      headers: { Authorization: 'Bearer ' + key },
    }),
  connectCalendar: (key: string) =>
    request<{ url: string }>('/calendar/connect', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key },
    }),
  disconnectCalendar: (key: string) =>
    request<{ revoked: boolean }>('/calendar/connection', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + key },
    }),
  slots: (signal?: AbortSignal) => request<Slot[]>('/slots', { signal }),
  createSlot: (startsAt: string, durationMinutes: number) =>
    request<Slot>('/slots', {
      method: 'POST',
      body: JSON.stringify({ startsAt, durationMinutes }),
    }),
  book: (slotId: string, name: string, email: string) =>
    request<BookingReceipt>('/slots/' + slotId + '/bookings', {
      method: 'POST',
      body: JSON.stringify({ name: name.trim(), email: email.trim() }),
    }),
}

export function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Something went wrong. Please try again.'
}
