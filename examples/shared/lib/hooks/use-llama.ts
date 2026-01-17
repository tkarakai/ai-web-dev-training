'use client';

import * as React from 'react';
import { llamaClient, type LlamaClient } from '../ai/llama-client';
import type { AIMessage } from '../../types';
import { generateId } from '../utils';

export interface UseLlamaOptions {
  client?: LlamaClient;
  onError?: (error: Error) => void;
  enableStreaming?: boolean;
}

export interface UseLlamaResult {
  messages: AIMessage[];
  isLoading: boolean;
  error: Error | null;
  sendMessage: (content: string, systemPrompt?: string) => Promise<void>;
  sendMessageStreaming: (content: string, systemPrompt?: string) => Promise<void>;
  clearMessages: () => void;
  status: 'idle' | 'loading' | 'success' | 'error';
}

/**
 * Hook for using llama client in React components
 */
export function useLlama(options: UseLlamaOptions = {}): UseLlamaResult {
  const client = options.client || llamaClient;

  const [messages, setMessages] = React.useState<AIMessage[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const [status, setStatus] = React.useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const sendMessage = React.useCallback(
    async (content: string, systemPrompt?: string) => {
      setIsLoading(true);
      setError(null);
      setStatus('loading');

      const userMessage: AIMessage = {
        id: generateId('msg'),
        role: 'user',
        content,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);

      try {
        const messagesToSend: AIMessage[] = systemPrompt
          ? [
              {
                id: generateId('sys'),
                role: 'system',
                content: systemPrompt,
                timestamp: new Date(),
              },
              ...messages,
              userMessage,
            ]
          : [...messages, userMessage];

        const response = await client.chat({
          messages: messagesToSend,
        });

        const assistantMessage: AIMessage = {
          id: generateId('msg'),
          role: 'assistant',
          content: response.content,
          timestamp: new Date(),
          metadata: {
            model: response.metadata.model,
            latencyMs: response.metadata.latencyMs,
            tokenCount: response.metadata.tokenCount,
            rawRequest: response.metadata.rawRequest,
            rawResponse: response.metadata.rawResponse,
          },
        };

        setMessages((prev) => [...prev, assistantMessage]);
        setStatus('success');
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        setStatus('error');

        if (options.onError) {
          options.onError(error);
        }

        // Add error message
        const errorMessage: AIMessage = {
          id: generateId('msg'),
          role: 'assistant',
          content: 'Sorry, I encountered an error processing your request.',
          timestamp: new Date(),
          metadata: {
            error: error.message,
          },
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    },
    [client, messages, options]
  );

  const sendMessageStreaming = React.useCallback(
    async (content: string, systemPrompt?: string) => {
      setIsLoading(true);
      setError(null);
      setStatus('loading');

      const userMessage: AIMessage = {
        id: generateId('msg'),
        role: 'user',
        content,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);

      // Create placeholder for streaming message
      const assistantId = generateId('msg');
      const placeholderMessage: AIMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        metadata: {},
      };

      setMessages((prev) => [...prev, placeholderMessage]);

      try {
        const messagesToSend: AIMessage[] = systemPrompt
          ? [
              {
                id: generateId('sys'),
                role: 'system',
                content: systemPrompt,
                timestamp: new Date(),
              },
              ...messages,
              userMessage,
            ]
          : [...messages, userMessage];

        const startTime = Date.now();
        let fullContent = '';

        // Stream the response
        for await (const chunk of client.chatStream({
          messages: messagesToSend,
        })) {
          fullContent += chunk;

          // Update message with accumulated content
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantId
                ? { ...msg, content: fullContent }
                : msg
            )
          );
        }

        const latencyMs = Date.now() - startTime;

        // Update with final metadata
        // Note: Raw HTTP request/response data is not available in streaming mode
        // since chatStream() is a generator that yields chunks without metadata
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId
              ? {
                  ...msg,
                  metadata: {
                    ...msg.metadata,
                    model: 'gpt-oss-20b',
                    latencyMs,
                  },
                }
              : msg
          )
        );

        setStatus('success');
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        setStatus('error');

        if (options.onError) {
          options.onError(error);
        }

        // Update placeholder with error
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId
              ? {
                  ...msg,
                  content: 'Sorry, I encountered an error processing your request.',
                  metadata: { error: error.message },
                }
              : msg
          )
        );
      } finally {
        setIsLoading(false);
      }
    },
    [client, messages, options]
  );

  const clearMessages = React.useCallback(() => {
    setMessages([]);
    setError(null);
    setStatus('idle');
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    sendMessageStreaming,
    clearMessages,
    status,
  };
}
