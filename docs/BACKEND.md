# Backend walkthrough

## Structure and responsibilities

Each feature lives in its own folder: slots/ and bookings/.

- Entities map TypeScript objects to PostgreSQL columns. Slot stores the start instant
  and duration; Booking stores the attendee and a reference to one slot.
- DTOs define accepted request fields and validation rules. They are runtime classes
  because TypeScript types alone disappear when the app runs.
- Controllers map HTTP routes to service calls. They parse IDs and receive validated DTOs.
- Services contain the business rules and persistence operations.
- Modules register these components with Nest's dependency injection container.
- DatabaseModule owns connection setup. A migration owns schema changes.
- configure-app.ts installs the same /api prefix and validation rules in startup and tests.

TypeORM already provides repositories, so there is no extra repository wrapper layer.
SlotsService uses an injected repository. BookingsService uses a transaction's entity
manager so the lock, checks, and insert share one database transaction and connection.

## HTTP contract

| Method | Path | Request | Success |
| --- | --- | --- | --- |
| GET | /api/health | None | 200: process health |
| POST | /api/slots | startsAt, durationMinutes | 201: slot |
| GET | /api/slots | None | 200: future, unbooked slots ordered by start |
| POST | /api/slots/:slotId/bookings | name, email | 201: id, slotId, createdAt |

Slot responses contain id, startsAt, durationMinutes, and createdAt. Dates serialize
as ISO timestamps. Public responses do not expose attendee names or email addresses.

Example create-slot body:

```json
{ "startsAt": "2099-01-15T10:00:00Z", "durationMinutes": 30 }
```

Example booking body:

```json
{ "name": "Alex", "email": "alex@example.com" }
```

Dates must be valid, future ISO timestamps with a time and explicit timezone. Duration
is an integer from 1 to 1440 minutes. Names are trimmed and must be nonempty, up to
100 characters. Email is trimmed, validated, and limited to 254 characters. Extra body
fields are rejected. IDs must be UUID v4. Invalid input returns 400; an unknown slot
returns 404; a booked or already-started slot returns 409.

## Why no queue is required

Booking runs inside a PostgreSQL transaction:

1. Select the slot with a write lock (SELECT ... FOR UPDATE).
2. Check that it exists, is in the future, and has no booking.
3. Insert the booking and commit.

Another request for the same slot waits for the row lock. Once it acquires the lock,
it sees the committed booking and receives 409. Different slot rows can be locked
independently. Locks are released on commit or rollback. The unique constraint on
bookings.slot_id also prevents duplicates from code paths that bypass the service.
Its PostgreSQL unique violation is translated to 409 for that specific constraint.

This coordination lives in PostgreSQL and works across API processes. An in-memory
queue would need additional coordination across processes and is unnecessary here.

## Tests and scope

Run npm test from the root for the isolated controller and health routing tests.
Run npm run test:integration -w backend for the real PostgreSQL tests. Apply migrations
first. The integration suite uses DATABASE_URL, creates its own records, and deletes
only those records during cleanup. It opens temporary HTTP listeners and closes the
application when finished; it does not leave development servers running.

The database suite checks invalid requests, persistence after app restarts, booking
eight concurrent requests into one slot (one 201 and seven 409 responses), the actual
unique constraint, hidden booked slots, and expired slots.

No authentication, cancellations, rescheduling, pagination, or prevention of overlapping
host-created slots is included. Each slot is independently bookable. One display time
zone remains a frontend decision; the API already accepts explicit offsets and stores
instants in PostgreSQL timestamptz columns.
