/**
 * LlamaClient - A TypeScript client for llama-server (llama.cpp)
 *
 * This is the core LLM integration used by all exercises.
 * It connects to a locally running llama-server instance.
 *
 * STUDY THIS FILE TO LEARN:
 * - How to structure an LLM client
 * - OpenAI-compatible API format
 * - Streaming with AsyncGenerator
 * - Error handling patterns
 *
 * SETUP:
 * Run llama-server with: llama-server -m your-model.gguf --port 8033
 * For embeddings: llama-server -m your-model.gguf --port 8033 --embedding
 */

import type {
  Message,
  LLMConfig,
  LLMResponse,
  TokenUsage,
  StreamChunk,
  DEFAULT_CONFIG,
} from './types';

// =============================================================================
// Configuration
// =============================================================================

export interface LlamaClientConfig {
  baseUrl: string;
  defaultConfig?: LLMConfig;
}

const DEFAULT_BASE_URL = 'http://127.0.0.1:8033';

// =============================================================================
// LlamaClient Class
// =============================================================================

export class LlamaClient {
  private baseUrl: string;
  private defaultConfig: LLMConfig;

  constructor(config: Partial<LlamaClientConfig> = {}) {
    this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
    this.defaultConfig = {
      temperature: 0.7,
      maxTokens: 1024,
      topP: 0.9,
      ...config.defaultConfig,
    };
  }

  // ---------------------------------------------------------------------------
  // Chat Completion (non-streaming)
  // ---------------------------------------------------------------------------

  async chat(
    messages: Message[],
    config: LLMConfig = {}
  ): Promise<LLMResponse> {
    const mergedConfig = { ...this.defaultConfig, ...config };

    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
          ...(m.name && { name: m.name }),
        })),
        temperature: mergedConfig.temperature,
        max_tokens: mergedConfig.maxTokens,
        top_p: mergedConfig.topP,
        top_k: mergedConfig.topK,
        stop: mergedConfig.stop,
        seed: mergedConfig.seed,
        stream: false,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new LlamaError(`Chat completion failed: ${response.status}`, error);
    }

    const data = await response.json();
    const choice = data.choices?.[0];

    return {
      content: choice?.message?.content ?? '',
      finishReason: choice?.finish_reason ?? 'stop',
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      } : undefined,
    };
  }

  // ---------------------------------------------------------------------------
  // Chat Completion (streaming)
  // ---------------------------------------------------------------------------

  async *chatStream(
    messages: Message[],
    config: LLMConfig = {}
  ): AsyncGenerator<StreamChunk> {
    const mergedConfig = { ...this.defaultConfig, ...config };

    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
          ...(m.name && { name: m.name }),
        })),
        temperature: mergedConfig.temperature,
        max_tokens: mergedConfig.maxTokens,
        top_p: mergedConfig.topP,
        top_k: mergedConfig.topK,
        stop: mergedConfig.stop,
        seed: mergedConfig.seed,
        stream: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new LlamaError(`Chat stream failed: ${response.status}`, error);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new LlamaError('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') {
              yield { content: '', done: true };
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta;
              const finishReason = parsed.choices?.[0]?.finish_reason;

              if (delta?.content) {
                yield {
                  content: delta.content,
                  done: false,
                };
              }

              if (finishReason) {
                yield {
                  content: '',
                  done: true,
                  finishReason,
                };
                return;
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  // ---------------------------------------------------------------------------
  // Embeddings (for RAG - Exercise 15)
  // ---------------------------------------------------------------------------

  async embed(texts: string[]): Promise<number[][]> {
    const response = await fetch(`${this.baseUrl}/v1/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: texts,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new LlamaError(`Embedding failed: ${response.status}`, error);
    }

    const data = await response.json();
    return data.data.map((item: { embedding: number[] }) => item.embedding);
  }

  // ---------------------------------------------------------------------------
  // Health Check
  // ---------------------------------------------------------------------------

  async isHealthy(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

// =============================================================================
// Error Class
// =============================================================================

export class LlamaError extends Error {
  constructor(
    message: string,
    public readonly details?: string
  ) {
    super(message);
    this.name = 'LlamaError';
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let defaultClient: LlamaClient | null = null;

export function getLlamaClient(config?: Partial<LlamaClientConfig>): LlamaClient {
  if (!defaultClient || config) {
    defaultClient = new LlamaClient(config);
  }
  return defaultClient;
}
