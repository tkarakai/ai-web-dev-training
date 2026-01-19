/**
 * Tests for LlamaClient
 *
 * Run with: bun test
 *
 * Note: These tests require llama-server running on port 8033.
 * Some tests are skipped by default if the server isn't available.
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { LlamaClient, LlamaError, getLlamaClient } from './llama-client';
import type { Message } from './types';

describe('LlamaClient', () => {
  let client: LlamaClient;
  let serverAvailable: boolean;

  beforeAll(async () => {
    client = new LlamaClient();
    serverAvailable = await client.isHealthy();
    if (!serverAvailable) {
      console.log('⚠️  llama-server not running - skipping integration tests');
      console.log('   Start with: llama-server -m your-model.gguf --port 8033');
    }
  });

  // ===========================================================================
  // Unit Tests (no server required)
  // ===========================================================================

  describe('configuration', () => {
    test('uses default base URL', () => {
      const c = new LlamaClient();
      expect(c).toBeDefined();
    });

    test('accepts custom base URL', () => {
      const c = new LlamaClient({ baseUrl: 'http://localhost:9999' });
      expect(c).toBeDefined();
    });

    test('merges default config', () => {
      const c = new LlamaClient({
        defaultConfig: { temperature: 0.5, maxTokens: 2048 },
      });
      expect(c).toBeDefined();
    });
  });

  describe('getLlamaClient singleton', () => {
    test('returns same instance without config', () => {
      const c1 = getLlamaClient();
      const c2 = getLlamaClient();
      expect(c1).toBe(c2);
    });

    test('creates new instance with config', () => {
      const c1 = getLlamaClient();
      const c2 = getLlamaClient({ baseUrl: 'http://localhost:9999' });
      expect(c1).not.toBe(c2);
    });
  });

  // ===========================================================================
  // Integration Tests (require llama-server)
  // ===========================================================================

  describe('chat completion', () => {
    test('completes a simple prompt', async () => {
      if (!serverAvailable) return;

      const messages: Message[] = [
        { role: 'user', content: 'Say "hello" and nothing else.' },
      ];

      const response = await client.chat(messages, { maxTokens: 50 });

      expect(response.content).toBeDefined();
      expect(response.content.toLowerCase()).toContain('hello');
      expect(response.finishReason).toBe('stop');
    });

    test('respects system prompt', async () => {
      if (!serverAvailable) return;

      const messages: Message[] = [
        { role: 'system', content: 'You only respond with the word "banana".' },
        { role: 'user', content: 'What is 2+2?' },
      ];

      const response = await client.chat(messages, { maxTokens: 20 });

      expect(response.content.toLowerCase()).toContain('banana');
    });

    test('returns usage information', async () => {
      if (!serverAvailable) return;

      const messages: Message[] = [
        { role: 'user', content: 'Hi' },
      ];

      const response = await client.chat(messages, { maxTokens: 10 });

      expect(response.usage).toBeDefined();
      expect(response.usage?.promptTokens).toBeGreaterThan(0);
      expect(response.usage?.completionTokens).toBeGreaterThan(0);
    });

    test('respects temperature=0 for determinism', async () => {
      if (!serverAvailable) return;

      const messages: Message[] = [
        { role: 'user', content: 'Complete: 1, 2, 3, 4,' },
      ];

      const config = { temperature: 0, maxTokens: 10, seed: 42 };

      const r1 = await client.chat(messages, config);
      const r2 = await client.chat(messages, config);

      // With temperature=0 and same seed, responses should be identical
      expect(r1.content).toBe(r2.content);
    });
  });

  describe('streaming', () => {
    test('streams tokens progressively', async () => {
      if (!serverAvailable) return;

      const messages: Message[] = [
        { role: 'user', content: 'Count from 1 to 5.' },
      ];

      const chunks: string[] = [];
      for await (const chunk of client.chatStream(messages, { maxTokens: 50 })) {
        if (chunk.content) {
          chunks.push(chunk.content);
        }
      }

      expect(chunks.length).toBeGreaterThan(1);
      const fullResponse = chunks.join('');
      expect(fullResponse).toContain('1');
      expect(fullResponse).toContain('5');
    });

    test('signals completion', async () => {
      if (!serverAvailable) return;

      const messages: Message[] = [
        { role: 'user', content: 'Say hi' },
      ];

      let sawDone = false;
      for await (const chunk of client.chatStream(messages, { maxTokens: 10 })) {
        if (chunk.done) {
          sawDone = true;
        }
      }

      expect(sawDone).toBe(true);
    });
  });

  describe('error handling', () => {
    test('throws LlamaError on connection failure', async () => {
      const badClient = new LlamaClient({ baseUrl: 'http://localhost:99999' });

      await expect(
        badClient.chat([{ role: 'user', content: 'hi' }])
      ).rejects.toThrow();
    });
  });
});
