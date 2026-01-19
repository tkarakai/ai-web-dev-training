/**
 * Tests for Token Economics
 *
 * Run with: bun test
 *
 * These tests demonstrate expected behavior of token estimation and cost calculation.
 * Study them to understand edge cases and verify your understanding.
 */

import { describe, test, expect } from 'bun:test';
import {
  estimateTokensByChars,
  estimateTokensByWords,
  estimateTokensHybrid,
  calculateCost,
  estimateCostFromText,
  checkContextFit,
  fitMessagesInContext,
  estimateBatchCost,
  formatCost,
  formatTokens,
  compareModelCosts,
  MODEL_PRICING,
} from './tokens';

// =============================================================================
// Token Estimation Tests
// =============================================================================

describe('estimateTokensByChars', () => {
  test('empty string returns 0', () => {
    expect(estimateTokensByChars('')).toBe(0);
  });

  test('short text uses 4 chars per token rule', () => {
    // 12 characters / 4 = 3 tokens
    expect(estimateTokensByChars('Hello World!')).toBe(3);
  });

  test('rounds up partial tokens', () => {
    // 5 characters / 4 = 1.25, rounds to 2
    expect(estimateTokensByChars('Hello')).toBe(2);
  });

  test('handles longer text', () => {
    const text = 'The quick brown fox jumps over the lazy dog.';
    // 44 chars / 4 = 11 tokens
    expect(estimateTokensByChars(text)).toBe(11);
  });
});

describe('estimateTokensByWords', () => {
  test('empty string returns 0', () => {
    expect(estimateTokensByWords('')).toBe(0);
    expect(estimateTokensByWords('   ')).toBe(0);
  });

  test('single word', () => {
    // 1 word * 1.3 = 1.3, rounds to 2
    expect(estimateTokensByWords('Hello')).toBe(2);
  });

  test('multiple words', () => {
    // 9 words * 1.3 = 11.7, rounds to 12
    expect(estimateTokensByWords('The quick brown fox jumps over the lazy dog')).toBe(12);
  });

  test('handles multiple spaces', () => {
    expect(estimateTokensByWords('Hello    World')).toBe(3);
  });
});

describe('estimateTokensHybrid', () => {
  test('empty string returns 0', () => {
    expect(estimateTokensHybrid('')).toBe(0);
  });

  test('plain text', () => {
    const tokens = estimateTokensHybrid('Hello, how are you today?');
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeLessThan(20);
  });

  test('text with numbers adds extra tokens', () => {
    const withoutNumbers = estimateTokensHybrid('Call me tomorrow');
    const withNumbers = estimateTokensHybrid('Call me at 555-123-4567');
    expect(withNumbers).toBeGreaterThan(withoutNumbers);
  });

  test('code-heavy text gets multiplier', () => {
    const prose = estimateTokensHybrid('This is a simple sentence');
    const code = estimateTokensHybrid('function foo() { return x + y; }');
    // Code typically has more tokens due to special characters
    expect(code).toBeGreaterThan(prose * 0.8);
  });

  test('punctuation adds tokens', () => {
    const withoutPunct = estimateTokensHybrid('Hello world');
    const withPunct = estimateTokensHybrid('Hello, world! How are you?');
    expect(withPunct).toBeGreaterThan(withoutPunct);
  });
});

// =============================================================================
// Cost Calculation Tests
// =============================================================================

describe('calculateCost', () => {
  test('calculates cost for gpt-4o', () => {
    const cost = calculateCost(1000, 500, 'gpt-4o');

    // 1000 input tokens * $2.5/1M = $0.0025
    expect(cost.inputCost).toBeCloseTo(0.0025, 6);

    // 500 output tokens * $10/1M = $0.005
    expect(cost.outputCost).toBeCloseTo(0.005, 6);

    expect(cost.totalCost).toBeCloseTo(0.0075, 6);
  });

  test('local models have zero cost', () => {
    const cost = calculateCost(10000, 5000, 'llama-3.1-8b');
    expect(cost.inputCost).toBe(0);
    expect(cost.outputCost).toBe(0);
    expect(cost.totalCost).toBe(0);
  });

  test('output is typically more expensive than input', () => {
    const cost = calculateCost(1000, 1000, 'gpt-4o');
    expect(cost.outputCost).toBeGreaterThan(cost.inputCost);
  });
});

describe('estimateCostFromText', () => {
  test('estimates cost from text content', () => {
    const text = 'Write me a haiku about coding.';
    const cost = estimateCostFromText(text, 50, 'gpt-4o-mini');

    expect(cost.inputTokens).toBeGreaterThan(0);
    expect(cost.outputTokens).toBe(50);
    expect(cost.totalCost).toBeGreaterThan(0);
  });
});

// =============================================================================
// Context Window Tests
// =============================================================================

describe('checkContextFit', () => {
  test('small input fits easily', () => {
    const usage = checkContextFit(1000, 500, 'gpt-4o');

    expect(usage.canFit).toBe(true);
    expect(usage.usedTokens).toBe(1000);
    expect(usage.percentUsed).toBeLessThan(1);
  });

  test('large input may not fit with output reserve', () => {
    // GPT-4o has 128K context
    const usage = checkContextFit(127_000, 2000, 'gpt-4o');

    expect(usage.canFit).toBe(false);
    expect(usage.usedTokens).toBe(127_000);
  });

  test('calculates available tokens correctly', () => {
    const usage = checkContextFit(10_000, 1000, 'gpt-4o');

    expect(usage.availableTokens).toBe(128_000 - 10_000);
  });
});

describe('fitMessagesInContext', () => {
  test('fits all messages when under limit', () => {
    const messages = ['Hello', 'World', 'Test'];
    const result = fitMessagesInContext(messages, 1000);

    expect(result.fittingMessages).toHaveLength(3);
    expect(result.droppedCount).toBe(0);
  });

  test('drops oldest messages when over limit', () => {
    const messages = [
      'This is a very long message that takes many tokens.',
      'This is another long message with lots of content.',
      'Short message.',
    ];
    // Very tight limit - only last message fits
    const result = fitMessagesInContext(messages, 20, 5);

    expect(result.fittingMessages.length).toBeLessThan(messages.length);
    expect(result.droppedCount).toBeGreaterThan(0);
    // Most recent messages should be kept
    expect(result.fittingMessages[result.fittingMessages.length - 1]).toBe('Short message.');
  });

  test('preserves message order', () => {
    const messages = ['First', 'Second', 'Third'];
    const result = fitMessagesInContext(messages, 1000);

    expect(result.fittingMessages[0]).toBe('First');
    expect(result.fittingMessages[2]).toBe('Third');
  });
});

// =============================================================================
// Batch Cost Tests
// =============================================================================

describe('estimateBatchCost', () => {
  test('calculates total and per-item cost', () => {
    const items = [
      'Document one content here.',
      'Document two content here.',
      'Document three content here.',
    ];
    const result = estimateBatchCost(items, 100, 'gpt-4o-mini');

    expect(result.items).toBe(3);
    expect(result.totalOutputTokens).toBe(300);
    expect(result.perItemCost).toBeCloseTo(result.totalCost / 3, 10);
  });

  test('handles empty array', () => {
    const result = estimateBatchCost([], 100, 'gpt-4o');

    expect(result.items).toBe(0);
    expect(result.totalCost).toBe(0);
  });
});

// =============================================================================
// Formatting Tests
// =============================================================================

describe('formatCost', () => {
  test('formats small costs in cents', () => {
    expect(formatCost(0.005)).toContain('¢');
  });

  test('formats larger costs in dollars', () => {
    const formatted = formatCost(1.5);
    expect(formatted).toBe('$1.5000');
  });
});

describe('formatTokens', () => {
  test('formats small numbers as-is', () => {
    expect(formatTokens(500)).toBe('500');
  });

  test('formats thousands with K suffix', () => {
    expect(formatTokens(5000)).toBe('5.0K');
  });

  test('formats millions with M suffix', () => {
    expect(formatTokens(1_500_000)).toBe('1.5M');
  });
});

// =============================================================================
// Model Comparison Tests
// =============================================================================

describe('compareModelCosts', () => {
  test('returns all models sorted by cost', () => {
    const comparison = compareModelCosts(1000, 500);

    expect(comparison.length).toBe(Object.keys(MODEL_PRICING).length);
    // Should be sorted ascending by cost
    for (let i = 1; i < comparison.length; i++) {
      expect(comparison[i].cost.totalCost).toBeGreaterThanOrEqual(
        comparison[i - 1].cost.totalCost
      );
    }
  });

  test('local models are cheapest', () => {
    const comparison = compareModelCosts(1000, 500);
    const cheapest = comparison[0];

    expect(['llama-3.1-8b', 'llama-3.1-70b', 'qwen-2.5-7b', 'mistral-7b']).toContain(
      cheapest.model
    );
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe('edge cases', () => {
  test('handles unicode text', () => {
    const tokens = estimateTokensHybrid('Hello 世界! 🌍');
    expect(tokens).toBeGreaterThan(0);
  });

  test('handles very long text', () => {
    const longText = 'word '.repeat(10000);
    const tokens = estimateTokensHybrid(longText);
    expect(tokens).toBeGreaterThan(10000);
  });

  test('handles newlines', () => {
    const text = 'Line 1\nLine 2\nLine 3';
    const tokens = estimateTokensHybrid(text);
    expect(tokens).toBeGreaterThan(0);
  });
});
