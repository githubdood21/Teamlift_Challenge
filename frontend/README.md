# Frontend

React + TypeScript, built with Vite. See the root README for setup.

- App.tsx owns view selection, the slot list, refreshes, and booking confirmation.
- components/SlotList.tsx groups actual available slots by Warsaw calendar day.
- components/CreateSlotForm.tsx publishes a date, time, and duration.
- components/BookingPanel.tsx submits attendee details and handles booking conflicts.
- api.ts centralizes typed fetch calls and HTTP errors.
- time.ts uses Intl for display and Temporal for timezone-safe input conversion.

React state handles this small app without a routing or global-state dependency.
Requests use relative /api URLs; Vite proxies them to Nest in development.
The forms prevent duplicate submissions. A successful mutation refreshes the schedule;
a booking also removes its slot immediately. The server remains authoritative.
An expired slot is filtered locally every 30 seconds; availability can be refreshed
manually. Another visitor's booking is handled with a clear 409 conflict message.

All times are entered and displayed in Europe/Warsaw, even if the browser is in
another time zone. Ambiguous and nonexistent daylight-saving clock times are rejected.
Booking confirmation stays on the page; no email is sent.

From the repository root:
- npm run dev: both apps.
- npm run build -w frontend: production build.
- npm run test -w frontend: time conversion tests.

The layout switches to a single column on smaller screens. Form fields are labeled,
status/error messages use live regions, and controls support keyboard focus.
Production frontend hosting remains the next checkpoint.

## Interaction and animation

BounceButton is a native button used by actions, date choices, the view switch,
back/retry actions, and clickable slot rows. Each click plays a complete 0.44-second bounce,
independent of press duration, without delaying the action. Buttons have no ripples.
Repeated clicks replace the previous bounce from its current transform.

RippleSurface preserves section/aside/span semantics for decorative panel feedback.
It covers the availability, welcome, publishing, booking, and confirmation panels,
and the Time well spent badge. Static content clicks create a clipped ripple; clicks
on nested buttons, links, inputs, labels, and other controls do not. Text selection
is preserved. Decorative surfaces add no tab stops or fake button roles.

Motion durations in src/index.css are elapsed seconds:
- --motion-fast: 0.15s for color and selected-state transitions.
- --motion-bounce: 0.44s for compress/rebound/settle (Web Animations API).
- --motion-panel: 0.24s for booking and confirmation entry.
- --motion-ripple: 0.48s for decorative panel ripples.
- --motion-success: 0.42s for the confirmation check, after a 0.12s delay.

No animation uses frame counts. Reduced-motion preferences suppress decorative
motion, and disabled buttons do not activate. Component tests cover immediate
button activation, bounce lifecycle, reduced motion, disabled behavior, surface
ripple cleanup, and ignoring nested controls.

The refresh control uses Lucide’s RefreshCw icon and spins once every 0.8 seconds
while the schedule request is loading. It completes at least one full turn and
stops only at a revolution boundary after loading ends, using animationiteration
rather than a timer or frame count. Data updates are not delayed. It does not bounce. Reduced-motion mode
disables the spin; the busy state and disabled control still indicate loading.

CalendarBusyPeriods shows only start/end intervals from the connected primary
calendar for all visitors, with a seven-day date selector and refresh.
It uses local-midnight Warsaw boundaries, including across daylight-saving changes.
The public busy-times endpoint is separate from the bookable-slot list. Connecting
or disconnecting a calendar remains protected by the host key.
