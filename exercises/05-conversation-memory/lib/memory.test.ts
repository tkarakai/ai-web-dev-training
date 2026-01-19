/**
 * Tests for Conversation Memory
 *
 * Run with: bun test
 */

import { describe, test, expect } from 'bun:test';
import {
  estimateMessageTokens,
  estimateConversationTokens,
  applySlidingWindow,
  applyImportanceStrategy,
  needsSummarization,
  createSummarizationPrompt,
  applySummarization,
  ConversationManager,
  MemoryError,
  type Message,
} from './memory';

// =============================================================================
// Helpers
// =============================================================================

function createMessage(
  role: 'system' | 'user' | 'assistant',
  content: string,
  index: number = 0
): Message {
  return {
    id: `msg-${index}`,
    role,
    content,
    timestamp: new Date(Date.now() + index * 1000),
  };
}

// =============================================================================
// Token Estimation Tests
// =============================================================================

describe('estimateMessageTokens', () => {
  test('estimates short message', () => {
    const msg = createMessage('user', 'Hello');
    const tokens = estimateMessageTokens(msg);
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeLessThan(20);
  });

  test('longer messages have more tokens', () => {
    const short = createMessage('user', 'Hi');
    const long = createMessage('user', 'This is a much longer message with many words');

    expect(estimateMessageTokens(long)).toBeGreaterThan(estimateMessageTokens(short));
  });
});

describe('estimateConversationTokens', () => {
  test('sums all message tokens', () => {
    const messages = [
      createMessage('user', 'Hello', 0),
      createMessage('assistant', 'Hi there!', 1),
      createMessage('user', 'How are you?', 2),
    ];

    const total = estimateConversationTokens(messages);
    const individual = messages.reduce((sum, m) => sum + estimateMessageTokens(m), 0);

    expect(total).toBe(individual);
  });
});

// =============================================================================
// Sliding Window Tests
// =============================================================================

describe('applySlidingWindow', () => {
  test('keeps all messages when under limit', () => {
    const messages = [
      createMessage('user', 'Hello', 0),
      createMessage('assistant', 'Hi', 1),
    ];

    const result = applySlidingWindow(messages, 1000, 100);
    expect(result).toHaveLength(2);
  });

  test('drops old messages when over limit', () => {
    const messages = [
      createMessage('user', 'First message', 0),
      createMessage('assistant', 'Response 1', 1),
      createMessage('user', 'Second message', 2),
      createMessage('assistant', 'Response 2', 3),
      createMessage('user', 'Third message', 4),
      createMessage('assistant', 'Response 3', 5),
    ];

    // Very tight limit
    const result = applySlidingWindow(messages, 50, 10);
    expect(result.length).toBeLessThan(messages.length);
    // Should keep most recent
    expect(result[result.length - 1].content).toBe('Response 3');
  });

  test('always keeps system message', () => {
    const messages = [
      createMessage('system', 'You are a helpful assistant', 0),
      createMessage('user', 'Hello', 1),
      createMessage('assistant', 'Hi', 2),
    ];

    const result = applySlidingWindow(messages, 100, 10);
    expect(result[0].role).toBe('system');
  });

  test('handles empty messages', () => {
    const result = applySlidingWindow([], 1000, 100);
    expect(result).toHaveLength(0);
  });
});

// =============================================================================
// Importance Strategy Tests
// =============================================================================

describe('applyImportanceStrategy', () => {
  test('keeps system message', () => {
    const messages = [
      createMessage('system', 'System prompt', 0),
      createMessage('user', 'Hello', 1),
    ];

    const result = applyImportanceStrategy(messages, 100, 10);
    expect(result.find(m => m.role === 'system')).toBeDefined();
  });

  test('prioritizes questions', () => {
    const messages = [
      createMessage('user', 'Statement without question', 0),
      createMessage('assistant', 'Response', 1),
      createMessage('user', 'What is the meaning of life?', 2),
    ];

    // With very tight limit, question should be kept
    const result = applyImportanceStrategy(messages, 50, 10);
    const hasQuestion = result.some(m => m.content.includes('?'));
    expect(hasQuestion).toBe(true);
  });

  test('maintains chronological order in output', () => {
    const messages = [
      createMessage('user', 'First', 0),
      createMessage('assistant', 'Second', 1),
      createMessage('user', 'Third', 2),
    ];

    const result = applyImportanceStrategy(messages, 1000, 100);
    for (let i = 1; i < result.length; i++) {
      expect(result[i].timestamp.getTime()).toBeGreaterThanOrEqual(
        result[i - 1].timestamp.getTime()
      );
    }
  });
});

// =============================================================================
// Summarization Tests
// =============================================================================

describe('needsSummarization', () => {
  test('returns false when under threshold', () => {
    const messages = [createMessage('user', 'Hello', 0)];
    expect(needsSummarization(messages, 1000, 0.8)).toBe(false);
  });

  test('returns true when over threshold', () => {
    const longContent = 'word '.repeat(500);
    const messages = [createMessage('user', longContent, 0)];
    expect(needsSummarization(messages, 100, 0.5)).toBe(true);
  });
});

describe('createSummarizationPrompt', () => {
  test('includes conversation content', () => {
    const messages = [
      createMessage('user', 'What is TypeScript?', 0),
      createMessage('assistant', 'TypeScript is a typed superset of JavaScript', 1),
    ];

    const prompt = createSummarizationPrompt(messages);

    expect(prompt).toContain('TypeScript');
    expect(prompt).toContain('Summary');
  });

  test('excludes system messages from summary', () => {
    const messages = [
      createMessage('system', 'Secret system prompt', 0),
      createMessage('user', 'Hello', 1),
    ];

    const prompt = createSummarizationPrompt(messages);

    expect(prompt).not.toContain('Secret system prompt');
    expect(prompt).toContain('Hello');
  });
});

describe('applySummarization', () => {
  test('replaces old messages with summary', () => {
    const messages = [
      createMessage('system', 'System prompt', 0),
      createMessage('user', 'Old message 1', 1),
      createMessage('assistant', 'Old response 1', 2),
      createMessage('user', 'Recent message', 3),
      createMessage('assistant', 'Recent response', 4),
    ];

    const result = applySummarization(messages, 'Summary of conversation', 2);

    // Should have system + summary + 2 recent
    expect(result.length).toBeLessThan(messages.length);
    expect(result.some(m => m.content.includes('Summary of conversation'))).toBe(true);
    expect(result[result.length - 1].content).toBe('Recent response');
  });
});

// =============================================================================
// ConversationManager Tests
// =============================================================================

describe('ConversationManager', () => {
  const defaultConfig = {
    maxTokens: 1000,
    reserveForOutput: 100,
    strategy: 'sliding-window' as const,
  };

  test('creates conversation', () => {
    const manager = new ConversationManager(defaultConfig);
    const conv = manager.createConversation('You are helpful');

    expect(conv.id).toBeDefined();
    expect(conv.messages).toHaveLength(1);
    expect(conv.messages[0].role).toBe('system');
  });

  test('adds messages', () => {
    const manager = new ConversationManager(defaultConfig);
    const conv = manager.createConversation();

    manager.addMessage(conv.id, 'user', 'Hello');
    manager.addMessage(conv.id, 'assistant', 'Hi there!');

    const updated = manager.getConversation(conv.id);
    expect(updated?.messages).toHaveLength(2);
  });

  test('auto-titles from first user message', () => {
    const manager = new ConversationManager(defaultConfig);
    const conv = manager.createConversation();

    manager.addMessage(conv.id, 'user', 'How do I learn TypeScript?');

    const updated = manager.getConversation(conv.id);
    expect(updated?.title).toContain('TypeScript');
  });

  test('throws on unknown conversation', () => {
    const manager = new ConversationManager(defaultConfig);

    expect(() => manager.addMessage('unknown', 'user', 'Hello')).toThrow(MemoryError);
  });

  test('getContextWindow applies strategy', () => {
    const manager = new ConversationManager({
      ...defaultConfig,
      maxTokens: 50,
    });

    const conv = manager.createConversation('System prompt');

    // Add many messages
    for (let i = 0; i < 10; i++) {
      manager.addMessage(conv.id, 'user', `Message ${i}`);
    }

    const context = manager.getContextWindow(conv.id);
    const full = manager.getConversation(conv.id)?.messages;

    expect(context.length).toBeLessThan(full!.length);
  });

  test('lists conversations sorted by update time', () => {
    const manager = new ConversationManager(defaultConfig);

    const conv1 = manager.createConversation();
    const conv2 = manager.createConversation();

    // Update conv1 later
    manager.addMessage(conv1.id, 'user', 'Update');

    const list = manager.listConversations();
    expect(list[0].id).toBe(conv1.id);
  });

  test('deletes conversations', () => {
    const manager = new ConversationManager(defaultConfig);
    const conv = manager.createConversation();

    expect(manager.deleteConversation(conv.id)).toBe(true);
    expect(manager.getConversation(conv.id)).toBeUndefined();
  });

  test('calculates stats', () => {
    const manager = new ConversationManager(defaultConfig);
    const conv = manager.createConversation('System');

    manager.addMessage(conv.id, 'user', 'Hello');
    manager.addMessage(conv.id, 'assistant', 'Hi');

    const stats = manager.getStats(conv.id);

    expect(stats.totalMessages).toBe(3);
    expect(stats.totalTokens).toBeGreaterThan(0);
    expect(stats.percentUsed).toBeGreaterThan(0);
    expect(stats.percentUsed).toBeLessThan(100);
  });
});
