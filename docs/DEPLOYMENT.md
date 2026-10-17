# Deploy Common Time on Render

## Architecture

Use one **Free Node Web Service**, serving the compiled React page and NestJS
Express API at one HTTPS origin, plus the existing Free PostgreSQL database.
No Docker, registry, separate Static Site, Redis or worker is required.
The same origin keeps the Calendar OAuth state cookie first-party and preserves
the frontend's relative `/api` URLs. Production startup requires both builds.
Local development still runs Vite and Nest separately.

The whole page waits for the free web service to wake up after 15 minutes idle
(approximately one minute). PostgreSQL expires 30 days after its creation; deploying
the app does not reset this. Runtime files are ephemeral; data stays in Postgres.

## First deployment

1. Commit and push the app, `render.yaml`, and `.github/workflows/` to GitHub `main`.
   Local files alone are not deployed and do not trigger GitHub Actions.
2. Check that the Blueprint's region matches the existing database (`frankfurt`
   currently). It deliberately does not create another database.
3. In Render, choose **New > Blueprint**, select this GitHub repository and review
   the proposed **Free Web Service**. An existing Static Site is not needed for this
   configuration. The public URL belongs to the Web Service.
4. Enter environment values when prompted. Optional integration keys can be left
   blank and added later. Never upload `backend/.env` to GitHub.
5. Set `APP_ORIGIN` and `GOOGLE_REDIRECT_URI` to the actual assigned service URL.
   Render may add a suffix to the name. Save/redeploy after correcting these if
   the final URL was not available during initial setup.
6. Add the hosted callback to the Google **Web application OAuth client's Authorized
   redirect URIs**. Keep the local callback too.
7. Wait for CI and Render deployment to finish. Check `/api/health`, then the root
   page, publishing, booking, a stale second booking, Calendar and Gemini.

### Render settings

These values are in `render.yaml` and can also be entered manually:

| Setting | Value |
| --- | --- |
| Runtime / Compute | Node / Free |
| Branch | main |
| Root Directory | Empty (repository root) |
| Build Command | `npm ci --include=dev && npm run build` |
| Start Command | `npm run start:deploy -w backend` |
| Health Check Path | `/api/health` |
| Auto-Deploy | After CI Checks Pass |
| Node version | 24.15.0 (also pinned in `.nvmrc`) |

`--include=dev` installs the build tools even with `NODE_ENV=production`.
Startup applies compiled TypeORM migrations, then starts Nest on Render's `PORT`,
bound to `0.0.0.0`. Migration failure prevents startup. This is appropriate for the
single-instance demo. The health route verifies Nest is running, not a fresh
database/provider connectivity check. Database connection is required at startup.

### Backend environment

| Variable | Hosted value |
| --- | --- |
| `NODE_ENV` | `production` |
| `NODE_VERSION` | `24.15.0` |
| `DATABASE_URL` | Existing database's **internal** URL in the same region |
| `APP_ORIGIN` | `https://YOUR-ACTUAL-SERVICE.onrender.com` |
| `HOST_ADMIN_KEY` | Existing admin key or a new random secret of at least 32 characters |
| `CALENDAR_TOKEN_ENCRYPTION_KEY` | Existing 64-hex-character key if reusing the connected database |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_REDIRECT_URI` | `https://YOUR-ACTUAL-SERVICE.onrender.com/api/calendar/callback` |
| `GEMINI_API_KEY` | Google AI Studio API key |
| `GEMINI_MODEL` | `gemini-3.1-flash-lite` |

Keep the encryption key stable: changing it makes saved Calendar tokens unreadable.
With the same Google client and encryption key, the existing connection can be
reused. Reconnecting from the hosted app checks the new callback configuration.
Credentials live only in Render; CI/releases need no provider or Render secrets.
Locally, continue using the external database URL with TLS in `backend/.env`.
Explicit server environment variables take precedence over `.env` values.

## CI/CD

`.github/workflows/ci.yml` runs on pull requests targeting `main` and pushes to
`main`. It installs locked dependencies, lints, runs unit/UI/HTTP tests, builds
both apps, applies migrations to a disposable PostgreSQL 18 service, then runs
scheduling, Calendar and confirmation integration tests. Providers are simulated;
CI never contacts your calendar or Gemini. It also extracts the archive, installs
production dependencies only, and starts it to verify the page, assets and API.
A successful run uploads a compiled
archive and SHA-256 checksum as a seven-day Actions artifact.

Render's `autoDeployTrigger: checksPass` deploys `main` after CI checks pass. Render
builds that commit from GitHub; it does not download the Actions artifact. Initial
and manual deployments are explicit Render operations; check CI results for those
too. No deploy hook secret is needed. **Render's Live status** confirms deployment,
while passing GitHub Actions confirms verification. Inspect Render logs if migration
or startup fails. Avoid adding a deploy hook for the same automatic deployments.

Optionally protect `main` in GitHub and require the `Lint, test and build` check.

## GitHub Releases

Once the desired commit is on `main`, create and push a version tag:

```sh
git tag -a v1.0.0 -m "Common Time v1.0.0"
git push origin v1.0.0
```

`.github/workflows/release.yml` reruns the complete CI workflow for the tag,
requires its commit to belong to `main`, verifies the checksum, and publishes a
GitHub Release with generated notes, the compiled app archive and `SHA256SUMS`.
Only the publishing job has `contents: write`, using GitHub's automatic token.
No personal token or npm publication is needed. Use a new version tag for each
release. Tags with a suffix are marked as prereleases. Tags do not deploy Render;
Render follows verified `main` commits.

The archive includes compiled app files, migrations, dependency manifests/lockfile,
blank environment examples and runtime instructions. It excludes real environment
files and `node_modules`. Consumers install target-platform production dependencies
with `npm ci --omit=dev`. This is a Node app archive, not a standalone executable.

Build locally using `npm run build` then `npm run package:release`. Outputs go to
ignored `release/`. To start the compiled app locally in PowerShell:

```powershell
$env:NODE_ENV = 'production'
npm run start:deploy -w backend
```

Use a free `PORT` if the development API is running. Afterwards run
`Remove-Item Env:NODE_ENV` to return to Vite development.

## Verification and rollback

- Publish and book a slot; verify a second booking is rejected.
- Restart/redeploy; confirm data survives independently of runtime files.
- Check the hosted Calendar callback and Gemini with a new booking.
- Check the database expiration before sharing the demo.

Render supports rollback to recent deployments. An app rollback does not revert
the database schema. Current migrations add tables/nullable columns; future
destructive migrations need separate planning. Do not casually revert migrations
against the shared demo database.

Sources: [Blueprint specification](https://render.com/docs/blueprint-spec),
[automatic deployments](https://render.com/docs/deploys),
[free limits](https://render.com/docs/free), and
[GitHub release publishing](https://cli.github.com/manual/gh_release_create).
