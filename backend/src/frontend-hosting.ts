import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NestExpressApplication } from '@nestjs/platform-express';

export function configureFrontend(
  app: NestExpressApplication,
  directory = fileURLToPath(new URL('../../frontend/dist', import.meta.url)),
): void {
  if (!existsSync(join(directory, 'index.html'))) {
    throw new Error('Frontend build missing. Run npm run build from the repository root.');
  }
  // Both the UI and /api share an origin, including the Calendar OAuth cookie.
  // The app uses only the root page, so unknown URLs remain genuine 404 responses.
  app.useStaticAssets(directory, { index: 'index.html', dotfiles: 'deny', maxAge: 0 });
}
