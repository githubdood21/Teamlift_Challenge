import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const version = process.env.RELEASE_VERSION || 'snapshot-local';
if (!/^(?:v?\d+\.\d+\.\d+(?:-[\da-zA-Z.-]+)?|snapshot-[\da-zA-Z-]+)$/.test(version)) {
  throw new Error('Use a release version such as v1.0.0, or snapshot-local.');
}
const output = join(root, 'release');
await mkdir(output, { recursive: true });
const stage = await mkdtemp(join(output, '.stage-'));
const archiveName = `common-time-${version}.tar.gz`;
try {
  // Explicit allowlist: never copy a workspace tree or backend/.env.
  for (const path of [
    'package.json', 'package-lock.json', '.nvmrc',
    'backend/package.json', 'backend/.env.example', 'backend/dist',
    'frontend/package.json', 'frontend/dist',
    'docs/DEPLOYMENT.md', 'docs/AI_CONFIRMATIONS.md', 'docs/GOOGLE_CALENDAR.md',
  ]) {
    const target = join(stage, path);
    await mkdir(resolve(target, '..'), { recursive: true });
    await cp(join(root, path), target, { recursive: true });
  }
  await writeFile(join(stage, 'RELEASE.json'), JSON.stringify({ version, commit: process.env.GITHUB_SHA || null }, null, 2) + '\n');
  await writeFile(join(stage, 'RUNNING.md'), `# Common Time compiled release

Requires Node 24.15.x or a later Node 24 release, npm, and PostgreSQL.
Extract this archive into its own directory. Run npm ci --omit=dev.
Copy backend/.env.example to backend/.env and fill the required values.
Set NODE_ENV=production and run npm run start:deploy -w backend.
The app listens on PORT (default 3000); /api/health is its health endpoint.
See docs/DEPLOYMENT.md for environment settings and OAuth configuration.
This archive contains compiled files, migrations and dependency manifests.
It excludes credentials and node_modules; npm installs dependencies on the target.
`);
  const archive = spawnSync('tar', ['-czf', join(output, archiveName), '-C', stage, '.'], { stdio: 'inherit' });
  if (archive.error) throw archive.error;
  if (archive.status !== 0) throw new Error('Could not create the release archive.');
  const hash = createHash('sha256').update(await readFile(join(output, archiveName))).digest('hex');
  await writeFile(join(output, 'SHA256SUMS'), `${hash}  ${archiveName}\n`);
  console.log(`Created release/${archiveName} and release/SHA256SUMS`);
} finally {
  // mkdtemp allocated this directory under our release output; verify before deletion.
  if (!resolve(stage).startsWith(resolve(output) + '/.stage-') && !resolve(stage).startsWith(resolve(output) + '\\.stage-')) {
    throw new Error('Unexpected release staging path');
  }
  await rm(stage, { recursive: true, force: true });
}
