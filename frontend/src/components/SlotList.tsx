import { RippleSurface } from './RippleSurface'
import { useState } from 'react'
import { RefreshButton } from './RefreshButton'
import type { Slot } from '../api'
import { dateKey, dayLabel, timeRange } from '../time'
import { Icon } from './Icon'
import { BounceButton } from './BounceButton'

export function SlotList({
  slots,
  loading,
  error,
  busy,
  host,
  selectedId,
  onSelect,
  onRefresh,
}: {
  slots: Slot[]
  loading: boolean
  error: string
  busy: boolean
  host: boolean
  selectedId?: string
  onSelect: (slot: Slot) => void
  onRefresh: () => void
}) {
  const [chosenDay, setChosenDay] = useState('')
  const days = [...new Set(slots.map((slot) => dateKey(slot.startsAt)))]
  const activeDay = days.includes(chosenDay) ? chosenDay : days[0]
  const visible = slots.filter((slot) => dateKey(slot.startsAt) === activeDay)

  return (
    <RippleSurface
      className="card availability"
      aria-labelledby="availability-title"
      aria-busy={loading}
    >
      <div className="section-heading">
        <div>
          <span className="eyebrow">
            {host ? 'YOUR SCHEDULE' : 'FIND YOUR MOMENT'}
          </span>
          <h2 id="availability-title">
            {host ? 'Published availability' : 'Available times'}
          </h2>
        </div>
        <RefreshButton loading={loading} busy={busy} onRefresh={onRefresh} />
      </div>
      <p className="muted list-intro">
        {host
          ? 'These times are open for booking. Reserved slots disappear automatically.'
          : 'Pick a day, then choose a time that works for you.'}
      </p>
      <div className="timezone">
        <span className="status-dot" />
        Europe/Warsaw
        <span className="timezone-note">All times shown in this zone</span>
      </div>
      {error && (
        <div className="feedback error" role="alert">
          {error}
          <BounceButton
            className="text-button"
            type="button"
            onClick={onRefresh}
            disabled={loading || busy}
          >
            Try again
          </BounceButton>
        </div>
      )}
      {loading && !slots.length ? (
        <div className="empty-state" role="status">
          <span className="loader" />
          <h3>Finding available times…</h3>
        </div>
      ) : !slots.length && !error ? (
        <div className="empty-state">
          <span className="empty-icon">
            <Icon name="calendar" size={30} />
          </span>
          <h3>
            {host
              ? 'A little space for possibilities.'
              : 'Good conversations take a little planning.'}
          </h3>
          <p>
            {host
              ? 'Publish your first time using the form. It will appear here.'
              : 'No times are available yet. Check back soon or refresh the schedule.'}
          </p>
        </div>
      ) : slots.length > 0 ? (
        <>
          <div className="day-picker" aria-label="Available days">
            {days.map((day) => {
              const slot = slots.find((slot) => dateKey(slot.startsAt) === day)!
              return (
                <BounceButton
                  className={'day-chip' + (activeDay === day ? ' active' : '')}
                  type="button"
                  key={day}
                  aria-pressed={activeDay === day}
                  disabled={busy}
                  onClick={() => setChosenDay(day)}
                >
                  {dayLabel(slot.startsAt)}
                </BounceButton>
              )
            })}
          </div>
          <div className="slots">
            {visible.map((slot) => {
              const content = (
                <>
                  <span className="slot-time">
                    <Icon name="clock" />
                    <span className="slot-description">
                      <strong>{timeRange(slot)}</strong>
                      <span>{slot.durationMinutes} minute conversation</span>
                    </span>
                  </span>
                  {host ? (
                    <span className="available-badge">Available</span>
                  ) : (
                    <span className="slot-button" aria-hidden="true">
                      {selectedId === slot.id ? 'Selected' : 'Book'}
                      <Icon name="arrow" size={16} />
                    </span>
                  )}
                </>
              )
              return host ? (
                <div className="slot-row" key={slot.id}>
                  {content}
                </div>
              ) : (
                <BounceButton
                  className={
                    'slot-row slot-card' +
                    (selectedId === slot.id ? ' selected' : '')
                  }
                  type="button"
                  key={slot.id}
                  disabled={busy || Boolean(error)}
                  onClick={() => onSelect(slot)}
                  aria-pressed={selectedId === slot.id}
                  aria-label={
                    'Book ' + dayLabel(slot.startsAt) + ', ' + timeRange(slot)
                  }
                >
                  {content}
                </BounceButton>
              )
            })}
          </div>
          <p className="list-footer">
            <Icon name="check" size={15} />
            {host
              ? 'A booked time is automatically removed from this list.'
              : 'One booking per slot. Your time is yours.'}
          </p>
        </>
      ) : null}
    </RippleSurface>
  )
}
