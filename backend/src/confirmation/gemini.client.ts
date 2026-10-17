import { Injectable } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';

export const STANDARD_CONFIRMATION = 'Your time is reserved. We look forward to the conversation.';
export type Confirmation = { message: string; source: 'ai' | 'standard' };
export type MeetingDetails = { startsAt: Date; durationMinutes: number };
// Google rejects deadlines below ten seconds before attempting generation.
const GENERATION_TIMEOUT_MS = 15000;

@Injectable()
export class GeminiClient {
  async generate(meeting: MeetingDetails): Promise<Confirmation> {
    const key = process.env.GEMINI_API_KEY?.trim();
    const fallback: Confirmation = { message: STANDARD_CONFIRMATION, source: 'standard' };
    if (!key) return fallback;
    try {
      const client = new GoogleGenAI({ apiKey: key, httpOptions: { timeout: GENERATION_TIMEOUT_MS } });
      const result = await client.models.generateContent({
        model: process.env.GEMINI_MODEL?.trim() || 'gemini-3.1-flash-lite',
        contents: JSON.stringify({
          status: 'already booked', startsAt: meeting.startsAt.toISOString(),
          durationMinutes: meeting.durationMinutes, timeZone: 'Europe/Warsaw',
        }),
        config: {
          abortSignal: AbortSignal.timeout(GENERATION_TIMEOUT_MS),
          systemInstruction: 'Write one or two short, friendly plain-text sentences acknowledging an already confirmed booking in Common Time. Under 45 words. You may mention its duration. The exact date and time are displayed separately, so do not repeat them. Do not invent names, locations, links, or other details. Do not promise email, invitations, reminders, or calendar events. Output only the acknowledgement, without markdown.',
          maxOutputTokens: 160,
          temperature: 0.6,
        },
      });
      const message = result.text?.replace(/\s+/g, ' ').trim();
      if (!message || message.length > 400 || /[<>]|https?:\/\//i.test(message)) return fallback;
      return { message, source: 'ai' };
    } catch {
      // Missing quota, invalid keys, timeouts, safety blocks: the booking is unaffected.
      // Provider error objects can contain credentials, so never log them.
      return fallback;
    }
  }
}
