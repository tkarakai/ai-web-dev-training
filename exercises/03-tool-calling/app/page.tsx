'use client';

import { useState, useMemo } from 'react';
import {
  createDefaultRegistry,
  runAgentLoop,
  type AgentStep,
} from '@/lib/tools';

/**
 * Tool Calling Playground
 *
 * This UI demonstrates the code in lib/tools.ts.
 * Watch the agent loop execute tools in real-time.
 *
 * REQUIRES: llama-server running on port 8033
 */

export default function ToolCallingPage() {
  const [query, setQuery] = useState("What's 15 multiplied by 7? Also, what's the weather in Tokyo?");
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [finalResponse, setFinalResponse] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const registry = useMemo(() => createDefaultRegistry(), []);

  const llmCall = async (messages: Array<{ role: string; content: string }>): Promise<string> => {
    const res = await fetch('http://127.0.0.1:8033/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        max_tokens: 512,
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? '';
  };

  const runAgent = async () => {
    setIsRunning(true);
    setSteps([]);
    setFinalResponse('');
    setError(null);

    try {
      const result = await runAgentLoop(query, registry, llmCall, 5);
      setSteps(result.steps);
      setFinalResponse(result.response);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setIsRunning(false);
    }
  };

  const testTool = async (toolName: string, params: Record<string, unknown>) => {
    const result = await registry.execute(toolName, params);
    alert(result.success ? result.output : `Error: ${result.error}`);
  };

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-8">
      <header>
        <h1 className="text-3xl font-bold">Exercise 03: Tool Calling</h1>
        <p className="text-gray-400 mt-2">
          Study <code className="text-blue-400">lib/tools.ts</code> - Zod schemas, tool registry, agent loop.
        </p>
      </header>

      {/* Tool Registry */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Available Tools</h2>
        <p className="text-gray-400 text-sm">
          Each tool is defined with a Zod schema for type-safe parameters.
        </p>
        <div className="grid md:grid-cols-2 gap-4">
          {registry.list().map((tool) => (
            <div
              key={tool.name}
              className="p-4 bg-gray-800 border border-gray-700 rounded-lg"
            >
              <h3 className="font-mono text-blue-400">{tool.name}</h3>
              <p className="text-sm text-gray-400 mt-1">{tool.description}</p>
              <button
                onClick={() => {
                  // Quick test with default params
                  if (tool.name === 'calculator') {
                    testTool('calculator', { operation: 'multiply', a: 6, b: 7 });
                  } else if (tool.name === 'get_weather') {
                    testTool('get_weather', { city: 'London' });
                  } else if (tool.name === 'get_time') {
                    testTool('get_time', { timezone: 'UTC' });
                  } else if (tool.name === 'search') {
                    testTool('search', { query: 'TypeScript', maxResults: 2 });
                  }
                }}
                className="mt-2 text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded"
              >
                Test Tool
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Agent Input */}
      <section className="space-y-4 bg-gray-800 p-6 rounded-lg">
        <h2 className="text-xl font-semibold">Agent Loop</h2>
        <p className="text-gray-400 text-sm">
          Ask a question that requires tools. Watch the agent call tools and use their results.
        </p>

        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full h-24 bg-gray-900 border border-gray-700 rounded-lg p-3 font-mono text-sm"
          placeholder="Ask something that needs tools..."
        />

        <button
          onClick={runAgent}
          disabled={isRunning || !query.trim()}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium"
        >
          {isRunning ? 'Running...' : 'Run Agent'}
        </button>
      </section>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-900/30 border border-red-700 rounded-lg">
          <p className="text-red-400">{error}</p>
          <p className="text-sm text-gray-400 mt-2">
            Make sure llama-server is running on port 8033
          </p>
        </div>
      )}

      {/* Agent Steps */}
      {steps.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Execution Steps</h2>
          <div className="space-y-2">
            {steps.map((step, i) => (
              <StepCard key={i} step={step} index={i} />
            ))}
          </div>
        </section>
      )}

      {/* Final Response */}
      {finalResponse && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Final Response</h2>
          <div className="p-4 bg-green-900/20 border border-green-700 rounded-lg">
            <p className="whitespace-pre-wrap">{finalResponse}</p>
          </div>
        </section>
      )}

      {/* Code Reference */}
      <section className="bg-gray-800 rounded-lg p-4 text-sm">
        <h3 className="font-semibold mb-2">Study the Code</h3>
        <ul className="space-y-1 text-gray-400">
          <li>
            <code className="text-blue-400">lib/tools.ts</code> - Tool definitions, registry, agent loop
          </li>
          <li>
            <code className="text-blue-400">lib/tools.test.ts</code> - Tests for tools and parsing
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

function StepCard({ step, index }: { step: AgentStep; index: number }) {
  const colors = {
    thought: 'border-purple-700 bg-purple-900/20',
    tool_call: 'border-yellow-700 bg-yellow-900/20',
    tool_result: 'border-blue-700 bg-blue-900/20',
    response: 'border-green-700 bg-green-900/20',
  };

  const labels = {
    thought: 'Thinking',
    tool_call: 'Tool Call',
    tool_result: 'Tool Result',
    response: 'Response',
  };

  return (
    <div className={`p-4 border rounded-lg ${colors[step.type]}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-medium text-gray-400">Step {index + 1}</span>
        <span className="text-xs px-2 py-0.5 bg-gray-800 rounded">
          {labels[step.type]}
        </span>
        {step.toolName && (
          <span className="text-xs font-mono text-yellow-400">
            {step.toolName}
          </span>
        )}
      </div>
      <p className="text-sm whitespace-pre-wrap">{step.content}</p>
      {step.toolParams && (
        <pre className="mt-2 text-xs bg-gray-900 p-2 rounded overflow-auto">
          {JSON.stringify(step.toolParams, null, 2)}
        </pre>
      )}
    </div>
  );
}
