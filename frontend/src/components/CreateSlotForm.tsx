import { RippleSurface } from './RippleSurface'
import { BounceButton } from './BounceButton'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { api, errorMessage } from '../api'
import { today, toStartsAt } from '../time'
import { Icon } from './Icon'

export function CreateSlotForm({
  busy,
  onBusy,
  onCreated,
}: {
  busy: boolean
  onBusy: (value: boolean) => void
  onCreated: () => void
}) {
  const [date, setDate] = useState(today)
  const [time, setTime] = useState('10:00')
  const [duration, setDuration] = useState('30')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setError('')
    setSuccess('')
    let startsAt: string
    try {
      startsAt = toStartsAt(date, time)
    } catch (error) {
      setError(
        error instanceof RangeError
          ? 'This clock time is skipped or repeated by daylight saving. Choose another time.'
          : errorMessage(error),
      )
      return
    }
    onBusy(true)
    try {
      await api.createSlot(startsAt, Number(duration))
      setSuccess('Time published. It’s ready to book.')
      onCreated()
    } catch (error) {
      setError(errorMessage(error))
    } finally {
      onBusy(false)
    }
  }

  return (
    <RippleSurface className="card create-card" aria-labelledby="create-title">
      <span className="icon-tile">
        <Icon name="plus" />
      </span>
      <h2 id="create-title">Make some time.</h2>
      <p className="muted">
        Publish a time you’re free. Someone else can take it from there.
      </p>
      <form onSubmit={(event) => void submit(event)}>
        <fieldset disabled={busy}>
          <label htmlFor="slot-date">Date</label>
          <input
            id="slot-date"
            type="date"
            min={today()}
            required
            value={date}
            onChange={(event) => {
              setDate(event.target.value)
              setSuccess('')
            }}
          />
          <div className="form-row">
            <div>
              <label htmlFor="slot-time">Start time</label>
              <input
                id="slot-time"
                type="time"
                required
                value={time}
                onChange={(event) => {
                  setTime(event.target.value)
                  setSuccess('')
                }}
              />
            </div>
            <div>
              <label htmlFor="slot-duration">Duration</label>
              <select
                id="slot-duration"
                value={duration}
                onChange={(event) => {
                  setDuration(event.target.value)
                  setSuccess('')
                }}
              >
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
                <option value="45">45 minutes</option>
                <option value="60">60 minutes</option>
              </select>
            </div>
          </div>
          <p className="field-note">All times in Europe/Warsaw.</p>
          <BounceButton
            className="button primary full"
            type="submit"
            aria-busy={busy}
          >
            {busy ? 'Publishing…' : 'Publish availability'}
            {busy ? (
              <span className="button-spinner" aria-hidden="true" />
            ) : (
              <Icon name="plus" size={18} />
            )}
          </BounceButton>
        </fieldset>
        {error && (
          <p className="feedback error" role="alert">
            {error}
          </p>
        )}
        {success && (
          <p className="feedback success" role="status">
            {success}
          </p>
        )}
      </form>
    </RippleSurface>
  )
}
