'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@examples/shared/components/ui/card';
import { Button } from '@examples/shared/components/ui/button';
import { Badge } from '@examples/shared/components/ui/badge';
import { Textarea } from '@examples/shared/components/ui/textarea';
import { generateId } from '@examples/shared/lib/utils';
import {
  parseReasoningResponse,
  formatReasoningSteps,
  estimateTokens,
  classifyProblemComplexity,
  sampleProblems,
  type SampleProblemKey,
} from '../lib/thinking-utils';

// Icons
function Brain({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
      <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
      <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" />
      <path d="M17.599 6.5a3 3 0 0 0 .399-1.375" />
      <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5" />
      <path d="M3.477 10.896a4 4 0 0 1 .585-.396" />
      <path d="M19.938 10.5a4 4 0 0 1 .585.396" />
      <path d="M6 18a4 4 0 0 1-1.967-.516" />
      <path d="M19.967 17.484A4 4 0 0 1 18 18" />
    </svg>
  );
}

function Zap({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
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

function Eye({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOff({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  );
}

function ChevronDown({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function ChevronUp({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m18 15-6-6-6 6" />
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

function CheckCircle({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function AlertCircle({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" x2="12" y1="8" y2="12" />
      <line x1="12" x2="12.01" y1="16" y2="16" />
    </svg>
  );
}

interface ModelResponse {
  id: string;
  mode: 'regular' | 'thinking';
  content: string;
  thinking: string | null;
  latencyMs: number;
  tokenCount: {
    input: number;
    output: number;
    thinking: number;
  };
  timestamp: Date;
}

interface ComparisonResult {
  id: string;
  prompt: string;
  regular: ModelResponse | null;
  thinking: ModelResponse | null;
  complexity: ReturnType<typeof classifyProblemComplexity>;
}

export default function ThinkingModelsPage() {
  const [prompt, setPrompt] = React.useState('');
  const [thinkingBudget, setThinkingBudget] = React.useState(5000);
  const [showThinking, setShowThinking] = React.useState(true);
  const [isLoadingRegular, setIsLoadingRegular] = React.useState(false);
  const [isLoadingThinking, setIsLoadingThinking] = React.useState(false);
  const [comparisons, setComparisons] = React.useState<ComparisonResult[]>([]);
  const [expandedThinking, setExpandedThinking] = React.useState<Set<string>>(new Set());

  // Simulate model responses (in a real app, these would call different endpoints)
  const simulateRegularModel = async (input: string): Promise<ModelResponse> => {
    const startTime = Date.now();

    // Simulate API latency (regular models are faster)
    await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 400));

    // Simulate a direct response without thinking
    const response = await fetch('http://127.0.0.1:8033/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-oss-20b',
        messages: [{ role: 'user', content: input }],
        max_tokens: 1024,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || 'No response';

    return {
      id: generateId('resp'),
      mode: 'regular',
      content,
      thinking: null,
      latencyMs: Date.now() - startTime,
      tokenCount: {
        input: data.usage?.prompt_tokens || estimateTokens(input),
        output: data.usage?.completion_tokens || estimateTokens(content),
        thinking: 0,
      },
      timestamp: new Date(),
    };
  };

  const simulateThinkingModel = async (input: string, budget: number): Promise<ModelResponse> => {
    const startTime = Date.now();

    // Thinking models take longer
    await new Promise((resolve) => setTimeout(resolve, 500));

    // For open source models, we can request thinking with a special prompt
    const thinkingPrompt = `Think through this step by step, showing your reasoning in <think></think> tags before giving your final answer.

${input}`;

    const response = await fetch('http://127.0.0.1:8033/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-oss-20b',
        messages: [{ role: 'user', content: thinkingPrompt }],
        max_tokens: Math.min(budget + 1024, 8192),
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || 'No response';

    // Parse thinking tokens from the response
    const { thinking, answer } = parseReasoningResponse(rawContent);

    return {
      id: generateId('resp'),
      mode: 'thinking',
      content: answer,
      thinking,
      latencyMs: Date.now() - startTime,
      tokenCount: {
        input: data.usage?.prompt_tokens || estimateTokens(thinkingPrompt),
        output: data.usage?.completion_tokens || estimateTokens(answer),
        thinking: thinking ? estimateTokens(thinking) : 0,
      },
      timestamp: new Date(),
    };
  };

  const runComparison = async () => {
    if (!prompt.trim()) return;

    const complexity = classifyProblemComplexity(prompt);
    const comparisonId = generateId('comp');

    // Add pending comparison
    const newComparison: ComparisonResult = {
      id: comparisonId,
      prompt,
      regular: null,
      thinking: null,
      complexity,
    };
    setComparisons((prev) => [newComparison, ...prev]);

    // Run both models in parallel
    setIsLoadingRegular(true);
    setIsLoadingThinking(true);

    try {
      const [regularResult, thinkingResult] = await Promise.allSettled([
        simulateRegularModel(prompt),
        simulateThinkingModel(prompt, thinkingBudget),
      ]);

      setComparisons((prev) =>
        prev.map((c) =>
          c.id === comparisonId
            ? {
                ...c,
                regular: regularResult.status === 'fulfilled' ? regularResult.value : null,
                thinking: thinkingResult.status === 'fulfilled' ? thinkingResult.value : null,
              }
            : c
        )
      );
    } catch (error) {
      console.error('Comparison failed:', error);
    } finally {
      setIsLoadingRegular(false);
      setIsLoadingThinking(false);
    }
  };

  const loadSampleProblem = (key: SampleProblemKey) => {
    setPrompt(sampleProblems[key].prompt);
  };

  const toggleThinkingExpanded = (id: string) => {
    setExpandedThinking((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <Brain className="w-8 h-8 text-purple-500" />
            Thinking Models Demo
          </h1>
          <p className="text-muted-foreground">
            Compare regular vs thinking models. See how reasoning tokens affect
            output quality and latency.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Input & Controls */}
          <div className="space-y-4">
            {/* Prompt Input */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Problem Input</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Enter a problem to compare regular vs thinking model responses..."
                  className="min-h-[120px] resize-none"
                />

                {/* Sample Problems */}
                <div>
                  <p className="text-xs text-muted-foreground mb-2">
                    Try a sample problem:
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {(Object.keys(sampleProblems) as SampleProblemKey[]).map(
                      (key) => (
                        <Button
                          key={key}
                          variant="outline"
                          size="sm"
                          className="text-xs h-7"
                          onClick={() => loadSampleProblem(key)}
                        >
                          {sampleProblems[key].label}
                        </Button>
                      )
                    )}
                  </div>
                </div>

                {/* Complexity Analysis */}
                {prompt && (
                  <div className="p-3 rounded-lg bg-muted/50 text-sm">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">Complexity:</span>
                      <Badge
                        variant={
                          classifyProblemComplexity(prompt).complexity ===
                          'complex'
                            ? 'default'
                            : classifyProblemComplexity(prompt).complexity ===
                                'moderate'
                              ? 'secondary'
                              : 'outline'
                        }
                      >
                        {classifyProblemComplexity(prompt).complexity}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {classifyProblemComplexity(prompt).reason}
                    </p>
                  </div>
                )}

                <Button
                  onClick={runComparison}
                  disabled={!prompt.trim() || isLoadingRegular || isLoadingThinking}
                  className="w-full"
                >
                  {isLoadingRegular || isLoadingThinking ? (
                    <>
                      <Loader className="w-4 h-4 mr-2 animate-spin" />
                      Running Comparison...
                    </>
                  ) : (
                    'Compare Models'
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Thinking Controls */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Brain className="w-4 h-4" />
                  Thinking Controls
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Thinking Budget */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium">
                      Thinking Budget
                    </label>
                    <span className="text-sm text-muted-foreground">
                      {thinkingBudget.toLocaleString()} tokens
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1000}
                    max={10000}
                    step={500}
                    value={thinkingBudget}
                    onChange={(e) => setThinkingBudget(Number(e.target.value))}
                    className="w-full accent-purple-500"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>1K (fast)</span>
                    <span>10K (thorough)</span>
                  </div>
                </div>

                {/* Show Thinking Toggle */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {showThinking ? (
                      <Eye className="w-4 h-4" />
                    ) : (
                      <EyeOff className="w-4 h-4" />
                    )}
                    <span className="text-sm font-medium">Show Reasoning</span>
                  </div>
                  <button
                    onClick={() => setShowThinking(!showThinking)}
                    className={`relative w-10 h-5 rounded-full transition-colors ${
                      showThinking ? 'bg-purple-500' : 'bg-muted'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                        showThinking ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Info Box */}
                <div className="p-3 rounded-lg bg-purple-50 border border-purple-100 text-sm">
                  <p className="font-medium text-purple-900 mb-1">
                    When to use thinking models:
                  </p>
                  <ul className="text-xs text-purple-700 space-y-1">
                    <li>• Multi-step math or logic problems</li>
                    <li>• Code architecture decisions</li>
                    <li>• Debugging complex issues</li>
                    <li>• Security analysis</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Model Comparison Info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Model Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <Zap className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium">Regular Model</p>
                      <p className="text-xs text-muted-foreground">
                        Fast, direct responses. Best for simple tasks.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                      <Brain className="w-4 h-4 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-medium">Thinking Model</p>
                      <p className="text-xs text-muted-foreground">
                        Uses hidden reasoning tokens. Better for complex tasks.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Results */}
          <div className="lg:col-span-2 space-y-4">
            {comparisons.length === 0 ? (
              <Card className="h-[400px] flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <Brain className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Enter a problem and click &quot;Compare Models&quot;</p>
                  <p className="text-sm mt-1">
                    to see how thinking affects the response
                  </p>
                </div>
              </Card>
            ) : (
              comparisons.map((comparison) => (
                <Card key={comparison.id} className="overflow-hidden">
                  <CardHeader className="pb-3 bg-muted/30">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {comparison.prompt}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {comparison.complexity.complexity}
                          </Badge>
                          {comparison.complexity.useThinking && (
                            <Badge
                              variant="secondary"
                              className="text-xs bg-purple-100 text-purple-700"
                            >
                              Thinking recommended
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x">
                      {/* Regular Model Response */}
                      <div className="p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                            <Zap className="w-3 h-3 text-blue-600" />
                          </div>
                          <span className="font-medium text-sm">Regular</span>
                          {comparison.regular && (
                            <div className="flex items-center gap-1 ml-auto text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              {comparison.regular.latencyMs}ms
                            </div>
                          )}
                        </div>

                        {!comparison.regular && isLoadingRegular ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader className="w-6 h-6 animate-spin text-muted-foreground" />
                          </div>
                        ) : comparison.regular ? (
                          <div className="space-y-3">
                            <div className="prose prose-sm max-w-none">
                              <p className="text-sm whitespace-pre-wrap">
                                {comparison.regular.content}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t">
                              <span>
                                {comparison.regular.tokenCount.input} in /{' '}
                                {comparison.regular.tokenCount.output} out
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-sm text-red-500">
                            <AlertCircle className="w-4 h-4" />
                            Failed to get response
                          </div>
                        )}
                      </div>

                      {/* Thinking Model Response */}
                      <div className="p-4 bg-purple-50/30">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center">
                            <Brain className="w-3 h-3 text-purple-600" />
                          </div>
                          <span className="font-medium text-sm">Thinking</span>
                          {comparison.thinking && (
                            <div className="flex items-center gap-1 ml-auto text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              {comparison.thinking.latencyMs}ms
                            </div>
                          )}
                        </div>

                        {!comparison.thinking && isLoadingThinking ? (
                          <div className="flex flex-col items-center justify-center py-8">
                            <Loader className="w-6 h-6 animate-spin text-purple-500" />
                            <span className="text-xs text-muted-foreground mt-2">
                              Thinking...
                            </span>
                          </div>
                        ) : comparison.thinking ? (
                          <div className="space-y-3">
                            {/* Thinking Section */}
                            {showThinking && comparison.thinking.thinking && (
                              <div className="rounded-lg bg-purple-100/50 border border-purple-200">
                                <button
                                  onClick={() =>
                                    toggleThinkingExpanded(comparison.id)
                                  }
                                  className="w-full flex items-center justify-between p-2 text-sm font-medium text-purple-700 hover:bg-purple-100/50"
                                >
                                  <div className="flex items-center gap-2">
                                    <Brain className="w-4 h-4" />
                                    <span>Reasoning Process</span>
                                    <Badge
                                      variant="secondary"
                                      className="text-xs bg-purple-200 text-purple-700"
                                    >
                                      {comparison.thinking.tokenCount.thinking}{' '}
                                      tokens
                                    </Badge>
                                  </div>
                                  {expandedThinking.has(comparison.id) ? (
                                    <ChevronUp className="w-4 h-4" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4" />
                                  )}
                                </button>
                                {expandedThinking.has(comparison.id) && (
                                  <div className="p-3 pt-0 text-sm text-purple-800 border-t border-purple-200">
                                    <div className="space-y-2">
                                      {formatReasoningSteps(
                                        comparison.thinking.thinking
                                      ).map((step, i) => (
                                        <div
                                          key={i}
                                          className="flex gap-2 text-xs"
                                        >
                                          <span className="text-purple-500 font-mono">
                                            {i + 1}.
                                          </span>
                                          <span>{step}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Answer */}
                            <div className="prose prose-sm max-w-none">
                              <p className="text-sm whitespace-pre-wrap">
                                {comparison.thinking.content}
                              </p>
                            </div>

                            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t">
                              <span>
                                {comparison.thinking.tokenCount.input} in /{' '}
                                {comparison.thinking.tokenCount.output} out
                              </span>
                              {comparison.thinking.tokenCount.thinking > 0 && (
                                <span className="text-purple-600">
                                  +{comparison.thinking.tokenCount.thinking}{' '}
                                  thinking
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-sm text-red-500">
                            <AlertCircle className="w-4 h-4" />
                            Failed to get response
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Comparison Summary */}
                    {comparison.regular && comparison.thinking && (
                      <div className="p-3 bg-muted/30 border-t text-xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>
                                Thinking was{' '}
                                {Math.round(
                                  (comparison.thinking.latencyMs /
                                    comparison.regular.latencyMs -
                                    1) *
                                    100
                                )}
                                % slower
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span>
                                Used{' '}
                                {Math.round(
                                  ((comparison.thinking.tokenCount.thinking +
                                    comparison.thinking.tokenCount.output) /
                                    comparison.regular.tokenCount.output -
                                    1) *
                                    100
                                )}
                                % more tokens
                              </span>
                            </div>
                          </div>
                          {comparison.complexity.useThinking ? (
                            <Badge className="bg-green-100 text-green-700 text-xs">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Thinking recommended
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-xs text-muted-foreground"
                            >
                              Regular may suffice
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
