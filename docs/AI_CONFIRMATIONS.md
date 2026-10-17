# Optional Gemini confirmation

After a booking succeeds, its receipt screen immediately confirms the reservation.
A separate request asks Gemini for a short acknowledgement, then displays it with an
“AI-written confirmation” label. It does not send email or create calendar events.

## Setup

1. Create a Gemini API key in [Google AI Studio](https://aistudio.google.com/api-keys).
2. Fill `GEMINI_API_KEY` in `backend/.env`. This is separate from Calendar OAuth;
   keep the key on the backend and never use a `VITE_` variable for it.
3. Keep `GEMINI_MODEL=gemini-3.1-flash-lite` or select a model available to your project.
4. Restart the backend and make a new booking to test it.

The selected model currently offers a free tier, subject to Google's quotas and
eligibility; see [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing).
The key is deliberately blank in the example and local environment files.
Live generation still needs verification after you supply a key.

## Behavior and boundaries

- `POST /api/slots/:slotId/bookings/:bookingId/confirmation` requires both matching
  UUIDs from a successful booking receipt. Unknown receipts return 404. The receipt
  identifier is an unguessable capability; there is no public bookings directory.
- Generation runs after the booking transaction commits. Only the start timestamp,
  duration, display time zone and confirmed status go to Gemini, never attendee names
  or email addresses. The endpoint accepts no arbitrary prompt.
- The provider has a fifteen-second timeout (Google requires at least ten seconds). Missing keys, quota errors, timeouts and
  unusable output return a standard confirmation. A separate HTTP failure also
  leaves the frontend's standard confirmation visible.
- Text is rendered as plain React text. Precise dates and times come from the saved
  slot, independently of the generated prose.
- The first message is saved in PostgreSQL, including standard fallbacks. Retries
  reuse it. After configuring a key, create a new booking to see generated text.
- Requests for the same receipt share one pending promise per server process.
  At most two provider calls run at once per process; excess requests use the
  standard message. Multiple server instances may duplicate provider work, but a
  conditional database update preserves the first saved result. Booking safety
  remains enforced independently by PostgreSQL.

Run `npm test` for mocked provider and UI checks, and
`npm run test:confirmation -w backend` for real PostgreSQL receipt, caching and
fallback checks in a disposable schema. Neither test suite calls Gemini.
