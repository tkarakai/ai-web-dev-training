/**
 * Tests for Evals in CI/CD
 */

import { describe, it, expect } from 'bun:test';
import {
  evaluateCriterion,
  EvalRunner,
  BaselineStore,
  formatCLIOutput,
  formatTextOutput,
  formatJSONOutput,
  SAMPLE_SUITES,
  type EvalTestCase,
  type EvalCriterion,
  type EvalSuiteResult,
} from './evals-cicd';

describe('evaluateCriterion', () => {
  describe('contains', () => {
    it('should pass when value is present', () => {
      const criterion: EvalCriterion = {
        type: 'contains',
        value: 'hello',
        description: 'Should contain hello',
      };

      const result = evaluateCriterion('Hello world', criterion);

      expect(result.passed).toBe(true);
      expect(result.score).toBe(1);
    });

    it('should fail when value is absent', () => {
      const criterion: EvalCriterion = {
        type: 'contains',
        value: 'goodbye',
        description: 'Should contain goodbye',
      };

      const result = evaluateCriterion('Hello world', criterion);

      expect(result.passed).toBe(false);
      expect(result.score).toBe(0);
    });

    it('should be case insensitive', () => {
      const criterion: EvalCriterion = {
        type: 'contains',
        value: 'HELLO',
        description: 'Should contain hello',
      };

      const result = evaluateCriterion('hello world', criterion);

      expect(result.passed).toBe(true);
    });
  });

  describe('not_contains', () => {
    it('should pass when value is absent', () => {
      const criterion: EvalCriterion = {
        type: 'not_contains',
        value: 'error',
        description: 'Should not contain error',
      };

      const result = evaluateCriterion('All good here', criterion);

      expect(result.passed).toBe(true);
    });

    it('should fail when value is present', () => {
      const criterion: EvalCriterion = {
        type: 'not_contains',
        value: 'error',
        description: 'Should not contain error',
      };

      const result = evaluateCriterion('There was an error', criterion);

      expect(result.passed).toBe(false);
    });
  });

  describe('regex', () => {
    it('should match regex pattern', () => {
      const criterion: EvalCriterion = {
        type: 'regex',
        value: /\d{3}-\d{4}/,
        description: 'Should match phone pattern',
      };

      const result = evaluateCriterion('Call 555-1234', criterion);

      expect(result.passed).toBe(true);
    });

    it('should handle string regex', () => {
      const criterion: EvalCriterion = {
        type: 'regex',
        value: 'hello.*world',
        description: 'Should match pattern',
      };

      const result = evaluateCriterion('hello beautiful world', criterion);

      expect(result.passed).toBe(true);
    });

    it('should fail when pattern not matched', () => {
      const criterion: EvalCriterion = {
        type: 'regex',
        value: /^\d+$/,
        description: 'Should be all digits',
      };

      const result = evaluateCriterion('abc123', criterion);

      expect(result.passed).toBe(false);
    });
  });

  describe('length', () => {
    it('should pass when length meets minimum', () => {
      const criterion: EvalCriterion = {
        type: 'length',
        value: 10,
        description: 'Should be at least 10 chars',
      };

      const result = evaluateCriterion('This is a test response', criterion);

      expect(result.passed).toBe(true);
    });

    it('should fail when length is below minimum', () => {
      const criterion: EvalCriterion = {
        type: 'length',
        value: 100,
        description: 'Should be at least 100 chars',
      };

      const result = evaluateCriterion('Short', criterion);

      expect(result.passed).toBe(false);
    });
  });

  describe('json_valid', () => {
    it('should pass for valid JSON', () => {
      const criterion: EvalCriterion = {
        type: 'json_valid',
        description: 'Should be valid JSON',
      };

      const result = evaluateCriterion('{"name": "test", "value": 123}', criterion);

      expect(result.passed).toBe(true);
    });

    it('should fail for invalid JSON', () => {
      const criterion: EvalCriterion = {
        type: 'json_valid',
        description: 'Should be valid JSON',
      };

      const result = evaluateCriterion('{invalid json}', criterion);

      expect(result.passed).toBe(false);
    });

    it('should pass for JSON arrays', () => {
      const criterion: EvalCriterion = {
        type: 'json_valid',
        description: 'Should be valid JSON',
      };

      const result = evaluateCriterion('[1, 2, 3]', criterion);

      expect(result.passed).toBe(true);
    });
  });

  describe('weight', () => {
    it('should apply weight to score', () => {
      const criterion: EvalCriterion = {
        type: 'contains',
        value: 'test',
        description: 'Should contain test',
        weight: 0.5,
      };

      const result = evaluateCriterion('This is a test', criterion);

      expect(result.passed).toBe(true);
      expect(result.score).toBe(0.5);
    });

    it('should use weight 1 by default', () => {
      const criterion: EvalCriterion = {
        type: 'contains',
        value: 'test',
        description: 'Should contain test',
      };

      const result = evaluateCriterion('This is a test', criterion);

      expect(result.score).toBe(1);
    });
  });
});

describe('EvalRunner', () => {
  it('should run a test case', async () => {
    // Mock test that doesn't require LLM
    const runner = new EvalRunner({ baseUrl: 'http://invalid' });

    // This will fail due to network error, which is expected behavior
    const test: EvalTestCase = {
      id: 'test-1',
      name: 'Test case',
      input: 'Hello',
      criteria: [{ type: 'contains', value: 'world', description: 'Test' }],
    };

    const result = await runner.runTest(test);

    expect(result.testId).toBe('test-1');
    expect(result.testName).toBe('Test case');
    // Will fail due to network error
    expect(result.passed).toBe(false);
    expect(result.error).toBeDefined();
  });
});

describe('BaselineStore', () => {
  it('should store and retrieve baselines', () => {
    const store = new BaselineStore();
    const result: EvalSuiteResult = {
      suiteName: 'test-suite',
      timestamp: new Date().toISOString(),
      totalTests: 5,
      passed: 4,
      failed: 1,
      score: 0.85,
      duration: 1000,
      results: [],
    };

    store.set('test-suite', result);

    expect(store.get('test-suite')).toBeDefined();
    expect(store.getScore('test-suite')).toBe(0.85);
  });

  it('should return undefined for unknown suites', () => {
    const store = new BaselineStore();

    expect(store.get('unknown')).toBeUndefined();
    expect(store.getScore('unknown')).toBeUndefined();
  });

  it('should serialize to/from JSON', () => {
    const store = new BaselineStore();
    store.set('suite-1', {
      suiteName: 'suite-1',
      timestamp: '2024-01-01',
      totalTests: 10,
      passed: 8,
      failed: 2,
      score: 0.9,
      duration: 5000,
      results: [],
    });

    const json = store.toJSON();
    expect(json['suite-1']).toBeDefined();
    expect(json['suite-1'].score).toBe(0.9);

    const newStore = new BaselineStore();
    newStore.fromJSON(json);
    expect(newStore.getScore('suite-1')).toBe(0.9);
  });
});

describe('formatCLIOutput', () => {
  it('should format suite result for CLI', () => {
    const result: EvalSuiteResult = {
      suiteName: 'test-suite',
      timestamp: '2024-01-01T00:00:00Z',
      totalTests: 3,
      passed: 2,
      failed: 1,
      score: 0.75,
      duration: 500,
      results: [
        {
          testId: 't1',
          testName: 'Test 1',
          passed: true,
          score: 1,
          criteriaResults: [],
          response: 'ok',
          latencyMs: 100,
        },
        {
          testId: 't2',
          testName: 'Test 2',
          passed: true,
          score: 0.8,
          criteriaResults: [],
          response: 'ok',
          latencyMs: 150,
        },
        {
          testId: 't3',
          testName: 'Test 3',
          passed: false,
          score: 0.45,
          criteriaResults: [],
          response: 'fail',
          latencyMs: 200,
        },
      ],
    };

    const output = formatCLIOutput(result);

    expect(output.summary.suite).toBe('test-suite');
    expect(output.summary.passed).toBe(2);
    expect(output.summary.failed).toBe(1);
    expect(output.summary.score).toBe('75.0%');
    expect(output.tests.length).toBe(3);
    expect(output.tests[0].status).toBe('PASS');
    expect(output.tests[2].status).toBe('FAIL');
    expect(output.exitCode).toBe(1); // Has failures
  });

  it('should return exit code 0 for all pass', () => {
    const result: EvalSuiteResult = {
      suiteName: 'test-suite',
      timestamp: '2024-01-01T00:00:00Z',
      totalTests: 2,
      passed: 2,
      failed: 0,
      score: 1,
      duration: 500,
      results: [
        { testId: 't1', testName: 'Test 1', passed: true, score: 1, criteriaResults: [], response: '', latencyMs: 100 },
        { testId: 't2', testName: 'Test 2', passed: true, score: 1, criteriaResults: [], response: '', latencyMs: 100 },
      ],
    };

    const output = formatCLIOutput(result);

    expect(output.exitCode).toBe(0);
  });

  it('should detect regression', () => {
    const result: EvalSuiteResult = {
      suiteName: 'test-suite',
      timestamp: '2024-01-01T00:00:00Z',
      totalTests: 2,
      passed: 2,
      failed: 0,
      score: 0.8,
      duration: 500,
      results: [],
      baseline: {
        baselineScore: 0.9,
        currentScore: 0.8,
        regression: true,
        regressionThreshold: 0.05,
        delta: -0.1,
      },
    };

    const output = formatCLIOutput(result);

    expect(output.summary.regression).toBe(true);
    expect(output.exitCode).toBe(1); // Regression = failure
  });
});

describe('formatTextOutput', () => {
  it('should format as readable text', () => {
    const result: EvalSuiteResult = {
      suiteName: 'my-suite',
      timestamp: '2024-01-01',
      totalTests: 2,
      passed: 1,
      failed: 1,
      score: 0.75,
      duration: 1000,
      results: [
        { testId: 't1', testName: 'Pass Test', passed: true, score: 1, criteriaResults: [], response: '', latencyMs: 100 },
        { testId: 't2', testName: 'Fail Test', passed: false, score: 0.5, criteriaResults: [], response: '', latencyMs: 200 },
      ],
    };

    const text = formatTextOutput(result);

    expect(text).toContain('my-suite');
    expect(text).toContain('PASS');
    expect(text).toContain('FAIL');
    expect(text).toContain('75.0%');
    expect(text).toContain('1000ms');
  });

  it('should include baseline comparison', () => {
    const result: EvalSuiteResult = {
      suiteName: 'test',
      timestamp: '2024-01-01',
      totalTests: 1,
      passed: 1,
      failed: 0,
      score: 0.85,
      duration: 100,
      results: [],
      baseline: {
        baselineScore: 0.9,
        currentScore: 0.85,
        regression: false,
        regressionThreshold: 0.1,
        delta: -0.05,
      },
    };

    const text = formatTextOutput(result);

    expect(text).toContain('90.0%');
    expect(text).toContain('85.0%');
    expect(text).toContain('No regression');
  });
});

describe('formatJSONOutput', () => {
  it('should format as valid JSON', () => {
    const result: EvalSuiteResult = {
      suiteName: 'json-test',
      timestamp: '2024-01-01',
      totalTests: 1,
      passed: 1,
      failed: 0,
      score: 1,
      duration: 100,
      results: [],
    };

    const json = formatJSONOutput(result);

    expect(() => JSON.parse(json)).not.toThrow();

    const parsed = JSON.parse(json);
    expect(parsed.summary.suite).toBe('json-test');
  });
});

describe('SAMPLE_SUITES', () => {
  it('should have sample test suites', () => {
    expect(Object.keys(SAMPLE_SUITES).length).toBeGreaterThan(0);
  });

  it('should have basic-qa suite', () => {
    expect(SAMPLE_SUITES['basic-qa']).toBeDefined();
    expect(SAMPLE_SUITES['basic-qa'].length).toBeGreaterThan(0);
  });

  it('should have code-generation suite', () => {
    expect(SAMPLE_SUITES['code-generation']).toBeDefined();
  });

  it('should have safety suite', () => {
    expect(SAMPLE_SUITES['safety']).toBeDefined();
  });

  it('should have valid test case structure', () => {
    for (const [suiteName, tests] of Object.entries(SAMPLE_SUITES)) {
      for (const test of tests) {
        expect(test.id).toBeDefined();
        expect(test.name).toBeDefined();
        expect(test.input).toBeDefined();
        expect(Array.isArray(test.criteria)).toBe(true);
        expect(test.criteria.length).toBeGreaterThan(0);
      }
    }
  });
});
