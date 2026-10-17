import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { setTimeout } from 'node:timers/promises';

// Run against an extracted archive after npm ci --omit=dev. DATABASE_URL must be set.
if (!process.argv[2] || !process.env.DATABASE_URL) throw new Error('Provide the extracted release directory and DATABASE_URL.');
const directory = resolve(process.argv[2]);
const socket = createServer();
await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
const port = socket.address().port;
await new Promise(resolve => socket.close(resolve));
const server = spawn(process.execPath, ['backend/dist/main.js'], {
  cwd: directory,
  env: { ...process.env, NODE_ENV: 'production', PORT: String(port) },
  // Do not emit connection/provider configuration in CI or local logs.
  stdio: 'ignore',
});
const stopped = new Promise(resolve => server.once('exit', resolve));
server.once('error', () => {});
const origin = `http://127.0.0.1:${port}`;
try {
  let healthy = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null) throw new Error('Compiled release exited before becoming healthy.');
    try {
      const response = await fetch(origin + '/api/health', { signal: AbortSignal.timeout(1000) });
      assert.deepEqual(await response.json(), { status: 'ok' });
      healthy = response.ok;
    } catch { /* Server may still be opening its database connection. */ }
    if (healthy) break;
    await setTimeout(250);
  }
  assert.ok(healthy, 'Compiled release did not become healthy.');
  const page = await fetch(origin, { signal: AbortSignal.timeout(2000) });
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /<div id="root">/);
  const script = html.match(/src="(\/assets\/[^\"]+\.js)"/);
  assert.ok(script, 'Built page must reference its compiled JavaScript asset.');
  const asset = await fetch(origin + script[1], { signal: AbortSignal.timeout(2000) });
  assert.equal(asset.status, 200);
  assert.match(asset.headers.get('content-type'), /javascript/);
  const missing = await fetch(origin + '/api/not-a-route', { signal: AbortSignal.timeout(2000) });
  assert.equal(missing.status, 404);
  assert.match(missing.headers.get('content-type'), /json/);
  console.log('Compiled release passed production dependency, frontend, asset and API smoke checks.');
} finally {
  if (server.exitCode === null) server.kill('SIGTERM');
  await stopped;
}
