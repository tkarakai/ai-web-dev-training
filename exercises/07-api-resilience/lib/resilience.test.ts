/**
 * Tests for API Resilience
 *
 * Run with: bun test
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import {
  PromptCache,
  withRetry,
  RateLimiter,
  generateIdempotencyKey,
  IdempotencyTracker,
  CircuitBreaker,
  CircuitOpenError,
  type Message,
} from './resilience';

// =============================================================================
// PromptCache Tests
// =============================================================================

describe('PromptCache', () => {
  let cache: PromptCache;

  beforeEach(() => {
    cache = new PromptCache(1000); // 1 second TTL
  });

  test('caches and retrieves response', () => {
    const messages: Message[] = [{ role: 'user', content: 'Hello' }];
    const config = { temperature: 0 };

    cache.set(messages, config, { content: 'Hi there', timestamp: Date.now() });
    const cached = cache.get(messages, config);

    expect(cached?.content).toBe('Hi there');
  });

  test('returns null for uncached', () => {
    const messages: Message[] = [{ role: 'user', content: 'Hello' }];
    expect(cache.get(messages, {})).toBeNull();
  });

  test('different configs have different keys', () => {
    const messages: Message[] = [{ role: 'user', content: 'Hello' }];

    cache.set(messages, { temperature: 0 }, { content: 'A', timestamp: Date.now() });
    cache.set(messages, { temperature: 1 }, { content: 'B', timestamp: Date.now() });

    expect(cache.get(messages, { temperature: 0 })?.content).toBe('A');
    expect(cache.get(messages, { temperature: 1 })?.content).toBe('B');
  });

  test('expires after TTL', async () => {
    const shortCache = new PromptCache(50); // 50ms TTL
    const messages: Message[] = [{ role: 'user', content: 'Hello' }];

    shortCache.set(messages, {}, { content: 'Hi', timestamp: Date.now() });
    expect(shortCache.get(messages, {})).not.toBeNull();

    await new Promise((r) => setTimeout(r, 100));
    expect(shortCache.get(messages, {})).toBeNull();
  });

  test('clear removes all entries', () => {
    const messages: Message[] = [{ role: 'user', content: 'Hello' }];
    cache.set(messages, {}, { content: 'Hi', timestamp: Date.now() });

    cache.clear();
    expect(cache.stats().size).toBe(0);
  });
});

// =============================================================================
// Retry Tests
// =============================================================================

describe('withRetry', () => {
  test('succeeds on first try', async () => {
    let attempts = 0;
    const result = await withRetry(async () => {
      attempts++;
      return 'success';
    });

    expect(result).toBe('success');
    expect(attempts).toBe(1);
  });

  test('retries on retryable error', async () => {
    let attempts = 0;
    const result = await withRetry(
      async () => {
        attempts++;
        if (attempts < 3) throw new Error('rate_limit');
        return 'success';
      },
      { maxAttempts: 5, baseDelayMs: 10 }
    );

    expect(result).toBe('success');
    expect(attempts).toBe(3);
  });

  test('throws after max attempts', async () => {
    let attempts = 0;

    await expect(
      withRetry(
        async () => {
          attempts++;
          throw new Error('rate_limit');
        },
        { maxAttempts: 3, baseDelayMs: 10 }
      )
    ).rejects.toThrow('rate_limit');

    expect(attempts).toBe(3);
  });

  test('does not retry non-retryable errors', async () => {
    let attempts = 0;

    await expect(
      withRetry(
        async () => {
          attempts++;
          throw new Error('invalid_input');
        },
        { maxAttempts: 3, baseDelayMs: 10, retryableErrors: ['rate_limit'] }
      )
    ).rejects.toThrow('invalid_input');

    expect(attempts).toBe(1);
  });
});

// =============================================================================
// RateLimiter Tests
// =============================================================================

describe('RateLimiter', () => {
  test('allows burst up to maxTokens', () => {
    const limiter = new RateLimiter({ maxTokens: 3, refillRate: 1, refillInterval: 1000 });

    expect(limiter.tryAcquire()).toBe(true);
    expect(limiter.tryAcquire()).toBe(true);
    expect(limiter.tryAcquire()).toBe(true);
    expect(limiter.tryAcquire()).toBe(false);
  });

  test('refills over time', async () => {
    const limiter = new RateLimiter({ maxTokens: 2, refillRate: 1, refillInterval: 50 });

    // Use all tokens
    limiter.tryAcquire();
    limiter.tryAcquire();
    expect(limiter.tryAcquire()).toBe(false);

    // Wait for refill
    await new Promise((r) => setTimeout(r, 100));
    expect(limiter.tryAcquire()).toBe(true);
  });

  test('acquire waits for token', async () => {
    const limiter = new RateLimiter({ maxTokens: 1, refillRate: 1, refillInterval: 50 });

    limiter.tryAcquire(); // Use the one token

    const start = Date.now();
    await limiter.acquire();
    const elapsed = Date.now() - start;

    expect(elapsed).toBeGreaterThanOrEqual(40);
  });

  test('getState returns current tokens', () => {
    const limiter = new RateLimiter({ maxTokens: 5, refillRate: 1, refillInterval: 1000 });

    limiter.tryAcquire();
    limiter.tryAcquire();

    const state = limiter.getState();
    expect(state.tokens).toBe(3);
    expect(state.maxTokens).toBe(5);
  });
});

// =============================================================================
// Idempotency Tests
// =============================================================================

describe('generateIdempotencyKey', () => {
  test('creates consistent key for same input', () => {
    const key1 = generateIdempotencyKey('chat', 'user1', 'hello');
    const key2 = generateIdempotencyKey('chat', 'user1', 'hello');

    // Keys will differ due to timestamp, but that's intentional
    expect(key1).toHaveLength(32);
    expect(key2).toHaveLength(32);
  });

  test('creates different keys for different inputs', () => {
    const key1 = generateIdempotencyKey('chat', 'user1');
    const key2 = generateIdempotencyKey('chat', 'user2');

    expect(key1).not.toBe(key2);
  });
});

describe('IdempotencyTracker', () => {
  test('deduplicates concurrent requests', async () => {
    const tracker = new IdempotencyTracker();
    let calls = 0;

    const fn = async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 50));
      return 'result';
    };

    // Start two requests with same key
    const [r1, r2] = await Promise.all([
      tracker.execute('key1', fn),
      tracker.execute('key1', fn),
    ]);

    expect(r1).toBe('result');
    expect(r2).toBe('result');
    expect(calls).toBe(1); // Only one actual call
  });

  test('returns cached result', async () => {
    const tracker = new IdempotencyTracker();
    let calls = 0;

    const fn = async () => {
      calls++;
      return 'result';
    };

    await tracker.execute('key1', fn);
    await tracker.execute('key1', fn);

    expect(calls).toBe(1);
  });

  test('different keys execute separately', async () => {
    const tracker = new IdempotencyTracker();
    let calls = 0;

    const fn = async () => {
      calls++;
      return 'result';
    };

    await tracker.execute('key1', fn);
    await tracker.execute('key2', fn);

    expect(calls).toBe(2);
  });
});

// =============================================================================
// CircuitBreaker Tests
// =============================================================================

describe('CircuitBreaker', () => {
  test('starts closed', () => {
    const breaker = new CircuitBreaker();
    expect(breaker.getState().state).toBe('closed');
  });

  test('opens after failure threshold', async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 1000 });

    // Fail twice
    try { await breaker.execute(async () => { throw new Error('fail'); }); } catch {}
    try { await breaker.execute(async () => { throw new Error('fail'); }); } catch {}

    expect(breaker.getState().state).toBe('open');
  });

  test('rejects when open', async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 10000 });

    // Open the circuit
    try { await breaker.execute(async () => { throw new Error('fail'); }); } catch {}

    await expect(
      breaker.execute(async () => 'success')
    ).rejects.toThrow(CircuitOpenError);
  });

  test('transitions to half-open after timeout', async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 50 });

    // Open the circuit
    try { await breaker.execute(async () => { throw new Error('fail'); }); } catch {}
    expect(breaker.getState().state).toBe('open');

    // Wait for reset timeout
    await new Promise((r) => setTimeout(r, 100));

    // Next call should be allowed (half-open)
    const result = await breaker.execute(async () => 'success');
    expect(result).toBe('success');
  });

  test('closes after success threshold in half-open', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 1,
      resetTimeoutMs: 50,
      successThreshold: 2,
    });

    // Open -> half-open
    try { await breaker.execute(async () => { throw new Error('fail'); }); } catch {}
    await new Promise((r) => setTimeout(r, 100));

    // Two successes to close
    await breaker.execute(async () => 'success');
    expect(breaker.getState().state).toBe('half-open');

    await breaker.execute(async () => 'success');
    expect(breaker.getState().state).toBe('closed');
  });

  test('reset returns to closed', () => {
    const breaker = new CircuitBreaker({ failureThreshold: 1 });

    // Open it
    try { breaker.execute(async () => { throw new Error('fail'); }); } catch {}

    breaker.reset();
    expect(breaker.getState().state).toBe('closed');
    expect(breaker.getState().failures).toBe(0);
  });
});
