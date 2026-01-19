/**
 * Tests for Structured Outputs
 *
 * Run with: bun test
 */

import { describe, test, expect } from 'bun:test';
import { z } from 'zod';
import {
  extractJSON,
  parseJSON,
  extractWithSchema,
  extractWithRepair,
  buildStructuredPrompt,
  SentimentSchema,
  EntitySchema,
  SummarySchema,
} from './structured';

// =============================================================================
// JSON Extraction Tests
// =============================================================================

describe('extractJSON', () => {
  test('extracts from code block', () => {
    const text = 'Here is the result:\n```json\n{"name": "test"}\n```';
    expect(extractJSON(text)).toBe('{"name": "test"}');
  });

  test('extracts from code block without json tag', () => {
    const text = '```\n{"value": 123}\n```';
    expect(extractJSON(text)).toBe('{"value": 123}');
  });

  test('extracts raw JSON object', () => {
    const text = 'The result is {"status": "ok"}';
    expect(extractJSON(text)).toBe('{"status": "ok"}');
  });

  test('extracts JSON array', () => {
    const text = 'Items: [1, 2, 3]';
    expect(extractJSON(text)).toBe('[1, 2, 3]');
  });

  test('returns null for no JSON', () => {
    const text = 'Just some regular text';
    expect(extractJSON(text)).toBeNull();
  });

  test('handles nested objects', () => {
    const text = '{"outer": {"inner": "value"}}';
    expect(extractJSON(text)).toBe('{"outer": {"inner": "value"}}');
  });
});

describe('parseJSON', () => {
  test('parses valid JSON', () => {
    const result = parseJSON('{"key": "value"}');
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ key: 'value' });
  });

  test('handles code blocks', () => {
    const result = parseJSON('```json\n{"a": 1}\n```');
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ a: 1 });
  });

  test('returns error for invalid JSON', () => {
    const result = parseJSON('{invalid}');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  test('returns error for no JSON', () => {
    const result = parseJSON('no json here');
    expect(result.success).toBe(false);
    expect(result.error).toContain('No JSON found');
  });
});

// =============================================================================
// Schema Extraction Tests
// =============================================================================

describe('extractWithSchema', () => {
  const TestSchema = z.object({
    name: z.string(),
    age: z.number(),
  });

  test('extracts valid data', () => {
    const result = extractWithSchema('{"name": "Alice", "age": 30}', TestSchema);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ name: 'Alice', age: 30 });
  });

  test('fails on invalid type', () => {
    const result = extractWithSchema('{"name": "Alice", "age": "thirty"}', TestSchema);
    expect(result.success).toBe(false);
    expect(result.error).toContain('age');
  });

  test('fails on missing field', () => {
    const result = extractWithSchema('{"name": "Alice"}', TestSchema);
    expect(result.success).toBe(false);
    expect(result.error).toContain('age');
  });

  test('allows extra fields', () => {
    const result = extractWithSchema('{"name": "Alice", "age": 30, "extra": true}', TestSchema);
    expect(result.success).toBe(true);
  });
});

// =============================================================================
// Common Schema Tests
// =============================================================================

describe('SentimentSchema', () => {
  test('validates positive sentiment', () => {
    const data = { sentiment: 'positive', confidence: 0.9 };
    const result = SentimentSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  test('validates with reasons', () => {
    const data = {
      sentiment: 'negative',
      confidence: 0.8,
      reasons: ['poor service', 'high prices'],
    };
    const result = SentimentSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  test('rejects invalid sentiment', () => {
    const data = { sentiment: 'very positive', confidence: 0.9 };
    const result = SentimentSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  test('rejects invalid confidence', () => {
    const data = { sentiment: 'positive', confidence: 1.5 };
    const result = SentimentSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});

describe('EntitySchema', () => {
  test('validates entities', () => {
    const data = {
      entities: [
        { text: 'John', type: 'person' },
        { text: 'Google', type: 'organization' },
      ],
    };
    const result = EntitySchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  test('validates with startIndex', () => {
    const data = {
      entities: [{ text: 'NYC', type: 'location', startIndex: 15 }],
    };
    const result = EntitySchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  test('rejects invalid type', () => {
    const data = {
      entities: [{ text: 'Thing', type: 'unknown_type' }],
    };
    const result = EntitySchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});

describe('SummarySchema', () => {
  test('validates summary', () => {
    const data = {
      summary: 'A brief summary',
      keyPoints: ['Point 1', 'Point 2'],
      wordCount: 100,
    };
    const result = SummarySchema.safeParse(data);
    expect(result.success).toBe(true);
  });
});

// =============================================================================
// Repair Loop Tests
// =============================================================================

describe('extractWithRepair', () => {
  const schema = z.object({
    value: z.number(),
  });

  test('succeeds on first try with valid output', async () => {
    const generate = async () => '{"value": 42}';
    const result = await extractWithRepair(generate, 'test', schema);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ value: 42 });
    expect(result.attempts).toBe(1);
  });

  test('retries on invalid output', async () => {
    let attempt = 0;
    const generate = async (prompt: string) => {
      attempt++;
      if (attempt === 1) return '{"value": "not a number"}';
      return '{"value": 42}';
    };

    const result = await extractWithRepair(generate, 'test', schema);

    expect(result.success).toBe(true);
    expect(result.attempts).toBe(2);
  });

  test('fails after max retries', async () => {
    const generate = async () => '{"value": "always wrong"}';
    const result = await extractWithRepair(generate, 'test', schema, { maxRetries: 2 });

    expect(result.success).toBe(false);
    expect(result.attempts).toBe(2);
    expect(result.error).toContain('2 attempts');
  });

  test('includes raw output when requested', async () => {
    const generate = async () => '{"value": 42}';
    const result = await extractWithRepair(generate, 'test', schema, {
      includeRawOutput: true,
    });

    expect(result.rawOutput).toBe('{"value": 42}');
  });
});

// =============================================================================
// Prompt Building Tests
// =============================================================================

describe('buildStructuredPrompt', () => {
  test('includes task', () => {
    const prompt = buildStructuredPrompt('Analyze this', z.object({ result: z.string() }));
    expect(prompt).toContain('Analyze this');
  });

  test('includes schema description', () => {
    const schema = z.object({
      name: z.string(),
      count: z.number(),
    });
    const prompt = buildStructuredPrompt('Test', schema);
    expect(prompt).toContain('name');
    expect(prompt).toContain('count');
    expect(prompt).toContain('string');
    expect(prompt).toContain('number');
  });

  test('includes examples when provided', () => {
    const schema = z.object({ x: z.number() });
    const examples = [{ input: 'test input', output: { x: 5 } }];
    const prompt = buildStructuredPrompt('Task', schema, examples);

    expect(prompt).toContain('Examples');
    expect(prompt).toContain('test input');
    expect(prompt).toContain('"x": 5');
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe('edge cases', () => {
  test('handles empty object', () => {
    const result = extractWithSchema('{}', z.object({}));
    expect(result.success).toBe(true);
  });

  test('handles empty array', () => {
    const result = extractWithSchema('[]', z.array(z.string()));
    expect(result.success).toBe(true);
    expect(result.data).toEqual([]);
  });

  test('handles unicode in values', () => {
    const schema = z.object({ text: z.string() });
    const result = extractWithSchema('{"text": "Hello 世界 🌍"}', schema);
    expect(result.success).toBe(true);
    expect(result.data?.text).toBe('Hello 世界 🌍');
  });

  test('handles nested arrays', () => {
    const schema = z.object({
      matrix: z.array(z.array(z.number())),
    });
    const result = extractWithSchema('{"matrix": [[1,2],[3,4]]}', schema);
    expect(result.success).toBe(true);
    expect(result.data?.matrix).toEqual([[1, 2], [3, 4]]);
  });
});
