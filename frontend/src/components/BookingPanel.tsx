import { RippleSurface } from './RippleSurface'
import { BounceButton } from './BounceButton'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { api, ApiError, errorMessage } from '../api'
import type { BookingReceipt, Slot } from '../api'
import { dayLabel, timeRange } from '../time'
import { Icon } from './Icon'

export function BookingPanel({
  slot,
  busy,
  onBusy,
  onCancel,
  onBooked,
  onUnavailable,
}: {
  slot: Slot
  busy: boolean
  onBusy: (value: boolean) => void
  onCancel: () => void
  onBooked: (name: string, receipt: BookingReceipt) => void
  onUnavailable: () => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [unavailable, setUnavailable] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || unavailable) return
    if (!name.trim()) {
      setError('Please enter your name.')
      return
    }
    onBusy(true)
    setError('')
    try {
      const receipt = await api.book(slot.id, name, email)
      onBooked(name.trim(), receipt)
    } catch (error) {
      if (
        error instanceof ApiError &&
        (error.status === 409 || error.status === 404)
      ) {
        setUnavailable(true)
        setError(
          'This time is no longer available. Choose another slot to continue.',
        )
        onUnavailable()
      } else setError(errorMessage(error))
    } finally {
      onBusy(false)
    }
  }

  return (
    <RippleSurface
      className="card booking-card"
      aria-labelledby="booking-title"
    >
      <span className="eyebrow">YOUR CONVERSATION</span>
      <h2 id="booking-title">Let’s make it a date.</h2>
      <div className="booking-summary">
        <Icon name="calendar" />
        <div>
          <strong>{dayLabel(slot.startsAt)}</strong>
          <span>{timeRange(slot)} · Europe/Warsaw</span>
        </div>
      </div>
      <form onSubmit={(event) => void submit(event)}>
        <fieldset disabled={busy || unavailable}>
          <label htmlFor="booking-name">Your name</label>
          <input
            id="booking-name"
            name="name"
            autoComplete="name"
            autoFocus
            required
            maxLength={100}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Alex Morgan"
          />
          <label htmlFor="booking-email">Email address</label>
          <input
            id="booking-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="alex@example.com"
          />
          <BounceButton
            className="button primary full"
            type="submit"
            aria-busy={busy}
          >
            {busy ? 'Reserving your time…' : 'Confirm booking'}
            {busy ? (
              <span className="button-spinner" aria-hidden="true" />
            ) : (
              <Icon name="arrow" size={18} />
            )}
          </BounceButton>
        </fieldset>
        {error && (
          <p className="feedback error" role="alert">
            {error}
          </p>
        )}
        <BounceButton
          className="text-button"
          type="button"
          disabled={busy}
          onClick={onCancel}
        >
          {unavailable ? 'Choose another time' : 'Back to available times'}
        </BounceButton>
      </form>
      <p className="field-note">Your details are only used for this booking.</p>
    </RippleSurface>
  )
}
