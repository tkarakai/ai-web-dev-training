/**
 * API Resilience - Production-grade LLM API integration
 *
 * WHAT YOU'LL LEARN:
 * 1. Prompt caching with TTL
 * 2. Retry with exponential backoff
 * 3. Rate limiting (token bucket)
 * 4. Idempotency keys for safe retries
 * 5. Circuit breaker pattern
 *
 * KEY INSIGHT: LLM APIs fail. Networks fail. Rate limits hit.
 * Production code needs multiple layers of resilience.
 */

import { createHash } from 'crypto';

// =============================================================================
// Types
// =============================================================================

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMConfig {
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export interface CachedResponse {
  content: string;
  timestamp: number;
  tokens?: { input: number; output: number };
}

// =============================================================================
// Prompt Cache
// =============================================================================

/**
 * Cache for LLM responses
 *
 * PATTERN: Cache identical prompts to reduce cost and latency.
 * Use with deterministic settings (temperature=0) for best results.
 */
export class PromptCache {
  private cache = new Map<string, CachedResponse>();
  private ttlMs: number;

  constructor(ttlMs: number = 5 * 60 * 1000) { // 5 minutes default
    this.ttlMs = ttlMs;
  }

  /**
   * Create a cache key from messages and config
   */
  private createKey(messages: Message[], config: LLMConfig): string {
    const data = JSON.stringify({ messages, config });
    return createHash('sha256').update(data).digest('hex');
  }

  /**
   * Get cached response if valid
   */
  get(messages: Message[], config: LLMConfig): CachedResponse | null {
    const key = this.createKey(messages, config);
    const cached = this.cache.get(key);

    if (!cached) return null;

    // Check TTL
    if (Date.now() - cached.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    return cached;
  }

  /**
   * Store response in cache
   */
  set(messages: Message[], config: LLMConfig, response: CachedResponse): void {
    const key = this.createKey(messages, config);
    this.cache.set(key, { ...response, timestamp: Date.now() });
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  stats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// =============================================================================
// Retry with Exponential Backoff
// =============================================================================

export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryableErrors?: string[];
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'rate_limit', '429', '503', '500'],
};

/**
 * Execute a function with retry logic
 *
 * PATTERN: Exponential backoff with jitter prevents thundering herd.
 * Always set a max delay to avoid infinite waits.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if error is retryable
      const isRetryable = opts.retryableErrors?.some(
        (e) => lastError!.message.includes(e)
      );

      if (!isRetryable || attempt === opts.maxAttempts) {
        throw lastError;
      }

      // Calculate delay with exponential backoff + jitter
      const exponentialDelay = opts.baseDelayMs * Math.pow(2, attempt - 1);
      const jitter = Math.random() * 0.3 * exponentialDelay;
      const delay = Math.min(exponentialDelay + jitter, opts.maxDelayMs);

      await sleep(delay);
    }
  }

  throw lastError;
}

// =============================================================================
// Rate Limiter (Token Bucket)
// =============================================================================

export interface RateLimiterOptions {
  maxTokens: number;      // Max burst capacity
  refillRate: number;     // Tokens per second
  refillInterval: number; // Ms between refills
}

/**
 * Token bucket rate limiter
 *
 * PATTERN: Token bucket allows bursts while maintaining average rate.
 * Better than simple time windows for API rate limiting.
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private options: RateLimiterOptions;

  constructor(options: Partial<RateLimiterOptions> = {}) {
    this.options = {
      maxTokens: 10,
      refillRate: 1,
      refillInterval: 1000,
      ...options,
    };
    this.tokens = this.options.maxTokens;
    this.lastRefill = Date.now();
  }

  /**
   * Refill tokens based on elapsed time
   */
  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const refills = Math.floor(elapsed / this.options.refillInterval);

    if (refills > 0) {
      this.tokens = Math.min(
        this.options.maxTokens,
        this.tokens + refills * this.options.refillRate
      );
      this.lastRefill = now;
    }
  }

  /**
   * Try to acquire a token
   */
  tryAcquire(): boolean {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }

    return false;
  }

  /**
   * Wait until a token is available
   */
  async acquire(): Promise<void> {
    while (!this.tryAcquire()) {
      await sleep(this.options.refillInterval);
    }
  }

  /**
   * Get current state
   */
  getState(): { tokens: number; maxTokens: number } {
    this.refill();
    return {
      tokens: this.tokens,
      maxTokens: this.options.maxTokens,
    };
  }
}

// =============================================================================
// Idempotency
// =============================================================================

/**
 * Generate an idempotency key
 *
 * PATTERN: Idempotency keys prevent duplicate operations during retries.
 * Include enough context to uniquely identify the request.
 */
export function generateIdempotencyKey(
  operation: string,
  ...args: unknown[]
): string {
  const data = JSON.stringify({ operation, args, timestamp: Date.now() });
  return createHash('sha256').update(data).digest('hex').slice(0, 32);
}

/**
 * Track in-flight and completed requests
 */
export class IdempotencyTracker {
  private inFlight = new Map<string, Promise<unknown>>();
  private completed = new Map<string, { result: unknown; timestamp: number }>();
  private ttlMs: number;

  constructor(ttlMs: number = 60 * 1000) {
    this.ttlMs = ttlMs;
  }

  /**
   * Execute with idempotency guarantee
   */
  async execute<T>(
    key: string,
    fn: () => Promise<T>
  ): Promise<T> {
    // Check if already completed
    const completed = this.completed.get(key);
    if (completed && Date.now() - completed.timestamp < this.ttlMs) {
      return completed.result as T;
    }

    // Check if in flight
    const inFlight = this.inFlight.get(key);
    if (inFlight) {
      return inFlight as Promise<T>;
    }

    // Execute
    const promise = fn();
    this.inFlight.set(key, promise);

    try {
      const result = await promise;
      this.completed.set(key, { result, timestamp: Date.now() });
      return result;
    } finally {
      this.inFlight.delete(key);
    }
  }
}

// =============================================================================
// Circuit Breaker
// =============================================================================

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerOptions {
  failureThreshold: number;  // Failures before opening
  resetTimeoutMs: number;    // Time before trying again
  successThreshold: number;  // Successes needed to close
}

/**
 * Circuit breaker to prevent cascading failures
 *
 * PATTERN: When a service is failing, stop calling it temporarily.
 * This prevents wasting resources and allows recovery.
 */
export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures = 0;
  private successes = 0;
  private lastFailure = 0;
  private options: CircuitBreakerOptions;

  constructor(options: Partial<CircuitBreakerOptions> = {}) {
    this.options = {
      failureThreshold: 5,
      resetTimeoutMs: 30000,
      successThreshold: 2,
      ...options,
    };
  }

  /**
   * Execute with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailure > this.options.resetTimeoutMs) {
        this.state = 'half-open';
        this.successes = 0;
      } else {
        throw new CircuitOpenError('Circuit is open');
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

  private onSuccess(): void {
    this.failures = 0;

    if (this.state === 'half-open') {
      this.successes++;
      if (this.successes >= this.options.successThreshold) {
        this.state = 'closed';
      }
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailure = Date.now();

    if (this.failures >= this.options.failureThreshold) {
      this.state = 'open';
    }
  }

  getState(): { state: CircuitState; failures: number; successes: number } {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
    };
  }

  reset(): void {
    this.state = 'closed';
    this.failures = 0;
    this.successes = 0;
  }
}

export class CircuitOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitOpenError';
  }
}

// =============================================================================
// Resilient Client
// =============================================================================

export interface ResilientClientOptions {
  baseUrl: string;
  cache?: PromptCache;
  rateLimiter?: RateLimiter;
  circuitBreaker?: CircuitBreaker;
  retryOptions?: Partial<RetryOptions>;
}

/**
 * LLM client with all resilience features combined
 */
export class ResilientClient {
  private baseUrl: string;
  private cache: PromptCache;
  private rateLimiter: RateLimiter;
  private circuitBreaker: CircuitBreaker;
  private retryOptions: RetryOptions;

  constructor(options: ResilientClientOptions) {
    this.baseUrl = options.baseUrl;
    this.cache = options.cache ?? new PromptCache();
    this.rateLimiter = options.rateLimiter ?? new RateLimiter();
    this.circuitBreaker = options.circuitBreaker ?? new CircuitBreaker();
    this.retryOptions = { ...DEFAULT_RETRY_OPTIONS, ...options.retryOptions };
  }

  /**
   * Chat with all resilience features
   */
  async chat(messages: Message[], config: LLMConfig = {}): Promise<string> {
    // Check cache first
    const cached = this.cache.get(messages, config);
    if (cached) {
      return cached.content;
    }

    // Wait for rate limit
    await this.rateLimiter.acquire();

    // Execute with circuit breaker and retry
    const result = await this.circuitBreaker.execute(() =>
      withRetry(
        () => this.doChat(messages, config),
        this.retryOptions
      )
    );

    // Cache the result
    this.cache.set(messages, config, {
      content: result,
      timestamp: Date.now(),
    });

    return result;
  }

  private async doChat(messages: Message[], config: LLMConfig): Promise<string> {
    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: config.temperature ?? 0.7,
        max_tokens: config.maxTokens ?? 1024,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content ?? '';
  }

  getStats() {
    return {
      cache: this.cache.stats(),
      rateLimiter: this.rateLimiter.getState(),
      circuitBreaker: this.circuitBreaker.getState(),
    };
  }
}

// =============================================================================
// Utilities
// =============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
