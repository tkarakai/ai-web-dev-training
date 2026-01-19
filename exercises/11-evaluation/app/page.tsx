'use client';

import { useState, useCallback } from 'react';

/**
 * Evaluation Framework Demo
 *
 * Run evaluations and see results.
 *
 * REQUIRES: llama-server running on port 8033
 */

interface EvalScore {
  passed: boolean;
  score: number;
  reason: string;
}

interface TestResult {
  testCase: { id: string; name: string; input: string; category?: string };
  output: string;
  score: EvalScore;
  latencyMs: number;
}

interface EvalSummary {
  totalTests: number;
  passed: number;
  failed: number;
  passRate: number;
  avgScore: number;
  avgLatencyMs: number;
  results: TestResult[];
}

type TestSuite = 'math' | 'factual' | 'format';

export default function EvaluationPage() {
  const [selectedSuite, setSelectedSuite] = useState<TestSuite>('math');
  const [summary, setSummary] = useState<EvalSummary | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [currentTest, setCurrentTest] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runEval = useCallback(async () => {
    setIsRunning(true);
    setError(null);
    setSummary(null);
    setCurrentTest(null);

    try {
      const {
        EvalRunner,
        MATH_TEST_SUITE,
        FACTUAL_TEST_SUITE,
        FORMAT_TEST_SUITE,
      } = await import('@/lib/evaluation');

      const suites: Record<TestSuite, typeof MATH_TEST_SUITE> = {
        math: MATH_TEST_SUITE,
        factual: FACTUAL_TEST_SUITE,
        format: FORMAT_TEST_SUITE,
      };

      const runner = new EvalRunner('http://127.0.0.1:8033', {
        onTestComplete: (result) => {
          setCurrentTest(result.testCase.name);
        },
      });

      const result = await runner.runAll(suites[selectedSuite]);
      setSummary(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Evaluation failed');
    }

    setIsRunning(false);
    setCurrentTest(null);
  }, [selectedSuite]);

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-8">
      <header>
        <h1 className="text-3xl font-bold">Exercise 11: Evaluation Framework</h1>
        <p className="text-gray-400 mt-2">
          Study <code className="text-blue-400">lib/evaluation.ts</code> - test LLM outputs
          systematically.
        </p>
      </header>

      {/* Controls */}
      <section className="bg-gray-800 p-6 rounded-lg space-y-4">
        <h2 className="text-xl font-semibold">Run Evaluation</h2>

        <div className="flex gap-4 items-center">
          <label className="text-sm text-gray-400">Test Suite:</label>
          <div className="flex gap-2">
            {(['math', 'factual', 'format'] as TestSuite[]).map((suite) => (
              <button
                key={suite}
                onClick={() => setSelectedSuite(suite)}
                disabled={isRunning}
                className={`px-4 py-2 rounded capitalize ${
                  selectedSuite === suite
                    ? 'bg-blue-600'
                    : 'bg-gray-700 hover:bg-gray-600'
                } disabled:opacity-50`}
              >
                {suite}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={runEval}
          disabled={isRunning}
          className="px-6 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 rounded-lg"
        >
          {isRunning ? `Running: ${currentTest || 'starting...'}` : 'Run Evaluation'}
        </button>

        {error && (
          <p className="text-red-400 text-sm">
            Error: {error}. Is llama-server running on port 8033?
          </p>
        )}
      </section>

      {/* Summary */}
      {summary && (
        <>
          <section className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatCard
              label="Total"
              value={summary.totalTests}
              color="blue"
            />
            <StatCard
              label="Passed"
              value={summary.passed}
              color="green"
            />
            <StatCard
              label="Failed"
              value={summary.failed}
              color="red"
            />
            <StatCard
              label="Pass Rate"
              value={`${(summary.passRate * 100).toFixed(0)}%`}
              color={summary.passRate >= 0.8 ? 'green' : summary.passRate >= 0.5 ? 'yellow' : 'red'}
            />
            <StatCard
              label="Avg Latency"
              value={`${summary.avgLatencyMs.toFixed(0)}ms`}
              color="gray"
            />
          </section>

          {/* Results */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Test Results</h2>
            <div className="space-y-3">
              {summary.results.map((result) => (
                <ResultCard key={result.testCase.id} result={result} />
              ))}
            </div>
          </section>
        </>
      )}

      {/* Evaluator Reference */}
      <section className="bg-gray-800 rounded-lg p-6 space-y-4">
        <h2 className="text-xl font-semibold">Built-in Evaluators</h2>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <EvaluatorInfo
            name="exactMatch"
            description="Output must match expected exactly"
            example='expect("hello")'
          />
          <EvaluatorInfo
            name="containsKeywords"
            description="Output must include all keywords"
            example='mustInclude("paris", "france")'
          />
          <EvaluatorInfo
            name="excludesKeywords"
            description="Output must NOT contain keywords"
            example='mustExclude("error", "fail")'
          />
          <EvaluatorInfo
            name="matchesPattern"
            description="Output must match regex pattern"
            example="matchPattern(/\\d+/)"
          />
          <EvaluatorInfo
            name="isValidJSON"
            description="Output must be parseable JSON"
            example="customEvaluator(isValidJSON)"
          />
          <EvaluatorInfo
            name="compositeEvaluator"
            description="Combines all applicable checks"
            example="(automatic)"
          />
        </div>
      </section>

      {/* Code Reference */}
      <section className="bg-gray-800 rounded-lg p-4 text-sm">
        <h3 className="font-semibold mb-2">Study the Code</h3>
        <ul className="space-y-1 text-gray-400">
          <li>
            <code className="text-blue-400">lib/evaluation.ts</code> - Evaluators, runner, test
            builders
          </li>
          <li>
            <code className="text-blue-400">lib/evaluation.test.ts</code> - Unit tests for
            evaluators
          </li>
        </ul>
      </section>
    </main>
  );
}

// =============================================================================
// Components
// =============================================================================

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color: 'blue' | 'green' | 'red' | 'yellow' | 'gray';
}) {
  const colors = {
    blue: 'border-blue-700 bg-blue-900/20',
    green: 'border-green-700 bg-green-900/20',
    red: 'border-red-700 bg-red-900/20',
    yellow: 'border-yellow-700 bg-yellow-900/20',
    gray: 'border-gray-700 bg-gray-800/50',
  };

  return (
    <div className={`p-4 rounded-lg border ${colors[color]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm text-gray-400">{label}</p>
    </div>
  );
}

function ResultCard({ result }: { result: TestResult }) {
  const [expanded, setExpanded] = useState(!result.score.passed);

  return (
    <div
      className={`rounded-lg border ${
        result.score.passed
          ? 'border-green-700 bg-green-900/10'
          : 'border-red-700 bg-red-900/10'
      }`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex justify-between items-center text-left"
      >
        <div className="flex items-center gap-3">
          <span className={result.score.passed ? 'text-green-400' : 'text-red-400'}>
            {result.score.passed ? '✓' : '✗'}
          </span>
          <div>
            <p className="font-medium">{result.testCase.name}</p>
            <p className="text-xs text-gray-500">{result.testCase.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-400">
          <span>{(result.score.score * 100).toFixed(0)}%</span>
          <span>{result.latencyMs}ms</span>
          <span>{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-700/50 pt-3">
          <div>
            <p className="text-xs text-gray-500 mb-1">Input:</p>
            <p className="text-sm bg-gray-900 p-2 rounded">{result.testCase.input}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Output:</p>
            <p className="text-sm bg-gray-900 p-2 rounded whitespace-pre-wrap">
              {result.output.slice(0, 500)}
              {result.output.length > 500 && '...'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Evaluation:</p>
            <p
              className={`text-sm ${
                result.score.passed ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {result.score.reason}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function EvaluatorInfo({
  name,
  description,
  example,
}: {
  name: string;
  description: string;
  example: string;
}) {
  return (
    <div className="bg-gray-900/50 p-3 rounded">
      <p className="font-mono text-blue-400">{name}</p>
      <p className="text-gray-400 text-sm mt-1">{description}</p>
      <code className="text-xs text-gray-500">{example}</code>
    </div>
  );
}
