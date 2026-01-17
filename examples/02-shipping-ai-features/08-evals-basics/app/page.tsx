'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@examples/shared/components/ui/card';
import { Button } from '@examples/shared/components/ui/button';
import { Badge } from '@examples/shared/components/ui/badge';
import {
  sampleEvalSet,
  runEvalSuite,
  compareRuns,
  categoryColors,
  type EvalCase,
  type EvalResult,
  type EvalRun,
  type EvalComparison,
} from '../lib/evals';

// Icons
function ClipboardCheck({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="m9 14 2 2 4-4" />
    </svg>
  );
}

function Play({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

function CheckCircle({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function XCircle({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
    </svg>
  );
}

function Loader({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function TrendingUp({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  );
}

function TrendingDown({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="22 17 13.5 8.5 8.5 13.5 2 7" />
      <polyline points="16 17 22 17 22 11" />
    </svg>
  );
}

function BarChart({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" x2="12" y1="20" y2="10" />
      <line x1="18" x2="18" y1="20" y2="4" />
      <line x1="6" x2="6" y1="20" y2="14" />
    </svg>
  );
}

function GitCompare({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="18" cy="18" r="3" />
      <circle cx="6" cy="6" r="3" />
      <path d="M18 6V18" />
      <path d="M6 18V6" />
    </svg>
  );
}

function Clock({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

export default function EvalsBasicsPage() {
  const [selectedCases, setSelectedCases] = React.useState<Set<string>>(
    new Set(sampleEvalSet.map((c) => c.id))
  );
  const [isRunning, setIsRunning] = React.useState(false);
  const [currentRun, setCurrentRun] = React.useState<EvalRun | null>(null);
  const [baseline, setBaseline] = React.useState<EvalRun | null>(null);
  const [comparison, setComparison] = React.useState<EvalComparison | null>(null);
  const [progress, setProgress] = React.useState({ completed: 0, total: 0 });
  const [expandedResult, setExpandedResult] = React.useState<string | null>(null);

  const toggleCase = (id: string) => {
    setSelectedCases((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectByCategory = (category: EvalCase['category']) => {
    const casesInCategory = sampleEvalSet
      .filter((c) => c.category === category)
      .map((c) => c.id);
    setSelectedCases((prev) => {
      const next = new Set(prev);
      const allSelected = casesInCategory.every((id) => next.has(id));
      if (allSelected) {
        casesInCategory.forEach((id) => next.delete(id));
      } else {
        casesInCategory.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const generateResponse = async (input: string): Promise<string> => {
    if (!input.trim()) {
      return "I'm sorry, but I need some input to work with. Could you please provide some text?";
    }

    const response = await fetch('http://127.0.0.1:8033/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-oss-20b',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant. Be concise and accurate.',
          },
          { role: 'user', content: input },
        ],
        max_tokens: 256,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || 'No response';
  };

  const runEvals = async () => {
    const casesToRun = sampleEvalSet.filter((c) => selectedCases.has(c.id));
    if (casesToRun.length === 0) return;

    setIsRunning(true);
    setProgress({ completed: 0, total: casesToRun.length });
    setComparison(null);

    try {
      const run = await runEvalSuite(casesToRun, generateResponse, (completed, total) => {
        setProgress({ completed, total });
      });

      setCurrentRun(run);

      if (baseline) {
        const comp = compareRuns(baseline, run);
        setComparison(comp);
      }
    } catch (error) {
      console.error('Eval run failed:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const saveAsBaseline = () => {
    if (currentRun) {
      setBaseline(currentRun);
      setComparison(null);
    }
  };

  const getResultForCase = (caseId: string): EvalResult | undefined => {
    return currentRun?.results.find((r) => r.caseId === caseId);
  };

  const getCaseById = (id: string): EvalCase | undefined => {
    return sampleEvalSet.find((c) => c.id === id);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <ClipboardCheck className="w-8 h-8 text-blue-600" />
            Evals Basics
          </h1>
          <p className="text-muted-foreground">
            Build and run eval sets to measure AI behavior before shipping
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Eval Cases */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Eval Cases</CardTitle>
                  <span className="text-xs text-muted-foreground">
                    {selectedCases.size} selected
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Category filters */}
                <div className="flex flex-wrap gap-1">
                  {(['golden', 'edge', 'regression', 'adversarial'] as const).map((cat) => {
                    const count = sampleEvalSet.filter((c) => c.category === cat).length;
                    const selected = sampleEvalSet
                      .filter((c) => c.category === cat)
                      .every((c) => selectedCases.has(c.id));
                    return (
                      <Button
                        key={cat}
                        variant={selected ? 'default' : 'outline'}
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => selectByCategory(cat)}
                      >
                        {cat} ({count})
                      </Button>
                    );
                  })}
                </div>

                {/* Case list */}
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {sampleEvalSet.map((evalCase) => {
                    const result = getResultForCase(evalCase.id);
                    const isSelected = selectedCases.has(evalCase.id);

                    return (
                      <div
                        key={evalCase.id}
                        className={`p-3 rounded-lg border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-blue-300 bg-blue-50/50'
                            : 'border-border hover:border-blue-200'
                        }`}
                        onClick={() => toggleCase(evalCase.id)}
                      >
                        <div className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="mt-1"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm truncate">
                                {evalCase.name}
                              </span>
                              {result && (
                                result.passed ? (
                                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                                )
                              )}
                            </div>
                            <div className="flex items-center gap-1 flex-wrap">
                              <Badge
                                variant="outline"
                                className={`text-xs ${categoryColors[evalCase.category]}`}
                              >
                                {evalCase.category}
                              </Badge>
                              {evalCase.tags.slice(0, 2).map((tag) => (
                                <Badge
                                  key={tag}
                                  variant="secondary"
                                  className="text-xs"
                                >
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <Button
                  onClick={runEvals}
                  disabled={isRunning || selectedCases.size === 0}
                  className="w-full"
                >
                  {isRunning ? (
                    <>
                      <Loader className="w-4 h-4 mr-2 animate-spin" />
                      Running {progress.completed}/{progress.total}...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Run Evals ({selectedCases.size} cases)
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Baseline Management */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <GitCompare className="w-4 h-4" />
                  Baseline Comparison
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {baseline ? (
                  <div className="p-3 rounded-lg bg-muted/50 text-sm">
                    <p className="font-medium">Current Baseline</p>
                    <p className="text-xs text-muted-foreground">
                      {baseline.summary.passed}/{baseline.summary.total} passed (
                      {(baseline.summary.passRate * 100).toFixed(0)}%)
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {baseline.timestamp.toLocaleString()}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No baseline set. Run evals and save as baseline to enable comparison.
                  </p>
                )}

                {currentRun && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={saveAsBaseline}
                    className="w-full"
                  >
                    Save Current Run as Baseline
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Results */}
          <div className="lg:col-span-2 space-y-4">
            {/* Summary Card */}
            {currentRun && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <BarChart className="w-4 h-4" />
                      Results Summary
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {currentRun.timestamp.toLocaleTimeString()}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-4 mb-4">
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <p className="text-2xl font-bold">{currentRun.summary.total}</p>
                      <p className="text-xs text-muted-foreground">Total</p>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <p className="text-2xl font-bold text-green-600">
                        {currentRun.summary.passed}
                      </p>
                      <p className="text-xs text-muted-foreground">Passed</p>
                    </div>
                    <div className="text-center p-3 bg-red-50 rounded-lg">
                      <p className="text-2xl font-bold text-red-600">
                        {currentRun.summary.failed}
                      </p>
                      <p className="text-xs text-muted-foreground">Failed</p>
                    </div>
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <p className="text-2xl font-bold text-blue-600">
                        {(currentRun.summary.passRate * 100).toFixed(0)}%
                      </p>
                      <p className="text-xs text-muted-foreground">Pass Rate</p>
                    </div>
                  </div>

                  {/* Comparison results */}
                  {comparison && (
                    <div className="p-4 rounded-lg border bg-muted/30">
                      <div className="flex items-center gap-2 mb-3">
                        <GitCompare className="w-4 h-4" />
                        <span className="font-medium text-sm">Comparison with Baseline</span>
                        {comparison.delta > 0 ? (
                          <Badge className="bg-green-100 text-green-700">
                            <TrendingUp className="w-3 h-3 mr-1" />
                            +{(comparison.delta * 100).toFixed(0)}%
                          </Badge>
                        ) : comparison.delta < 0 ? (
                          <Badge className="bg-red-100 text-red-700">
                            <TrendingDown className="w-3 h-3 mr-1" />
                            {(comparison.delta * 100).toFixed(0)}%
                          </Badge>
                        ) : (
                          <Badge variant="secondary">No change</Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-sm">
                        <div className="p-2 bg-green-50 rounded">
                          <p className="font-medium text-green-700">
                            {comparison.improved.length} Improved
                          </p>
                          {comparison.improved.length > 0 && (
                            <p className="text-xs text-muted-foreground truncate">
                              {comparison.improved.join(', ')}
                            </p>
                          )}
                        </div>
                        <div className="p-2 bg-red-50 rounded">
                          <p className="font-medium text-red-700">
                            {comparison.regressed.length} Regressed
                          </p>
                          {comparison.regressed.length > 0 && (
                            <p className="text-xs text-muted-foreground truncate">
                              {comparison.regressed.join(', ')}
                            </p>
                          )}
                        </div>
                        <div className="p-2 bg-gray-50 rounded">
                          <p className="font-medium text-gray-700">
                            {comparison.unchanged.length} Unchanged
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Detailed Results */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Detailed Results</CardTitle>
              </CardHeader>
              <CardContent>
                {!currentRun ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <ClipboardCheck className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Select eval cases and click &quot;Run Evals&quot;</p>
                    <p className="text-sm mt-1">to see detailed results</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[500px] overflow-y-auto">
                    {currentRun.results.map((result) => {
                      const evalCase = getCaseById(result.caseId);
                      const isExpanded = expandedResult === result.caseId;

                      return (
                        <div
                          key={result.caseId}
                          className={`border rounded-lg overflow-hidden ${
                            result.passed ? 'border-green-200' : 'border-red-200'
                          }`}
                        >
                          <div
                            className={`p-3 cursor-pointer ${
                              result.passed ? 'bg-green-50/50' : 'bg-red-50/50'
                            }`}
                            onClick={() =>
                              setExpandedResult(isExpanded ? null : result.caseId)
                            }
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {result.passed ? (
                                  <CheckCircle className="w-5 h-5 text-green-500" />
                                ) : (
                                  <XCircle className="w-5 h-5 text-red-500" />
                                )}
                                <span className="font-medium text-sm">
                                  {evalCase?.name || result.caseId}
                                </span>
                                {evalCase && (
                                  <Badge
                                    variant="outline"
                                    className={`text-xs ${categoryColors[evalCase.category]}`}
                                  >
                                    {evalCase.category}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Clock className="w-3 h-3" />
                                {result.metrics.latencyMs}ms
                              </div>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="p-4 border-t bg-white space-y-3">
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1">
                                  Input:
                                </p>
                                <p className="text-sm bg-muted/30 p-2 rounded">
                                  {evalCase?.input || 'N/A'}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1">
                                  Output:
                                </p>
                                <p className="text-sm bg-muted/30 p-2 rounded whitespace-pre-wrap">
                                  {result.output || '(empty)'}
                                </p>
                              </div>
                              <div className="grid grid-cols-3 gap-2 text-xs">
                                <div className="p-2 bg-muted/30 rounded">
                                  <p className="text-muted-foreground">Length</p>
                                  <p className="font-medium">{result.metrics.length} chars</p>
                                </div>
                                <div className="p-2 bg-muted/30 rounded">
                                  <p className="text-muted-foreground">Words</p>
                                  <p className="font-medium">{result.metrics.wordCount}</p>
                                </div>
                                <div className="p-2 bg-muted/30 rounded">
                                  <p className="text-muted-foreground">Keywords</p>
                                  <p className="font-medium">
                                    {(result.metrics.keywordCoverage * 100).toFixed(0)}%
                                  </p>
                                </div>
                              </div>
                              {result.errors.length > 0 && (
                                <div className="p-2 bg-red-50 rounded border border-red-200">
                                  <p className="text-xs font-medium text-red-700 mb-1">
                                    Errors:
                                  </p>
                                  <ul className="text-xs text-red-600 space-y-1">
                                    {result.errors.map((err, i) => (
                                      <li key={i}>• {err}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
