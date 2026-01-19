'use client';

import { useState, useCallback } from 'react';

/**
 * Multi-Agent Pipelines Demo
 *
 * Visualize different agent orchestration patterns.
 *
 * REQUIRES: llama-server running on port 8033
 */

type PatternType = 'sequential' | 'parallel' | 'maker-checker' | 'debate';

interface AgentResponse {
  agent: string;
  input: string;
  output: string;
  latencyMs: number;
}

interface PipelineResult {
  pattern: PatternType;
  steps: AgentResponse[];
  finalOutput: string;
  totalLatencyMs: number;
  metadata?: Record<string, unknown>;
}

export default function MultiAgentPage() {
  const [input, setInput] = useState('Explain the benefits of TypeScript over JavaScript');
  const [pattern, setPattern] = useState<PatternType>('sequential');
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runPipeline = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const { MultiAgentClient, AGENTS } = await import('@/lib/multi-agent');
      const client = new MultiAgentClient();

      let pipelineResult: PipelineResult;

      switch (pattern) {
        case 'sequential': {
          const res = await client.chain(
            [AGENTS.analyzer, AGENTS.writer, AGENTS.summarizer],
            input
          );
          pipelineResult = { ...res, pattern };
          break;
        }

        case 'parallel': {
          const res = await client.aggregate(
            [AGENTS.analyzer, AGENTS.researcher],
            input,
            AGENTS.summarizer
          );
          pipelineResult = { ...res, pattern };
          break;
        }

        case 'maker-checker': {
          const res = await client.makerChecker(AGENTS.writer, AGENTS.critic, input, 2);
          // Convert iterations to steps format
          const steps: AgentResponse[] = [];
          for (const iter of res.iterations) {
            steps.push(iter.draft);
            steps.push(iter.review);
          }
          pipelineResult = {
            pattern,
            steps,
            finalOutput: res.finalOutput,
            totalLatencyMs: res.totalLatencyMs,
            metadata: { approved: res.approved, iterations: res.iterations.length },
          };
          break;
        }

        case 'debate': {
          const res = await client.debate(input);
          pipelineResult = {
            pattern,
            steps: [
              { agent: 'Pro', input, output: res.proArgument, latencyMs: 0 },
              { agent: 'Con', input, output: res.conArgument, latencyMs: 0 },
              { agent: 'Judge', input: 'evaluate', output: res.judgment, latencyMs: 0 },
            ],
            finalOutput: res.judgment,
            totalLatencyMs: res.totalLatencyMs,
          };
          break;
        }
      }

      setResult(pipelineResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Pipeline failed');
    }

    setIsLoading(false);
  }, [input, pattern]);

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-8">
      <header>
        <h1 className="text-3xl font-bold">Exercise 09: Multi-Agent Pipelines</h1>
        <p className="text-gray-400 mt-2">
          Study <code className="text-blue-400">lib/multi-agent.ts</code> - orchestrate multiple
          LLM calls with different roles.
        </p>
      </header>

      {/* Pattern Selection */}
      <section className="bg-gray-800 p-6 rounded-lg space-y-4">
        <h2 className="text-xl font-semibold">Select Pattern</h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <PatternButton
            name="Sequential"
            description="A → B → C"
            selected={pattern === 'sequential'}
            onClick={() => setPattern('sequential')}
          />
          <PatternButton
            name="Parallel"
            description="[A, B] → C"
            selected={pattern === 'parallel'}
            onClick={() => setPattern('parallel')}
          />
          <PatternButton
            name="Maker-Checker"
            description="Create ↔ Review"
            selected={pattern === 'maker-checker'}
            onClick={() => setPattern('maker-checker')}
          />
          <PatternButton
            name="Debate"
            description="Pro vs Con → Judge"
            selected={pattern === 'debate'}
            onClick={() => setPattern('debate')}
          />
        </div>

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 min-h-[80px]"
          placeholder="Enter your input..."
        />

        <button
          onClick={runPipeline}
          disabled={isLoading || !input.trim()}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 rounded-lg"
        >
          {isLoading ? 'Running Pipeline...' : 'Run Pipeline'}
        </button>

        {error && (
          <p className="text-red-400 text-sm">
            Error: {error}. Is llama-server running on port 8033?
          </p>
        )}
      </section>

      {/* Pipeline Visualization */}
      {result && (
        <section className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Pipeline Results</h2>
            <span className="text-sm text-gray-400">
              Total: {result.totalLatencyMs}ms
            </span>
          </div>

          {/* Visual Pipeline */}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="px-2 py-1 bg-blue-900 rounded">Input</span>
            {result.steps.map((step, i) => (
              <span key={i} className="flex items-center gap-2">
                <span className="text-gray-500">→</span>
                <span className="px-2 py-1 bg-green-900 rounded">{step.agent}</span>
              </span>
            ))}
            <span className="text-gray-500">→</span>
            <span className="px-2 py-1 bg-purple-900 rounded">Output</span>
          </div>

          {/* Steps */}
          <div className="space-y-4">
            {result.steps.map((step, i) => (
              <AgentStep key={i} step={step} index={i} />
            ))}
          </div>

          {/* Final Output */}
          <div className="bg-purple-900/30 border border-purple-700 rounded-lg p-4">
            <h3 className="font-medium text-purple-300 mb-2">Final Output</h3>
            <p className="whitespace-pre-wrap">{result.finalOutput}</p>
          </div>

          {/* Metadata */}
          {result.metadata && (
            <div className="text-sm text-gray-400">
              <p>
                Metadata:{' '}
                {Object.entries(result.metadata)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(', ')}
              </p>
            </div>
          )}
        </section>
      )}

      {/* Pattern Explanations */}
      <section className="bg-gray-800 rounded-lg p-6 space-y-4">
        <h2 className="text-xl font-semibold">Pipeline Patterns</h2>

        <div className="grid md:grid-cols-2 gap-6 text-sm">
          <PatternExplanation
            name="Sequential Chain"
            code="analyzer → writer → summarizer"
            description="Each agent processes the output of the previous. Good for progressive refinement."
          />
          <PatternExplanation
            name="Parallel Fan-Out"
            code="[analyzer, researcher] → aggregator"
            description="Run agents concurrently, then combine. Good for multiple perspectives."
          />
          <PatternExplanation
            name="Maker-Checker"
            code="writer ↔ critic (iterate)"
            description="One creates, one reviews. Loop until approved or max iterations."
          />
          <PatternExplanation
            name="Debate"
            code="pro | con → judge"
            description="Argue both sides, then evaluate. Good for complex decisions."
          />
        </div>
      </section>

      {/* Code Reference */}
      <section className="bg-gray-800 rounded-lg p-4 text-sm">
        <h3 className="font-semibold mb-2">Study the Code</h3>
        <ul className="space-y-1 text-gray-400">
          <li>
            <code className="text-blue-400">lib/multi-agent.ts</code> - Agent definitions, pipeline
            patterns, fluent builder
          </li>
          <li>
            <code className="text-blue-400">lib/multi-agent.test.ts</code> - Structure and
            integration tests
          </li>
        </ul>
      </section>
    </main>
  );
}

// =============================================================================
// Components
// =============================================================================

function PatternButton({
  name,
  description,
  selected,
  onClick,
}: {
  name: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`p-4 rounded-lg border text-left transition-colors ${
        selected
          ? 'border-blue-500 bg-blue-900/30'
          : 'border-gray-700 hover:border-gray-500'
      }`}
    >
      <p className="font-medium">{name}</p>
      <p className="text-sm text-gray-400 font-mono">{description}</p>
    </button>
  );
}

function AgentStep({ step, index }: { step: AgentResponse; index: number }) {
  const [expanded, setExpanded] = useState(index === 0);

  const colors: Record<string, string> = {
    Analyzer: 'border-blue-700 bg-blue-900/20',
    Writer: 'border-green-700 bg-green-900/20',
    Critic: 'border-yellow-700 bg-yellow-900/20',
    Summarizer: 'border-purple-700 bg-purple-900/20',
    Researcher: 'border-cyan-700 bg-cyan-900/20',
    Pro: 'border-green-700 bg-green-900/20',
    Con: 'border-red-700 bg-red-900/20',
    Judge: 'border-purple-700 bg-purple-900/20',
  };

  const colorClass = colors[step.agent] || 'border-gray-700 bg-gray-900/20';

  return (
    <div className={`rounded-lg border ${colorClass}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex justify-between items-center text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">#{index + 1}</span>
          <span className="font-medium">{step.agent}</span>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-400">
          <span>{step.latencyMs}ms</span>
          <span>{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-700/50 pt-3">
          <div>
            <p className="text-xs text-gray-500 mb-1">Input (truncated):</p>
            <p className="text-sm text-gray-400 line-clamp-2">{step.input}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Output:</p>
            <p className="text-sm whitespace-pre-wrap">{step.output}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function PatternExplanation({
  name,
  code,
  description,
}: {
  name: string;
  code: string;
  description: string;
}) {
  return (
    <div>
      <h3 className="font-medium text-blue-400">{name}</h3>
      <code className="text-xs text-gray-500">{code}</code>
      <p className="text-gray-400 mt-1">{description}</p>
    </div>
  );
}
