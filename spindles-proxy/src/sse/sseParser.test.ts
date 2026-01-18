import { describe, it, expect, vi } from 'vitest';
import { SSEParser, type SSEEvent } from './sseParser.js';

describe('SSEParser', () => {
  it('parses a simple data event', () => {
    const events: SSEEvent[] = [];
    const parser = new SSEParser((e) => events.push(e));
    
    parser.feed('data: {"type":"ping"}\n\n');
    
    expect(events).toHaveLength(1);
    expect(events[0].data).toBe('{"type":"ping"}');
    expect(events[0].event).toBeUndefined();
  });

  it('parses event with event type', () => {
    const events: SSEEvent[] = [];
    const parser = new SSEParser((e) => events.push(e));
    
    parser.feed('event: message_start\ndata: {"type":"message_start"}\n\n');
    
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe('message_start');
    expect(events[0].data).toBe('{"type":"message_start"}');
  });

  it('handles chunk boundaries in the middle of a line', () => {
    const events: SSEEvent[] = [];
    const parser = new SSEParser((e) => events.push(e));
    
    parser.feed('data: {"typ');
    parser.feed('e":"ping"}\n\n');
    
    expect(events).toHaveLength(1);
    expect(events[0].data).toBe('{"type":"ping"}');
  });

  it('handles chunk boundaries at newlines', () => {
    const events: SSEEvent[] = [];
    const parser = new SSEParser((e) => events.push(e));
    
    parser.feed('data: {"type":"ping"}\n');
    parser.feed('\n');
    
    expect(events).toHaveLength(1);
    expect(events[0].data).toBe('{"type":"ping"}');
  });

  it('handles multiple events in one chunk', () => {
    const events: SSEEvent[] = [];
    const parser = new SSEParser((e) => events.push(e));
    
    parser.feed('data: {"type":"ping"}\n\ndata: {"type":"pong"}\n\n');
    
    expect(events).toHaveLength(2);
    expect(events[0].data).toBe('{"type":"ping"}');
    expect(events[1].data).toBe('{"type":"pong"}');
  });

  it('handles multi-line data', () => {
    const events: SSEEvent[] = [];
    const parser = new SSEParser((e) => events.push(e));
    
    parser.feed('data: line1\ndata: line2\n\n');
    
    expect(events).toHaveLength(1);
    expect(events[0].data).toBe('line1\nline2');
  });

  it('ignores comment lines', () => {
    const events: SSEEvent[] = [];
    const parser = new SSEParser((e) => events.push(e));
    
    parser.feed(': this is a comment\ndata: {"type":"ping"}\n\n');
    
    expect(events).toHaveLength(1);
    expect(events[0].data).toBe('{"type":"ping"}');
  });

  it('ignores [DONE] data', () => {
    const events: SSEEvent[] = [];
    const parser = new SSEParser((e) => events.push(e));
    
    parser.feed('data: [DONE]\n\n');
    
    expect(events).toHaveLength(0);
  });

  it('handles carriage return line endings', () => {
    const events: SSEEvent[] = [];
    const parser = new SSEParser((e) => events.push(e));
    
    parser.feed('data: {"type":"ping"}\r\n\r\n');
    
    expect(events).toHaveLength(1);
    expect(events[0].data).toBe('{"type":"ping"}');
  });

  it('handles fragmented chunks across multiple feeds', () => {
    const events: SSEEvent[] = [];
    const parser = new SSEParser((e) => events.push(e));
    
    parser.feed('eve');
    parser.feed('nt: test');
    parser.feed('\ndat');
    parser.feed('a: hello');
    parser.feed('\n\n');
    
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe('test');
    expect(events[0].data).toBe('hello');
  });

  it('handles empty events (no data lines)', () => {
    const events: SSEEvent[] = [];
    const parser = new SSEParser((e) => events.push(e));
    
    parser.feed('event: keep-alive\n\n');
    
    expect(events).toHaveLength(0);
  });

  it('strips leading space from field values', () => {
    const events: SSEEvent[] = [];
    const parser = new SSEParser((e) => events.push(e));
    
    parser.feed('data:no-space\n\n');
    parser.feed('data: with-space\n\n');
    
    expect(events).toHaveLength(2);
    expect(events[0].data).toBe('no-space');
    expect(events[1].data).toBe('with-space');
  });
});
