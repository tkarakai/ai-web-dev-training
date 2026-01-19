/**
 * Tests for Evaluation Framework
 *
 * Run: bun test lib/evaluation.test.ts
 */

import { describe, it, expect } from 'bun:test';
import {
  exactMatch,
  containsKeywords,
  excludesKeywords,
  matchesPattern,
  lengthCheck,
  isValidJSON,
  compositeEvaluator,
  testCase,
  TestCaseBuilder,
  MATH_TEST_SUITE,
  FACTUAL_TEST_SUITE,
  generateReport,
  generateJSONReport,
  type TestCase,
  type EvalSummary,
} from './evaluation';

describe('exactMatch evaluator', () => {
  const tc: TestCase = {
    id: 'test',
    name: 'test',
    input: 'test',
    expected: 'hello world',
  };

  it('passes on exact match', () => {
    const result = exactMatch('hello world', tc);
    expect(result.passed).toBe(true);
    expect(result.score).toBe(1);
  });

  it('handles case insensitivity', () => {
    const result = exactMatch('Hello World', tc);
    expect(result.passed).toBe(true);
  });

  it('handles whitespace', () => {
    const result = exactMatch('  hello world  ', tc);
    expect(result.passed).toBe(true);
  });

  it('fails on mismatch', () => {
    const result = exactMatch('goodbye world', tc);
    expect(result.passed).toBe(false);
    expect(result.score).toBe(0);
  });

  it('fails without expected value', () => {
    const noExpected: TestCase = { id: 'test', name: 'test', input: 'test' };
    const result = exactMatch('anything', noExpected);
    expect(result.passed).toBe(false);
  });
});

describe('containsKeywords evaluator', () => {
  it('passes when all keywords found', () => {
    const tc: TestCase = {
      id: 'test',
      name: 'test',
      input: 'test',
      mustInclude: ['hello', 'world'],
    };
    const result = containsKeywords('Hello there, World!', tc);
    expect(result.passed).toBe(true);
    expect(result.score).toBe(1);
  });

  it('fails when keyword missing', () => {
    const tc: TestCase = {
      id: 'test',
      name: 'test',
      input: 'test',
      mustInclude: ['hello', 'world', 'foo'],
    };
    const result = containsKeywords('Hello World', tc);
    expect(result.passed).toBe(false);
    expect(result.score).toBeCloseTo(2 / 3, 2);
    expect(result.details?.missing).toContain('foo');
  });

  it('handles empty keywords', () => {
    const tc: TestCase = { id: 'test', name: 'test', input: 'test', mustInclude: [] };
    const result = containsKeywords('anything', tc);
    expect(result.passed).toBe(true);
  });
});

describe('excludesKeywords evaluator', () => {
  it('passes when no excluded keywords found', () => {
    const tc: TestCase = {
      id: 'test',
      name: 'test',
      input: 'test',
      mustExclude: ['bad', 'wrong'],
    };
    const result = excludesKeywords('This is good and correct', tc);
    expect(result.passed).toBe(true);
  });

  it('fails when excluded keyword found', () => {
    const tc: TestCase = {
      id: 'test',
      name: 'test',
      input: 'test',
      mustExclude: ['error', 'fail'],
    };
    const result = excludesKeywords('This has an error', tc);
    expect(result.passed).toBe(false);
    expect(result.details?.foundExcluded).toContain('error');
  });
});

describe('matchesPattern evaluator', () => {
  it('passes when pattern matches', () => {
    const tc: TestCase = {
      id: 'test',
      name: 'test',
      input: 'test',
      pattern: /\d{3}-\d{4}/,
    };
    const result = matchesPattern('Call 555-1234 for info', tc);
    expect(result.passed).toBe(true);
  });

  it('fails when pattern does not match', () => {
    const tc: TestCase = {
      id: 'test',
      name: 'test',
      input: 'test',
      pattern: /\d{3}-\d{4}/,
    };
    const result = matchesPattern('No phone number here', tc);
    expect(result.passed).toBe(false);
  });
});

describe('lengthCheck evaluator', () => {
  it('passes within range', () => {
    const result = lengthCheck('hello', 3, 10);
    expect(result.passed).toBe(true);
  });

  it('fails below minimum', () => {
    const result = lengthCheck('hi', 5, 100);
    expect(result.passed).toBe(false);
  });

  it('fails above maximum', () => {
    const result = lengthCheck('hello world', 1, 5);
    expect(result.passed).toBe(false);
  });
});

describe('isValidJSON evaluator', () => {
  it('passes for valid JSON object', () => {
    const result = isValidJSON('{"name": "John", "age": 30}');
    expect(result.passed).toBe(true);
  });

  it('passes for valid JSON array', () => {
    const result = isValidJSON('[1, 2, 3]');
    expect(result.passed).toBe(true);
  });

  it('fails for invalid JSON', () => {
    const result = isValidJSON('not json at all');
    expect(result.passed).toBe(false);
    expect(result.reason).toContain('Invalid JSON');
  });

  it('fails for malformed JSON', () => {
    const result = isValidJSON('{name: "John"}');
    expect(result.passed).toBe(false);
  });
});

describe('compositeEvaluator', () => {
  it('combines multiple evaluators', () => {
    const tc: TestCase = {
      id: 'test',
      name: 'test',
      input: 'test',
      mustInclude: ['hello'],
      mustExclude: ['goodbye'],
    };

    const result = compositeEvaluator('Hello there!', tc);
    expect(result.passed).toBe(true);
  });

  it('fails if any evaluator fails', () => {
    const tc: TestCase = {
      id: 'test',
      name: 'test',
      input: 'test',
      mustInclude: ['hello'],
      mustExclude: ['world'],
    };

    const result = compositeEvaluator('Hello world!', tc);
    expect(result.passed).toBe(false);
  });

  it('handles custom evaluator', () => {
    const tc: TestCase = {
      id: 'test',
      name: 'test',
      input: 'test',
      evaluator: (output) => ({
        passed: output.length > 5,
        score: output.length > 5 ? 1 : 0,
        reason: output.length > 5 ? 'Long enough' : 'Too short',
      }),
    };

    expect(compositeEvaluator('Hi', tc).passed).toBe(false);
    expect(compositeEvaluator('Hello there!', tc).passed).toBe(true);
  });
});

describe('TestCaseBuilder', () => {
  it('builds test case with fluent API', () => {
    const tc = testCase()
      .id('test-1')
      .name('My Test')
      .input('What is 2+2?')
      .mustInclude('4')
      .category('math')
      .build();

    expect(tc.id).toBe('test-1');
    expect(tc.name).toBe('My Test');
    expect(tc.input).toBe('What is 2+2?');
    expect(tc.mustInclude).toContain('4');
    expect(tc.category).toBe('math');
  });

  it('generates id if not provided', () => {
    const tc = testCase().name('Test').input('Input').build();
    expect(tc.id).toBeTruthy();
  });

  it('throws without input', () => {
    expect(() => testCase().id('test').name('Test').build()).toThrow('must have input');
  });
});

describe('Sample Test Suites', () => {
  it('MATH_TEST_SUITE has valid test cases', () => {
    expect(MATH_TEST_SUITE.length).toBeGreaterThan(0);
    for (const tc of MATH_TEST_SUITE) {
      expect(tc.id).toBeTruthy();
      expect(tc.input).toBeTruthy();
      expect(tc.category).toBe('math');
    }
  });

  it('FACTUAL_TEST_SUITE has valid test cases', () => {
    expect(FACTUAL_TEST_SUITE.length).toBeGreaterThan(0);
    for (const tc of FACTUAL_TEST_SUITE) {
      expect(tc.id).toBeTruthy();
      expect(tc.input).toBeTruthy();
    }
  });
});

describe('Report Generation', () => {
  const mockSummary: EvalSummary = {
    totalTests: 10,
    passed: 8,
    failed: 2,
    passRate: 0.8,
    avgScore: 0.85,
    avgLatencyMs: 500,
    byCategory: new Map([
      ['math', { passed: 5, total: 5 }],
      ['format', { passed: 3, total: 5 }],
    ]),
    results: [
      {
        testCase: { id: 'test-1', name: 'Test 1', input: 'input' },
        output: 'output',
        score: { passed: true, score: 1, reason: 'Good' },
        latencyMs: 100,
        timestamp: new Date(),
      },
      {
        testCase: { id: 'test-2', name: 'Test 2', input: 'input' },
        output: 'wrong output',
        score: { passed: false, score: 0, reason: 'Missing keyword' },
        latencyMs: 200,
        timestamp: new Date(),
      },
    ],
  };

  it('generateReport creates readable output', () => {
    const report = generateReport(mockSummary);
    expect(report).toContain('EVALUATION REPORT');
    expect(report).toContain('Total Tests:  10');
    expect(report).toContain('Passed:       8');
    expect(report).toContain('80');
    expect(report).toContain('math');
    expect(report).toContain('FAILED TESTS');
  });

  it('generateJSONReport creates valid JSON structure', () => {
    const jsonReport = generateJSONReport(mockSummary);
    expect(jsonReport).toHaveProperty('timestamp');
    expect(jsonReport).toHaveProperty('summary');
    expect(jsonReport).toHaveProperty('results');

    const summary = (jsonReport as any).summary;
    expect(summary.totalTests).toBe(10);
    expect(summary.passed).toBe(8);
    expect(summary.passRate).toBe(0.8);
  });
});

// =============================================================================
// Integration tests (require llama-server)
// =============================================================================

describe.skip('EvalRunner integration (requires llama-server)', () => {
  it('runs a single test case', async () => {
    const { EvalRunner } = await import('./evaluation');
    const runner = new EvalRunner();

    const tc = testCase()
      .id('int-1')
      .name('Simple math')
      .input('What is 5 + 3?')
      .mustInclude('8')
      .build();

    const result = await runner.runTest(tc);
    expect(result.output).toBeTruthy();
    expect(result.latencyMs).toBeGreaterThan(0);
  });

  it('runs a test suite', async () => {
    const { EvalRunner, MATH_TEST_SUITE } = await import('./evaluation');
    const runner = new EvalRunner();

    const summary = await runner.runAll(MATH_TEST_SUITE.slice(0, 2));
    expect(summary.totalTests).toBe(2);
    expect(summary.results.length).toBe(2);
  });
});
