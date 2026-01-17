/**
 * Unified AI client for llama.cpp with cloud fallback
 *
 * This client prioritizes local llama-server (at 127.0.0.1:8033) for privacy
 * and zero API costs, with graceful fallback to cloud providers when configured.
 *
 * Usage:
 * ```ts
 * const client = new LlamaClient();
 * const response = await client.chat({
 *   messages: [{ role: 'user', content: 'Hello!' }]
 * });
 * ```
 */

import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { streamText, generateText } from 'ai';
import type { AIMessage, LLMConfig, LLMProvider, AIResponse } from '../../types';

type CoreMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

const DEFAULT_LLAMA_SERVER_URL = 'http://127.0.0.1:8033';
const DEFAULT_MODEL = 'gpt-oss-20b';

export interface LlamaClientConfig {
  llamaServerURL?: string;
  fallbackProvider?: LLMProvider;
  defaultConfig?: LLMConfig;
}

export interface ChatOptions {
  messages: AIMessage[];
  config?: LLMConfig;
  stream?: boolean;
}

export interface ChatResponse {
  content: string;
  metadata: {
    model: string;
    provider: string;
    tokenCount?: {
      input: number;
      output: number;
      total: number;
    };
    latencyMs: number;
    rawRequest?: {
      url: string;
      method: string;
      headers?: Record<string, string>;
      body: any;
    };
    rawResponse?: {
      status?: number;
      headers?: Record<string, string>;
      body: any;
    };
  };
}

/**
 * Unified AI client with local-first approach
 */
export class LlamaClient {
  private llamaServerURL: string;
  private fallbackProvider?: LLMProvider;
  private defaultConfig: LLMConfig;
  private llamaServerAvailable: boolean | null = null;

  constructor(config: LlamaClientConfig = {}) {
    this.llamaServerURL = config.llamaServerURL || DEFAULT_LLAMA_SERVER_URL;
    this.fallbackProvider = config.fallbackProvider;
    this.defaultConfig = config.defaultConfig || {
      temperature: 0.7,
      maxTokens: 2000,
    };
  }

  /**
   * Check if llama-server is available
   */
  private async checkLlamaServer(): Promise<boolean> {
    if (this.llamaServerAvailable !== null) {
      return this.llamaServerAvailable;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);

      const response = await fetch(`${this.llamaServerURL}/health`, {
        signal: controller.signal,
      });

      clearTimeout(timeout);
      this.llamaServerAvailable = response.ok;
      return response.ok;
    } catch (error) {
      this.llamaServerAvailable = false;
      return false;
    }
  }

  /**
   * Convert AIMessage to CoreMessage format
   */
  private toCoreMessages(messages: AIMessage[]): CoreMessage[] {
    return messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
  }

  /**
   * Chat completion with automatic provider selection
   */
  async chat(options: ChatOptions): Promise<ChatResponse> {
    const config = { ...this.defaultConfig, ...options.config };
    const startTime = Date.now();

    // Try llama-server first
    const llamaAvailable = await this.checkLlamaServer();

    if (llamaAvailable) {
      try {
        return await this.chatWithLlama(options, config, startTime);
      } catch (error) {
        console.warn('[LlamaClient] llama-server failed, trying fallback:', error);

        // Mark as unavailable for future requests
        this.llamaServerAvailable = false;

        if (!this.fallbackProvider) {
          throw new Error(
            'llama-server failed and no fallback provider configured. ' +
              'Please start llama-server or configure a fallback provider.'
          );
        }
      }
    }

    // Use fallback provider if available
    if (this.fallbackProvider) {
      return await this.chatWithFallback(options, config, startTime);
    }

    throw new Error(
      `llama-server not available at ${this.llamaServerURL} and no fallback configured. ` +
        'Please start llama-server with: llama-server -hf ggml-org/gpt-oss-20b-GGUF --jinja -c 0 --host 127.0.0.1 --port 8033'
    );
  }

  /**
   * Chat using local llama-server
   */
  private async chatWithLlama(
    options: ChatOptions,
    config: LLMConfig,
    startTime: number
  ): Promise<ChatResponse> {
    // Create OpenAI-compatible client pointing to llama-server
    // Using openai-compatible provider to avoid OpenAI-specific defaults
    const llama = createOpenAICompatible({
      name: 'llama.cpp',
      baseURL: `${this.llamaServerURL}/v1`,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const model = llama.chatModel(config.model || DEFAULT_MODEL);
    const messages = this.toCoreMessages(options.messages);

    if (options.stream) {
      // Capture request for educational purposes (even in streaming mode)
      const requestPayload = {
        model: config.model || DEFAULT_MODEL,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        temperature: config.temperature,
        stream: true,
      };

      const { textStream, text, usage } = await streamText({
        model: model as any,
        messages,
        temperature: config.temperature,
      });

      const fullText = await text;
      const latencyMs = Date.now() - startTime;

      // Extract token counts with fallbacks for different API formats
      let tokenCount: { input: number; output: number; total: number } | undefined;
      if (usage) {
        const usageAny = usage as any;
        const promptTokens = usageAny.promptTokens || usageAny.prompt_tokens || 0;
        const completionTokens = usageAny.completionTokens || usageAny.completion_tokens || 0;
        const totalTokens = usageAny.totalTokens || usageAny.total_tokens || (promptTokens + completionTokens) || 0;

        if (promptTokens > 0 || completionTokens > 0 || totalTokens > 0) {
          tokenCount = {
            input: promptTokens,
            output: completionTokens,
            total: totalTokens,
          };
        }
      }

      return {
        content: fullText,
        metadata: {
          model: config.model || DEFAULT_MODEL,
          provider: 'llama-local',
          tokenCount,
          latencyMs,
          rawRequest: {
            url: `${this.llamaServerURL}/v1/chat/completions`,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: requestPayload,
          },
          rawResponse: {
            status: 200,
            body: {
              choices: [{ message: { content: fullText } }],
              usage: usage || null,
              stream: true,
            },
          },
        },
      };
    } else {
      // Capture request for educational purposes
      const requestPayload = {
        model: config.model || DEFAULT_MODEL,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        temperature: config.temperature,
      };

      const { text, usage } = await generateText({
        model: model as any,
        messages,
        temperature: config.temperature,
      });

      const latencyMs = Date.now() - startTime;

      // Extract token counts with fallbacks for different API formats
      let tokenCount: { input: number; output: number; total: number } | undefined;
      if (usage) {
        const usageAny = usage as any;
        const promptTokens = usageAny.promptTokens || usageAny.prompt_tokens || 0;
        const completionTokens = usageAny.completionTokens || usageAny.completion_tokens || 0;
        const totalTokens = usageAny.totalTokens || usageAny.total_tokens || (promptTokens + completionTokens) || 0;

        if (promptTokens > 0 || completionTokens > 0 || totalTokens > 0) {
          tokenCount = {
            input: promptTokens,
            output: completionTokens,
            total: totalTokens,
          };
        }
      }

      return {
        content: text,
        metadata: {
          model: config.model || DEFAULT_MODEL,
          provider: 'llama-local',
          tokenCount,
          latencyMs,
          rawRequest: {
            url: `${this.llamaServerURL}/v1/chat/completions`,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: requestPayload,
          },
          rawResponse: {
            status: 200,
            body: { choices: [{ message: { content: text } }], usage: usage || null },
          },
        },
      };
    }
  }

  /**
   * Chat using fallback cloud provider
   */
  private async chatWithFallback(
    options: ChatOptions,
    config: LLMConfig,
    startTime: number
  ): Promise<ChatResponse> {
    if (!this.fallbackProvider) {
      throw new Error('No fallback provider configured');
    }

    const provider = createOpenAI({
      apiKey: this.fallbackProvider.apiKey || process.env.OPENAI_API_KEY,
      baseURL: this.fallbackProvider.baseURL,
    });

    const model = provider(this.fallbackProvider.model);
    const messages = this.toCoreMessages(options.messages);

    if (options.stream) {
      const { text } = await streamText({
        model: model as any,
        messages,
        temperature: config.temperature,
      });

      const fullText = await text;
      const latencyMs = Date.now() - startTime;

      return {
        content: fullText,
        metadata: {
          model: this.fallbackProvider.model,
          provider: this.fallbackProvider.name,
          latencyMs,
        },
      };
    } else {
      const { text, usage } = await generateText({
        model: model as any,
        messages,
        temperature: config.temperature,
      });

      const latencyMs = Date.now() - startTime;

      // Extract token counts with fallbacks for different API formats
      let tokenCount: { input: number; output: number; total: number } | undefined;
      if (usage) {
        const usageAny = usage as any;
        const promptTokens = usageAny.promptTokens || usageAny.prompt_tokens || 0;
        const completionTokens = usageAny.completionTokens || usageAny.completion_tokens || 0;
        const totalTokens = usageAny.totalTokens || usageAny.total_tokens || (promptTokens + completionTokens) || 0;

        if (promptTokens > 0 || completionTokens > 0 || totalTokens > 0) {
          tokenCount = {
            input: promptTokens,
            output: completionTokens,
            total: totalTokens,
          };
        }
      }

      return {
        content: text,
        metadata: {
          model: this.fallbackProvider.model,
          provider: this.fallbackProvider.name,
          tokenCount,
          latencyMs,
        },
      };
    }
  }

  /**
   * Streaming chat completion
   */
  async *chatStream(options: ChatOptions): AsyncGenerator<string> {
    const config = { ...this.defaultConfig, ...options.config };
    const llamaAvailable = await this.checkLlamaServer();

    let model: any;

    if (llamaAvailable) {
      const llama = createOpenAICompatible({
        name: 'llama.cpp',
        baseURL: `${this.llamaServerURL}/v1`,
        headers: {
          'Content-Type': 'application/json',
        },
      });
      model = llama.chatModel(config.model || DEFAULT_MODEL);
    } else if (this.fallbackProvider) {
      const provider = createOpenAI({
        apiKey: this.fallbackProvider.apiKey || process.env.OPENAI_API_KEY,
        baseURL: this.fallbackProvider.baseURL,
      });
      model = provider(this.fallbackProvider.model);
    } else {
      throw new Error('No AI provider available');
    }
    const messages = this.toCoreMessages(options.messages);

    const { textStream } = await streamText({
      model: model as any,
      messages,
      temperature: config.temperature,
    });

    for await (const chunk of textStream) {
      yield chunk;
    }
  }

  /**
   * Get current provider status
   */
  async getStatus(): Promise<{
    llamaServer: { available: boolean; url: string };
    fallback: { configured: boolean; provider?: string };
  }> {
    const llamaAvailable = await this.checkLlamaServer();

    return {
      llamaServer: {
        available: llamaAvailable,
        url: this.llamaServerURL,
      },
      fallback: {
        configured: !!this.fallbackProvider,
        provider: this.fallbackProvider?.name,
      },
    };
  }
}

/**
 * Create a configured LlamaClient instance
 */
export function createLlamaClient(config?: LlamaClientConfig): LlamaClient {
  return new LlamaClient(config);
}

/**
 * Default singleton instance
 */
export const llamaClient = new LlamaClient();
