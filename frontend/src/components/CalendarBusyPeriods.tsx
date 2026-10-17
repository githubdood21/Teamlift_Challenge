import { RippleSurface } from './RippleSurface'
import { useEffect, useState } from 'react'
import { CalendarX2 } from 'lucide-react'
import { api, errorMessage } from '../api'
import type { CalendarBusyResult } from '../api'
import { calendarWeek, dateKey, dayLabel, timeLabel, today } from '../time'
import { RefreshButton } from './RefreshButton'

export function CalendarBusyPeriods({
  refreshKey,
  busy,
}: {
  refreshKey: number
  busy: boolean
}) {
  const [startDate, setStartDate] = useState(today)
  const [refresh, setRefresh] = useState(0)
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState<CalendarBusyResult | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      setLoading(true)
      setError('')
      setResult(null)
      try {
        if (!startDate) throw new Error('Choose a week start date.')
        const range = calendarWeek(startDate)
        const response = await api.calendarBusy(
          range.start,
          range.end,
          controller.signal,
        )
        if (!controller.signal.aborted) setResult(response)
      } catch (error) {
        if (!controller.signal.aborted) setError(errorMessage(error))
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [startDate, refresh, refreshKey])

  return (
    <RippleSurface
      className="card calendar-busy"
      aria-labelledby="calendar-busy-title"
      aria-busy={loading}
    >
      <div className="section-heading">
        <div>
          <span className="eyebrow">GOOGLE AVAILABILITY</span>
          <h2 id="calendar-busy-title">Busy in Google Calendar</h2>
        </div>
        <RefreshButton
          label="Refresh Google Calendar busy periods"
          loading={loading}
          busy={busy}
          onRefresh={() => setRefresh((value) => value + 1)}
        />
      </div>
      <p className="muted">
        These periods block bookings in Common Time. Event names and details
        stay private.
      </p>
      <div className="busy-range">
        <div>
          <label htmlFor="busy-week-start">Week starting</label>
          <input
            id="busy-week-start"
            type="date"
            value={startDate}
            disabled={busy}
            onChange={(event) => setStartDate(event.target.value)}
          />
        </div>
        <span>7 days · Europe/Warsaw</span>
      </div>
      {loading ? (
        <p className="busy-message" role="status">
          Checking Google Calendar…
        </p>
      ) : error ? (
        <p className="feedback error" role="alert">
          {error}
        </p>
      ) : result && !result.connected ? (
        <p className="busy-message" role="status">
          Google Calendar is not connected. Available slots are based on the
          host’s published times.
        </p>
      ) : result && !result.periods.length ? (
        <p className="busy-message" role="status">
          No busy periods reported for this week.
        </p>
      ) : result ? (
        <ul className="busy-periods">
          {result.periods.map((period) => (
            <li key={period.start + period.end}>
              <span className="busy-period-icon">
                <CalendarX2 size={18} aria-hidden="true" />
              </span>
              <div>
                <strong>{dayLabel(period.start)}</strong>
                <span>
                  {timeLabel(period.start)} –{' '}
                  {dateKey(period.start) !== dateKey(period.end)
                    ? dayLabel(period.end) + ', '
                    : ''}
                  {timeLabel(period.end)}
                </span>
              </div>
              <span className="busy-period-badge">Unavailable</span>
            </li>
          ))}
        </ul>
      ) : null}
      {result?.connected && !loading && !error && (
        <p className="field-note">
          Source: Google Calendar · Checked {timeLabel(result.checkedAt)} ·
          Refresh to check for changes.
        </p>
      )}
    </RippleSurface>
  )
}
