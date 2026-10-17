# Backend

NestJS with its Express adapter. See the root README for setup and commands.

Request flow: main.ts starts the app, AppModule registers the controller and service,
AppController routes GET /api/health, and AppService returns the response.

From the repository root: npm run start:dev -w backend.
