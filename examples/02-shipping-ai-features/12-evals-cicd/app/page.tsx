'use client';

import { useState, useCallback } from 'react';
import { Card } from '@examples/shared/components/ui/card';
import { Button } from '@examples/shared/components/ui/button';
import { Badge } from '@examples/shared/components/ui/badge';
import { generateId } from '@examples/shared/lib/utils';
import {
  GoldenConversation,
  EvalResult,
  Rubric,
  GradingResult,
  ABTest,
  CanaryDeployment,
  CIPipeline,
  goldenConversations,
  helpfulnessRubric,
  llmJudgePitfalls,
  runPatternEval,
  calculateRubricScore,
  simulateABMetrics,
  simulateCanaryMetrics,
  createCIPipeline,
  simulatePipelineStage,
  generateSampleResponse,
  stageStatusColors,
} from '../lib/evals-cicd';

type Tab = 'golden' | 'rubrics' | 'ab_testing' | 'canary' | 'ci_pipeline';

export default function EvalsCICDPage() {
  const [activeTab, setActiveTab] = useState<Tab>('golden');
  const [evalResults, setEvalResults] = useState<Map<string, EvalResult>>(new Map());
  const [isRunningEvals, setIsRunningEvals] = useState(false);
  const [gradingState, setGradingState] = useState<Map<string, GradingResult[]>>(new Map());
  const [abTest, setABTest] = useState<ABTest | null>(null);
  const [canary, setCanary] = useState<CanaryDeployment | null>(null);
  const [pipeline, setPipeline] = useState<CIPipeline | null>(null);
  const [isRunningPipeline, setIsRunningPipeline] = useState(false);

  // Run golden evals
  const runGoldenEvals = useCallback(async () => {
    setIsRunningEvals(true);
    setEvalResults(new Map());

    for (const golden of goldenConversations) {
      await new Promise(resolve => setTimeout(resolve, 500));

      const response = generateSampleResponse(golden);
      const assistantTurn = golden.turns.find(t => t.role === 'assistant');

      if (assistantTurn) {
        const { passed, matchedExpected, matchedForbidden } = runPatternEval(
          response,
          assistantTurn.expectedPatterns,
          assistantTurn.forbiddenPatterns
        );

        setEvalResults(prev => {
          const next = new Map(prev);
          next.set(golden.id, {
            caseId: golden.id,
            passed,
            response,
            matchedExpected,
            matchedForbidden,
          });
          return next;
        });
      }
    }

    setIsRunningEvals(false);
  }, []);

  // Update grading
  const updateGrade = useCallback((responseId: string, criterionName: string, score: number) => {
    setGradingState(prev => {
      const next = new Map(prev);
      const grades = next.get(responseId) || [];
      const existingIndex = grades.findIndex(g => g.criterionName === criterionName);

      if (existingIndex >= 0) {
        grades[existingIndex] = { ...grades[existingIndex], score };
      } else {
        grades.push({ criterionName, score, maxScore: 4 });
      }

      next.set(responseId, [...grades]);
      return next;
    });
  }, []);

  // Start A/B test
  const startABTest = useCallback(() => {
    const test: ABTest = {
      id: generateId('ab'),
      name: 'New System Prompt v2',
      status: 'running',
      control: {
        id: 'control',
        name: 'Current Prompt',
        config: { promptVersion: 'v1.0' },
        metrics: simulateABMetrics('control', 0),
      },
      treatment: {
        id: 'treatment',
        name: 'New Prompt',
        config: { promptVersion: 'v2.0' },
        metrics: simulateABMetrics('treatment', 0),
      },
      trafficSplit: 20,
      startDate: new Date(),
    };
    setABTest(test);

    // Simulate traffic over time
    let requestCount = 0;
    const interval = setInterval(() => {
      requestCount += Math.floor(Math.random() * 50) + 20;
      setABTest(prev => {
        if (!prev) return null;
        return {
          ...prev,
          control: {
            ...prev.control,
            metrics: simulateABMetrics('control', Math.floor(requestCount * 0.8)),
          },
          treatment: {
            ...prev.treatment,
            metrics: simulateABMetrics('treatment', Math.floor(requestCount * 0.2)),
          },
        };
      });
    }, 1000);

    setTimeout(() => {
      clearInterval(interval);
      setABTest(prev => {
        if (!prev) return null;
        return {
          ...prev,
          status: 'completed',
          endDate: new Date(),
          winner: prev.treatment.metrics.avgSatisfaction > prev.control.metrics.avgSatisfaction
            ? 'treatment'
            : 'control',
        };
      });
    }, 8000);
  }, []);

  // Start canary deployment
  const startCanary = useCallback(() => {
    const deployment: CanaryDeployment = {
      id: generateId('canary'),
      name: 'Prompt Update v2.1',
      currentVersion: 'v2.0',
      newVersion: 'v2.1',
      stages: [
        {
          name: 'Initial',
          trafficPercent: 5,
          duration: '5m',
          requiredMetrics: [
            { metric: 'errorRate', threshold: 0.05, operator: '<' },
            { metric: 'successRate', threshold: 0.9, operator: '>' },
          ],
          status: 'pending',
        },
        {
          name: 'Expand',
          trafficPercent: 25,
          duration: '15m',
          requiredMetrics: [
            { metric: 'errorRate', threshold: 0.03, operator: '<' },
            { metric: 'successRate', threshold: 0.92, operator: '>' },
          ],
          status: 'pending',
        },
        {
          name: 'Full',
          trafficPercent: 100,
          duration: '30m',
          requiredMetrics: [
            { metric: 'errorRate', threshold: 0.02, operator: '<' },
            { metric: 'successRate', threshold: 0.95, operator: '>' },
          ],
          status: 'pending',
        },
      ],
      currentStage: 0,
      status: 'running',
      metrics: simulateCanaryMetrics(),
    };
    setCanary(deployment);

    // Simulate stages
    let stageIndex = 0;
    const runStage = () => {
      if (stageIndex >= deployment.stages.length) {
        setCanary(prev => prev ? { ...prev, status: 'passed' } : null);
        return;
      }

      setCanary(prev => {
        if (!prev) return null;
        const stages = [...prev.stages];
        stages[stageIndex] = { ...stages[stageIndex], status: 'running' };
        return { ...prev, stages, currentStage: stageIndex, metrics: simulateCanaryMetrics() };
      });

      setTimeout(() => {
        const passed = Math.random() > 0.15;
        setCanary(prev => {
          if (!prev) return null;
          const stages = [...prev.stages];
          stages[stageIndex] = { ...stages[stageIndex], status: passed ? 'passed' : 'failed' };

          if (!passed) {
            return { ...prev, stages, status: 'rolled_back' };
          }

          return { ...prev, stages, metrics: simulateCanaryMetrics() };
        });

        if (Math.random() > 0.15) {
          stageIndex++;
          setTimeout(runStage, 1500);
        }
      }, 2000);
    };

    runStage();
  }, []);

  // Run CI pipeline
  const runPipeline = useCallback(async () => {
    setIsRunningPipeline(true);
    const newPipeline = createCIPipeline();
    newPipeline.status = 'running';
    newPipeline.startTime = Date.now();
    setPipeline(newPipeline);

    for (let i = 0; i < newPipeline.stages.length; i++) {
      const stage = newPipeline.stages[i];
      const result = await simulatePipelineStage(stage, (updated) => {
        setPipeline(prev => {
          if (!prev) return null;
          const stages = [...prev.stages];
          stages[i] = updated;
          return { ...prev, stages };
        });
      });

      if (result.status === 'failed') {
        setPipeline(prev => prev ? { ...prev, status: 'failed', endTime: Date.now() } : null);
        setIsRunningPipeline(false);
        return;
      }
    }

    setPipeline(prev => {
      if (!prev) return null;
      return {
        ...prev,
        status: 'passed',
        endTime: Date.now(),
        evalResults: {
          golden: { passed: 4, total: 4 },
          edge: { passed: 18, total: 20 },
          regression: { passed: 50, total: 50 },
        },
      };
    });
    setIsRunningPipeline(false);
  }, []);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'golden', label: 'Golden Evals' },
    { id: 'rubrics', label: 'Rubrics & Grading' },
    { id: 'ab_testing', label: 'A/B Testing' },
    { id: 'canary', label: 'Canary Deploy' },
    { id: 'ci_pipeline', label: 'CI Pipeline' },
  ];

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Evals & CI/CD</h1>
          <p className="text-muted-foreground mt-2">
            Automated testing pipelines: offline evals, A/B testing, canary deployments, and CI gating
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {activeTab === 'golden' && (
            <GoldenEvalsTab
              conversations={goldenConversations}
              results={evalResults}
              isRunning={isRunningEvals}
              onRun={runGoldenEvals}
            />
          )}

          {activeTab === 'rubrics' && (
            <RubricsTab
              rubric={helpfulnessRubric}
              grades={gradingState}
              onGrade={updateGrade}
            />
          )}

          {activeTab === 'ab_testing' && (
            <ABTestingTab
              test={abTest}
              onStart={startABTest}
            />
          )}

          {activeTab === 'canary' && (
            <CanaryTab
              deployment={canary}
              onStart={startCanary}
            />
          )}

          {activeTab === 'ci_pipeline' && (
            <CIPipelineTab
              pipeline={pipeline}
              isRunning={isRunningPipeline}
              onRun={runPipeline}
            />
          )}
        </div>
      </div>
    </main>
  );
}

function GoldenEvalsTab({
  conversations,
  results,
  isRunning,
  onRun,
}: {
  conversations: GoldenConversation[];
  results: Map<string, EvalResult>;
  isRunning: boolean;
  onRun: () => void;
}) {
  const passedCount = Array.from(results.values()).filter(r => r.passed).length;
  const totalCount = results.size;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Golden Conversations</h2>
          <p className="text-sm text-muted-foreground">
            Curated examples that must always work correctly
          </p>
        </div>
        <div className="flex items-center gap-4">
          {totalCount > 0 && (
            <Badge variant={passedCount === totalCount ? 'success' : 'destructive'}>
              {passedCount}/{totalCount} Passed
            </Badge>
          )}
          <Button onClick={onRun} disabled={isRunning}>
            {isRunning ? 'Running...' : 'Run Golden Evals'}
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        {conversations.map(golden => {
          const result = results.get(golden.id);
          const assistantTurn = golden.turns.find(t => t.role === 'assistant');
          const userTurn = golden.turns.find(t => t.role === 'user');

          return (
            <Card key={golden.id} className="p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{golden.name}</h3>
                    {golden.critical && (
                      <Badge variant="destructive" className="text-xs">Critical</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{golden.description}</p>
                </div>
                {result && (
                  <Badge variant={result.passed ? 'success' : 'destructive'}>
                    {result.passed ? 'PASS' : 'FAIL'}
                  </Badge>
                )}
              </div>

              <div className="space-y-2">
                <div className="bg-muted/50 p-3 rounded">
                  <span className="text-xs text-muted-foreground">User:</span>
                  <p className="text-sm">{userTurn?.content}</p>
                </div>

                {result && (
                  <div className="bg-blue-50 p-3 rounded">
                    <span className="text-xs text-muted-foreground">Response:</span>
                    <p className="text-sm">{result.response}</p>
                  </div>
                )}

                <div className="flex gap-4 text-xs">
                  <div>
                    <span className="text-muted-foreground">Expected patterns: </span>
                    {assistantTurn?.expectedPatterns?.map((p, i) => (
                      <Badge
                        key={i}
                        variant={result?.matchedExpected.includes(p.source) ? 'success' : 'outline'}
                        className="text-xs mr-1"
                      >
                        {p.source.slice(0, 20)}...
                      </Badge>
                    ))}
                  </div>
                </div>

                {result && result.matchedForbidden.length > 0 && (
                  <div className="text-xs text-red-600">
                    Matched forbidden: {result.matchedForbidden.join(', ')}
                  </div>
                )}
              </div>

              <div className="flex gap-1 mt-3">
                {golden.tags.map(tag => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function RubricsTab({
  rubric,
  grades,
  onGrade,
}: {
  rubric: Rubric;
  grades: Map<string, GradingResult[]>;
  onGrade: (responseId: string, criterion: string, score: number) => void;
}) {
  const sampleResponses = [
    {
      id: 'resp-1',
      question: 'How do I cancel my subscription?',
      response: 'To cancel your subscription, go to Account Settings > Billing > Cancel Subscription. You\'ll keep access until the end of your billing period. Would you like me to walk you through it?',
    },
    {
      id: 'resp-2',
      question: 'What payment methods do you accept?',
      response: 'We accept credit cards.',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Rubric-Based Grading</h2>
        <p className="text-sm text-muted-foreground">
          Evaluate responses using structured criteria
        </p>
      </div>

      {/* Rubric Definition */}
      <Card className="p-4">
        <h3 className="font-semibold mb-4">Rubric: {rubric.name}</h3>
        <div className="space-y-4">
          {rubric.criteria.map(criterion => (
            <div key={criterion.name} className="border rounded p-3">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h4 className="font-medium">{criterion.name}</h4>
                  <p className="text-sm text-muted-foreground">{criterion.description}</p>
                </div>
                <Badge variant="outline">Weight: {criterion.weight}x</Badge>
              </div>
              <div className="grid grid-cols-4 gap-2 mt-3">
                {criterion.levels.map(level => (
                  <div key={level.score} className="text-xs bg-muted/50 p-2 rounded">
                    <span className="font-semibold">{level.score}:</span> {level.description}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Grading Interface */}
      <div className="grid gap-4">
        {sampleResponses.map(sample => {
          const responseGrades = grades.get(sample.id) || [];
          const scoreResult = responseGrades.length > 0
            ? calculateRubricScore(responseGrades, rubric)
            : null;

          return (
            <Card key={sample.id} className="p-4">
              <div className="mb-4">
                <p className="text-sm text-muted-foreground mb-1">Question:</p>
                <p className="font-medium">{sample.question}</p>
              </div>
              <div className="bg-blue-50 p-3 rounded mb-4">
                <p className="text-sm text-muted-foreground mb-1">Response:</p>
                <p>{sample.response}</p>
              </div>

              <div className="space-y-3">
                {rubric.criteria.map(criterion => {
                  const grade = responseGrades.find(g => g.criterionName === criterion.name);
                  return (
                    <div key={criterion.name} className="flex items-center gap-4">
                      <span className="text-sm w-32">{criterion.name}:</span>
                      <div className="flex gap-2">
                        {criterion.levels.map(level => (
                          <button
                            key={level.score}
                            onClick={() => onGrade(sample.id, criterion.name, level.score)}
                            className={`w-8 h-8 rounded border text-sm ${
                              grade?.score === level.score
                                ? 'bg-primary text-primary-foreground'
                                : 'hover:bg-muted'
                            }`}
                          >
                            {level.score}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {scoreResult && (
                <div className="mt-4 pt-4 border-t flex justify-between items-center">
                  <span className="font-medium">Total Score:</span>
                  <Badge variant={scoreResult.percentage >= 75 ? 'success' : scoreResult.percentage >= 50 ? 'secondary' : 'destructive'}>
                    {scoreResult.score.toFixed(1)} / {scoreResult.maxScore.toFixed(1)} ({scoreResult.percentage.toFixed(0)}%)
                  </Badge>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* LLM-as-Judge Pitfalls */}
      <Card className="p-4">
        <h3 className="font-semibold mb-4">LLM-as-Judge Pitfalls</h3>
        <div className="grid grid-cols-2 gap-4">
          {llmJudgePitfalls.map(pitfall => (
            <div key={pitfall.name} className="border rounded p-3">
              <h4 className="font-medium text-red-600">{pitfall.name}</h4>
              <p className="text-sm text-muted-foreground mt-1">{pitfall.description}</p>
              <p className="text-sm text-green-600 mt-2">
                <span className="font-medium">Mitigation:</span> {pitfall.mitigation}
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function ABTestingTab({
  test,
  onStart,
}: {
  test: ABTest | null;
  onStart: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">A/B Testing</h2>
          <p className="text-sm text-muted-foreground">
            Compare variants in production with real traffic
          </p>
        </div>
        <Button onClick={onStart} disabled={test?.status === 'running'}>
          {test?.status === 'running' ? 'Running...' : 'Start A/B Test'}
        </Button>
      </div>

      {test && (
        <Card className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="font-semibold text-lg">{test.name}</h3>
              <p className="text-sm text-muted-foreground">
                Traffic split: {100 - test.trafficSplit}% control / {test.trafficSplit}% treatment
              </p>
            </div>
            <Badge variant={
              test.status === 'running' ? 'secondary' :
              test.status === 'completed' ? 'success' : 'outline'
            }>
              {test.status}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* Control */}
            <div className={`p-4 rounded border ${test.winner === 'control' ? 'border-green-500 bg-green-50' : ''}`}>
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-semibold">{test.control.name}</h4>
                {test.winner === 'control' && <Badge variant="success">Winner</Badge>}
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Requests:</span>
                  <span className="font-mono">{test.control.metrics.requests}</span>
                </div>
                <div className="flex justify-between">
                  <span>Success Rate:</span>
                  <span className="font-mono">{(test.control.metrics.successRate * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Avg Latency:</span>
                  <span className="font-mono">{test.control.metrics.avgLatency.toFixed(0)}ms</span>
                </div>
                <div className="flex justify-between">
                  <span>Satisfaction:</span>
                  <span className="font-mono">{test.control.metrics.avgSatisfaction.toFixed(2)}/5</span>
                </div>
                <div className="flex justify-between">
                  <span>Conversions:</span>
                  <span className="font-mono">{test.control.metrics.conversions}</span>
                </div>
              </div>
            </div>

            {/* Treatment */}
            <div className={`p-4 rounded border ${test.winner === 'treatment' ? 'border-green-500 bg-green-50' : ''}`}>
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-semibold">{test.treatment.name}</h4>
                {test.winner === 'treatment' && <Badge variant="success">Winner</Badge>}
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Requests:</span>
                  <span className="font-mono">{test.treatment.metrics.requests}</span>
                </div>
                <div className="flex justify-between">
                  <span>Success Rate:</span>
                  <span className="font-mono">{(test.treatment.metrics.successRate * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Avg Latency:</span>
                  <span className="font-mono">{test.treatment.metrics.avgLatency.toFixed(0)}ms</span>
                </div>
                <div className="flex justify-between">
                  <span>Satisfaction:</span>
                  <span className="font-mono">{test.treatment.metrics.avgSatisfaction.toFixed(2)}/5</span>
                </div>
                <div className="flex justify-between">
                  <span>Conversions:</span>
                  <span className="font-mono">{test.treatment.metrics.conversions}</span>
                </div>
              </div>
            </div>
          </div>

          {test.status === 'completed' && (
            <div className="mt-6 pt-4 border-t">
              <h4 className="font-medium mb-2">Recommendation</h4>
              <p className="text-sm">
                {test.winner === 'treatment'
                  ? 'Treatment variant shows improvement. Consider promoting to 100% traffic.'
                  : 'Control variant performs better. Keep current configuration.'}
              </p>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function CanaryTab({
  deployment,
  onStart,
}: {
  deployment: CanaryDeployment | null;
  onStart: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Canary Deployment</h2>
          <p className="text-sm text-muted-foreground">
            Gradually roll out changes with automatic rollback
          </p>
        </div>
        <Button onClick={onStart} disabled={deployment?.status === 'running'}>
          {deployment?.status === 'running' ? 'Deploying...' : 'Start Canary'}
        </Button>
      </div>

      {deployment && (
        <Card className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="font-semibold text-lg">{deployment.name}</h3>
              <p className="text-sm text-muted-foreground">
                {deployment.currentVersion} → {deployment.newVersion}
              </p>
            </div>
            <Badge variant={
              deployment.status === 'passed' ? 'success' :
              deployment.status === 'rolled_back' || deployment.status === 'failed' ? 'destructive' :
              'secondary'
            }>
              {deployment.status.replace('_', ' ')}
            </Badge>
          </div>

          {/* Stages */}
          <div className="space-y-4 mb-6">
            {deployment.stages.map((stage, index) => (
              <div
                key={stage.name}
                className={`p-4 rounded border ${stageStatusColors[stage.status]}`}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-medium">{stage.name}</h4>
                    <p className="text-sm opacity-75">
                      {stage.trafficPercent}% traffic | {stage.duration}
                    </p>
                  </div>
                  <Badge variant="outline">{stage.status}</Badge>
                </div>
                <div className="mt-3 text-xs space-y-1">
                  {stage.requiredMetrics.map((metric, i) => (
                    <div key={i}>
                      {metric.metric} {metric.operator} {metric.threshold}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Current Metrics */}
          <div className="border-t pt-4">
            <h4 className="font-medium mb-3">Current Metrics</h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-muted/50 rounded">
                <p className="text-sm text-muted-foreground">Error Rate</p>
                <p className={`text-xl font-bold ${deployment.metrics.errorRate < 0.02 ? 'text-green-600' : 'text-red-600'}`}>
                  {(deployment.metrics.errorRate * 100).toFixed(2)}%
                </p>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded">
                <p className="text-sm text-muted-foreground">P95 Latency</p>
                <p className="text-xl font-bold">{deployment.metrics.latencyP95.toFixed(0)}ms</p>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded">
                <p className="text-sm text-muted-foreground">Success Rate</p>
                <p className={`text-xl font-bold ${deployment.metrics.successRate > 0.95 ? 'text-green-600' : 'text-yellow-600'}`}>
                  {(deployment.metrics.successRate * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function CIPipelineTab({
  pipeline,
  isRunning,
  onRun,
}: {
  pipeline: CIPipeline | null;
  isRunning: boolean;
  onRun: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">CI Pipeline</h2>
          <p className="text-sm text-muted-foreground">
            Automated testing for prompt and AI artifact changes
          </p>
        </div>
        <Button onClick={onRun} disabled={isRunning}>
          {isRunning ? 'Running...' : 'Run Pipeline'}
        </Button>
      </div>

      {pipeline && (
        <Card className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-semibold text-lg">{pipeline.name}</h3>
            <Badge variant={
              pipeline.status === 'passed' ? 'success' :
              pipeline.status === 'failed' ? 'destructive' :
              pipeline.status === 'running' ? 'secondary' : 'outline'
            }>
              {pipeline.status}
            </Badge>
          </div>

          {/* Pipeline Stages */}
          <div className="flex gap-2 mb-6">
            {pipeline.stages.map((stage, index) => (
              <div key={stage.name} className="flex-1">
                <div className={`p-4 rounded border ${stageStatusColors[stage.status]}`}>
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium">{stage.name}</h4>
                    {stage.duration && (
                      <span className="text-xs opacity-75">{(stage.duration / 1000).toFixed(1)}s</span>
                    )}
                  </div>
                  <div className="space-y-1">
                    {stage.steps.map((step, i) => (
                      <div key={i} className="text-xs font-mono opacity-75">
                        {step}
                      </div>
                    ))}
                  </div>
                  {stage.output && (
                    <p className="text-xs mt-2 pt-2 border-t opacity-75">{stage.output}</p>
                  )}
                </div>
                {index < pipeline.stages.length - 1 && (
                  <div className="flex justify-center my-2">
                    <span className="text-muted-foreground">→</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Eval Results */}
          {pipeline.evalResults && (
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Eval Results</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-yellow-50 rounded border border-yellow-200">
                  <p className="text-sm text-yellow-800">Golden Cases</p>
                  <p className="text-xl font-bold text-yellow-900">
                    {pipeline.evalResults.golden.passed}/{pipeline.evalResults.golden.total}
                  </p>
                </div>
                <div className="text-center p-3 bg-purple-50 rounded border border-purple-200">
                  <p className="text-sm text-purple-800">Edge Cases</p>
                  <p className="text-xl font-bold text-purple-900">
                    {pipeline.evalResults.edge.passed}/{pipeline.evalResults.edge.total}
                  </p>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded border border-blue-200">
                  <p className="text-sm text-blue-800">Regression</p>
                  <p className="text-xl font-bold text-blue-900">
                    {pipeline.evalResults.regression.passed}/{pipeline.evalResults.regression.total}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Duration */}
          {pipeline.endTime && pipeline.startTime && (
            <div className="mt-4 text-sm text-muted-foreground text-right">
              Total duration: {((pipeline.endTime - pipeline.startTime) / 1000).toFixed(1)}s
            </div>
          )}
        </Card>
      )}

      {/* GitHub Actions Example */}
      <Card className="p-4">
        <h3 className="font-semibold mb-4">GitHub Actions Integration</h3>
        <pre className="bg-muted p-4 rounded text-xs overflow-x-auto">
{`name: Prompt CI

on:
  pull_request:
    paths:
      - 'prompts/**'
      - 'evals/**'

jobs:
  eval:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup
        run: npm ci

      - name: Run Evals
        run: npm run eval
        env:
          OPENAI_API_KEY: \${{ secrets.OPENAI_API_KEY }}

      - name: Check Thresholds
        run: npm run eval:check-thresholds

      - name: Upload Report
        uses: actions/upload-artifact@v4
        with:
          name: eval-report
          path: eval-results/`}
        </pre>
      </Card>
    </div>
  );
}
