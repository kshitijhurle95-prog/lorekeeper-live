import { describe, expect, it, vi } from 'vitest';
import { extractOutputText, summarizeMoment, validateSummary } from './ai.js';

describe('optional AI summaries', () => {
  it('extracts text from message output items and ignores non-text items', () => {
    expect(extractOutputText({ output: [{ type: 'reasoning' }, { type: 'message', content: [{ type: 'output_text', text: 'A dragon was found.' }] }] })).toBe('A dragon was found.');
  });
  it('rejects unsafe, empty, and overlong summaries', () => {
    expect(() => validateSummary('short')).toThrow();
    expect(() => validateSummary('A'.repeat(281))).toThrow();
    expect(() => validateSummary('<script>danger</script>')).toThrow();
  });
  it('returns a bounded summary from the Responses API and fails safely on provider errors', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(JSON.stringify({ output: [{ type: 'message', content: [{ type: 'output_text', text: 'Chat discovered a hidden dragon beneath the castle.' }] }] }), { status: 200 }));
    await expect(summarizeMoment('We found a hidden dragon', 'test-key', request)).resolves.toBe('Chat discovered a hidden dragon beneath the castle.');
    expect(JSON.parse(String(request.mock.calls[0]?.[1]?.body))).toMatchObject({ store: false });
    const unavailable = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status: 503 }));
    await expect(summarizeMoment('Original moment', 'test-key', unavailable)).rejects.toThrow('AI service returned 503');
  });
  it('does not make a request when no server key is configured', async () => {
    const request = vi.fn<typeof fetch>();
    await expect(summarizeMoment('Original moment', '', request)).rejects.toThrow(/not configured/);
    expect(request).not.toHaveBeenCalled();
  });
});
