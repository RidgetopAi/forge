import { describe, it, expect, vi } from 'vitest';
import { BlockAssembler } from './blockAssembler.js';
import type { ActivityMessage } from '../types/activity.js';
import type { AnthropicSSEEvent } from '../types/anthropic.js';

describe('BlockAssembler', () => {
  const mockSession = { runName: 'test', instanceNumber: 1, totalInstances: 3, project: 'forge' };

  it('assembles thinking blocks', () => {
    const activities: ActivityMessage[] = [];
    const assembler = new BlockAssembler((a) => activities.push(a), () => mockSession);

    assembler.process({ type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: 'Let me ' } });
    assembler.process({ type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: 'think about this...' } });
    assembler.process({ type: 'content_block_stop', index: 0 });

    expect(activities).toHaveLength(1);
    expect(activities[0].type).toBe('thinking');
    if (activities[0].type === 'thinking') {
      expect(activities[0].content).toBe('Let me think about this...');
      expect(activities[0].session).toEqual(mockSession);
    }
  });

  it('assembles text blocks', () => {
    const activities: ActivityMessage[] = [];
    const assembler = new BlockAssembler((a) => activities.push(a), () => mockSession);

    assembler.process({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: 'Hello' } });
    assembler.process({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: ' world!' } });
    assembler.process({ type: 'content_block_stop', index: 0 });

    expect(activities).toHaveLength(1);
    expect(activities[0].type).toBe('text');
    if (activities[0].type === 'text') {
      expect(activities[0].content).toBe('Hello world!');
    }
  });

  it('assembles tool_use blocks with JSON parsing', () => {
    const activities: ActivityMessage[] = [];
    const assembler = new BlockAssembler((a) => activities.push(a), () => mockSession);

    assembler.process({ 
      type: 'content_block_start', 
      index: 0, 
      content_block: { type: 'tool_use', id: 'tool_123', name: 'read_file', input: {} } 
    });
    assembler.process({ type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: '{"path":' } });
    assembler.process({ type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: '"/test.txt"}' } });
    assembler.process({ type: 'content_block_stop', index: 0 });

    expect(activities).toHaveLength(1);
    expect(activities[0].type).toBe('tool_call');
    if (activities[0].type === 'tool_call') {
      expect(activities[0].toolName).toBe('read_file');
      expect(activities[0].toolId).toBe('tool_123');
      expect(activities[0].input).toEqual({ path: '/test.txt' });
    }
  });

  it('handles invalid JSON in tool_use by returning raw string', () => {
    const activities: ActivityMessage[] = [];
    const assembler = new BlockAssembler((a) => activities.push(a), () => mockSession);

    assembler.process({ 
      type: 'content_block_start', 
      index: 0, 
      content_block: { type: 'tool_use', id: 'tool_456', name: 'bad_tool', input: {} } 
    });
    assembler.process({ type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: 'not valid json' } });
    assembler.process({ type: 'content_block_stop', index: 0 });

    expect(activities).toHaveLength(1);
    if (activities[0].type === 'tool_call') {
      expect(activities[0].input).toBe('not valid json');
    }
  });

  it('handles multiple concurrent blocks', () => {
    const activities: ActivityMessage[] = [];
    const assembler = new BlockAssembler((a) => activities.push(a), () => mockSession);

    assembler.process({ type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: 'A' } });
    assembler.process({ type: 'content_block_start', index: 1, content_block: { type: 'text', text: 'B' } });
    assembler.process({ type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: '1' } });
    assembler.process({ type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: '2' } });
    assembler.process({ type: 'content_block_stop', index: 0 });
    assembler.process({ type: 'content_block_stop', index: 1 });

    expect(activities).toHaveLength(2);
    expect(activities[0].type).toBe('thinking');
    expect(activities[1].type).toBe('text');
    if (activities[0].type === 'thinking') expect(activities[0].content).toBe('A1');
    if (activities[1].type === 'text') expect(activities[1].content).toBe('B2');
  });

  it('emits error activities', () => {
    const activities: ActivityMessage[] = [];
    const assembler = new BlockAssembler((a) => activities.push(a), () => mockSession);

    assembler.process({ type: 'error', error: { type: 'rate_limit', message: 'Too many requests' } });

    expect(activities).toHaveLength(1);
    expect(activities[0].type).toBe('error');
    if (activities[0].type === 'error') {
      expect(activities[0].message).toBe('Too many requests');
      expect(activities[0].code).toBe('rate_limit');
    }
  });

  it('handles null session', () => {
    const activities: ActivityMessage[] = [];
    const assembler = new BlockAssembler((a) => activities.push(a), () => null);

    assembler.process({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: 'test' } });
    assembler.process({ type: 'content_block_stop', index: 0 });

    expect(activities).toHaveLength(1);
    expect(activities[0].session).toBeNull();
  });
});
