'use client';

import { useState } from 'react';
import {
  extractWithRepair,
  buildStructuredPrompt,
  SentimentSchema,
  EntitySchema,
  SummarySchema,
  type ExtractionResult,
} from '@/lib/structured';
import { z } from 'zod';

/**
 * Structured Outputs Demo
 *
 * Extract typed data from LLM outputs with validation and repair.
 *
 * REQUIRES: llama-server running on port 8033
 */

type TaskType = 'sentiment' | 'entities' | 'summary' | 'custom';

const SCHEMAS = {
  sentiment: SentimentSchema,
  entities: EntitySchema,
  summary: SummarySchema,
  custom: z.object({ result: z.string() }),
};

const EXAMPLE_INPUTS = {
  sentiment: 'I absolutely loved this product! Best purchase I ever made.',
  entities: 'John Smith from Google met with Sarah at the New York office on January 15th.',
  summary: 'TypeScript is a typed superset of JavaScript that compiles to plain JavaScript. It adds optional static typing and class-based object-oriented programming to the language.',
  custom: 'Extract key information from this text.',
};

export default function StructuredOutputsPage() {
  const [taskType, setTaskType] = useState<TaskType>('sentiment');
  const [input, setInput] = useState(EXAMPLE_INPUTS.sentiment);
  const [customSchema, setCustomSchema] = useState('{ "result": "string" }');
  const [result, setResult] = useState<ExtractionResult<unknown> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [maxRetries, setMaxRetries] = useState(3);
  const [prompt, setPrompt] = useState('');

  const generate = async (promptText: string): Promise<string> => {
    const res = await fetch('http://127.0.0.1:8033/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: promptText }],
        max_tokens: 512,
        temperature: 0.7,
      }),
    });

    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? '';
  };

  const runExtraction = async () => {
    setIsLoading(true);
    setResult(null);

    try {
      const schema = SCHEMAS[taskType];
      const taskPrompts = {
        sentiment: `Analyze the sentiment of this text: "${input}"`,
        entities: `Extract named entities from this text: "${input}"`,
        summary: `Summarize this text: "${input}"`,
        custom: input,
      };

      const fullPrompt = buildStructuredPrompt(taskPrompts[taskType], schema);
      setPrompt(fullPrompt);

      const extractionResult = await extractWithRepair(
        generate,
        fullPrompt,
        schema,
        { maxRetries, includeRawOutput: true }
      );

      setResult(extractionResult);
    } catch (e) {
      setResult({
        success: false,
        error: e instanceof Error ? e.message : 'Unknown error',
        attempts: 0,
      });
    }

    setIsLoading(false);
  };

  const handleTaskChange = (task: TaskType) => {
    setTaskType(task);
    setInput(EXAMPLE_INPUTS[task]);
    setResult(null);
  };

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-8">
      <header>
        <h1 className="text-3xl font-bold">Exercise 06: Structured Outputs</h1>
        <p className="text-gray-400 mt-2">
          Study <code className="text-blue-400">lib/structured.ts</code> - JSON extraction, Zod validation, repair loops.
        </p>
      </header>

      {/* Task Selection */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Task Type</h2>
        <div className="flex gap-2">
          {(['sentiment', 'entities', 'summary', 'custom'] as const).map((task) => (
            <button
              key={task}
              onClick={() => handleTaskChange(task)}
              className={`px-4 py-2 rounded ${
                taskType === task
                  ? 'bg-blue-600'
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              {task.charAt(0).toUpperCase() + task.slice(1)}
            </button>
          ))}
        </div>
      </section>

      {/* Input */}
      <section className="space-y-4 bg-gray-800 p-6 rounded-lg">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Input</h2>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-400">Max Retries:</label>
            <input
              type="number"
              value={maxRetries}
              onChange={(e) => setMaxRetries(Number(e.target.value))}
              className="w-16 bg-gray-900 border border-gray-700 rounded px-2 py-1"
              min={1}
              max={5}
            />
          </div>
        </div>

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="w-full h-32 bg-gray-900 border border-gray-700 rounded-lg p-3"
          placeholder="Enter text to analyze..."
        />

        <button
          onClick={runExtraction}
          disabled={isLoading || !input.trim()}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 rounded-lg font-medium"
        >
          {isLoading ? 'Extracting...' : 'Extract Structured Data'}
        </button>
      </section>

      {/* Schema Preview */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Expected Schema</h2>
        <pre className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-sm overflow-auto">
          {JSON.stringify(
            taskType === 'sentiment'
              ? { sentiment: 'positive | negative | neutral', confidence: 'number 0-1', reasons: 'string[] (optional)' }
              : taskType === 'entities'
              ? { entities: [{ text: 'string', type: 'person | organization | location | date | other' }] }
              : taskType === 'summary'
              ? { summary: 'string', keyPoints: 'string[]', wordCount: 'number' }
              : { result: 'string' },
            null,
            2
          )}
        </pre>
      </section>

      {/* Result */}
      {result && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Result</h2>

          <div className={`p-4 rounded-lg border ${
            result.success
              ? 'bg-green-900/20 border-green-700'
              : 'bg-red-900/20 border-red-700'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-sm font-medium ${result.success ? 'text-green-400' : 'text-red-400'}`}>
                {result.success ? 'Success' : 'Failed'}
              </span>
              <span className="text-sm text-gray-500">
                ({result.attempts} attempt{result.attempts !== 1 ? 's' : ''})
              </span>
            </div>

            {result.success ? (
              <pre className="bg-gray-900 p-3 rounded text-sm overflow-auto">
                {JSON.stringify(result.data, null, 2)}
              </pre>
            ) : (
              <p className="text-red-400">{result.error}</p>
            )}
          </div>

          {result.rawOutput && (
            <div className="space-y-2">
              <h3 className="font-medium">Raw LLM Output</h3>
              <pre className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-sm overflow-auto max-h-48">
                {result.rawOutput}
              </pre>
            </div>
          )}
        </section>
      )}

      {/* Generated Prompt */}
      {prompt && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Generated Prompt</h2>
          <pre className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-sm overflow-auto max-h-64">
            {prompt}
          </pre>
        </section>
      )}

      {/* Code Reference */}
      <section className="bg-gray-800 rounded-lg p-4 text-sm">
        <h3 className="font-semibold mb-2">Study the Code</h3>
        <ul className="space-y-1 text-gray-400">
          <li>
            <code className="text-blue-400">lib/structured.ts</code> - JSON extraction, validation, repair
          </li>
          <li>
            <code className="text-blue-400">lib/structured.test.ts</code> - Tests for extraction and schemas
          </li>
        </ul>
      </section>
    </main>
  );
}
