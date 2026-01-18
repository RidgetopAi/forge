import { describe, it, expect } from 'vitest';
import { extractToolResults } from './requestTap.js';

describe('extractToolResults', () => {
  const mockSession = { runName: 'test', instanceNumber: 1, totalInstances: 3, project: 'forge' };

  it('extracts tool_result blocks from messages', () => {
    const body = JSON.stringify({
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'tool_123',
              content: 'File contents here',
            },
          ],
        },
      ],
    });

    const results = extractToolResults(Buffer.from(body), mockSession);

    expect(results).toHaveLength(1);
    expect(results[0].type).toBe('tool_result');
    expect(results[0].toolId).toBe('tool_123');
    expect(results[0].content).toBe('File contents here');
    expect(results[0].isError).toBe(false);
    expect(results[0].session).toEqual(mockSession);
  });

  it('extracts multiple tool_results', () => {
    const body = JSON.stringify({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'tool_result', tool_use_id: 'tool_1', content: 'result 1' },
            { type: 'tool_result', tool_use_id: 'tool_2', content: 'result 2' },
          ],
        },
      ],
    });

    const results = extractToolResults(Buffer.from(body), mockSession);

    expect(results).toHaveLength(2);
    expect(results[0].toolId).toBe('tool_1');
    expect(results[1].toolId).toBe('tool_2');
  });

  it('handles is_error flag', () => {
    const body = JSON.stringify({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'tool_result', tool_use_id: 'tool_err', content: 'Error message', is_error: true },
          ],
        },
      ],
    });

    const results = extractToolResults(Buffer.from(body), mockSession);

    expect(results).toHaveLength(1);
    expect(results[0].isError).toBe(true);
  });

  it('returns empty array for non-JSON body', () => {
    const results = extractToolResults(Buffer.from('not json'), mockSession);
    expect(results).toHaveLength(0);
  });

  it('returns empty array for request without messages', () => {
    const body = JSON.stringify({ model: 'claude-3' });
    const results = extractToolResults(Buffer.from(body), mockSession);
    expect(results).toHaveLength(0);
  });

  it('handles null session', () => {
    const body = JSON.stringify({
      messages: [
        {
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: 'tool_x', content: 'test' }],
        },
      ],
    });

    const results = extractToolResults(Buffer.from(body), null);

    expect(results).toHaveLength(1);
    expect(results[0].session).toBeNull();
  });

  it('ignores non-tool_result content blocks', () => {
    const body = JSON.stringify({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'hello' },
            { type: 'tool_result', tool_use_id: 'tool_only', content: 'result' },
          ],
        },
      ],
    });

    const results = extractToolResults(Buffer.from(body), mockSession);

    expect(results).toHaveLength(1);
    expect(results[0].toolId).toBe('tool_only');
  });
});
