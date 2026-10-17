import { BookingConfirmation } from './components/BookingConfirmation'
import { CalendarBusyPeriods } from './components/CalendarBusyPeriods'
import { RippleSurface } from './components/RippleSurface'
import { BounceButton } from './components/BounceButton'
import { useEffect, useState } from 'react'
import { api, errorMessage } from './api'
import type { BookingReceipt, Slot } from './api'
import { BookingPanel } from './components/BookingPanel'
import { CreateSlotForm } from './components/CreateSlotForm'
import { Icon } from './components/Icon'
import { SlotList } from './components/SlotList'
import { CalendarSettings } from './components/CalendarSettings'
import './App.css'

function App() {
  const [view, setView] = useState<'book' | 'host'>(() =>
    new URLSearchParams(window.location.search).has('calendar')
      ? 'host'
      : 'book',
  )
  const [slots, setSlots] = useState<Slot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState<Slot | null>(null)
  const [confirmation, setConfirmation] = useState<{
    slot: Slot
    name: string
    bookingId: string
  } | null>(null)
  const [now, setNow] = useState(Date.now)
  const reload = () => setRefresh((value) => value + 1)

  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      setLoading(true)
      setError('')
      try {
        setSlots(await api.slots(controller.signal))
      } catch (error) {
        if (!controller.signal.aborted) setError(errorMessage(error))
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [refresh])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000)
    return () => window.clearInterval(timer)
  }, [])

  const available = slots.filter(
    (slot) => new Date(slot.startsAt).getTime() > now,
  )
  function changeView(next: 'book' | 'host') {
    setView(next)
    setSelected(null)
    setConfirmation(null)
    reload()
  }
  function booked(name: string, receipt: BookingReceipt) {
    if (!selected) return
    setConfirmation({ slot: selected, name, bookingId: receipt.id })
    setSlots((previous) => previous.filter((slot) => slot.id !== selected.id))
    setSelected(null)
    reload()
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="/" aria-label="Common Time home">
          <span className="brand-mark">
            <Icon name="calendar" size={21} />
          </span>
          common time
        </a>
        <span className="header-note">A little time. A good conversation.</span>
        <span className="header-badge">
          <span className="status-dot" />
          Made for connection
        </span>
      </header>
      <main>
        <section className="page-heading">
          <div>
            <p className="eyebrow">LESS BACK-AND-FORTH. MORE FACE TIME.</p>
            <h1>
              {view === 'host' ? (
                <>
                  Good things start
                  <br />
                  with <em>making time.</em>
                </>
              ) : (
                <>
                  Find a time.
                  <br />
                  Start a <em>conversation.</em>
                </>
              )}
            </h1>
            <p className="hero-description">
              {view === 'host'
                ? 'Share a little space in your day. We’ll take care of the booking.'
                : 'Choose a moment that works for you. No accounts, no endless email threads. Just a time to connect.'}
            </p>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="art-calendar">
              <div className="art-calendar-top">
                <i />
                <i />
              </div>
              <div className="art-grid">
                {Array.from({ length: 12 }, (_, index) => (
                  <span className={index === 6 ? 'art-picked' : ''} key={index}>
                    {index === 6 ? <Icon name="check" size={22} /> : ''}
                  </span>
                ))}
              </div>
            </div>
            <RippleSurface as="span" className="art-tag">
              <Icon name="clock" size={16} />
              Time well spent.
            </RippleSurface>
          </div>
        </section>
        <div className="workspace-toolbar">
          <div className="view-switch" role="group" aria-label="Scheduler view">
            <BounceButton
              type="button"
              aria-pressed={view === 'book'}
              className={view === 'book' ? 'active' : ''}
              disabled={busy}
              onClick={() => changeView('book')}
            >
              Book a time
            </BounceButton>
            <BounceButton
              type="button"
              aria-pressed={view === 'host'}
              className={view === 'host' ? 'active' : ''}
              disabled={busy}
              onClick={() => changeView('host')}
            >
              Manage availability
            </BounceButton>
          </div>
          <span className="toolbar-note">
            <Icon name="calendar" size={16} />
            One host. A world of possibilities.
          </span>
        </div>
        {view === 'host' && <CalendarSettings onChanged={reload} />}
        <div
          className={'workspace ' + (view === 'host' ? 'host-workspace' : '')}
        >
          {view === 'host' && (
            <CreateSlotForm busy={busy} onBusy={setBusy} onCreated={reload} />
          )}
          <SlotList
            slots={available}
            loading={loading}
            error={error}
            busy={busy}
            host={view === 'host'}
            selectedId={selected?.id}
            onSelect={(slot) => {
              setSelected(slot)
              setConfirmation(null)
            }}
            onRefresh={reload}
          />
          {view === 'book' &&
            (confirmation ? (
              <BookingConfirmation key={confirmation.bookingId} slot={confirmation.slot} name={confirmation.name} bookingId={confirmation.bookingId} onClose={() => setConfirmation(null)} />
            ) : selected ? (
              <BookingPanel
                key={selected.id}
                slot={selected}
                busy={busy}
                onBusy={setBusy}
                onCancel={() => setSelected(null)}
                onBooked={booked}
                onUnavailable={() => {
                  setSlots((previous) =>
                    previous.filter((slot) => slot.id !== selected.id),
                  )
                  reload()
                }}
              />
            ) : (
              <RippleSurface as="aside" className="welcome-panel">
                <span className="icon-tile">
                  <Icon name="clock" size={24} />
                </span>
                <h2>
                  A moment to connect. <br />A simpler way to meet.
                </h2>
                <p>
                  Pick an available time to get started. The rest only takes a
                  minute.
                </p>
                <ol className="steps">
                  <li>
                    <span>01</span>
                    <div>
                      <strong>Find your time</strong>
                      <p>Choose a day and an open slot.</p>
                    </div>
                  </li>
                  <li>
                    <span>02</span>
                    <div>
                      <strong>Make it yours</strong>
                      <p>Add your name and email.</p>
                    </div>
                  </li>
                  <li>
                    <span>03</span>
                    <div>
                      <strong>You’re ready to meet</strong>
                      <p>Your time is reserved instantly.</p>
                    </div>
                  </li>
                </ol>
                <div className="welcome-foot">
                  A small step toward a good conversation.
                </div>
              </RippleSurface>
            ))}
        </div>
        <CalendarBusyPeriods refreshKey={refresh} busy={busy} />
        <p className="scope-note">
          {view === 'host'
            ? 'Single-host demo · Publishing is open to everyone; no account needed.'
            : 'Thoughtfully simple scheduling. No account needed.'}
        </p>
      </main>
      <footer>
        <span className="footer-brand">common time</span>
        <span>Make room for what matters.</span>
        <span>Built for a little more human connection.</span>
      </footer>
    </div>
  )
}

export default App
