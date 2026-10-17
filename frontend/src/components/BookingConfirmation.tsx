import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { api } from '../api'
import type { ConfirmationMessage, Slot } from '../api'
import { dayLabel, timeRange } from '../time'
import { BounceButton } from './BounceButton'
import { Icon } from './Icon'
import { RippleSurface } from './RippleSurface'

const standard: ConfirmationMessage = { message: 'Your time is reserved. We look forward to the conversation.', source: 'standard' }

export function BookingConfirmation({ slot, name, bookingId, onClose }: {
  slot: Slot; name: string; bookingId: string; onClose: () => void
}) {
  const [result, setResult] = useState(standard)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      try {
        const message = await api.confirmation(slot.id, bookingId, controller.signal)
        if (!controller.signal.aborted) setResult(message)
      } catch {
        // This is optional presentation: the reservation has already succeeded.
        if (!controller.signal.aborted) setResult(standard)
      } finally { if (!controller.signal.aborted) setLoading(false) }
    }
    void load()
    return () => controller.abort()
  }, [slot.id, bookingId])

  return <RippleSurface className="card confirmation" role="status">
    <span className="confirmation-check"><Icon name="check" size={28} /></span>
    <p className="eyebrow">IT’S IN THE DIARY</p>
    <h2>You’re all set,<br />{name}.</h2>
    <p className="muted">{result.message}</p>
    {loading ? <p className="confirmation-ai-note"><span className="loader" aria-hidden="true" />Adding a friendly note…</p>
      : result.source === 'ai' ? <p className="confirmation-ai-note"><Sparkles size={14} aria-hidden="true" />AI-written confirmation</p> : null}
    <div className="confirmation-details"><strong>{dayLabel(slot.startsAt)}</strong><span>{timeRange(slot)}</span><span>Europe/Warsaw · {slot.durationMinutes} minutes</span></div>
    <BounceButton className="button secondary full" type="button" onClick={onClose}>Back to schedule<Icon name="arrow" size={18} /></BounceButton>
  </RippleSurface>
}
