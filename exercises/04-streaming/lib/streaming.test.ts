/**
 * Tests for Streaming
 *
 * Run with: bun test
 */

import { describe, test, expect, mock } from 'bun:test';
import {
  StreamAccumulator,
  createInitialState,
  type StreamChunk,
} from './streaming';

// =============================================================================
// StreamAccumulator Tests
// =============================================================================

describe('StreamAccumulator', () => {
  test('accumulates content from chunks', () => {
    const acc = new StreamAccumulator();
    acc.start();

    acc.addChunk({ content: 'Hello', done: false });
    acc.addChunk({ content: ' ', done: false });
    acc.addChunk({ content: 'World', done: false });

    expect(acc.getContent()).toBe('Hello World');
  });

  test('tracks token count', () => {
    const acc = new StreamAccumulator();
    acc.start();

    acc.addChunk({ content: 'a', done: false });
    acc.addChunk({ content: 'b', done: false });
    acc.addChunk({ content: 'c', done: false });

    const metrics = acc.getMetrics();
    expect(metrics.tokenCount).toBe(3);
  });

  test('ignores empty content', () => {
    const acc = new StreamAccumulator();
    acc.start();

    acc.addChunk({ content: 'a', done: false });
    acc.addChunk({ content: '', done: false });
    acc.addChunk({ content: 'b', done: false });

    expect(acc.getContent()).toBe('ab');
    expect(acc.getMetrics().tokenCount).toBe(2);
  });

  test('handles done chunks', () => {
    const acc = new StreamAccumulator();
    acc.start();

    acc.addChunk({ content: 'text', done: false });
    acc.addChunk({ content: '', done: true, finishReason: 'stop' });

    expect(acc.getContent()).toBe('text');
  });

  test('resets on start', () => {
    const acc = new StreamAccumulator();

    acc.start();
    acc.addChunk({ content: 'first', done: false });

    acc.start();
    acc.addChunk({ content: 'second', done: false });

    expect(acc.getContent()).toBe('second');
  });

  test('calculates metrics', async () => {
    const acc = new StreamAccumulator();
    acc.start();

    // Add some delay to get measurable metrics
    await new Promise((r) => setTimeout(r, 10));
    acc.addChunk({ content: 'a', done: false });

    await new Promise((r) => setTimeout(r, 10));
    acc.addChunk({ content: 'b', done: false });

    const metrics = acc.getMetrics();

    expect(metrics.totalMs).toBeGreaterThan(0);
    expect(metrics.firstTokenMs).toBeGreaterThan(0);
    expect(metrics.tokenCount).toBe(2);
    expect(metrics.tokensPerSecond).toBeGreaterThan(0);
  });
});

// =============================================================================
// Initial State Tests
// =============================================================================

describe('createInitialState', () => {
  test('creates correct initial state', () => {
    const state = createInitialState();

    expect(state.content).toBe('');
    expect(state.isStreaming).toBe(false);
    expect(state.error).toBeNull();
    expect(state.metrics).toBeNull();
  });
});

// =============================================================================
// Chunk Processing Tests
// =============================================================================

describe('StreamChunk handling', () => {
  test('returns accumulated content', () => {
    const acc = new StreamAccumulator();
    acc.start();

    const result1 = acc.addChunk({ content: 'Hello', done: false });
    expect(result1).toBe('Hello');

    const result2 = acc.addChunk({ content: ' World', done: false });
    expect(result2).toBe('Hello World');
  });

  test('handles various finish reasons', () => {
    const acc = new StreamAccumulator();
    acc.start();

    acc.addChunk({ content: 'text', done: false });
    acc.addChunk({ content: '', done: true, finishReason: 'length' });

    expect(acc.getContent()).toBe('text');
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe('edge cases', () => {
  test('handles empty stream', () => {
    const acc = new StreamAccumulator();
    acc.start();

    const metrics = acc.getMetrics();
    expect(acc.getContent()).toBe('');
    expect(metrics.tokenCount).toBe(0);
  });

  test('handles unicode content', () => {
    const acc = new StreamAccumulator();
    acc.start();

    acc.addChunk({ content: 'Hello ', done: false });
    acc.addChunk({ content: '世界', done: false });
    acc.addChunk({ content: ' 🌍', done: false });

    expect(acc.getContent()).toBe('Hello 世界 🌍');
  });

  test('handles newlines', () => {
    const acc = new StreamAccumulator();
    acc.start();

    acc.addChunk({ content: 'Line 1\n', done: false });
    acc.addChunk({ content: 'Line 2', done: false });

    expect(acc.getContent()).toBe('Line 1\nLine 2');
  });
});
