# Exercise 07: API Resilience

Production-grade LLM API integration. Learn caching, retry with backoff, rate limiting, and circuit breakers.

## What You'll Learn

1. **Prompt caching** - Cache identical requests to reduce cost and latency
2. **Retry with backoff** - Handle transient failures gracefully
3. **Rate limiting** - Token bucket algorithm for burst control
4. **Circuit breaker** - Prevent cascading failures

## Prerequisites

**llama-server must be running:**

```bash
llama-server -m your-model.gguf --port 8033
```

## The Code to Study

```
lib/resilience.ts       <- THE MAIN FILE - all resilience patterns
lib/resilience.test.ts  <- Tests for each component
```

## Key Concepts

### Prompt Caching

```typescript
class PromptCache {
  private cache = new Map<string, CachedResponse>();

  get(messages, config) {
    const key = hash(messages, config);
    const cached = this.cache.get(key);

    // Check TTL
    if (cached && Date.now() - cached.timestamp < this.ttlMs) {
      return cached;
    }
    return null;
  }

  set(messages, config, response) {
    const key = hash(messages, config);
    this.cache.set(key, { ...response, timestamp: Date.now() });
  }
}
```

Use with `temperature=0` for deterministic, cacheable results.

### Retry with Exponential Backoff

```typescript
async function withRetry<T>(fn: () => Promise<T>, options): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (!isRetryable(error) || attempt === maxAttempts) throw error;

      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt - 1);
      const jitter = Math.random() * 0.3 * delay;
      await sleep(Math.min(delay + jitter, maxDelay));
    }
  }
}
```

### Token Bucket Rate Limiter

```typescript
class RateLimiter {
  private tokens: number;

  tryAcquire(): boolean {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }

  private refill() {
    const elapsed = Date.now() - this.lastRefill;
    const newTokens = Math.floor(elapsed / refillInterval) * refillRate;
    this.tokens = Math.min(maxTokens, this.tokens + newTokens);
  }
}
```

### Circuit Breaker

```typescript
class CircuitBreaker {
  state: 'closed' | 'open' | 'half-open' = 'closed';

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailure > resetTimeout) {
        this.state = 'half-open';
      } else {
        throw new CircuitOpenError();
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
}
```

## Run the Exercise

```bash
# Install dependencies
bun install

# Run tests
bun test

# Start the UI (requires llama-server)
bun dev
```

Open http://localhost:3007 to test resilience features.

## Code Patterns to Note

### 1. Layered Resilience

```typescript
class ResilientClient {
  async chat(messages, config) {
    // Layer 1: Check cache
    const cached = this.cache.get(messages, config);
    if (cached) return cached;

    // Layer 2: Rate limit
    await this.rateLimiter.acquire();

    // Layer 3: Circuit breaker + retry
    const result = await this.circuitBreaker.execute(() =>
      withRetry(() => this.doChat(messages, config))
    );

    // Layer 4: Cache result
    this.cache.set(messages, config, result);

    return result;
  }
}
```

### 2. Idempotency for Safe Retries

```typescript
function generateIdempotencyKey(operation, ...args) {
  return hash({ operation, args, timestamp: Date.now() });
}

class IdempotencyTracker {
  async execute(key, fn) {
    // Return cached result if already completed
    const completed = this.completed.get(key);
    if (completed) return completed.result;

    // Deduplicate concurrent requests
    const inFlight = this.inFlight.get(key);
    if (inFlight) return inFlight;

    // Execute and cache
    const promise = fn();
    this.inFlight.set(key, promise);
    const result = await promise;
    this.completed.set(key, { result, timestamp: Date.now() });
    return result;
  }
}
```

### 3. Statistics for Monitoring

```typescript
getStats() {
  return {
    cache: { size: this.cache.size, hitRate: this.hits / this.total },
    rateLimiter: { tokens: this.tokens, maxTokens: this.maxTokens },
    circuitBreaker: { state: this.state, failures: this.failures },
  };
}
```

## Exercises to Try

1. **Add cache hit/miss tracking** - Count and display cache hit rate
2. **Implement semantic caching** - Cache similar (not identical) prompts
3. **Add per-user rate limiting** - Different limits for different users
4. **Build a retry dashboard** - Visualize retry attempts over time

## When to Use Each Pattern

| Pattern | Use When | Trade-off |
|---------|----------|-----------|
| Caching | Deterministic queries, high volume | Memory usage, stale data |
| Retry | Transient errors (network, rate limit) | Latency on failure |
| Rate Limiting | Protect against burst, stay under quotas | May reject valid requests |
| Circuit Breaker | Downstream service issues | May reject during recovery |

## Next Exercise

[Exercise 08: Chain-of-Thought Reasoning](../08-chain-of-thought) - Improve accuracy with step-by-step reasoning.
