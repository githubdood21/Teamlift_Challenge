# Google Calendar setup and implementation

## Scope

One host connects their primary Google Calendar. Common Time requests only
https://www.googleapis.com/auth/calendar.freebusy. It reads busy intervals, not
event titles or descriptions, and never creates calendar events or invitations.
Booking visitors do not sign in to Google.

The host's Calendar settings screen lives under **Manage availability**. Unlock it
with HOST_ADMIN_KEY from backend/.env. This protects calendar management only;
publishing slots remains public as allowed by the original challenge.

## Your one-time Google Cloud setup

1. Create or select a project in Google Cloud Console.
2. Enable the Google Calendar API.
3. Configure Google Auth Platform branding/audience and the OAuth consent screen.
   For development, use Testing and add your Google account as a test user.
4. Add the availability-only calendar.freebusy scope in Data Access.
5. Create an OAuth client of type **Web application**.
6. Register this exact authorized redirect URI:
   http://localhost:3000/api/calendar/callback
7. Fill these existing blank entries in backend/.env:

   GOOGLE_CLIENT_ID=your-client-id
   GOOGLE_CLIENT_SECRET=your-client-secret
   GOOGLE_REDIRECT_URI=http://localhost:3000/api/calendar/callback

APP_ORIGIN is http://localhost:5173 locally. Use localhost consistently rather than
mixing it with 127.0.0.1, because the consent callback is bound to a browser cookie.
Restart the backend after changing .env. In VS Code, stop and restart the app launch.

Local HOST_ADMIN_KEY and CALENDAR_TOKEN_ENCRYPTION_KEY were generated privately.
The admin key is what you enter in the protected screen. Keep the encryption key
unchanged after connecting: it decrypts the stored Google refresh token. Neither key
belongs in frontend environment variables, Git, URLs, screenshots, or chat messages.

For a fresh checkout, generate a long random admin key (at least 32 characters) and
an encryption key of 32 random bytes encoded as 64 hexadecimal characters. Set
those in the backend environment before connecting.

## Connect and test manually

1. Open Manage availability and enter your host admin key.
2. If setup is incomplete, the unlocked screen lists missing environment field names.
3. Click Connect Google Calendar and complete consent on Google's own screen.
4. On return, unlock again to manage the saved connection. Admin keys are held only
   in React memory; navigation intentionally clears them.
5. Publish a future slot, then create a busy event in Google Calendar overlapping it.
6. Refresh Common Time: the slot should disappear. Remove the event and refresh:
   the unbooked slot should return.
7. Try booking a slot that became busy after it was selected: the API should reject
   it with 409 and the UI should let you choose another time.

OAuth apps in Testing that request Calendar access have refresh tokens that expire
after seven days. Reconnect when needed. The application has been tested with
simulated Google responses; live consent and a real calendar still need verification
after your credentials are configured.

## Visible busy periods

The public scheduling page displays **Busy in Google Calendar** for all visitors.
Choose a week start date or use its refresh button. Busy periods appear as unavailable
rows with dates and times in Europe/Warsaw, a Google source label, and the last-check time.
This view refreshes with the main schedule too. It does not show event titles, guests,
or descriptions and does not present Google events as Common Time bookings.

The busy-period endpoint is intentionally public for this demo, uses no-store responses,
and limits each requested date range to 32 days. Visitors see start/end times only.
The host admin key is still required to connect, disconnect, or inspect setup settings. Google
lookup failures show an error rather than claiming the calendar is free.

## Security and persistence

- Management endpoints require the host key as an Authorization bearer header.
  Comparison uses fixed-length SHA-256 digests and timingSafeEqual.
- Authorization uses random, expiring, single-use state bound to an HttpOnly,
  SameSite=Lax browser cookie, plus PKCE (S256).
- The authorization code is exchanged by the backend using Google's official
  google-auth-library. Refresh tokens and PKCE verifiers are encrypted with
  AES-256-GCM before storage in PostgreSQL.
- Tokens are never returned to the frontend. Callback redirects contain only a
  generic connected/denied/failed outcome, and the frontend removes that parameter.
- The disconnect action removes the local connection and pending attempts and tries
  to revoke the Google grant. If revocation fails, the UI explains how to remove
  access in the Google Account as well.
- This is a single-host demo using an admin key rather than a full account system.

## Availability behavior

With no connected calendar, the original scheduling flow continues unchanged.
After connection, listing fetches busy periods for the requested slot range and
filters overlaps without deleting stored slots. Adjacent intervals do not overlap.
Publishing also checks Google and rejects conflicting times with 409 before saving.
Each booking checks Google again while holding the slot's PostgreSQL row lock.
Google errors, revoked credentials, and incomplete connected configurations return
503 instead of advertising unverified availability. Provider requests have timeouts.

The database lock and unique constraint prevent duplicate bookings within Common
Time. They cannot atomically prevent someone adding an external Google event at
the same instant as a booking; the final recheck reduces that race.

## API

| Method | Path | Protection |
| --- | --- | --- |
| GET | /api/calendar/status | Host admin key |
| GET | /api/calendar/busy?start=...&end=... | Public busy times only; ISO timestamps with timezone, at most 32 days |
| POST | /api/calendar/connect | Host admin key; returns authorization URL and sets state cookie |
| GET | /api/calendar/callback | Browser-bound, expiring OAuth state + PKCE |
| DELETE | /api/calendar/connection | Host admin key |

Calendar tables are created by the second migration. Run
npm run migration:run -w backend on a fresh or updated database before starting.

## Automated verification

- npm test: unit, component, crypto, OAuth URL/scope, overlap and isolated HTTP tests.
- npm run test:calendar -w backend: real PostgreSQL in a temporary schema with a
  simulated Google provider. Covers unauthorized access, state/cookie binding,
  replay/expiry/denial, encrypted storage, filtering, direct booking conflicts,
  Google outages, and disconnect behavior. Only its generated schema is removed.
- npm run test:integration -w backend: original real-database booking tests.

## References

- [Google web-server OAuth](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Calendar authorization scopes](https://developers.google.com/workspace/calendar/api/auth)
- [FreeBusy API](https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query)
- [OAuth token expiration](https://developers.google.com/identity/protocols/oauth2/)
