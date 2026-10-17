# Common Time

A small scheduling app built step by step for the TeamLift internship challenge.
The original brief is preserved in [docs/CHALLENGE.md](docs/CHALLENGE.md).

## Current checkpoint

React + TypeScript frontend, NestJS API with the Express adapter, and a working
health endpoint. The PostgreSQL-backed API creates and lists slots and books them
with validation and database-enforced double-booking protection. The live Render
connection, migration, restart persistence, and concurrent booking behavior are verified.
The optional Google Calendar integration includes protected host setup, encrypted
token storage, busy-time filtering, and a booking recheck. Gemini can generate a
friendly confirmation after booking, with a saved standard fallback. Example
credentials are blank; see [Calendar setup](docs/GOOGLE_CALENDAR.md) and
[Gemini setup](docs/AI_CONFIRMATIONS.md).

Render deployment and GitHub Actions CI/release configuration are ready. The hosted
app serves React and the API from one Node service. Hosting still needs the app
pushed to GitHub and Render's environment/OAuth URLs configured.

The frontend now supports publishing availability and booking slots, including
loading, empty, error, conflict, and confirmation states. All times display in Europe/Warsaw.

## Run locally

Use Node.js 24.15 or a newer Node 24 release and npm 11.
From the repository root:

```sh
npm install
# Copy backend/.env.example to backend/.env and configure DATABASE_URL first.
# Start PostgreSQL locally, or use a hosted development database.
npm run migration:run -w backend
npm run dev
```

- Frontend: http://localhost:5173
- API health: http://localhost:3000/api/health

The page opens in **Book a time**. Use **Manage availability** to publish a future
time, then switch back to book it with a name and email. If the API is still starting,
use the refresh button on the schedule. Stop both processes with Ctrl+C.

This repository uses npm workspaces: one install and one lockfile cover both apps.
Vite forwards browser requests under /api to Nest on port 3000 during development.
The frontend uses relative API URLs, avoiding a separate CORS configuration locally.
Keep port 3000 for local development because the proxy points to that port.
The backend respects PORT when deployed.

## Run from VS Code

Open the repository root in VS Code. Complete the database setup and migration
above, and run `npm install` once. In **Run and Debug**
(Ctrl+Shift+D), select **Full app: frontend + backend** and press **F5**.
Both servers run in integrated terminals with file watching. Vite opens the app in
your default browser when ready. If the API is still starting, refresh the page.

Stopping either session stops both servers. You can also launch **Backend: NestJS**
or **Frontend: Vite** separately. The backend supports TypeScript breakpoints;
use browser developer tools for React code. No extra VS Code extensions are required.
Configuration: [.vscode/launch.json](.vscode/launch.json).

## Commands

| Command | Purpose |
| --- | --- |
| npm run dev | Run both apps with file watching |
| npm run build | Build both apps |
| npm run lint | Check both apps |
| npm test | Run frontend time-zone tests and isolated backend tests |
| npm start | Run the built API only |
| npm run migration:run -w backend | Build the API and apply pending migrations |
| npm run migration:show -w backend | Show applied/pending migrations |
| npm run test:calendar -w backend | Verify calendar integration using PostgreSQL and simulated Google |
| npm run test:confirmation -w backend | Verify saved AI confirmations using PostgreSQL and simulated Gemini |
| npm run package:release | Package the existing frontend/backend builds with a checksum |

Production output: frontend/dist and backend/dist. With NODE_ENV=production, Nest
serves the built React app and /api together. Local development uses Vite's proxy.
`render.yaml` configures a free Node Web Service using the existing PostgreSQL database.
See [deployment and GitHub Releases](docs/DEPLOYMENT.md) for setup steps.

## Structure

- frontend/src/App.tsx: scheduler state and composition of the booking/host views.
- frontend/src/components/: availability list, publishing form, booking form.
- frontend/src/api.ts: typed API requests and HTTP error handling.
- frontend/src/time.ts: Europe/Warsaw formatting and daylight-saving-safe input conversion.
- frontend/vite.config.ts: development server and API proxy.
- backend/src/main.ts: create the Nest/Express server and set the /api prefix.
- backend/src/app.controller.ts: map GET /api/health to a handler.
- backend/src/app.service.ts: provide the health response.
- PLAN.md: milestones and proposed domain/API design.
- docs/DEPLOYMENT.md: database and deployment tradeoffs.

## PostgreSQL setup

1. Copy backend/.env.example to backend/.env (PowerShell: `Copy-Item backend/.env.example backend/.env`).
2. Set DATABASE_URL to your database connection string. This file is ignored by Git.
3. Run `npm run migration:run -w backend` before starting the app.

Our selected development setup uses Render PostgreSQL too: put its external URL
in backend/.env and enable TLS as described below. No local database installation
is required. The hosted demo will use the internal URL instead.

As an optional alternative, for a local database with Docker Desktop, run `docker compose up -d --wait` from
the root. The example URL matches compose.yaml. Stop the database with
`docker compose stop`; its named volume retains data. These sample credentials
are only for local development and the port is bound to localhost.

Alternatively, install PostgreSQL directly and create a database, or use Render's
external database URL for development. Append `?sslmode=require` to that external
URL (or `&sslmode=require` if it already has query parameters). Use a separate
database for local development if you want to keep the hosted demo data isolated.

Nest loads backend/.env, with server environment variables taking precedence.
Startup requires a working database connection. Migrations are explicit and
`synchronize` is disabled: starting the app does not silently change the schema.
The first migration creates slots and bookings, including the unique slot booking
constraint. The second adds encrypted calendar connections and expiring OAuth attempts.
The third stores optional booking confirmation messages. Entities and services implement the scheduling endpoints. See
[docs/BACKEND.md](docs/BACKEND.md) for the architecture and API contract.

`npm test` does not require a database: frontend tests cover time conversion, and the
health HTTP test replaces DatabaseModule.
It verifies routing, not PostgreSQL connectivity or schema behavior. Run
`npm run test:integration -w backend` for the real database suite after migrations.

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the Render plan.

## AI tools

Optional Gemini booking confirmations are implemented. Fill `GEMINI_API_KEY` in
`backend/.env`, restart the backend, and make a new booking. Without a key, the
normal confirmation works. See [AI setup and behavior](docs/AI_CONFIRMATIONS.md).

OpenAI Codex helped plan, scaffold, implement, and test the backend and frontend. Implementation is being reviewed step by step so it can
be explained in the interview.

## Next improvements

Deploy the prepared Render configuration and verify the hosted integrations. Consider full host authentication,
preventing overlapping availability, and cancellation if the scope grows.
