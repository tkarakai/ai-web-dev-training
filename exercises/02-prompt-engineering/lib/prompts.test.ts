/**
 * Tests for Prompt Engineering
 *
 * Run with: bun test
 *
 * These tests verify prompt construction. Integration tests with LLM
 * are in the UI (requires llama-server running).
 */

import { describe, test, expect } from 'bun:test';
import {
  buildZeroShotPrompt,
  buildFewShotPrompt,
  buildChainOfThoughtPrompt,
  buildRoleBasedPrompt,
  renderTemplate,
  extractTemplateVariables,
  buildComparisonPrompts,
  estimatePromptTokens,
  validatePromptLength,
  PromptError,
  TEMPLATES,
  EXAMPLE_SETS,
} from './prompts';

// =============================================================================
// Prompt Building Tests
// =============================================================================

describe('buildZeroShotPrompt', () => {
  test('creates single user message', () => {
    const messages = buildZeroShotPrompt('What is 2+2?');

    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe('user');
    expect(messages[0].content).toBe('What is 2+2?');
  });
});

describe('buildFewShotPrompt', () => {
  test('creates alternating user/assistant messages', () => {
    const examples = [
      { input: 'Hi', output: 'Hello!' },
      { input: 'Bye', output: 'Goodbye!' },
    ];
    const messages = buildFewShotPrompt('Hey', examples);

    expect(messages).toHaveLength(5); // 2 pairs + 1 final user
    expect(messages[0].role).toBe('user');
    expect(messages[1].role).toBe('assistant');
    expect(messages[4].role).toBe('user');
    expect(messages[4].content).toBe('Hey');
  });

  test('handles empty examples', () => {
    const messages = buildFewShotPrompt('Hello', []);

    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe('Hello');
  });
});

describe('buildChainOfThoughtPrompt', () => {
  test('appends step-by-step instruction', () => {
    const messages = buildChainOfThoughtPrompt('Solve: 15 * 7');

    expect(messages).toHaveLength(1);
    expect(messages[0].content).toContain('step by step');
    expect(messages[0].content).toContain('15 * 7');
  });
});

describe('buildRoleBasedPrompt', () => {
  test('creates system + user messages', () => {
    const messages = buildRoleBasedPrompt(
      'Explain loops',
      'You are a Python teacher'
    );

    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toBe('You are a Python teacher');
    expect(messages[1].role).toBe('user');
    expect(messages[1].content).toBe('Explain loops');
  });

  test('includes constraints in system message', () => {
    const messages = buildRoleBasedPrompt(
      'Help me',
      'You are a helpful assistant',
      ['Be concise', 'Use examples']
    );

    expect(messages[0].content).toContain('Be concise');
    expect(messages[0].content).toContain('Use examples');
    expect(messages[0].content).toContain('Constraints:');
  });
});

// =============================================================================
// Template Tests
// =============================================================================

describe('renderTemplate', () => {
  test('replaces single variable', () => {
    const result = renderTemplate('Hello {{name}}!', { name: 'World' });
    expect(result).toBe('Hello World!');
  });

  test('replaces multiple variables', () => {
    const result = renderTemplate(
      '{{greeting}}, {{name}}!',
      { greeting: 'Hi', name: 'Alice' }
    );
    expect(result).toBe('Hi, Alice!');
  });

  test('replaces same variable multiple times', () => {
    const result = renderTemplate(
      '{{x}} + {{x}} = {{x}}{{x}}',
      { x: '2' }
    );
    expect(result).toBe('2 + 2 = 22');
  });

  test('throws on missing variable', () => {
    expect(() =>
      renderTemplate('Hello {{name}}!', {})
    ).toThrow(PromptError);
  });

  test('throws with informative error', () => {
    try {
      renderTemplate('{{a}} and {{b}}', { a: '1' });
    } catch (e) {
      expect(e).toBeInstanceOf(PromptError);
      expect((e as PromptError).code).toBe('MISSING_VARIABLES');
      expect((e as PromptError).message).toContain('{{b}}');
    }
  });
});

describe('extractTemplateVariables', () => {
  test('extracts single variable', () => {
    const vars = extractTemplateVariables('Hello {{name}}');
    expect(vars).toEqual(['name']);
  });

  test('extracts multiple unique variables', () => {
    const vars = extractTemplateVariables('{{a}} + {{b}} = {{c}}');
    expect(vars).toHaveLength(3);
    expect(vars).toContain('a');
    expect(vars).toContain('b');
    expect(vars).toContain('c');
  });

  test('deduplicates repeated variables', () => {
    const vars = extractTemplateVariables('{{x}} + {{x}}');
    expect(vars).toEqual(['x']);
  });

  test('returns empty array for no variables', () => {
    const vars = extractTemplateVariables('No variables here');
    expect(vars).toEqual([]);
  });
});

describe('TEMPLATES', () => {
  test('summarize template has correct variables', () => {
    const vars = extractTemplateVariables(TEMPLATES.summarize.template);
    expect(vars).toContain('content_type');
    expect(vars).toContain('length');
    expect(vars).toContain('focus');
    expect(vars).toContain('content');
  });

  test('all templates are valid', () => {
    for (const [name, template] of Object.entries(TEMPLATES)) {
      const extracted = extractTemplateVariables(template.template);
      expect(extracted.sort()).toEqual(template.variables.sort());
    }
  });
});

// =============================================================================
// Comparison Tests
// =============================================================================

describe('buildComparisonPrompts', () => {
  test('creates all four strategy variants', () => {
    const comparisons = buildComparisonPrompts('What is AI?');

    expect(comparisons).toHaveLength(4);
    const strategies = comparisons.map((c) => c.strategy);
    expect(strategies).toContain('zero-shot');
    expect(strategies).toContain('few-shot');
    expect(strategies).toContain('chain-of-thought');
    expect(strategies).toContain('role-based');
  });

  test('includes examples in few-shot variant', () => {
    const examples = [{ input: 'Q1', output: 'A1' }];
    const comparisons = buildComparisonPrompts('Q2', examples);

    const fewShot = comparisons.find((c) => c.strategy === 'few-shot');
    expect(fewShot?.messages).toHaveLength(3); // example pair + query
  });
});

// =============================================================================
// Validation Tests
// =============================================================================

describe('estimatePromptTokens', () => {
  test('accounts for role tokens', () => {
    const short = estimatePromptTokens([{ role: 'user', content: 'Hi' }]);
    const long = estimatePromptTokens([
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'Hello!' },
    ]);

    expect(long).toBeGreaterThan(short);
  });

  test('scales with content length', () => {
    const short = estimatePromptTokens([{ role: 'user', content: 'Hi' }]);
    const long = estimatePromptTokens([
      { role: 'user', content: 'This is a much longer message with many more words' },
    ]);

    expect(long).toBeGreaterThan(short);
  });
});

describe('validatePromptLength', () => {
  test('validates short prompt', () => {
    const messages = [{ role: 'user' as const, content: 'Hi' }];
    const result = validatePromptLength(messages, 4096);

    expect(result.valid).toBe(true);
    expect(result.estimatedTokens).toBeLessThan(100);
  });

  test('rejects prompt exceeding context', () => {
    const longContent = 'word '.repeat(10000);
    const messages = [{ role: 'user' as const, content: longContent }];
    const result = validatePromptLength(messages, 1000);

    expect(result.valid).toBe(false);
  });

  test('accounts for output reservation', () => {
    const messages = [{ role: 'user' as const, content: 'test' }];

    const withReserve = validatePromptLength(messages, 100, 90);
    const withoutReserve = validatePromptLength(messages, 100, 0);

    expect(withoutReserve.available).toBeGreaterThan(withReserve.available);
  });
});

// =============================================================================
// Example Sets Tests
// =============================================================================

describe('EXAMPLE_SETS', () => {
  test('sentiment examples are valid', () => {
    expect(EXAMPLE_SETS.sentiment).toHaveLength(3);
    expect(EXAMPLE_SETS.sentiment.every((e) => e.input && e.output)).toBe(true);
  });

  test('all example sets have input/output pairs', () => {
    for (const [name, examples] of Object.entries(EXAMPLE_SETS)) {
      expect(examples.length).toBeGreaterThan(0);
      for (const example of examples) {
        expect(typeof example.input).toBe('string');
        expect(typeof example.output).toBe('string');
      }
    }
  });
});
