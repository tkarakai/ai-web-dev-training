/**
 * Tests for Chain-of-Thought Reasoning
 *
 * Run: bun test lib/chain-of-thought.test.ts
 */

import { describe, it, expect } from 'bun:test';
import {
  buildCoTPrompt,
  buildStructuredCoTPrompt,
  buildZeroShotPrompt,
  extractSteps,
  extractFinalAnswer,
  normalizeAnswer,
  answersMatch,
  estimateConfidence,
  TEST_PROBLEMS,
} from './chain-of-thought';

describe('Prompt Builders', () => {
  it('buildCoTPrompt adds "think step by step"', () => {
    const prompt = buildCoTPrompt('What is 2+2?');
    expect(prompt).toContain('What is 2+2?');
    expect(prompt.toLowerCase()).toContain('step by step');
  });

  it('buildStructuredCoTPrompt includes format instructions', () => {
    const prompt = buildStructuredCoTPrompt('What is 2+2?');
    expect(prompt).toContain('What is 2+2?');
    expect(prompt).toContain('Step 1:');
    expect(prompt).toContain('Final Answer:');
  });

  it('buildZeroShotPrompt is minimal', () => {
    const prompt = buildZeroShotPrompt('What is 2+2?');
    expect(prompt).toContain('What is 2+2?');
    expect(prompt).toContain('Answer:');
    expect(prompt.toLowerCase()).not.toContain('step');
  });
});

describe('extractSteps', () => {
  it('extracts numbered steps', () => {
    const response = `
      Step 1: First, we identify the numbers: 2 and 2.
      Step 2: Next, we add them together: 2 + 2 = 4.
      Step 3: Therefore, the result is 4.
      Final Answer: 4
    `;

    const steps = extractSteps(response);
    expect(steps.length).toBe(3);
    expect(steps[0].stepNumber).toBe(1);
    expect(steps[0].content).toContain('identify');
    expect(steps[1].stepNumber).toBe(2);
    expect(steps[2].stepNumber).toBe(3);
  });

  it('extracts simple numbered format', () => {
    const response = `
      1. Calculate the discount: 80 * 0.25 = 20
      2. Subtract from original: 80 - 20 = 60
      Final Answer: $60
    `;

    const steps = extractSteps(response);
    expect(steps.length).toBe(2);
    expect(steps[0].content).toContain('discount');
    expect(steps[1].content).toContain('Subtract');
  });

  it('extracts ordinal format', () => {
    const response = `
      First, we need to understand the problem. The train travels 60 miles in 1.5 hours.
      Second, we calculate speed using the formula: speed = distance / time.
      Finally, we compute: 60 / 1.5 = 40 miles per hour.
    `;

    const steps = extractSteps(response);
    expect(steps.length).toBeGreaterThanOrEqual(2);
    expect(steps.some((s) => s.content.toLowerCase().includes('understand'))).toBe(true);
  });

  it('handles empty response', () => {
    const steps = extractSteps('');
    expect(steps).toEqual([]);
  });
});

describe('extractFinalAnswer', () => {
  it('extracts "Final Answer:" format', () => {
    const response = 'Step 1: Calculate. Step 2: Add. Final Answer: 42';
    expect(extractFinalAnswer(response)).toBe('42');
  });

  it('extracts "Therefore, the answer is" format', () => {
    const response = 'We add 2 + 2. Therefore, the answer is 4.';
    expect(extractFinalAnswer(response)).toBe('4');
  });

  it('extracts "The answer is" format', () => {
    const response = 'After calculation, the answer is 100.';
    expect(extractFinalAnswer(response)).toBe('100');
  });

  it('extracts last number as fallback', () => {
    const response = 'We have 5 apples, give away 2, that leaves 3';
    expect(extractFinalAnswer(response)).toBe('3');
  });

  it('handles text answers', () => {
    const response = 'Based on logic, no we cannot conclude that. Final Answer: no';
    expect(extractFinalAnswer(response).toLowerCase()).toBe('no');
  });
});

describe('normalizeAnswer', () => {
  it('lowercases', () => {
    expect(normalizeAnswer('YES')).toBe('yes');
  });

  it('removes punctuation', () => {
    expect(normalizeAnswer('$60.00!')).toBe('6000');
  });

  it('trims whitespace', () => {
    expect(normalizeAnswer('  answer  ')).toBe('answer');
  });

  it('removes leading articles', () => {
    expect(normalizeAnswer('the answer')).toBe('answer');
    expect(normalizeAnswer('a result')).toBe('result');
  });
});

describe('answersMatch', () => {
  it('matches identical answers', () => {
    expect(answersMatch('42', '42')).toBe(true);
  });

  it('matches with different case', () => {
    expect(answersMatch('Yes', 'YES')).toBe(true);
  });

  it('matches numeric variants', () => {
    expect(answersMatch('5', '5.0')).toBe(true);
    expect(answersMatch('0.05', '.05')).toBe(true);
  });

  it('matches with whitespace differences', () => {
    expect(answersMatch('40 mph', '40  mph')).toBe(true);
  });

  it('matches substrings for short answers', () => {
    expect(answersMatch('no', 'no, we cannot')).toBe(true);
  });

  it('rejects different answers', () => {
    expect(answersMatch('yes', 'no')).toBe(false);
    expect(answersMatch('42', '43')).toBe(false);
  });
});

describe('estimateConfidence', () => {
  it('gives higher confidence with more steps', () => {
    const fewSteps = [{ stepNumber: 1, content: 'One step' }];
    const manySteps = [
      { stepNumber: 1, content: 'Step one' },
      { stepNumber: 2, content: 'Step two' },
      { stepNumber: 3, content: 'Step three' },
      { stepNumber: 4, content: 'Step four' },
      { stepNumber: 5, content: 'Step five' },
    ];

    const confFew = estimateConfidence('response', fewSteps);
    const confMany = estimateConfidence('response', manySteps);

    expect(confMany).toBeGreaterThan(confFew);
  });

  it('gives higher confidence with explicit answer marker', () => {
    const withMarker = estimateConfidence('Final Answer: 42', []);
    const withoutMarker = estimateConfidence('The result is 42', []);

    expect(withMarker).toBeGreaterThan(withoutMarker);
  });

  it('reduces confidence with hedging language', () => {
    const confident = estimateConfidence('The answer is definitely 42', []);
    const hedging = estimateConfidence('I think maybe the answer might be 42', []);

    expect(confident).toBeGreaterThan(hedging);
  });

  it('stays in 0-1 range', () => {
    const conf1 = estimateConfidence('Final Answer: 42', [
      { stepNumber: 1, content: 'a' },
      { stepNumber: 2, content: 'b' },
      { stepNumber: 3, content: 'c' },
      { stepNumber: 4, content: 'd' },
      { stepNumber: 5, content: 'e' },
    ]);
    const conf2 = estimateConfidence('maybe probably not sure', []);

    expect(conf1).toBeLessThanOrEqual(1);
    expect(conf2).toBeGreaterThanOrEqual(0);
  });
});

describe('TEST_PROBLEMS', () => {
  it('has variety of categories', () => {
    const categories = new Set(TEST_PROBLEMS.map((p) => p.category));
    expect(categories.size).toBeGreaterThanOrEqual(3);
    expect(categories.has('math')).toBe(true);
    expect(categories.has('logic')).toBe(true);
  });

  it('each problem has required fields', () => {
    for (const problem of TEST_PROBLEMS) {
      expect(problem.id).toBeTruthy();
      expect(problem.question).toBeTruthy();
      expect(problem.correctAnswer).toBeTruthy();
      expect(problem.category).toBeTruthy();
    }
  });

  it('has at least 5 problems', () => {
    expect(TEST_PROBLEMS.length).toBeGreaterThanOrEqual(5);
  });
});

// =============================================================================
// Integration tests (require llama-server)
// =============================================================================

describe.skip('CoTClient integration (requires llama-server)', () => {
  // Skipped by default - remove .skip to run with llama-server

  it('ask returns structured CoT response', async () => {
    const { CoTClient } = await import('./chain-of-thought');
    const client = new CoTClient();

    const response = await client.ask('What is 15 + 27?', { structured: true });

    expect(response.fullResponse).toBeTruthy();
    expect(response.steps.length).toBeGreaterThan(0);
    expect(response.finalAnswer).toBeTruthy();
    expect(response.confidence).toBeGreaterThan(0);
  });

  it('askWithConsistency returns voted answer', async () => {
    const { CoTClient } = await import('./chain-of-thought');
    const client = new CoTClient();

    const result = await client.askWithConsistency('What is 10 * 5?', 3);

    expect(result.answer).toBeTruthy();
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.responses.length).toBe(3);
  });
});
