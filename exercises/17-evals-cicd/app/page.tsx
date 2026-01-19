'use client';

import { useState, useCallback } from 'react';

interface EvalCriterion {
  type: 'contains' | 'not_contains' | 'regex' | 'length' | 'json_valid' | 'custom';
  value?: string | number;
  description: string;
  weight?: number;
}

interface EvalTestCase {
  id: string;
  name: string;
  input: string;
  criteria: EvalCriterion[];
  tags?: string[];
}

interface CriterionResult {
  criterion: EvalCriterion;
  passed: boolean;
  score: number;
  details?: string;
}

interface EvalResult {
  testId: string;
  testName: string;
  passed: boolean;
  score: number;
  criteriaResults: CriterionResult[];
  response: string;
  latencyMs: number;
  error?: string;
}

interface EvalSuiteResult {
  suiteName: string;
  timestamp: string;
  totalTests: number;
  passed: number;
  failed: number;
  score: number;
  duration: number;
  results: EvalResult[];
}

const SAMPLE_SUITES: Record<string, EvalTestCase[]> = {
  'basic-qa': [
    {
      id: 'qa-1',
      name: 'Simple factual question',
      input: 'What is the capital of France?',
      criteria: [
        { type: 'contains', value: 'Paris', description: 'Should mention Paris' },
        { type: 'length', value: 10, description: 'Should have meaningful response' },
      ],
      tags: ['factual', 'geography'],
    },
    {
      id: 'qa-2',
      name: 'Math question',
      input: 'What is 15 + 27?',
      criteria: [
        { type: 'contains', value: '42', description: 'Should contain correct answer' },
      ],
      tags: ['math'],
    },
  ],
  'code-generation': [
    {
      id: 'code-1',
      name: 'Simple function',
      input: 'Write a JavaScript function that returns the sum of two numbers.',
      criteria: [
        { type: 'contains', value: 'function', description: 'Should define a function' },
        { type: 'contains', value: 'return', description: 'Should return a value' },
      ],
      tags: ['javascript'],
    },
  ],
  'json-output': [
    {
      id: 'json-1',
      name: 'Generate valid JSON',
      input: 'Generate a JSON object with name and age fields. Only output the JSON.',
      criteria: [
        { type: 'json_valid', description: 'Output should be valid JSON' },
        { type: 'contains', value: 'name', description: 'Should have name field' },
      ],
      tags: ['json'],
    },
  ],
};

function evaluateCriterion(response: string, criterion: EvalCriterion): CriterionResult {
  const weight = criterion.weight ?? 1;

  switch (criterion.type) {
    case 'contains': {
      const searchValue = String(criterion.value).toLowerCase();
      const passed = response.toLowerCase().includes(searchValue);
      return {
        criterion,
        passed,
        score: passed ? weight : 0,
        details: passed ? `Found "${criterion.value}"` : `Missing "${criterion.value}"`,
      };
    }
    case 'not_contains': {
      const searchValue = String(criterion.value).toLowerCase();
      const passed = !response.toLowerCase().includes(searchValue);
      return {
        criterion,
        passed,
        score: passed ? weight : 0,
        details: passed ? `Correctly excludes "${criterion.value}"` : `Incorrectly contains "${criterion.value}"`,
      };
    }
    case 'length': {
      const minLength = Number(criterion.value);
      const passed = response.length >= minLength;
      return {
        criterion,
        passed,
        score: passed ? weight : 0,
        details: `Length: ${response.length} (min: ${minLength})`,
      };
    }
    case 'json_valid': {
      let passed = false;
      let details = '';
      try {
        JSON.parse(response);
        passed = true;
        details = 'Valid JSON';
      } catch {
        details = 'Invalid JSON';
      }
      return { criterion, passed, score: passed ? weight : 0, details };
    }
    case 'regex': {
      const regex = new RegExp(String(criterion.value), 'i');
      const passed = regex.test(response);
      return {
        criterion,
        passed,
        score: passed ? weight : 0,
        details: passed ? 'Matches pattern' : 'Does not match pattern',
      };
    }
    default:
      return { criterion, passed: false, score: 0, details: 'Unknown criterion type' };
  }
}

export default function EvalsCICDPage() {
  const [baseUrl, setBaseUrl] = useState('http://127.0.0.1:8033');
  const [selectedSuite, setSelectedSuite] = useState<string>('basic-qa');
  const [running, setRunning] = useState(false);
  const [suiteResult, setSuiteResult] = useState<EvalSuiteResult | null>(null);
  const [outputFormat, setOutputFormat] = useState<'text' | 'json'>('text');

  const runSuite = useCallback(async () => {
    const tests = SAMPLE_SUITES[selectedSuite];
    if (!tests) return;

    setRunning(true);
    setSuiteResult(null);

    const startTime = Date.now();
    const results: EvalResult[] = [];

    for (const test of tests) {
      const testStart = Date.now();
      try {
        const res = await fetch(`${baseUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: test.input }],
            temperature: 0.1,
            max_tokens: 500,
          }),
        });

        if (!res.ok) throw new Error(`Request failed: ${res.statusText}`);

        const data = await res.json();
        const response = data.choices?.[0]?.message?.content || '';

        const criteriaResults = test.criteria.map((c) => evaluateCriterion(response, c));
        const totalWeight = criteriaResults.reduce((sum, r) => sum + (r.criterion.weight ?? 1), 0);
        const weightedScore = criteriaResults.reduce((sum, r) => sum + r.score, 0);
        const score = totalWeight > 0 ? weightedScore / totalWeight : 0;

        results.push({
          testId: test.id,
          testName: test.name,
          passed: criteriaResults.every((r) => r.passed),
          score,
          criteriaResults,
          response,
          latencyMs: Date.now() - testStart,
        });
      } catch (err) {
        results.push({
          testId: test.id,
          testName: test.name,
          passed: false,
          score: 0,
          criteriaResults: [],
          response: '',
          latencyMs: Date.now() - testStart,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    const passed = results.filter((r) => r.passed).length;
    const score = results.length > 0 ? results.reduce((sum, r) => sum + r.score, 0) / results.length : 0;

    setSuiteResult({
      suiteName: selectedSuite,
      timestamp: new Date().toISOString(),
      totalTests: tests.length,
      passed,
      failed: results.length - passed,
      score,
      duration: Date.now() - startTime,
      results,
    });

    setRunning(false);
  }, [baseUrl, selectedSuite]);

  const getJSONOutput = () => {
    if (!suiteResult) return '';
    return JSON.stringify({
      summary: {
        suite: suiteResult.suiteName,
        timestamp: suiteResult.timestamp,
        passed: suiteResult.passed,
        failed: suiteResult.failed,
        total: suiteResult.totalTests,
        score: (suiteResult.score * 100).toFixed(1) + '%',
        duration: suiteResult.duration + 'ms',
      },
      tests: suiteResult.results.map((r) => ({
        id: r.testId,
        name: r.testName,
        status: r.error ? 'ERROR' : r.passed ? 'PASS' : 'FAIL',
        score: (r.score * 100).toFixed(1) + '%',
        latency: r.latencyMs + 'ms',
        error: r.error,
      })),
      exitCode: suiteResult.failed > 0 ? 1 : 0,
    }, null, 2);
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Exercise 17: Evals in CI/CD</h1>
        <p className="text-gray-400 mb-8">
          Run LLM evaluations as part of your development workflow
        </p>

        {/* Config */}
        <div className="bg-gray-900 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Configuration</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">llama-server URL</label>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Test Suite</label>
              <select
                value={selectedSuite}
                onChange={(e) => setSelectedSuite(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2"
              >
                {Object.keys(SAMPLE_SUITES).map((name) => (
                  <option key={name} value={name}>
                    {name} ({SAMPLE_SUITES[name].length} tests)
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Test Cases Preview */}
        <div className="bg-gray-900 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Test Cases: {selectedSuite}</h2>
          <div className="space-y-4">
            {SAMPLE_SUITES[selectedSuite]?.map((test) => (
              <div key={test.id} className="bg-gray-800 rounded p-4">
                <div className="flex justify-between mb-2">
                  <span className="font-medium">{test.name}</span>
                  <span className="text-sm text-gray-500">{test.id}</span>
                </div>
                <p className="text-sm text-gray-400 mb-2">{test.input}</p>
                <div className="flex gap-2 flex-wrap">
                  {test.criteria.map((c, i) => (
                    <span key={i} className="text-xs bg-gray-700 px-2 py-1 rounded">
                      {c.type}: {c.description}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={runSuite}
            disabled={running}
            className="mt-4 bg-green-600 hover:bg-green-700 disabled:opacity-50 px-6 py-2 rounded-lg"
          >
            {running ? 'Running...' : 'Run Eval Suite'}
          </button>
        </div>

        {/* Results */}
        {suiteResult && (
          <>
            {/* Summary */}
            <div className="bg-gray-900 rounded-lg p-6 mb-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-semibold">Results</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => setOutputFormat('text')}
                    className={`px-3 py-1 rounded text-sm ${
                      outputFormat === 'text' ? 'bg-blue-600' : 'bg-gray-700'
                    }`}
                  >
                    Text
                  </button>
                  <button
                    onClick={() => setOutputFormat('json')}
                    className={`px-3 py-1 rounded text-sm ${
                      outputFormat === 'json' ? 'bg-blue-600' : 'bg-gray-700'
                    }`}
                  >
                    JSON
                  </button>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-gray-800 rounded p-4 text-center">
                  <div className="text-2xl font-bold">{suiteResult.totalTests}</div>
                  <div className="text-sm text-gray-400">Total</div>
                </div>
                <div className="bg-gray-800 rounded p-4 text-center">
                  <div className="text-2xl font-bold text-green-400">{suiteResult.passed}</div>
                  <div className="text-sm text-gray-400">Passed</div>
                </div>
                <div className="bg-gray-800 rounded p-4 text-center">
                  <div className="text-2xl font-bold text-red-400">{suiteResult.failed}</div>
                  <div className="text-sm text-gray-400">Failed</div>
                </div>
                <div className="bg-gray-800 rounded p-4 text-center">
                  <div className={`text-2xl font-bold ${suiteResult.score >= 0.8 ? 'text-green-400' : suiteResult.score >= 0.5 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {(suiteResult.score * 100).toFixed(0)}%
                  </div>
                  <div className="text-sm text-gray-400">Score</div>
                </div>
              </div>

              {outputFormat === 'json' ? (
                <pre className="bg-gray-800 p-4 rounded text-sm overflow-x-auto font-mono">
                  {getJSONOutput()}
                </pre>
              ) : (
                <div className="space-y-4">
                  {suiteResult.results.map((result) => (
                    <div
                      key={result.testId}
                      className={`border rounded p-4 ${
                        result.error
                          ? 'border-yellow-700 bg-yellow-900/20'
                          : result.passed
                          ? 'border-green-700 bg-green-900/20'
                          : 'border-red-700 bg-red-900/20'
                      }`}
                    >
                      <div className="flex justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-sm ${
                            result.error
                              ? 'bg-yellow-800 text-yellow-200'
                              : result.passed
                              ? 'bg-green-800 text-green-200'
                              : 'bg-red-800 text-red-200'
                          }`}>
                            {result.error ? 'ERROR' : result.passed ? 'PASS' : 'FAIL'}
                          </span>
                          <span className="font-medium">{result.testName}</span>
                        </div>
                        <div className="text-sm text-gray-400">
                          {(result.score * 100).toFixed(0)}% | {result.latencyMs}ms
                        </div>
                      </div>

                      {result.error ? (
                        <p className="text-yellow-300 text-sm">{result.error}</p>
                      ) : (
                        <>
                          <div className="text-sm mb-2">
                            {result.criteriaResults.map((cr, i) => (
                              <div key={i} className="flex items-center gap-2">
                                <span className={cr.passed ? 'text-green-400' : 'text-red-400'}>
                                  {cr.passed ? '✓' : '✗'}
                                </span>
                                <span className="text-gray-400">{cr.criterion.description}:</span>
                                <span>{cr.details}</span>
                              </div>
                            ))}
                          </div>
                          <details className="text-sm">
                            <summary className="text-gray-400 cursor-pointer">Response</summary>
                            <pre className="mt-2 bg-gray-800 p-2 rounded text-xs overflow-x-auto">
                              {result.response}
                            </pre>
                          </details>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Exit Code */}
            <div className={`rounded-lg p-4 text-center ${
              suiteResult.failed > 0 ? 'bg-red-900/30 border border-red-700' : 'bg-green-900/30 border border-green-700'
            }`}>
              <span className="font-mono">
                Exit Code: {suiteResult.failed > 0 ? 1 : 0}
              </span>
              <span className="text-gray-400 ml-4">
                {suiteResult.failed > 0 ? 'CI would FAIL' : 'CI would PASS'}
              </span>
            </div>
          </>
        )}

        {/* CLI Example */}
        <div className="mt-8 bg-gray-900 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">CLI Usage</h2>
          <pre className="bg-gray-800 p-4 rounded text-sm overflow-x-auto">
{`# Run evals from command line
bun run eval --suite basic-qa --format json

# In CI/CD pipeline (GitHub Actions example)
- name: Run LLM Evals
  run: |
    bun run eval --suite basic-qa --format json > eval-results.json
    EXIT_CODE=$(jq '.exitCode' eval-results.json)
    if [ "$EXIT_CODE" != "0" ]; then
      echo "Evals failed!"
      exit 1
    fi

# With baseline comparison
bun run eval --suite basic-qa --baseline 0.85 --threshold 0.05`}
          </pre>
        </div>
      </div>
    </div>
  );
}
