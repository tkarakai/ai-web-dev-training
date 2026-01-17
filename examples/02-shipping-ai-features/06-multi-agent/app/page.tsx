'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@examples/shared/components/ui/card';
import { Button } from '@examples/shared/components/ui/button';
import { Badge } from '@examples/shared/components/ui/badge';
import { Textarea } from '@examples/shared/components/ui/textarea';
import { Input } from '@examples/shared/components/ui/input';
import {
  agents,
  runSequentialPipeline,
  runParallel,
  runMakerChecker,
  formatLatency,
  estimateCost,
  type Agent,
  type AgentOutput,
  type PipelineStage,
  type ParallelTask,
} from '../lib/agent-utils';

// Icons
function Users({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function ArrowRight({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

function GitBranch({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="6" x2="6" y1="3" y2="15" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M18 9a9 9 0 0 1-9 9" />
    </svg>
  );
}

function Network({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="16" y="16" width="6" height="6" rx="1" />
      <rect x="2" y="16" width="6" height="6" rx="1" />
      <rect x="9" y="2" width="6" height="6" rx="1" />
      <path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3" />
      <path d="M12 12V8" />
    </svg>
  );
}

function RefreshCw({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
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

function Clock({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function DollarSign({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" x2="12" y1="2" y2="22" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

type PatternType = 'sequential' | 'parallel' | 'maker-checker';

const patternInfo = {
  sequential: {
    title: 'Sequential Pipeline',
    description: 'Agents hand off to each other in order. Research → Analysis → Writing.',
    icon: ArrowRight,
    color: 'blue',
  },
  parallel: {
    title: 'Parallel (Fan-out)',
    description: 'Multiple agents work simultaneously on the same input.',
    icon: GitBranch,
    color: 'green',
  },
  'maker-checker': {
    title: 'Maker-Checker',
    description: 'One agent creates, another critiques. Iterate until quality threshold.',
    icon: RefreshCw,
    color: 'purple',
  },
};

function AgentCard({ agent, status, output }: { agent: Agent; status: 'idle' | 'running' | 'complete'; output?: AgentOutput }) {
  const colorClasses: Record<string, string> = {
    blue: 'border-blue-200 bg-blue-50',
    green: 'border-green-200 bg-green-50',
    purple: 'border-purple-200 bg-purple-50',
    orange: 'border-orange-200 bg-orange-50',
    red: 'border-red-200 bg-red-50',
    indigo: 'border-indigo-200 bg-indigo-50',
    cyan: 'border-cyan-200 bg-cyan-50',
    amber: 'border-amber-200 bg-amber-50',
  };

  return (
    <div className={`p-3 rounded-lg border ${colorClasses[agent.color] || 'border-gray-200 bg-gray-50'}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            status === 'running' ? 'bg-yellow-500 animate-pulse' :
            status === 'complete' ? 'bg-green-500' : 'bg-gray-300'
          }`} />
          <span className="font-medium text-sm">{agent.name}</span>
        </div>
        {output && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            {formatLatency(output.latencyMs)}
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground mb-2">{agent.role}</p>
      {output && (
        <div className="mt-2 p-2 bg-white/50 rounded text-xs max-h-32 overflow-y-auto">
          {output.content.slice(0, 300)}
          {output.content.length > 300 && '...'}
        </div>
      )}
    </div>
  );
}

export default function MultiAgentPage() {
  const [pattern, setPattern] = React.useState<PatternType>('sequential');
  const [input, setInput] = React.useState('Explain the benefits and drawbacks of microservices architecture');
  const [isRunning, setIsRunning] = React.useState(false);
  const [outputs, setOutputs] = React.useState<AgentOutput[]>([]);
  const [currentStage, setCurrentStage] = React.useState(0);
  const [totalLatency, setTotalLatency] = React.useState(0);
  const [totalTokens, setTotalTokens] = React.useState(0);
  const [makerCheckerHistory, setMakerCheckerHistory] = React.useState<Array<{
    maker: AgentOutput;
    checker: AgentOutput;
    score: number;
  }>>([]);
  const [acceptanceThreshold, setAcceptanceThreshold] = React.useState(80);

  const runPattern = async () => {
    setIsRunning(true);
    setOutputs([]);
    setCurrentStage(0);
    setTotalLatency(0);
    setTotalTokens(0);
    setMakerCheckerHistory([]);

    try {
      switch (pattern) {
        case 'sequential': {
          const stages: PipelineStage[] = [
            { agent: agents.researcher },
            {
              agent: agents.analyst,
              transformInput: (prev) => `Analyze these research findings:\n\n${prev.content}`,
            },
            {
              agent: agents.writer,
              transformInput: (prev) => `Write a summary based on this analysis:\n\n${prev.content}`,
            },
          ];

          await runSequentialPipeline(stages, input, (stage, total, agent, output) => {
            setCurrentStage(stage);
            if (output) {
              setOutputs((prev) => [...prev, output]);
              setTotalLatency((prev) => prev + output.latencyMs);
              setTotalTokens((prev) => prev + output.tokenCount);
            }
          });
          break;
        }

        case 'parallel': {
          const tasks: ParallelTask[] = [
            { agent: agents.technicalReviewer, input: `Review this for technical accuracy:\n\n${input}` },
            { agent: agents.securityReviewer, input: `Review this for security concerns:\n\n${input}` },
            { agent: agents.analyst, input: `Analyze the key points:\n\n${input}` },
          ];

          const result = await runParallel(tasks, (completed, total, outputs) => {
            setCurrentStage(completed);
            setOutputs([...outputs]);
          });

          setTotalLatency(result.totalLatency);
          setTotalTokens(result.totalTokens);
          break;
        }

        case 'maker-checker': {
          const result = await runMakerChecker(
            `Write a TypeScript function that ${input}`,
            agents.maker,
            agents.checker,
            3,
            acceptanceThreshold,
            (iteration, phase, output, score) => {
              setCurrentStage(iteration);
              if (output) {
                setOutputs((prev) => [...prev, output]);
                setTotalLatency((prev) => prev + output.latencyMs);
                setTotalTokens((prev) => prev + output.tokenCount);
              }
            }
          );

          setMakerCheckerHistory(result.history);
          break;
        }
      }
    } catch (error) {
      console.error('Pattern execution failed:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const Icon = patternInfo[pattern].icon;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <Users className="w-8 h-8 text-indigo-500" />
            Multi-Agent Orchestration
          </h1>
          <p className="text-muted-foreground">
            Explore different patterns for coordinating multiple AI agents
          </p>
        </div>

        {/* Pattern Selector */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {(Object.keys(patternInfo) as PatternType[]).map((p) => {
            const info = patternInfo[p];
            const PatternIcon = info.icon;
            return (
              <button
                key={p}
                onClick={() => {
                  setPattern(p);
                  setOutputs([]);
                  setMakerCheckerHistory([]);
                }}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  pattern === p
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-border hover:border-indigo-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <PatternIcon className={`w-5 h-5 ${pattern === p ? 'text-indigo-600' : 'text-muted-foreground'}`} />
                  <span className="font-medium">{info.title}</span>
                </div>
                <p className="text-xs text-muted-foreground">{info.description}</p>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Input & Controls */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Icon className="w-4 h-4" />
                  {patternInfo[pattern].title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Task Input</label>
                  <Textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Enter your task..."
                    className="min-h-[100px] resize-none"
                  />
                </div>

                {pattern === 'maker-checker' && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium">Acceptance Threshold</label>
                      <span className="text-sm text-muted-foreground">{acceptanceThreshold}%</span>
                    </div>
                    <input
                      type="range"
                      min={50}
                      max={100}
                      value={acceptanceThreshold}
                      onChange={(e) => setAcceptanceThreshold(Number(e.target.value))}
                      className="w-full accent-purple-500"
                    />
                  </div>
                )}

                <Button onClick={runPattern} disabled={isRunning || !input.trim()} className="w-full">
                  {isRunning ? (
                    <>
                      <Loader className="w-4 h-4 mr-2 animate-spin" />
                      Running...
                    </>
                  ) : (
                    <>Run {patternInfo[pattern].title}</>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Agents Overview */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Agents in this Pattern</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {pattern === 'sequential' && (
                    <>
                      <AgentCard
                        agent={agents.researcher}
                        status={currentStage >= 1 ? (currentStage > 1 ? 'complete' : 'running') : 'idle'}
                        output={outputs.find((o) => o.agentId === 'researcher')}
                      />
                      <div className="flex justify-center">
                        <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <AgentCard
                        agent={agents.analyst}
                        status={currentStage >= 2 ? (currentStage > 2 ? 'complete' : 'running') : 'idle'}
                        output={outputs.find((o) => o.agentId === 'analyst')}
                      />
                      <div className="flex justify-center">
                        <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <AgentCard
                        agent={agents.writer}
                        status={currentStage >= 3 ? 'complete' : currentStage === 3 ? 'running' : 'idle'}
                        output={outputs.find((o) => o.agentId === 'writer')}
                      />
                    </>
                  )}
                  {pattern === 'parallel' && (
                    <div className="space-y-2">
                      <AgentCard
                        agent={agents.technicalReviewer}
                        status={outputs.find((o) => o.agentId === 'technical') ? 'complete' : isRunning ? 'running' : 'idle'}
                        output={outputs.find((o) => o.agentId === 'technical')}
                      />
                      <AgentCard
                        agent={agents.securityReviewer}
                        status={outputs.find((o) => o.agentId === 'security') ? 'complete' : isRunning ? 'running' : 'idle'}
                        output={outputs.find((o) => o.agentId === 'security')}
                      />
                      <AgentCard
                        agent={agents.analyst}
                        status={outputs.find((o) => o.agentId === 'analyst') ? 'complete' : isRunning ? 'running' : 'idle'}
                        output={outputs.find((o) => o.agentId === 'analyst')}
                      />
                    </div>
                  )}
                  {pattern === 'maker-checker' && (
                    <div className="space-y-2">
                      <AgentCard agent={agents.maker} status={isRunning ? 'running' : outputs.length > 0 ? 'complete' : 'idle'} />
                      <div className="flex justify-center">
                        <RefreshCw className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <AgentCard agent={agents.checker} status={isRunning ? 'running' : outputs.length > 0 ? 'complete' : 'idle'} />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Stats */}
            {(totalLatency > 0 || totalTokens > 0) && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Execution Stats</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <Clock className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                      <p className="text-lg font-bold">{formatLatency(totalLatency)}</p>
                      <p className="text-xs text-muted-foreground">Total Time</p>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <DollarSign className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                      <p className="text-lg font-bold">${estimateCost(totalTokens).toFixed(4)}</p>
                      <p className="text-xs text-muted-foreground">{totalTokens} tokens</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column: Results */}
          <div className="lg:col-span-2">
            <Card className="h-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span>Execution Results</span>
                  {makerCheckerHistory.length > 0 && (
                    <Badge variant="secondary">
                      {makerCheckerHistory.length} iteration{makerCheckerHistory.length > 1 ? 's' : ''}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {outputs.length === 0 && !isRunning ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Network className="w-12 h-12 mb-4 opacity-50" />
                    <p>Select a pattern and run to see agent outputs</p>
                  </div>
                ) : pattern === 'maker-checker' && makerCheckerHistory.length > 0 ? (
                  <div className="space-y-4">
                    {makerCheckerHistory.map((h, i) => (
                      <div key={i} className="border rounded-lg overflow-hidden">
                        <div className="bg-muted/30 px-4 py-2 flex items-center justify-between">
                          <span className="font-medium text-sm">Iteration {i + 1}</span>
                          <Badge
                            variant={h.score >= acceptanceThreshold ? 'default' : 'secondary'}
                            className={h.score >= acceptanceThreshold ? 'bg-green-500' : ''}
                          >
                            Score: {h.score}/100
                          </Badge>
                        </div>
                        <div className="p-4 space-y-4">
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-3 h-3 rounded-full bg-cyan-500" />
                              <span className="text-sm font-medium">Maker Output</span>
                              <span className="text-xs text-muted-foreground">
                                {formatLatency(h.maker.latencyMs)}
                              </span>
                            </div>
                            <div className="bg-muted/20 p-3 rounded text-sm whitespace-pre-wrap max-h-48 overflow-y-auto">
                              {h.maker.content}
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-3 h-3 rounded-full bg-amber-500" />
                              <span className="text-sm font-medium">Checker Feedback</span>
                              <span className="text-xs text-muted-foreground">
                                {formatLatency(h.checker.latencyMs)}
                              </span>
                            </div>
                            <div className="bg-muted/20 p-3 rounded text-sm whitespace-pre-wrap max-h-32 overflow-y-auto">
                              {h.checker.content}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {outputs.map((output, i) => {
                      const agent = Object.values(agents).find((a) => a.id === output.agentId);
                      return (
                        <div key={i} className="border rounded-lg overflow-hidden">
                          <div className="bg-muted/30 px-4 py-2 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{
                                  backgroundColor:
                                    agent?.color === 'blue' ? '#3b82f6' :
                                    agent?.color === 'green' ? '#22c55e' :
                                    agent?.color === 'purple' ? '#a855f7' :
                                    agent?.color === 'orange' ? '#f97316' :
                                    agent?.color === 'red' ? '#ef4444' : '#6b7280',
                                }}
                              />
                              <span className="font-medium text-sm">{agent?.name || output.agentId}</span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span>{formatLatency(output.latencyMs)}</span>
                              <span>{output.tokenCount} tokens</span>
                            </div>
                          </div>
                          <div className="p-4">
                            <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                              {output.content}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {isRunning && (
                      <div className="flex items-center justify-center py-8">
                        <Loader className="w-6 h-6 animate-spin text-indigo-500" />
                        <span className="ml-2 text-muted-foreground">Processing...</span>
                      </div>
                    )}
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
