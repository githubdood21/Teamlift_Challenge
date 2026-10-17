import { afterEach, expect, it, vi } from 'vitest';
import { GeminiClient, STANDARD_CONFIRMATION } from './gemini.client.js';

const { generateContent, configureClient } = vi.hoisted(() => ({ generateContent: vi.fn(), configureClient: vi.fn() }));
vi.mock('@google/genai', () => ({ GoogleGenAI: class {
  constructor(options: unknown) { configureClient(options); }
  models = { generateContent };
} }));
const meeting = { startsAt: new Date('2026-11-01T10:00:00Z'), durationMinutes: 30 };
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

it('returns a standard confirmation without calling Google when the key is blank', async () => {
  vi.stubEnv('GEMINI_API_KEY', '');
  expect(await new GeminiClient().generate(meeting)).toEqual({ message: STANDARD_CONFIRMATION, source: 'standard' });
  expect(generateContent).not.toHaveBeenCalled();
});

it('sends only meeting details and normalizes the generated text', async () => {
  vi.stubEnv('GEMINI_API_KEY', 'test-key');
  generateContent.mockResolvedValue({ text: ' Your time is reserved.\n See you soon! ' });
  expect(await new GeminiClient().generate(meeting)).toEqual({ message: 'Your time is reserved. See you soon!', source: 'ai' });
  const input = generateContent.mock.calls[0][0];
  expect(JSON.parse(input.contents)).toEqual({ status: 'already booked', startsAt: meeting.startsAt.toISOString(), durationMinutes: 30, timeZone: 'Europe/Warsaw' });
  expect(input.config.abortSignal).toBeInstanceOf(AbortSignal);
  expect(configureClient).toHaveBeenCalledWith({ apiKey: 'test-key', httpOptions: { timeout: 15000 } });
});

it.each(['', '<script>bad</script>', 'https://example.com', 'a'.repeat(401)])('falls back for unusable output %s', async text => {
  vi.stubEnv('GEMINI_API_KEY', 'test-key');
  generateContent.mockResolvedValue({ text });
  expect((await new GeminiClient().generate(meeting)).source).toBe('standard');
});

it('falls back on provider errors including timeout and quota failures', async () => {
  vi.stubEnv('GEMINI_API_KEY', 'test-key');
  generateContent.mockRejectedValue(new Error('Simulated provider failure'));
  expect((await new GeminiClient().generate(meeting)).message).toBe(STANDARD_CONFIRMATION);
});
