import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { CalendarDays, LockKeyhole, Link2, Unlink } from 'lucide-react'
import { api, ApiError, errorMessage } from '../api'
import type { CalendarStatus } from '../api'
import { BounceButton } from './BounceButton'
import { RippleSurface } from './RippleSurface'

export function CalendarSettings({ onChanged }: { onChanged: () => void }) {
  const [input, setInput] = useState('')
  const [adminKey, setAdminKey] = useState('')
  const [status, setStatus] = useState<CalendarStatus | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState(() => {
    const result = new URLSearchParams(window.location.search).get('calendar')
    if (result === 'connected')
      return 'Google Calendar connected. Unlock settings to manage the connection.'
    if (result === 'denied')
      return 'Google permission was not granted. Your previous calendar connection is unchanged.'
    if (result === 'failed')
      return 'Calendar connection could not be completed. Unlock settings and try again.'
    return ''
  })
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)

  useEffect(() => {
    const url = new URL(window.location.href)
    if (url.searchParams.has('calendar')) {
      url.searchParams.delete('calendar')
      window.history.replaceState(
        null,
        '',
        url.pathname + url.search + url.hash,
      )
    }
  }, [])

  async function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError('')
    const key = input.trim()
    try {
      setStatus(await api.calendarStatus(key))
      setAdminKey(key)
      setInput('')
    } catch (error) {
      setError(
        error instanceof ApiError && error.status === 503
          ? 'Host settings are unavailable. Check HOST_ADMIN_KEY and the backend connection.'
          : errorMessage(error),
      )
    } finally {
      setPending(false)
    }
  }

  async function connect() {
    setPending(true)
    setError('')
    try {
      const result = await api.connectCalendar(adminKey)
      const url = new URL(result.url)
      if (url.origin !== 'https://accounts.google.com')
        throw new Error('Unexpected authorization destination.')
      window.location.assign(url.toString())
    } catch (error) {
      setError(errorMessage(error))
      setPending(false)
    }
  }

  async function disconnect() {
    setPending(true)
    setError('')
    try {
      const result = await api.disconnectCalendar(adminKey)
      setStatus(
        (previous) =>
          previous && { ...previous, connected: false, connectedAt: null },
      )
      setNotice(
        result.revoked
          ? 'Calendar disconnected. Published slots are available without Google checks.'
          : 'Calendar disconnected locally. You can also remove Common Time access in your Google Account.',
      )
      setConfirmDisconnect(false)
      onChanged()
    } catch (error) {
      setError(errorMessage(error))
    } finally {
      setPending(false)
    }
  }

  return (
    <RippleSurface
      className="card calendar-settings"
      aria-labelledby="calendar-settings-title"
    >
      <div className="calendar-settings-heading">
        <span className="icon-tile">
          <CalendarDays size={23} aria-hidden="true" />
        </span>
        <div>
          <span className="eyebrow">HOST ONLY</span>
          <h2 id="calendar-settings-title">Your calendar, in the loop.</h2>
        </div>
        <span className="calendar-status">
          <span className="status-dot" />
          {adminKey
            ? status?.connected
              ? 'Connected'
              : 'Not connected'
            : 'Protected settings'}
        </span>
      </div>
      <p className="muted">
        Connect your primary Google Calendar to hide times that clash with
        existing events. We only check availability; event details stay private.
      </p>
      {notice && (
        <p className="feedback success" role="status">
          {notice}
        </p>
      )}
      {!adminKey ? (
        <form
          className="calendar-unlock"
          onSubmit={(event) => void unlock(event)}
        >
          <div>
            <label htmlFor="host-admin-key">Host admin key</label>
            <input
              id="host-admin-key"
              type="password"
              required
              autoComplete="off"
              value={input}
              disabled={pending}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Enter your private host key"
              aria-describedby="host-key-note"
            />
          </div>
          <BounceButton
            className="button secondary"
            type="submit"
            disabled={pending}
          >
            {pending ? (
              <span className="loader" aria-hidden="true" />
            ) : (
              <LockKeyhole size={16} aria-hidden="true" />
            )}
            {pending ? 'Unlocking…' : 'Unlock settings'}
          </BounceButton>
          <p className="field-note" id="host-key-note">
            Use HOST_ADMIN_KEY from backend/.env. The key stays in memory and is
            cleared when you leave this screen.
          </p>
        </form>
      ) : (
        <>
          {!status?.configured && (
            <div className="calendar-setup-note">
              <strong>One-time Google setup needed</strong>
              <p>
                Fill these fields in backend/.env, then restart the backend and
                unlock again:
              </p>
              <ul>
                {status?.missing.map((name) => (
                  <li key={name}>
                    <code>{name}</code>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="calendar-actions">
            <BounceButton
              className="button primary"
              type="button"
              disabled={pending || !status?.configured}
              onClick={() => void connect()}
            >
              <Link2 size={16} aria-hidden="true" />
              {pending
                ? 'Working…'
                : status?.connected
                  ? 'Reconnect Google Calendar'
                  : 'Connect Google Calendar'}
            </BounceButton>
            {status?.connected && (
              <BounceButton
                className="button secondary"
                type="button"
                disabled={pending}
                onClick={() => setConfirmDisconnect(true)}
              >
                <Unlink size={16} aria-hidden="true" />
                Disconnect
              </BounceButton>
            )}
            <BounceButton
              className="text-button"
              type="button"
              disabled={pending}
              onClick={() => {
                setAdminKey('')
                setStatus(null)
                setConfirmDisconnect(false)
                setError('')
              }}
            >
              Lock settings
            </BounceButton>
          </div>
          {confirmDisconnect && (
            <div className="calendar-setup-note">
              <p>
                Disconnect Google Calendar? Booking will continue using only the
                availability you publish here.
              </p>
              <div className="calendar-actions">
                <BounceButton
                  className="button secondary"
                  type="button"
                  disabled={pending}
                  onClick={() => void disconnect()}
                >
                  Confirm disconnect
                </BounceButton>
                <BounceButton
                  className="text-button"
                  type="button"
                  disabled={pending}
                  onClick={() => setConfirmDisconnect(false)}
                >
                  Keep connected
                </BounceButton>
              </div>
            </div>
          )}
          <p className="field-note">
            You’ll approve access on Google’s own screen. Booking visitors never
            need to sign in.
          </p>
        </>
      )}
      {error && (
        <p className="feedback error" role="alert">
          {error}
        </p>
      )}
    </RippleSurface>
  )
}
