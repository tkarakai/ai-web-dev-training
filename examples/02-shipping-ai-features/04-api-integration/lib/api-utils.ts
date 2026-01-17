/**
 * API integration utilities for resilient LLM calls
 */

// Simple in-memory cache
class ResponseCache {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private ttlMs: number;

  constructor(ttlMs = 60000) {
    this.ttlMs = ttlMs;
  }

  private generateKey(prompt: string, options: any): string {
    return JSON.stringify({ prompt, ...options });
  }

  get(prompt: string, options: any): any | null {
    const key = this.generateKey(prompt, options);
    const entry = this.cache.get(key);

    if (!entry) return null;

    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  set(prompt: string, options: any, data: any): void {
    const key = this.generateKey(prompt, options);
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }

  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()).map(k => k.slice(0, 50) + '...'),
    };
  }
}

// Rate limiter using token bucket algorithm
class RateLimiter {
  private tokens: number;
  private maxTokens: number;
  private refillRate: number; // tokens per second
  private lastRefill: number;

  constructor(maxTokens = 10, refillRate = 1) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.refillRate = refillRate;
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }

  canProceed(): boolean {
    this.refill();
    return this.tokens >= 1;
  }

  consume(): boolean {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }

  getWaitTime(): number {
    this.refill();
    if (this.tokens >= 1) return 0;
    return Math.ceil((1 - this.tokens) / this.refillRate * 1000);
  }

  getStatus(): { tokens: number; maxTokens: number; waitTime: number } {
    this.refill();
    return {
      tokens: Math.floor(this.tokens * 10) / 10,
      maxTokens: this.maxTokens,
      waitTime: this.getWaitTime(),
    };
  }
}

// Retry with exponential backoff
interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  retryOn?: (error: Error) => boolean;
}

async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<{ result: T; attempts: number; errors: Error[] }> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    retryOn = () => true,
  } = options;

  const errors: Error[] = [];
  let attempts = 0;

  while (attempts <= maxRetries) {
    attempts++;
    try {
      const result = await fn();
      return { result, attempts, errors };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      errors.push(err);

      if (attempts > maxRetries || !retryOn(err)) {
        throw err;
      }

      const delay = Math.min(baseDelay * Math.pow(2, attempts - 1), maxDelay);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw errors[errors.length - 1];
}

// Idempotency key generator
function generateIdempotencyKey(prompt: string, timestamp?: number): string {
  const ts = timestamp || Date.now();
  const data = `${prompt}-${ts}`;

  // Simple hash function
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }

  return `idem_${Math.abs(hash).toString(36)}_${ts.toString(36)}`;
}

// Request deduplication
class RequestDeduplicator {
  private pending = new Map<string, Promise<any>>();

  async dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.pending.get(key);
    if (existing) {
      return existing;
    }

    const promise = fn().finally(() => {
      this.pending.delete(key);
    });

    this.pending.set(key, promise);
    return promise;
  }

  get pendingCount(): number {
    return this.pending.size;
  }
}

// Export singleton instances
export const responseCache = new ResponseCache(60000);
export const rateLimiter = new RateLimiter(10, 2);
export const requestDeduplicator = new RequestDeduplicator();

export { withRetry, generateIdempotencyKey };
export type { RetryOptions };
