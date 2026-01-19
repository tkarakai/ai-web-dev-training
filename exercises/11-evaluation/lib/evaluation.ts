/**
 * Evaluation Framework
 *
 * Build and run evaluations to test LLM outputs systematically.
 *
 * KEY CONCEPTS:
 * 1. Test cases - Define inputs and expected outputs
 * 2. Evaluators - Functions that score outputs
 * 3. Eval runner - Execute tests and collect results
 * 4. Reporting - Aggregate and analyze results
 */

import { LlamaClient, type Message } from '../../shared/lib/llama-client';

// =============================================================================
// TYPES
// =============================================================================

export interface TestCase {
  id: string;
  name: string;
  input: string;
  /** Expected output (for exact match) */
  expected?: string;
  /** Keywords that should appear in output */
  mustInclude?: string[];
  /** Keywords that should NOT appear */
  mustExclude?: string[];
  /** Regex pattern output must match */
  pattern?: RegExp;
  /** Custom evaluator function */
  evaluator?: (output: string, testCase: TestCase) => EvalScore;
  /** Category/tag for grouping */
  category?: string;
  /** Additional context for the LLM */
  systemPrompt?: string;
}

export interface EvalScore {
  passed: boolean;
  score: number; // 0-1
  reason: string;
  details?: Record<string, unknown>;
}

export interface TestResult {
  testCase: TestCase;
  output: string;
  score: EvalScore;
  latencyMs: number;
  timestamp: Date;
}

export interface EvalSummary {
  totalTests: number;
  passed: number;
  failed: number;
  passRate: number;
  avgScore: number;
  avgLatencyMs: number;
  byCategory: Map<string, { passed: number; total: number }>;
  results: TestResult[];
}

// =============================================================================
// BUILT-IN EVALUATORS
// =============================================================================

/**
 * Exact match evaluator
 */
export function exactMatch(output: string, testCase: TestCase): EvalScore {
  if (!testCase.expected) {
    return { passed: false, score: 0, reason: 'No expected value provided' };
  }

  const normalizedOutput = output.toLowerCase().trim();
  const normalizedExpected = testCase.expected.toLowerCase().trim();
  const passed = normalizedOutput === normalizedExpected;

  return {
    passed,
    score: passed ? 1 : 0,
    reason: passed ? 'Exact match' : `Expected "${testCase.expected}", got "${output.slice(0, 100)}"`,
  };
}

/**
 * Contains keywords evaluator
 */
export function containsKeywords(output: string, testCase: TestCase): EvalScore {
  if (!testCase.mustInclude || testCase.mustInclude.length === 0) {
    return { passed: true, score: 1, reason: 'No keywords to check' };
  }

  const outputLower = output.toLowerCase();
  const found: string[] = [];
  const missing: string[] = [];

  for (const keyword of testCase.mustInclude) {
    if (outputLower.includes(keyword.toLowerCase())) {
      found.push(keyword);
    } else {
      missing.push(keyword);
    }
  }

  const score = found.length / testCase.mustInclude.length;
  const passed = missing.length === 0;

  return {
    passed,
    score,
    reason: passed
      ? `All ${found.length} keywords found`
      : `Missing keywords: ${missing.join(', ')}`,
    details: { found, missing },
  };
}

/**
 * Excludes keywords evaluator
 */
export function excludesKeywords(output: string, testCase: TestCase): EvalScore {
  if (!testCase.mustExclude || testCase.mustExclude.length === 0) {
    return { passed: true, score: 1, reason: 'No exclusions to check' };
  }

  const outputLower = output.toLowerCase();
  const foundExcluded: string[] = [];

  for (const keyword of testCase.mustExclude) {
    if (outputLower.includes(keyword.toLowerCase())) {
      foundExcluded.push(keyword);
    }
  }

  const passed = foundExcluded.length === 0;
  const score = passed ? 1 : 1 - foundExcluded.length / testCase.mustExclude.length;

  return {
    passed,
    score,
    reason: passed
      ? 'No excluded keywords found'
      : `Found excluded keywords: ${foundExcluded.join(', ')}`,
    details: { foundExcluded },
  };
}

/**
 * Pattern match evaluator
 */
export function matchesPattern(output: string, testCase: TestCase): EvalScore {
  if (!testCase.pattern) {
    return { passed: true, score: 1, reason: 'No pattern to check' };
  }

  const passed = testCase.pattern.test(output);

  return {
    passed,
    score: passed ? 1 : 0,
    reason: passed ? 'Pattern matched' : `Pattern ${testCase.pattern} not found in output`,
  };
}

/**
 * Length evaluator (output should be within range)
 */
export function lengthCheck(
  output: string,
  minLength: number = 0,
  maxLength: number = Infinity
): EvalScore {
  const length = output.length;
  const passed = length >= minLength && length <= maxLength;

  return {
    passed,
    score: passed ? 1 : 0,
    reason: passed
      ? `Length ${length} within range [${minLength}, ${maxLength}]`
      : `Length ${length} outside range [${minLength}, ${maxLength}]`,
    details: { length, minLength, maxLength },
  };
}

/**
 * JSON validity evaluator
 */
export function isValidJSON(output: string): EvalScore {
  try {
    JSON.parse(output);
    return { passed: true, score: 1, reason: 'Valid JSON' };
  } catch (e) {
    return {
      passed: false,
      score: 0,
      reason: `Invalid JSON: ${e instanceof Error ? e.message : 'Parse error'}`,
    };
  }
}

/**
 * Semantic similarity (using LLM as judge)
 *
 * Ask an LLM to rate how similar the output is to expected.
 */
export async function semanticSimilarity(
  client: LlamaClient,
  output: string,
  expected: string
): Promise<EvalScore> {
  const prompt = `Rate how semantically similar these two texts are on a scale of 0-10.

Text A: "${output}"

Text B: "${expected}"

Respond with ONLY a number from 0-10, where:
- 0 = completely different meaning
- 5 = somewhat similar
- 10 = identical meaning

Score:`;

  const response = await client.chat([{ role: 'user', content: prompt }], {
    temperature: 0,
    maxTokens: 10,
  });

  const scoreMatch = response.match(/\b(\d+(?:\.\d+)?)\b/);
  const rawScore = scoreMatch ? parseFloat(scoreMatch[1]) : 0;
  const normalizedScore = Math.min(rawScore / 10, 1);
  const passed = normalizedScore >= 0.7;

  return {
    passed,
    score: normalizedScore,
    reason: `Semantic similarity: ${(normalizedScore * 100).toFixed(0)}%`,
    details: { rawScore },
  };
}

// =============================================================================
// COMPOSITE EVALUATOR
// =============================================================================

/**
 * Combine multiple evaluators
 *
 * Runs all applicable evaluators and aggregates scores.
 */
export function compositeEvaluator(output: string, testCase: TestCase): EvalScore {
  const scores: EvalScore[] = [];

  // Run each applicable evaluator
  if (testCase.expected) {
    scores.push(exactMatch(output, testCase));
  }
  if (testCase.mustInclude?.length) {
    scores.push(containsKeywords(output, testCase));
  }
  if (testCase.mustExclude?.length) {
    scores.push(excludesKeywords(output, testCase));
  }
  if (testCase.pattern) {
    scores.push(matchesPattern(output, testCase));
  }
  if (testCase.evaluator) {
    scores.push(testCase.evaluator(output, testCase));
  }

  // If no evaluators, assume pass
  if (scores.length === 0) {
    return { passed: true, score: 1, reason: 'No criteria to evaluate' };
  }

  // Aggregate: all must pass, average score
  const allPassed = scores.every((s) => s.passed);
  const avgScore = scores.reduce((sum, s) => sum + s.score, 0) / scores.length;
  const reasons = scores.filter((s) => !s.passed).map((s) => s.reason);

  return {
    passed: allPassed,
    score: avgScore,
    reason: allPassed ? 'All checks passed' : reasons.join('; '),
    details: { scores },
  };
}

// =============================================================================
// EVAL RUNNER
// =============================================================================

export interface EvalRunnerConfig {
  /** System prompt to use for all tests */
  systemPrompt?: string;
  /** Temperature for LLM calls */
  temperature?: number;
  /** Max tokens for LLM responses */
  maxTokens?: number;
  /** Callback after each test */
  onTestComplete?: (result: TestResult) => void;
}

/**
 * Run evaluations against an LLM
 */
export class EvalRunner {
  private client: LlamaClient;
  private config: EvalRunnerConfig;

  constructor(baseUrl: string = 'http://127.0.0.1:8033', config: EvalRunnerConfig = {}) {
    this.client = new LlamaClient(baseUrl);
    this.config = config;
  }

  /**
   * Run a single test case
   */
  async runTest(testCase: TestCase): Promise<TestResult> {
    const start = Date.now();

    const messages: Message[] = [];

    // Add system prompt if provided
    const systemPrompt = testCase.systemPrompt || this.config.systemPrompt;
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    messages.push({ role: 'user', content: testCase.input });

    const output = await this.client.chat(messages, {
      temperature: this.config.temperature ?? 0,
      maxTokens: this.config.maxTokens ?? 500,
    });

    const score = compositeEvaluator(output, testCase);
    const latencyMs = Date.now() - start;

    const result: TestResult = {
      testCase,
      output,
      score,
      latencyMs,
      timestamp: new Date(),
    };

    this.config.onTestComplete?.(result);

    return result;
  }

  /**
   * Run all test cases
   */
  async runAll(testCases: TestCase[]): Promise<EvalSummary> {
    const results: TestResult[] = [];

    for (const testCase of testCases) {
      const result = await this.runTest(testCase);
      results.push(result);
    }

    return this.summarize(results);
  }

  /**
   * Run tests in parallel (with concurrency limit)
   */
  async runParallel(testCases: TestCase[], concurrency: number = 3): Promise<EvalSummary> {
    const results: TestResult[] = [];
    const queue = [...testCases];

    async function worker(runner: EvalRunner) {
      while (queue.length > 0) {
        const testCase = queue.shift();
        if (testCase) {
          const result = await runner.runTest(testCase);
          results.push(result);
        }
      }
    }

    await Promise.all(Array(concurrency).fill(0).map(() => worker(this)));

    return this.summarize(results);
  }

  /**
   * Summarize results
   */
  private summarize(results: TestResult[]): EvalSummary {
    const passed = results.filter((r) => r.score.passed).length;
    const failed = results.length - passed;
    const avgScore = results.reduce((sum, r) => sum + r.score.score, 0) / results.length;
    const avgLatencyMs = results.reduce((sum, r) => sum + r.latencyMs, 0) / results.length;

    // Group by category
    const byCategory = new Map<string, { passed: number; total: number }>();
    for (const result of results) {
      const category = result.testCase.category || 'uncategorized';
      const stats = byCategory.get(category) || { passed: 0, total: 0 };
      stats.total++;
      if (result.score.passed) stats.passed++;
      byCategory.set(category, stats);
    }

    return {
      totalTests: results.length,
      passed,
      failed,
      passRate: passed / results.length,
      avgScore,
      avgLatencyMs,
      byCategory,
      results,
    };
  }
}

// =============================================================================
// TEST CASE BUILDERS
// =============================================================================

/**
 * Create a test case with fluent API
 */
export class TestCaseBuilder {
  private testCase: Partial<TestCase> = {};

  id(id: string): this {
    this.testCase.id = id;
    return this;
  }

  name(name: string): this {
    this.testCase.name = name;
    return this;
  }

  input(input: string): this {
    this.testCase.input = input;
    return this;
  }

  expect(expected: string): this {
    this.testCase.expected = expected;
    return this;
  }

  mustInclude(...keywords: string[]): this {
    this.testCase.mustInclude = keywords;
    return this;
  }

  mustExclude(...keywords: string[]): this {
    this.testCase.mustExclude = keywords;
    return this;
  }

  matchPattern(pattern: RegExp): this {
    this.testCase.pattern = pattern;
    return this;
  }

  category(category: string): this {
    this.testCase.category = category;
    return this;
  }

  withSystem(systemPrompt: string): this {
    this.testCase.systemPrompt = systemPrompt;
    return this;
  }

  customEvaluator(fn: (output: string, testCase: TestCase) => EvalScore): this {
    this.testCase.evaluator = fn;
    return this;
  }

  build(): TestCase {
    if (!this.testCase.id) {
      this.testCase.id = `test-${Date.now()}`;
    }
    if (!this.testCase.name) {
      this.testCase.name = this.testCase.id;
    }
    if (!this.testCase.input) {
      throw new Error('Test case must have input');
    }
    return this.testCase as TestCase;
  }
}

export function testCase(): TestCaseBuilder {
  return new TestCaseBuilder();
}

// =============================================================================
// SAMPLE TEST SUITES
// =============================================================================

/**
 * Sample test suite for math questions
 */
export const MATH_TEST_SUITE: TestCase[] = [
  testCase()
    .id('math-1')
    .name('Basic addition')
    .input('What is 2 + 2?')
    .mustInclude('4')
    .category('math')
    .build(),

  testCase()
    .id('math-2')
    .name('Multiplication')
    .input('What is 7 x 8?')
    .mustInclude('56')
    .category('math')
    .build(),

  testCase()
    .id('math-3')
    .name('Word problem')
    .input('If you have 10 apples and give away 3, how many do you have?')
    .mustInclude('7')
    .category('math')
    .build(),
];

/**
 * Sample test suite for factual questions
 */
export const FACTUAL_TEST_SUITE: TestCase[] = [
  testCase()
    .id('fact-1')
    .name('Capital city')
    .input('What is the capital of France?')
    .mustInclude('paris')
    .category('geography')
    .build(),

  testCase()
    .id('fact-2')
    .name('Science fact')
    .input('What is the chemical symbol for water?')
    .mustInclude('h2o')
    .category('science')
    .build(),

  testCase()
    .id('fact-3')
    .name('Historical event')
    .input('In what year did World War II end?')
    .mustInclude('1945')
    .category('history')
    .build(),
];

/**
 * Sample test suite for formatting
 */
export const FORMAT_TEST_SUITE: TestCase[] = [
  testCase()
    .id('format-1')
    .name('JSON output')
    .input('Return a JSON object with fields "name" and "age" for a person named John who is 30.')
    .withSystem('Always respond with valid JSON only.')
    .customEvaluator((output) => {
      const jsonCheck = isValidJSON(output);
      if (!jsonCheck.passed) return jsonCheck;

      try {
        const obj = JSON.parse(output);
        const hasName = 'name' in obj;
        const hasAge = 'age' in obj;
        return {
          passed: hasName && hasAge,
          score: hasName && hasAge ? 1 : 0.5,
          reason: hasName && hasAge ? 'Valid JSON with required fields' : 'Missing required fields',
        };
      } catch {
        return jsonCheck;
      }
    })
    .category('format')
    .build(),

  testCase()
    .id('format-2')
    .name('Numbered list')
    .input('List 3 primary colors as a numbered list.')
    .matchPattern(/1\.\s*\w+[\s\S]*2\.\s*\w+[\s\S]*3\.\s*\w+/i)
    .category('format')
    .build(),
];

// =============================================================================
// REPORTING
// =============================================================================

/**
 * Generate a text report of eval results
 */
export function generateReport(summary: EvalSummary): string {
  const lines: string[] = [];

  lines.push('╔══════════════════════════════════════════════════════════════╗');
  lines.push('║                     EVALUATION REPORT                        ║');
  lines.push('╚══════════════════════════════════════════════════════════════╝');
  lines.push('');

  // Summary
  lines.push(`📊 SUMMARY`);
  lines.push(`   Total Tests:  ${summary.totalTests}`);
  lines.push(`   Passed:       ${summary.passed} (${(summary.passRate * 100).toFixed(1)}%)`);
  lines.push(`   Failed:       ${summary.failed}`);
  lines.push(`   Avg Score:    ${(summary.avgScore * 100).toFixed(1)}%`);
  lines.push(`   Avg Latency:  ${summary.avgLatencyMs.toFixed(0)}ms`);
  lines.push('');

  // By category
  if (summary.byCategory.size > 0) {
    lines.push('📁 BY CATEGORY');
    for (const [category, stats] of summary.byCategory) {
      const rate = ((stats.passed / stats.total) * 100).toFixed(0);
      lines.push(`   ${category}: ${stats.passed}/${stats.total} (${rate}%)`);
    }
    lines.push('');
  }

  // Failed tests
  const failed = summary.results.filter((r) => !r.score.passed);
  if (failed.length > 0) {
    lines.push('❌ FAILED TESTS');
    for (const result of failed) {
      lines.push(`   [${result.testCase.id}] ${result.testCase.name}`);
      lines.push(`      Reason: ${result.score.reason}`);
      lines.push(`      Output: "${result.output.slice(0, 100)}..."`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Generate JSON report (for CI/CD)
 */
export function generateJSONReport(summary: EvalSummary): object {
  return {
    timestamp: new Date().toISOString(),
    summary: {
      totalTests: summary.totalTests,
      passed: summary.passed,
      failed: summary.failed,
      passRate: summary.passRate,
      avgScore: summary.avgScore,
      avgLatencyMs: summary.avgLatencyMs,
    },
    byCategory: Object.fromEntries(summary.byCategory),
    results: summary.results.map((r) => ({
      id: r.testCase.id,
      name: r.testCase.name,
      passed: r.score.passed,
      score: r.score.score,
      reason: r.score.reason,
      latencyMs: r.latencyMs,
    })),
  };
}
