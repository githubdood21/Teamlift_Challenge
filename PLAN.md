# Scheduling app: implementation plan

## Scope

Build a single-host scheduler with one displayed time zone, no login, and four core actions:
create a slot, list available slots, book a slot, and prevent a second booking.
Finish the required flow before considering AI or Google Calendar integration.

Selected stack: React + TypeScript for the frontend and NestJS with Express for the API.
Database: PostgreSQL using TypeORM. Use Render free PostgreSQL for the hosted demo;
the user accepts its 30-day lifetime. Local development also connects to Render
using the external URL in backend/.env. See docs/DEPLOYMENT.md.
Keep this as one repository with `frontend/` and `backend/` directories.

## Working rhythm

Work through one milestone at a time. At each checkpoint, explain what changed,
verify its behavior, and discuss the main tradeoff before continuing.

## Milestones

1. **Define the contract.** Agree on the scope, data model, and API below.
2. **Set up the foundation.** Scaffold the frontend and backend, configure the database,
   and document local startup. Verify the frontend can reach the API.
3. **Create and list slots.** Add persistent storage, request validation, and a minimal
   host form and available-slot list. Verify slots survive a server restart.
4. **Book a slot.** Add the booking form and API, enforce one booking per slot in the
   database, and handle a slot becoming unavailable while someone is viewing it.
5. **Polish and verify.** Improve layout, accessibility, loading, empty, error, and
   confirmation states. Test validation and concurrent attempts to book the same slot.
6. **Prepare delivery.** Deploy, write setup and design notes, disclose AI tool use,
   and rehearse a short explanation of the end-to-end flow.

Optional Google Calendar integration selected: protected host connection screen,
encrypted tokens, conflict filtering, and booking-time checks. Live Google verification
remains pending the user-provided project credentials.

## First piece: data and API design

### Data model

- `Slot`: `id`, `startsAt`, `durationMinutes`, `createdAt`.
- `Booking`: `id`, `slotId` (unique foreign key), `name`, `email`, `createdAt`.

Store timestamps as timezone-aware PostgreSQL timestamptz values representing UTC instants. Display dates and times
in one explicitly labeled app time zone; choose that zone before implementing date input.
Compute a slot's end from its start and duration rather than storing both.

The unique constraint on `Booking.slotId` is the final protection against double
bookings. A frontend check alone cannot protect against two simultaneous requests.
The API should translate a conflict on that constraint into HTTP 409.

For the initial scope, each slot is independently bookable. Preventing overlapping
host-created slots is a separate policy to decide before implementing slot creation.
There are no cancellation, rescheduling, or account features in the required scope.

### API contract

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Verify API connectivity |
| POST | `/api/slots` | Create a future slot from `startsAt` and `durationMinutes` |
| GET | `/api/slots` | Return future, unbooked slots ordered by start time |
| POST | `/api/slots/:id/bookings` | Book a slot with `name` and `email` |

Validate dates, positive integer durations, nonempty names, and email format on the
server. Return 400 for invalid input, 404 for an unknown slot, and 409 for an already
booked or no-longer-bookable slot. Booking responses must not expose other attendees'
details. The public slot list must not include names or emails.

### Interview talking points

- React owns the form and display state; the API owns validation and persistence.
- The database preserves data across restarts and enforces booking uniqueness.
- A stale browser can still attempt a booking, so the UI must handle HTTP 409 clearly.
- No login is an explicit simplification from the brief; publishing slots is public
  in this challenge implementation.
- Start with the required user journey and spend remaining time on usability.

## Progress

- [x] Read the challenge and draft the plan, data model, and API contract.
- [x] Confirm React TypeScript and NestJS with Express.
- [x] Scaffold both apps and connect the frontend to the API health endpoint.
- [x] Select PostgreSQL and Render for the hosted demo (30-day lifetime accepted).
- [x] Add TypeORM connection configuration, an initial migration, and local PostgreSQL setup instructions.
- [x] Configure Render PostgreSQL and apply the initial migration.
- [x] Add slot/booking entities, DTOs, services, controllers, and feature modules.
- [x] Verify validation, restart persistence, and concurrent bookings against PostgreSQL.
- [x] Implement and browser-verify frontend slot creation, booking, and conflict recovery.
- [x] Use Europe/Warsaw for input and display, with tests for daylight saving.

- [x] Implement optional Google Calendar integration and protected host settings.
- [x] Verify OAuth/security and availability behavior with simulated Google and PostgreSQL.
- [x] Configure Google project credentials and verify real consent/calendar conflicts.
- [x] Display Google busy periods publicly for the demo calendar.
- [x] Add optional Gemini confirmation messages with persisted results and standard fallbacks.
- [x] Supply a Gemini key and verify live generation with a provider-compatible timeout.
- [x] Add production frontend serving, Render configuration and GitHub Actions CI/releases.
- [ ] Push the app, configure Render secrets/OAuth URLs and verify the hosted demo.
