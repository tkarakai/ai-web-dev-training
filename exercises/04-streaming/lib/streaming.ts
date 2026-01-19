/**
 * Streaming Responses - Real-time token-by-token output
 *
 * WHAT YOU'LL LEARN:
 * 1. Server-Sent Events (SSE) protocol
 * 2. AsyncGenerator patterns for streaming
 * 3. Partial state updates in React
 * 4. Backpressure and cancellation
 *
 * KEY INSIGHT: Streaming makes AI feel responsive. Instead of waiting
 * 5 seconds for a complete response, users see text appear immediately.
 */

// =============================================================================
// Types
// =============================================================================

export interface StreamChunk {
  content: string;
  done: boolean;
  finishReason?: 'stop' | 'length' | 'error';
}

export interface StreamMetrics {
  firstTokenMs: number;      // Time to first token
  totalMs: number;           // Total time
  tokenCount: number;        // Tokens received
  tokensPerSecond: number;   // Generation speed
}

export interface StreamState {
  content: string;
  isStreaming: boolean;
  error: string | null;
  metrics: StreamMetrics | null;
}

// =============================================================================
// SSE Parser
// =============================================================================

/**
 * Parse Server-Sent Events from a ReadableStream
 *
 * SSE format:
 * data: {"content": "Hello"}
 * data: {"content": " world"}
 * data: [DONE]
 *
 * Each message is prefixed with "data: " and ends with two newlines.
 */
export async function* parseSSE(
  reader: ReadableStreamDefaultReader<Uint8Array>
): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Split by double newline (SSE message boundary)
      const messages = buffer.split('\n\n');
      buffer = messages.pop() ?? '';

      for (const message of messages) {
        for (const line of message.split('\n')) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data !== '[DONE]') {
              yield data;
            }
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// =============================================================================
// Streaming Client
// =============================================================================

/**
 * Stream chat completions from llama-server
 *
 * PATTERN: AsyncGenerator lets you yield values over time.
 * The consumer can process each chunk as it arrives.
 */
export async function* streamChat(
  messages: Array<{ role: string; content: string }>,
  options: {
    baseUrl?: string;
    maxTokens?: number;
    temperature?: number;
    signal?: AbortSignal;
  } = {}
): AsyncGenerator<StreamChunk> {
  const {
    baseUrl = 'http://127.0.0.1:8033',
    maxTokens = 1024,
    temperature = 0.7,
    signal,
  } = options;

  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages,
      max_tokens: maxTokens,
      temperature,
      stream: true,
    }),
    signal,
  });

  if (!response.ok) {
    throw new StreamError(`HTTP ${response.status}`, 'HTTP_ERROR');
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new StreamError('No response body', 'NO_BODY');
  }

  for await (const data of parseSSE(reader)) {
    try {
      const parsed = JSON.parse(data);
      const delta = parsed.choices?.[0]?.delta;
      const finishReason = parsed.choices?.[0]?.finish_reason;

      if (delta?.content) {
        yield { content: delta.content, done: false };
      }

      if (finishReason) {
        yield { content: '', done: true, finishReason };
        return;
      }
    } catch {
      // Skip invalid JSON
    }
  }

  // Stream ended without explicit finish
  yield { content: '', done: true, finishReason: 'stop' };
}

// =============================================================================
// Stream Accumulator
// =============================================================================

/**
 * Accumulate streaming chunks with metrics
 *
 * PATTERN: Separate streaming logic from UI state management.
 * The accumulator handles the complexity; your UI just renders.
 */
export class StreamAccumulator {
  private content = '';
  private tokenCount = 0;
  private startTime = 0;
  private firstTokenTime = 0;

  start(): void {
    this.content = '';
    this.tokenCount = 0;
    this.startTime = Date.now();
    this.firstTokenTime = 0;
  }

  addChunk(chunk: StreamChunk): string {
    if (chunk.content) {
      if (this.firstTokenTime === 0) {
        this.firstTokenTime = Date.now();
      }
      this.content += chunk.content;
      this.tokenCount++;
    }
    return this.content;
  }

  getContent(): string {
    return this.content;
  }

  getMetrics(): StreamMetrics {
    const totalMs = Date.now() - this.startTime;
    const firstTokenMs = this.firstTokenTime
      ? this.firstTokenTime - this.startTime
      : totalMs;

    return {
      firstTokenMs,
      totalMs,
      tokenCount: this.tokenCount,
      tokensPerSecond: totalMs > 0 ? (this.tokenCount / totalMs) * 1000 : 0,
    };
  }
}

// =============================================================================
// Stream Runner (for React)
// =============================================================================

export interface StreamRunnerOptions {
  messages: Array<{ role: string; content: string }>;
  onChunk: (content: string, chunk: StreamChunk) => void;
  onComplete: (content: string, metrics: StreamMetrics) => void;
  onError: (error: Error) => void;
  signal?: AbortSignal;
  baseUrl?: string;
}

/**
 * Run a stream with callbacks
 *
 * This is often more convenient than using the AsyncGenerator directly,
 * especially in React where you want to update state on each chunk.
 */
export async function runStream(options: StreamRunnerOptions): Promise<void> {
  const { messages, onChunk, onComplete, onError, signal, baseUrl } = options;
  const accumulator = new StreamAccumulator();

  try {
    accumulator.start();

    for await (const chunk of streamChat(messages, { signal, baseUrl })) {
      const content = accumulator.addChunk(chunk);
      onChunk(content, chunk);

      if (chunk.done) {
        onComplete(content, accumulator.getMetrics());
        return;
      }
    }
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      // Cancellation is not an error
      onComplete(accumulator.getContent(), accumulator.getMetrics());
    } else {
      onError(e instanceof Error ? e : new Error(String(e)));
    }
  }
}

// =============================================================================
// Backpressure Handling
// =============================================================================

/**
 * Add artificial delay between chunks (for testing/demos)
 */
export async function* withDelay(
  stream: AsyncGenerator<StreamChunk>,
  delayMs: number
): AsyncGenerator<StreamChunk> {
  for await (const chunk of stream) {
    yield chunk;
    if (!chunk.done && delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

/**
 * Buffer chunks to reduce render frequency
 *
 * Instead of updating UI on every token, batch updates every N ms.
 * This can improve performance with fast generation.
 */
export async function* withBuffer(
  stream: AsyncGenerator<StreamChunk>,
  bufferMs: number
): AsyncGenerator<StreamChunk> {
  let buffer = '';
  let lastYield = Date.now();

  for await (const chunk of stream) {
    if (chunk.done) {
      // Flush any remaining buffer
      if (buffer) {
        yield { content: buffer, done: false };
      }
      yield chunk;
      return;
    }

    buffer += chunk.content;

    // Yield when buffer time exceeded
    if (Date.now() - lastYield >= bufferMs) {
      yield { content: buffer, done: false };
      buffer = '';
      lastYield = Date.now();
    }
  }

  // Flush remaining
  if (buffer) {
    yield { content: buffer, done: false };
  }
}

// =============================================================================
// React Hook (simplified version)
// =============================================================================

/**
 * Create initial stream state
 */
export function createInitialState(): StreamState {
  return {
    content: '',
    isStreaming: false,
    error: null,
    metrics: null,
  };
}

// =============================================================================
// Errors
// =============================================================================

export class StreamError extends Error {
  constructor(
    message: string,
    public readonly code: 'HTTP_ERROR' | 'NO_BODY' | 'PARSE_ERROR' | 'CANCELLED'
  ) {
    super(message);
    this.name = 'StreamError';
  }
}
