'use client';

import { useState, useCallback } from 'react';
import {
  buildZeroShotPrompt,
  buildFewShotPrompt,
  buildChainOfThoughtPrompt,
  buildRoleBasedPrompt,
  renderTemplate,
  TEMPLATES,
  EXAMPLE_SETS,
  type PromptStrategy,
  type ExampleSetName,
} from '@/lib/prompts';
import type { Message } from '../../shared/lib/types';

/**
 * Prompt Engineering Playground
 *
 * This UI demonstrates the code in lib/prompts.ts.
 * It makes REAL calls to llama-server to compare prompting strategies.
 *
 * REQUIRES: llama-server running on port 8033
 * Start with: llama-server -m your-model.gguf --port 8033
 */

interface ComparisonResult {
  strategy: PromptStrategy;
  messages: Message[];
  response: string;
  latencyMs: number;
  error?: string;
}

export default function PromptEngineeringPage() {
  const [task, setTask] = useState('What is the capital of France?');
  const [customRole, setCustomRole] = useState(
    'You are a geography teacher who explains things simply.'
  );
  const [selectedExamples, setSelectedExamples] = useState<ExampleSetName>('questionAnswering');
  const [results, setResults] = useState<ComparisonResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [serverStatus, setServerStatus] = useState<'unknown' | 'online' | 'offline'>('unknown');

  // Check server status
  const checkServer = useCallback(async () => {
    try {
      const res = await fetch('http://127.0.0.1:8033/health', {
        signal: AbortSignal.timeout(2000),
      });
      setServerStatus(res.ok ? 'online' : 'offline');
    } catch {
      setServerStatus('offline');
    }
  }, []);

  // Run a single prompt
  const runPrompt = async (messages: Message[]): Promise<{ response: string; latencyMs: number }> => {
    const start = Date.now();
    const res = await fetch('http://127.0.0.1:8033/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        max_tokens: 256,
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    return {
      response: data.choices?.[0]?.message?.content ?? '',
      latencyMs: Date.now() - start,
    };
  };

  // Compare all strategies
  const runComparison = async () => {
    setIsLoading(true);
    setResults([]);

    const strategies: Array<{ strategy: PromptStrategy; messages: Message[] }> = [
      { strategy: 'zero-shot', messages: buildZeroShotPrompt(task) },
      { strategy: 'few-shot', messages: buildFewShotPrompt(task, EXAMPLE_SETS[selectedExamples]) },
      { strategy: 'chain-of-thought', messages: buildChainOfThoughtPrompt(task) },
      { strategy: 'role-based', messages: buildRoleBasedPrompt(task, customRole) },
    ];

    const newResults: ComparisonResult[] = [];

    for (const { strategy, messages } of strategies) {
      try {
        const { response, latencyMs } = await runPrompt(messages);
        newResults.push({ strategy, messages, response, latencyMs });
      } catch (e) {
        newResults.push({
          strategy,
          messages,
          response: '',
          latencyMs: 0,
          error: e instanceof Error ? e.message : 'Unknown error',
        });
      }
      // Update results progressively
      setResults([...newResults]);
    }

    setIsLoading(false);
  };

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-8">
      <header>
        <h1 className="text-3xl font-bold">Exercise 02: Prompt Engineering</h1>
        <p className="text-gray-400 mt-2">
          Study <code className="text-blue-400">lib/prompts.ts</code> then compare
          strategies with real LLM calls.
        </p>
      </header>

      {/* Server Status */}
      <section className="flex items-center gap-4">
        <button
          onClick={checkServer}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded"
        >
          Check Server
        </button>
        <span
          className={`text-sm ${
            serverStatus === 'online'
              ? 'text-green-400'
              : serverStatus === 'offline'
              ? 'text-red-400'
              : 'text-gray-500'
          }`}
        >
          {serverStatus === 'online' && 'llama-server is running'}
          {serverStatus === 'offline' && 'llama-server not found on port 8033'}
          {serverStatus === 'unknown' && 'Click to check server status'}
        </span>
      </section>

      {/* Input Configuration */}
      <section className="space-y-4 bg-gray-800 p-6 rounded-lg">
        <h2 className="text-xl font-semibold">Configuration</h2>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Your Task/Question</label>
          <textarea
            value={task}
            onChange={(e) => setTask(e.target.value)}
            className="w-full h-24 bg-gray-900 border border-gray-700 rounded-lg p-3 font-mono text-sm"
            placeholder="Enter your question or task..."
          />
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Few-Shot Examples (for few-shot strategy)
            </label>
            <select
              value={selectedExamples}
              onChange={(e) => setSelectedExamples(e.target.value as ExampleSetName)}
              className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2"
            >
              {Object.keys(EXAMPLE_SETS).map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Role (for role-based strategy)
            </label>
            <input
              type="text"
              value={customRole}
              onChange={(e) => setCustomRole(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2"
            />
          </div>
        </div>

        <button
          onClick={runComparison}
          disabled={isLoading || !task.trim()}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium"
        >
          {isLoading ? 'Running comparison...' : 'Compare All Strategies'}
        </button>
      </section>

      {/* Results */}
      {results.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Results Comparison</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {results.map((result) => (
              <ResultCard key={result.strategy} result={result} />
            ))}
          </div>
        </section>
      )}

      {/* Prompt Preview */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Prompt Preview</h2>
        <p className="text-gray-400 text-sm">
          See exactly what messages each strategy sends to the LLM.
        </p>
        <div className="grid md:grid-cols-2 gap-4">
          <PromptPreview
            title="Zero-Shot"
            messages={buildZeroShotPrompt(task)}
            description="Direct question, no examples"
          />
          <PromptPreview
            title="Few-Shot"
            messages={buildFewShotPrompt(task, EXAMPLE_SETS[selectedExamples])}
            description="Examples teach the format"
          />
          <PromptPreview
            title="Chain-of-Thought"
            messages={buildChainOfThoughtPrompt(task)}
            description="Encourages step-by-step reasoning"
          />
          <PromptPreview
            title="Role-Based"
            messages={buildRoleBasedPrompt(task, customRole)}
            description="System prompt sets the persona"
          />
        </div>
      </section>

      {/* Code Reference */}
      <section className="bg-gray-800 rounded-lg p-4 text-sm">
        <h3 className="font-semibold mb-2">Study the Code</h3>
        <ul className="space-y-1 text-gray-400">
          <li>
            <code className="text-blue-400">lib/prompts.ts</code> - Prompt building functions
          </li>
          <li>
            <code className="text-blue-400">lib/prompts.test.ts</code> - Tests for prompt construction
          </li>
        </ul>
        <p className="mt-2 text-gray-400">
          Run <code className="text-green-400">bun test</code> to verify your understanding.
        </p>
      </section>
    </main>
  );
}

// =============================================================================
// Components
// =============================================================================

function ResultCard({ result }: { result: ComparisonResult }) {
  const [showMessages, setShowMessages] = useState(false);

  return (
    <div
      className={`p-4 rounded-lg border ${
        result.error ? 'bg-red-900/20 border-red-700' : 'bg-gray-800 border-gray-700'
      }`}
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-medium capitalize">{result.strategy}</h3>
        {!result.error && (
          <span className="text-xs text-gray-500">{result.latencyMs}ms</span>
        )}
      </div>

      {result.error ? (
        <p className="text-red-400 text-sm">{result.error}</p>
      ) : (
        <p className="text-sm whitespace-pre-wrap">{result.response}</p>
      )}

      <button
        onClick={() => setShowMessages(!showMessages)}
        className="text-xs text-blue-400 mt-2 hover:underline"
      >
        {showMessages ? 'Hide' : 'Show'} messages sent
      </button>

      {showMessages && (
        <div className="mt-2 text-xs bg-gray-900 p-2 rounded max-h-40 overflow-auto">
          {result.messages.map((msg, i) => (
            <div key={i} className="mb-1">
              <span className="text-gray-500">{msg.role}:</span>{' '}
              <span className="text-gray-300">{msg.content.slice(0, 100)}...</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PromptPreview({
  title,
  messages,
  description,
}: {
  title: string;
  messages: Message[];
  description: string;
}) {
  return (
    <div className="p-4 bg-gray-800 border border-gray-700 rounded-lg">
      <h3 className="font-medium">{title}</h3>
      <p className="text-xs text-gray-500 mb-2">{description}</p>
      <div className="text-xs bg-gray-900 p-2 rounded max-h-40 overflow-auto">
        {messages.map((msg, i) => (
          <div key={i} className="mb-2">
            <span
              className={`font-medium ${
                msg.role === 'system'
                  ? 'text-purple-400'
                  : msg.role === 'assistant'
                  ? 'text-green-400'
                  : 'text-blue-400'
              }`}
            >
              {msg.role}:
            </span>
            <pre className="whitespace-pre-wrap text-gray-300 mt-1">{msg.content}</pre>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-500 mt-2">
        ~{messages.reduce((sum, m) => sum + Math.ceil(m.content.length / 4) + 4, 0)} tokens
      </p>
    </div>
  );
}
