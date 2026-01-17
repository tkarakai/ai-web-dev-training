/**
 * Error handling utilities for AI operations
 */

import type { AIError } from '../../types';

export class LlamaServerError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'LlamaServerError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public readonly errors?: unknown[]) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class RateLimitError extends Error {
  constructor(
    message: string,
    public readonly retryAfter?: number
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export class ContentFilterError extends Error {
  constructor(message: string, public readonly reason?: string) {
    super(message);
    this.name = 'ContentFilterError';
  }
}

/**
 * Convert unknown error to AIError type
 */
export function toAIError(error: unknown): AIError {
  if (error instanceof RateLimitError) {
    return {
      type: 'rate_limit',
      message: error.message,
      retryAfter: error.retryAfter,
    };
  }

  if (error instanceof ContentFilterError) {
    return {
      type: 'content_filter',
      message: error.message,
      details: { reason: error.reason },
    };
  }

  if (error instanceof ValidationError) {
    return {
      type: 'validation_error',
      message: error.message,
      details: { errors: error.errors },
    };
  }

  if (error instanceof LlamaServerError) {
    return {
      type: 'model_error',
      message: error.message,
      details: { cause: error.cause },
    };
  }

  if (error instanceof TypeError && error.message.includes('fetch')) {
    return {
      type: 'network_error',
      message: 'Network error: Unable to connect to AI service',
      details: { originalError: error.message },
    };
  }

  if (error instanceof Error) {
    return {
      type: 'model_error',
      message: error.message,
      details: { originalError: error.name },
    };
  }

  return {
    type: 'model_error',
    message: 'Unknown error occurred',
    details: { error },
  };
}

/**
 * Retry logic with exponential backoff
 */
export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: unknown) => boolean;
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  shouldRetry: (error) => {
    // Retry on network errors and rate limits
    if (error instanceof RateLimitError) return true;
    if (error instanceof TypeError && error.message.includes('fetch')) return true;
    return false;
  },
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: unknown;
  let delay = opts.initialDelay;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry if this is the last attempt
      if (attempt === opts.maxRetries) {
        break;
      }

      // Check if we should retry this error
      if (!opts.shouldRetry(error)) {
        throw error;
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));

      // Exponential backoff
      delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelay);
    }
  }

  throw lastError;
}

/**
 * Timeout wrapper
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage = 'Operation timed out'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
    ),
  ]);
}

/**
 * Safe async wrapper that catches errors
 */
export async function tryCatch<T, E = Error>(
  fn: () => Promise<T>
): Promise<[T, null] | [null, E]> {
  try {
    const result = await fn();
    return [result, null];
  } catch (error) {
    return [null, error as E];
  }
}

/**
 * Format error for user display
 */
export function formatErrorMessage(error: AIError): string {
  switch (error.type) {
    case 'timeout':
      return 'The request took too long. Please try again.';
    case 'rate_limit':
      return error.retryAfter
        ? `Too many requests. Please wait ${error.retryAfter} seconds.`
        : 'Too many requests. Please try again later.';
    case 'content_filter':
      return 'This request cannot be processed. Please rephrase your question.';
    case 'model_error':
      return 'An error occurred while processing your request. Please try again.';
    case 'network_error':
      return 'Network error. Please check your connection and try again.';
    case 'validation_error':
      return 'Invalid input. Please check your request and try again.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
}
